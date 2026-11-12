import json
import logging
import os
import time
import urllib.error
import urllib.request

from evdev import InputDevice, ecodes

DEVICE_PATH = os.environ['SCANNER_DEVICE']
API_URL = os.environ.get('API_URL', 'http://app:3020/api/v1/scans')
RETRY_SECONDS = 2
API_TIMEOUT_SECONDS = 5

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


def post_scan(code):
    body = json.dumps({'code': code, 'source': 'handheld'}).encode()
    request = urllib.request.Request(API_URL, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=API_TIMEOUT_SECONDS) as response:
        return json.load(response)


def handle_scan(code):
    try:
        outcome = post_scan(code)
    except urllib.error.HTTPError as error:
        log.warning('scan %s rejected by the API: %s %s', code, error.code, error.read().decode(errors='replace'))
        return
    except (urllib.error.URLError, OSError, ValueError) as error:
        log.warning('scan %s not delivered: %s', code, error)
        return

    log.info('scan %s: %s %s', code, outcome.get('result'), outcome.get('itemName') or '')


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
