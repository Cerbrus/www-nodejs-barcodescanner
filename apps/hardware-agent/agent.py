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
PASSIVE_TONE_HZ = 2400
SLEEP_ABOVE_SECONDS = 0.005
EVENT_STREAM_TIMEOUT_SECONDS = 60
BLIP, GAP = 0.06, 0.07


def on(seconds):
    return {'kind': 'on', 'seconds': seconds}


def off(seconds):
    return {'kind': 'off', 'seconds': seconds}


DEFAULT_SIGNALS = {
    'added': [on(0.08)],
    'incremented': [on(BLIP), off(GAP), on(BLIP)],
    'needs_name': [on(0.45)],
    'ignored': [],
    'error': [on(0.08), off(GAP), on(0.08), off(GAP), on(0.08)],
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

        self.high, self.low = Value.ACTIVE, Value.INACTIVE
        self.lines = gpiod.request_lines(GPIO_CHIP, consumer='barcodescanner', config={
            BUZZER_PIN: gpiod.LineSettings(direction=Direction.OUTPUT, output_value=self.low,
                                           active_low=BUZZER_ACTIVE_LOW),
        })

    def play(self, steps):
        try:
            for step in steps:
                kind, seconds = step['kind'], float(step['seconds'])
                if kind == 'off':
                    time.sleep(seconds)
                elif kind == 'gate':
                    self.gate(float(step.get('hz') or 10), float(step.get('duty') or 50), seconds)
                else:
                    self.sound(seconds)
        finally:
            self.write(False)

    def write(self, sounding):
        self.lines.set_value(BUZZER_PIN, self.high if sounding else self.low)

    def sound(self, seconds):
        if BUZZER_TYPE == 'passive':
            self.square_wave(PASSIVE_TONE_HZ, 50, seconds)
        else:
            self.write(True)
            time.sleep(seconds)
            self.write(False)

    def gate(self, hz, duty, seconds):
        if BUZZER_TYPE == 'passive' and hz < 100:
            period = 1 / hz
            for _ in range(max(1, round(seconds * hz))):
                self.square_wave(PASSIVE_TONE_HZ, 50, period * duty / 100)
                time.sleep(period * (100 - duty) / 100)
        else:
            self.square_wave(hz, duty, seconds)

    def square_wave(self, hz, duty, seconds):
        period = 1 / hz
        phases = ((True, period * duty / 100), (False, period * (100 - duty) / 100))
        end = time.perf_counter() + seconds
        while time.perf_counter() < end:
            for sounding, length in phases:
                self.write(sounding)
                if length > SLEEP_ABOVE_SECONDS:
                    time.sleep(length)
                else:
                    wake_at = time.perf_counter() + length
                    while time.perf_counter() < wake_at:
                        pass
        self.write(False)


class Feedback:
    def __init__(self):
        self.output = None
        self.signals_by_event = dict(DEFAULT_SIGNALS)
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
        threading.Thread(target=self.listen_for_tests, daemon=True).start()

    def signal(self, name):
        steps = self.signals_by_event.get(name)
        if steps:
            self.enqueue(name, steps)

    def load_settings(self):
        with urllib.request.urlopen(f'{API_BASE}/feedback/settings', timeout=API_TIMEOUT_SECONDS) as response:
            settings = json.load(response)
        self.signals_by_event = {row['event']: row['steps'] for row in settings['events']}
        log.info('feedback sounds: %s', ', '.join(f"{row['event']}={row['soundId']}" for row in settings['events']))

    def enqueue(self, name, steps):
        if not self.output:
            return
        try:
            self.signals.put_nowait((name, steps))
        except queue.Full:
            pass

    def work(self):
        while True:
            name, steps = self.signals.get()
            try:
                self.output.play(steps)
            except Exception as error:
                log.warning('feedback signal %s failed: %s', name, error)

    def listen_for_tests(self):
        while True:
            try:
                with urllib.request.urlopen(f'{API_BASE}/events', timeout=EVENT_STREAM_TIMEOUT_SECONDS) as stream:
                    self.load_settings()
                    event = ''
                    for raw in stream:
                        line = raw.decode(errors='replace').strip()
                        if line.startswith('event:'):
                            event = line[len('event:'):].strip()
                        elif line.startswith('data:') and event == 'feedback':
                            test = json.loads(line[len('data:'):])
                            log.info('test sound "%s" played', test.get('name'))
                            self.enqueue(test.get('name'), test.get('steps') or [])
                        elif line.startswith('data:') and event == 'feedback_settings':
                            self.load_settings()
                        elif not line:
                            event = ''
            except (urllib.error.URLError, OSError, ValueError, KeyError):
                pass
            time.sleep(RETRY_SECONDS)

    def demonstrate(self):
        if not self.output:
            print('feedback is off or not available; check FEEDBACK_OUTPUT and the log lines above')
            return
        try:
            self.load_settings()
        except (urllib.error.URLError, OSError, ValueError, KeyError) as error:
            print(f'settings not available ({error}), playing the built-in sounds')
        for name, steps in self.signals_by_event.items():
            print(name, '' if steps else '(no sound)')
            self.output.play(steps)
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
