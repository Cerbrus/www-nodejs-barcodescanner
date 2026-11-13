import json
import os
import socket
import sys
import threading
import time
import types
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

KEYS = {f'KEY_{digit}': 100 + digit for digit in range(10)}
KEYS.update({f'KEY_KP{digit}': 200 + digit for digit in range(10)})
KEYS.update(KEY_ENTER=28, KEY_KPENTER=96, KEY_TAB=15, KEY_LEFTSHIFT=42, KEY_RIGHTSHIFT=54, KEY_LEFTCTRL=29,
            KEY_RIGHTCTRL=97, KEY_LEFTALT=56, KEY_RIGHTALT=100, KEY_CAPSLOCK=58, KEY_NUMLOCK=69, KEY_A=30)
EV_KEY, KEY_DOWN, KEY_UP = 1, 1, 0


class FakeLines:
    def __init__(self):
        self.writes = []

    def set_value(self, pin, value):
        self.writes.append(value)


def install_fakes():
    evdev = types.ModuleType('evdev')
    evdev.InputDevice = object
    evdev.ecodes = types.SimpleNamespace(EV_KEY=EV_KEY, KEY={}, **KEYS)
    gpiod = types.ModuleType('gpiod')
    line = types.ModuleType('gpiod.line')
    line.Value = types.SimpleNamespace(ACTIVE=1, INACTIVE=0)
    line.Direction = types.SimpleNamespace(OUTPUT='output')
    gpiod.line = line
    gpiod.LineSettings = lambda **settings: settings
    gpiod.requests = []

    def request_lines(chip, consumer, config):
        gpiod.requests.append((chip, config))
        return FakeLines()

    gpiod.request_lines = request_lines
    sys.modules.update({'evdev': evdev, 'gpiod': gpiod, 'gpiod.line': line})
    return gpiod


GPIOD = install_fakes()
os.environ.update(SCANNER_DEVICE='/dev/input/test', API_BASE='http://127.0.0.1:9/api/v1', AGENT_TOKEN='secret-for-tests',
                  FEEDBACK_OUTPUT='none', LOG_LEVEL='CRITICAL')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import agent  # noqa: E402


class Event:
    def __init__(self, code, value=KEY_DOWN, kind=EV_KEY):
        self.type, self.code, self.value = kind, code, value


def keys(text):
    names = {'\n': 'KEY_ENTER', '\t': 'KEY_TAB'}
    return [Event(KEYS[names.get(character, f'KEY_{character}')]) for character in text]


class FakeDevice:
    def __init__(self):
        self.reader, self.writer = socket.socketpair()
        self.fd = self.reader.fileno()
        self.batches = []

    def feed(self, events):
        self.batches.append(events)
        self.writer.send(b'x')

    def read(self):
        self.reader.recv(1)
        return self.batches.pop(0)

    def close(self):
        self.reader.close()
        self.writer.close()


class FakeApi:
    def __init__(self):
        self.requests = []
        self.answers = {}
        api = self

        class Handler(BaseHTTPRequestHandler):
            def respond(self):
                length = int(self.headers.get('Content-Length') or 0)
                body = json.loads(self.rfile.read(length)) if length else None
                api.requests.append((self.command, self.path, self.headers.get('X-Agent-Token'), body))
                status, answer = api.answers.get(self.path, (404, {'message': 'not found'}))
                payload = json.dumps(answer).encode()
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            do_GET = do_POST = respond

            def log_message(self, *args):
                pass

        self.server = HTTPServer(('127.0.0.1', 0), Handler)
        self.base = f'http://127.0.0.1:{self.server.server_port}/api/v1'
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


class RecordingFeedback:
    def __init__(self):
        self.signals = []

    def signal(self, name):
        self.signals.append(name)


class ReadScans(unittest.TestCase):
    def setUp(self):
        self.device = FakeDevice()
        self.scans = agent.read_scans(self.device)

    def tearDown(self):
        self.scans.close()
        self.device.close()

    def test_digits_and_enter_become_one_scan(self):
        self.device.feed(keys('8710400335481\n'))
        self.assertEqual(next(self.scans), '8710400335481')

    def test_keys_arriving_in_pieces_are_joined(self):
        self.device.feed(keys('8710'))
        self.device.feed(keys('4003'))
        self.device.feed(keys('35481\n'))
        self.assertEqual(next(self.scans), '8710400335481')

    def test_keypad_digits_and_keypad_enter_count_too(self):
        self.device.feed([Event(KEYS[f'KEY_KP{digit}']) for digit in '12345670'] + [Event(KEYS['KEY_KPENTER'])])
        self.assertEqual(next(self.scans), '12345670')

    def test_tab_ends_a_scan(self):
        self.device.feed(keys('12345670\t'))
        self.assertEqual(next(self.scans), '12345670')

    def test_two_scans_in_one_read_are_kept_apart(self):
        self.device.feed(keys('11111111\n22222222\n'))
        self.assertEqual([next(self.scans), next(self.scans)], ['11111111', '22222222'])

    def test_a_scan_without_end_key_is_delivered_after_a_pause(self):
        self.device.feed(keys('12345670'))
        started = time.monotonic()
        self.assertEqual(next(self.scans), '12345670')
        self.assertGreaterEqual(time.monotonic() - started, agent.IDLE_SECONDS * 0.8)

    def test_key_releases_modifiers_and_other_event_types_are_ignored(self):
        self.device.feed([Event(KEYS['KEY_LEFTSHIFT']), Event(KEYS['KEY_1']), Event(KEYS['KEY_1'], KEY_UP),
                          Event(KEYS['KEY_2'], kind=4), Event(KEYS['KEY_2']), Event(KEYS['KEY_ENTER'])])
        self.assertEqual(next(self.scans), '12')

    def test_letters_do_not_end_up_in_the_code(self):
        self.device.feed([Event(KEYS['KEY_A'])] + keys('12345670\n'))
        self.assertEqual(next(self.scans), '12345670')

    def test_an_end_key_without_digits_gives_no_scan(self):
        self.device.feed(keys('\n'))
        self.device.feed(keys('12345670\n'))
        self.assertEqual(next(self.scans), '12345670')


class BuzzerSounds(unittest.TestCase):
    def setUp(self):
        self.addCleanup(setattr, agent, 'BUZZER_TYPE', agent.BUZZER_TYPE)

    def test_an_active_buzzer_is_switched_on_and_off_per_step(self):
        agent.BUZZER_TYPE = 'active'
        buzzer = agent.Buzzer()
        buzzer.play([agent.on(0.01), agent.off(0.01), agent.on(0.01)])
        self.assertEqual(buzzer.lines.writes, [1, 0, 1, 0, 0])

    def test_gating_switches_many_times_and_ends_silent(self):
        agent.BUZZER_TYPE = 'active'
        buzzer = agent.Buzzer()
        buzzer.play([{'kind': 'gate', 'hz': 200, 'duty': 50, 'seconds': 0.05}])
        self.assertGreater(buzzer.lines.writes.count(1), 5)
        self.assertEqual(buzzer.lines.writes[-1], 0)

    def test_a_passive_buzzer_gets_a_square_wave_for_a_plain_beep(self):
        agent.BUZZER_TYPE = 'passive'
        buzzer = agent.Buzzer()
        buzzer.play([agent.on(0.02)])
        self.assertGreater(buzzer.lines.writes.count(1), 10)
        self.assertEqual(buzzer.lines.writes[-1], 0)

    def test_the_buzzer_ends_silent_when_a_step_is_broken(self):
        agent.BUZZER_TYPE = 'active'
        buzzer = agent.Buzzer()
        with self.assertRaises(KeyError):
            buzzer.play([agent.on(0.01), {'seconds': 0.01}])
        self.assertEqual(buzzer.lines.writes[-1], 0)

    def test_the_configured_pin_is_requested_as_output(self):
        agent.Buzzer()
        chip, config = GPIOD.requests[-1]
        self.assertEqual(chip, agent.GPIO_CHIP)
        self.assertEqual(config[agent.BUZZER_PIN]['direction'], 'output')


class FeedbackSettings(unittest.TestCase):
    def setUp(self):
        self.api = FakeApi()
        self.addCleanup(self.api.close)
        self.addCleanup(setattr, agent, 'API_BASE', agent.API_BASE)
        agent.API_BASE = self.api.base

    def test_feedback_is_off_by_default_and_ignores_signals(self):
        feedback = agent.Feedback()
        feedback.signal('added')
        self.assertIsNone(feedback.output)
        self.assertTrue(feedback.signals.empty())

    def test_settings_from_the_api_replace_the_built_in_sounds(self):
        self.api.answers['/api/v1/feedback/settings'] = (200, {'events': [
            {'event': 'added', 'soundId': 'tick', 'steps': [agent.on(0.02)]},
            {'event': 'error', 'soundId': 'none', 'steps': []},
        ]})
        feedback = agent.Feedback()
        feedback.output = object()
        feedback.load_settings()
        feedback.signal('added')
        feedback.signal('error')
        feedback.signal('never-heard-of')

        self.assertEqual(feedback.signals.get_nowait(), ('added', [agent.on(0.02)]))
        self.assertTrue(feedback.signals.empty())

    def test_a_full_queue_drops_the_signal_instead_of_blocking(self):
        feedback = agent.Feedback()
        feedback.output = object()
        for _ in range(agent.FEEDBACK_QUEUE_SIZE + 3):
            feedback.signal('added')
        self.assertEqual(feedback.signals.qsize(), agent.FEEDBACK_QUEUE_SIZE)


class HandleScan(unittest.TestCase):
    def setUp(self):
        self.api = FakeApi()
        self.addCleanup(self.api.close)
        self.addCleanup(setattr, agent, 'API_BASE', agent.API_BASE)
        agent.API_BASE = self.api.base
        self.feedback = RecordingFeedback()

    def test_a_scan_is_posted_with_the_agent_token_and_its_result_becomes_the_signal(self):
        self.api.answers['/api/v1/scans'] = (201, {'result': 'incremented', 'itemName': 'Melk'})
        agent.handle_scan('8710400335481', self.feedback)

        method, path, token, body = self.api.requests[-1]
        self.assertEqual((method, path, token), ('POST', '/api/v1/scans', 'secret-for-tests'))
        self.assertEqual(body['code'], '8710400335481')
        self.assertEqual(self.feedback.signals, ['incremented'])

    def test_a_refused_scan_gives_the_error_signal(self):
        self.api.answers['/api/v1/scans'] = (400, {'message': 'code must match'})
        agent.handle_scan('12', self.feedback)
        self.assertEqual(self.feedback.signals, ['error'])

    def test_an_unreachable_api_gives_the_error_signal(self):
        agent.API_BASE = 'http://127.0.0.1:9/api/v1'
        agent.handle_scan('8710400335481', self.feedback)
        self.assertEqual(self.feedback.signals, ['error'])


if __name__ == '__main__':
    unittest.main()
