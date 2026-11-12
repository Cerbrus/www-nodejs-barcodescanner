import json
import logging
import os
import queue
import select
import sys
import threading
import time
import urllib.error
import urllib.request

from evdev import InputDevice, ecodes

DEVICE_PATH = os.environ.get('SCANNER_DEVICE', '')
API_BASE = os.environ.get('API_BASE', 'http://app:3020/api/v1')
RETRY_SECONDS = 2
API_TIMEOUT_SECONDS = 5
LOG_DELIVERY_ATTEMPTS = 5
LOG_QUEUE_SIZE = 200
API_LOG_LEVELS = {'info', 'warning', 'error'}

DIGIT_KEYS = {
    **{getattr(ecodes, f'KEY_{digit}'): str(digit) for digit in range(10)},
    **{getattr(ecodes, f'KEY_KP{digit}'): str(digit) for digit in range(10)},
}
END_KEYS = {ecodes.KEY_ENTER, ecodes.KEY_KPENTER, ecodes.KEY_TAB}
MODIFIER_KEYS = {ecodes.KEY_LEFTSHIFT, ecodes.KEY_RIGHTSHIFT, ecodes.KEY_LEFTCTRL, ecodes.KEY_RIGHTCTRL,
                 ecodes.KEY_LEFTALT, ecodes.KEY_RIGHTALT, ecodes.KEY_CAPSLOCK, ecodes.KEY_NUMLOCK}
KEY_DOWN = 1
IDLE_SECONDS = 0.3

FEEDBACK_OUTPUT = os.environ.get('FEEDBACK_OUTPUT', 'none').lower() or 'none'
GPIO_CHIP = os.environ.get('GPIO_CHIP') or '/dev/gpiochip0'
BUZZER_PIN = int(os.environ.get('BUZZER_PIN') or 18)
BUZZER_TYPE = (os.environ.get('BUZZER_TYPE') or 'active').lower()
BUZZER_ACTIVE_LOW = (os.environ.get('BUZZER_ACTIVE_LOW') or 'false').lower() in ('1', 'true', 'yes')
FEEDBACK_QUEUE_SIZE = 4
HIGH_TONE_HZ = 2400
LOW_TONE_HZ = 900
SIGNALS = {
    'added': [(HIGH_TONE_HZ, 0.08, 0)],
    'incremented': [(HIGH_TONE_HZ, 0.06, 0.07), (HIGH_TONE_HZ, 0.06, 0)],
    'needs_name': [(LOW_TONE_HZ, 0.45, 0)],
    'error': [(LOW_TONE_HZ, 0.08, 0.07), (LOW_TONE_HZ, 0.08, 0.07), (LOW_TONE_HZ, 0.08, 0)],
}

logging.basicConfig(level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
                    format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('hardware-agent')


def post_json(path, payload):
    body = json.dumps(payload).encode()
    request = urllib.request.Request(f'{API_BASE}{path}', data=body, headers={'Content-Type': 'application/json'})
    return urllib.request.urlopen(request, timeout=API_TIMEOUT_SECONDS)


class ApiLogHandler(logging.Handler):
    def __init__(self):
        super().__init__(level=logging.INFO)
        self.lines = queue.Queue(maxsize=LOG_QUEUE_SIZE)
        threading.Thread(target=self.deliver, daemon=True).start()

    def emit(self, record):
        level = record.levelname.lower()
        try:
            self.lines.put_nowait({'level': level if level in API_LOG_LEVELS else 'info', 'message': record.getMessage()})
        except queue.Full:
            pass

    def deliver(self):
        while True:
            line = self.lines.get()
            for _ in range(LOG_DELIVERY_ATTEMPTS):
                try:
                    post_json('/logs', line).close()
                    break
                except (urllib.error.URLError, OSError):
                    time.sleep(RETRY_SECONDS)


log.addHandler(ApiLogHandler())


def read_scans(device):
    digits = ''
    other_keys = 0
    while True:
        waiting_for_end = digits or other_keys
        ready, _, _ = select.select([device.fd], [], [], IDLE_SECONDS if waiting_for_end else None)
        if not ready:
            if other_keys:
                log.warning('scan without end key: %d digits "%s" and %d other keys', len(digits), digits, other_keys)
            if digits:
                yield digits
            digits, other_keys = '', 0
            continue

        for event in device.read():
            if event.type != ecodes.EV_KEY or event.value != KEY_DOWN:
                continue
            log.debug('key %s', ecodes.KEY.get(event.code, event.code))
            if event.code in END_KEYS:
                if other_keys:
                    log.warning('scan with %d non-digit keys, digits "%s"', other_keys, digits)
                if digits:
                    yield digits
                digits, other_keys = '', 0
            elif event.code in DIGIT_KEYS:
                digits += DIGIT_KEYS[event.code]
            elif event.code not in MODIFIER_KEYS:
                other_keys += 1


class Buzzer:
    def __init__(self):
        import gpiod
        from gpiod.line import Direction, Value

        self.on, self.off = Value.ACTIVE, Value.INACTIVE
        self.lines = gpiod.request_lines(GPIO_CHIP, consumer='barcodescanner', config={
            BUZZER_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=self.off,
                                           active_low=BUZZER_ACTIVE_LOW),
        })

    def play(self, beeps):
        for frequency, on_seconds, off_seconds in beeps:
            if BUZZER_TYPE == 'passive':
                self.tone(frequency, on_seconds)
            else:
                self.lines.set_value(BUZZER_PIN, self.on)
                time.sleep(on_seconds)
            self.lines.set_value(BUZZER_PIN, self.off)
            time.sleep(off_seconds)

    def tone(self, frequency, seconds):
        half_period = 1 / (2 * frequency)
        end = time.perf_counter() + seconds
        level = self.on
        while time.perf_counter() < end:
            self.lines.set_value(BUZZER_PIN, level)
            level = self.off if level == self.on else self.on
            flip_at = time.perf_counter() + half_period
            while time.perf_counter() < flip_at:
                pass


class Feedback:
    def __init__(self):
        self.output = None
        self.signals = queue.Queue(maxsize=FEEDBACK_QUEUE_SIZE)
        if FEEDBACK_OUTPUT == 'none':
            return
        if FEEDBACK_OUTPUT != 'buzzer':
            log.warning('unknown FEEDBACK_OUTPUT "%s", feedback is off', FEEDBACK_OUTPUT)
            return

        try:
            self.output = Buzzer()
        except Exception as error:
            log.warning('buzzer on %s pin %d not available (%s), feedback is off', GPIO_CHIP, BUZZER_PIN, error)
            return

        log.info('feedback: %s buzzer on GPIO %d%s', BUZZER_TYPE, BUZZER_PIN, ', active low' if BUZZER_ACTIVE_LOW else '')
        threading.Thread(target=self.work, daemon=True).start()

    def signal(self, name):
        if not self.output or name not in SIGNALS:
            return
        try:
            self.signals.put_nowait(name)
        except queue.Full:
            pass

    def work(self):
        while True:
            name = self.signals.get()
            try:
                self.output.play(SIGNALS[name])
            except Exception as error:
                log.warning('feedback signal %s failed: %s', name, error)

    def demonstrate(self):
        if not self.output:
            print('feedback is off or not available; check FEEDBACK_OUTPUT and the log lines above')
            return
        for name, beeps in SIGNALS.items():
            print(name)
            self.output.play(beeps)
            time.sleep(1)


def post_scan(code):
    with post_json('/scans', {'code': code, 'source': 'handheld'}) as response:
        return json.load(response)


def handle_scan(code, feedback):
    try:
        outcome = post_scan(code)
    except urllib.error.HTTPError as error:
        log.warning('scan %s rejected by the API: %s %s', code, error.code, error.read().decode(errors='replace'))
        feedback.signal('error')
        return
    except (urllib.error.URLError, OSError, ValueError) as error:
        log.warning('scan %s not delivered: %s', code, error)
        feedback.signal('error')
        return

    feedback.signal(outcome.get('result'))
    log.info('scan %s: %s %s', code, outcome.get('result'), outcome.get('itemName') or '')


def run():
    feedback = Feedback()
    waiting_logged = False
    while True:
        try:
            device = InputDevice(DEVICE_PATH)
            device.grab()
        except OSError as error:
            if not waiting_logged:
                log.warning('scanner not available at %s (%s), waiting', DEVICE_PATH, error)
                waiting_logged = True
            time.sleep(RETRY_SECONDS)
            continue

        waiting_logged = False
        log.info('scanner connected: %s (%s)', device.name, DEVICE_PATH)
        try:
            for code in read_scans(device):
                handle_scan(code, feedback)
        except OSError as error:
            log.warning('scanner disconnected (%s)', error)
        finally:
            try:
                device.close()
            except OSError:
                pass


if __name__ == '__main__':
    if '--test-feedback' in sys.argv:
        Feedback().demonstrate()
    else:
        run()
