import logging
import os
import time

from evdev import InputDevice, ecodes

DEVICE_PATH = os.environ['SCANNER_DEVICE']
RETRY_SECONDS = 2

DIGIT_KEYS = {
    **{getattr(ecodes, f'KEY_{digit}'): str(digit) for digit in range(10)},
    **{getattr(ecodes, f'KEY_KP{digit}'): str(digit) for digit in range(10)},
}
ENTER_KEYS = {ecodes.KEY_ENTER, ecodes.KEY_KPENTER}
KEY_DOWN = 1

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('hardware-agent')


def read_scans(device):
    digits = ''
    for event in device.read_loop():
        if event.type != ecodes.EV_KEY or event.value != KEY_DOWN:
            continue
        if event.code in ENTER_KEYS:
            if digits:
                yield digits
            digits = ''
        elif event.code in DIGIT_KEYS:
            digits += DIGIT_KEYS[event.code]


def handle_scan(code):
    log.info('scan %s', code)


def run():
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
                handle_scan(code)
        except OSError as error:
            log.warning('scanner disconnected (%s)', error)
        finally:
            try:
                device.close()
            except OSError:
                pass


if __name__ == '__main__':
    run()
