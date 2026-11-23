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
KEYS.update({f'KEY_{letter}': 300 + index for index, letter in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ')})
KEYS.update({f'KEY_{name}': 400 + index for index, name in enumerate([
    'GRAVE', 'MINUS', 'EQUAL', 'LEFTBRACE', 'RIGHTBRACE', 'BACKSLASH', 'SEMICOLON', 'APOSTROPHE', 'COMMA', 'DOT',
    'SLASH', 'SPACE'])})
KEYS.update(KEY_ENTER=28, KEY_KPENTER=96, KEY_TAB=15, KEY_LEFTSHIFT=42, KEY_RIGHTSHIFT=54, KEY_LEFTCTRL=29,
            KEY_RIGHTCTRL=97, KEY_LEFTALT=56, KEY_RIGHTALT=500, KEY_CAPSLOCK=58, KEY_NUMLOCK=69, KEY_F1=59)
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
    end_keys = {'\n': 'KEY_ENTER', '\t': 'KEY_TAB'}
    typed = {character: (code, shifted)
             for code, characters in agent.TYPED_KEYS.items() for shifted, character in enumerate(characters)}
    events = []
    for character in text:
        if character in end_keys:
            events.append(Event(KEYS[end_keys[character]]))
            continue
        code, shifted = typed[character]
        press = [Event(code), Event(code, KEY_UP)]
        shift = KEYS['KEY_LEFTSHIFT']
        events += [Event(shift), *press, Event(shift, KEY_UP)] if shifted else press
    return events


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
        self.assertEqual(next(self.scans), ('8710400335481', True))

    def test_keys_arriving_in_pieces_are_joined(self):
        self.device.feed(keys('8710'))
        self.device.feed(keys('4003'))
        self.device.feed(keys('35481\n'))
        self.assertEqual(next(self.scans), ('8710400335481', True))

    def test_keypad_digits_and_keypad_enter_count_too(self):
        self.device.feed([Event(KEYS[f'KEY_KP{digit}']) for digit in '12345670'] + [Event(KEYS['KEY_KPENTER'])])
        self.assertEqual(next(self.scans), ('12345670', True))

    def test_tab_ends_a_scan(self):
        self.device.feed(keys('12345670\t'))
        self.assertEqual(next(self.scans), ('12345670', True))

    def test_two_scans_in_one_read_are_kept_apart(self):
        self.device.feed(keys('11111111\n22222222\n'))
        self.assertEqual([next(self.scans), next(self.scans)], [('11111111', True), ('22222222', True)])

    def test_a_scan_without_end_key_is_delivered_after_a_pause(self):
        self.device.feed(keys('12345670'))
        started = time.monotonic()
        self.assertEqual(next(self.scans), ('12345670', True))
        self.assertGreaterEqual(time.monotonic() - started, agent.IDLE_SECONDS * 0.8)

    def test_key_releases_lock_keys_and_other_event_types_are_ignored(self):
        self.device.feed([Event(KEYS['KEY_NUMLOCK']), Event(KEYS['KEY_1']), Event(KEYS['KEY_1'], KEY_UP),
                          Event(KEYS['KEY_2'], kind=4), Event(KEYS['KEY_CAPSLOCK']), Event(KEYS['KEY_2']),
                          Event(KEYS['KEY_ENTER'])])
        self.assertEqual(next(self.scans), ('12', True))

    def test_every_printable_ascii_character_is_typed_back(self):
        text = ''.join(chr(code) for code in range(32, 127))
        self.device.feed(keys(f'{text}\n'))
        self.assertEqual(next(self.scans), (text, True))

    def test_a_digit_key_with_shift_is_a_symbol_and_not_a_digit(self):
        self.device.feed(keys('!@#$%^&*()\n'))
        self.assertEqual(next(self.scans), ('!@#$%^&*()', True))

    def test_shift_holds_until_it_is_released(self):
        shift = KEYS['KEY_RIGHTSHIFT']
        self.device.feed([Event(shift), Event(KEYS['KEY_A']), Event(KEYS['KEY_B']), Event(shift, KEY_UP),
                          Event(KEYS['KEY_C']), Event(KEYS['KEY_ENTER'])])
        self.assertEqual(next(self.scans), ('ABc', True))

    def test_a_recipe_code_is_typed_back_whole(self):
        code = 'R1;Pasta pesto;45*2:volkoren;112:cr%C3%A8me;87'
        self.device.feed(keys(f'{code}\n'))
        self.assertEqual(next(self.scans), (code, True))

    def test_an_alt_code_makes_the_scan_unreadable(self):
        alt_code = [Event(KEYS['KEY_LEFTALT'])] + [Event(KEYS[f'KEY_KP{digit}']) for digit in '50089']
        self.device.feed(keys('A') + alt_code + keys('B\n'))
        self.assertEqual(next(self.scans), ('A50089B', False))

    def test_a_key_that_types_nothing_makes_the_scan_unreadable(self):
        self.device.feed([Event(KEYS['KEY_F1'])] + keys('12345670\n'))
        self.assertEqual(next(self.scans), ('12345670', False))

    def test_the_next_scan_after_an_unreadable_one_is_readable_again(self):
        self.device.feed([Event(KEYS['KEY_LEFTCTRL'])] + keys('1\n12345670\n'))
        self.assertEqual([next(self.scans), next(self.scans)], [('1', False), ('12345670', True)])

    def test_an_end_key_without_keys_gives_no_scan(self):
        self.device.feed(keys('\n'))
        self.device.feed(keys('12345670\n'))
        self.assertEqual(next(self.scans), ('12345670', True))


class TellCodesApart(unittest.TestCase):
    def test_six_to_fourteen_digits_are_a_barcode(self):
        self.assertTrue(all(agent.is_code(code) for code in ['123456', '8710400335481', '12345678901234']))

    def test_fewer_or_more_digits_are_not(self):
        self.assertFalse(any(agent.is_code(code) for code in ['', '12345', '123456789012345']))

    def test_a_recipe_code_starts_with_the_letter_a_version_and_a_semicolon(self):
        self.assertTrue(all(agent.is_code(code) for code in ['R1;Pasta pesto;45', 'R2;']))

    def test_other_text_is_not_a_code(self):
        others = ['https://example.com/1234567', 'R;Pasta', 'r1;Pasta', 'R12;Pasta', '8710400335481a', ' 8710400335481']
        self.assertFalse(any(agent.is_code(code) for code in others))

    def test_a_long_text_is_cut_off_in_the_log(self):
        self.assertEqual(agent.shorten('12345670'), '12345670')
        self.assertEqual(agent.shorten('R1;' + 'x' * 60), 'R1;' + 'x' * 37 + '…')


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


class SendScans(unittest.TestCase):
    def setUp(self):
        self.api = FakeApi()
        self.addCleanup(self.api.close)
        self.addCleanup(setattr, agent, 'API_BASE', agent.API_BASE)
        self.addCleanup(setattr, agent, 'RETRY_SECONDS', agent.RETRY_SECONDS)
        agent.API_BASE = self.api.base
        agent.RETRY_SECONDS = 3600
        self.feedback = RecordingFeedback()
        self.sender = agent.ScanSender(self.feedback)

    def unreachable(self):
        agent.API_BASE = 'http://127.0.0.1:9/api/v1'

    def reachable(self, result='added'):
        agent.API_BASE = self.api.base
        self.api.answers['/api/v1/scans'] = (201, {'result': result, 'itemName': 'Melk'})

    def posted(self):
        return [request[3] for request in self.api.requests if request[1] == '/api/v1/scans']

    def test_a_scan_is_posted_with_the_agent_token_and_its_result_becomes_the_signal(self):
        self.reachable('incremented')
        self.sender.handle('8710400335481')

        method, path, token, body = self.api.requests[-1]
        self.assertEqual((method, path, token), ('POST', '/api/v1/scans', 'secret-for-tests'))
        self.assertEqual(body['code'], '8710400335481')
        self.assertNotIn('scannedAt', body)
        self.assertEqual(self.feedback.signals, ['incremented'])

    def test_a_barcode_and_a_recipe_code_are_posted(self):
        self.reachable()
        self.sender.receive('8710400335481', True)
        self.sender.receive('R1;Pasta pesto;45*2:volkoren', True)
        self.assertEqual([body['code'] for body in self.posted()], ['8710400335481', 'R1;Pasta pesto;45*2:volkoren'])

    def test_text_that_is_no_code_is_not_posted_and_gives_the_error_signal(self):
        self.reachable()
        self.sender.receive('https://example.com/1234567', True)
        self.sender.receive('12345', True)
        self.assertEqual(self.posted(), [])
        self.assertEqual(self.feedback.signals, ['error', 'error'])

    def test_an_unreadable_scan_is_not_posted_even_when_its_text_looks_like_a_barcode(self):
        self.reachable()
        self.sender.receive('1345790826', False)
        self.assertEqual(self.posted(), [])
        self.assertEqual(self.feedback.signals, ['error'])

    def test_a_refused_scan_gives_the_error_signal_and_is_not_kept(self):
        self.api.answers['/api/v1/scans'] = (400, {'message': 'code must match'})
        self.sender.handle('12')
        self.assertEqual(self.feedback.signals, ['error'])
        self.assertEqual(len(self.sender.held), 0)

    def test_a_scan_is_held_when_the_app_is_unreachable_and_delivered_with_its_time(self):
        self.unreachable()
        before = time.time()
        self.sender.handle('8710400335481')
        self.assertEqual(self.feedback.signals, ['held'])
        self.assertEqual(len(self.sender.held), 1)

        self.reachable()
        self.sender.deliver_once()
        self.assertEqual(len(self.sender.held), 0)
        self.assertEqual(self.feedback.signals, ['held'])
        sent = self.posted()[-1]
        self.assertEqual(sent['code'], '8710400335481')
        scanned = agent.datetime.fromisoformat(sent['scannedAt'].replace('Z', '+00:00')).timestamp()
        self.assertAlmostEqual(scanned, before, delta=2)

    def test_a_server_error_holds_the_scan_too(self):
        self.api.answers['/api/v1/scans'] = (502, {'message': 'bad gateway'})
        self.sender.handle('8710400335481')
        self.assertEqual(self.feedback.signals, ['held'])

    def test_held_scans_are_delivered_in_the_order_they_were_made(self):
        self.unreachable()
        self.sender.handle('11111111')
        self.reachable()
        self.sender.handle('22222222')
        self.assertEqual(self.posted(), [])
        self.assertEqual(self.feedback.signals, ['held', 'held'])

        self.sender.deliver_once()
        self.assertEqual([scan['code'] for scan in self.posted()], ['11111111', '22222222'])

    def test_delivery_stops_at_the_first_scan_that_still_fails(self):
        self.unreachable()
        self.sender.handle('11111111')
        self.sender.handle('22222222')
        self.sender.deliver_once()
        self.assertEqual(len(self.sender.held), 2)

    def test_a_held_scan_that_waited_too_long_is_dropped(self):
        self.unreachable()
        self.sender.handle('11111111')
        code, scanned_at = self.sender.held[0]
        self.sender.held[0] = (code, scanned_at - agent.HELD_SCAN_MAX_SECONDS - 5)
        self.reachable()
        self.sender.deliver_once()
        self.assertEqual(len(self.sender.held), 0)
        self.assertEqual(self.posted(), [])

    def test_more_scans_than_the_limit_are_refused_with_the_error_signal(self):
        self.unreachable()
        self.addCleanup(setattr, agent, 'HELD_SCANS_LIMIT', agent.HELD_SCANS_LIMIT)
        agent.HELD_SCANS_LIMIT = 2
        for code in ('11111111', '22222222', '33333333'):
            self.sender.handle(code)
        self.assertEqual(self.feedback.signals, ['held', 'held', 'error'])
        self.assertEqual(len(self.sender.held), 2)


class ScannerStatus(unittest.TestCase):
    def setUp(self):
        self.api = FakeApi()
        self.addCleanup(self.api.close)
        self.addCleanup(setattr, agent, 'API_BASE', agent.API_BASE)
        agent.API_BASE = self.api.base
        self.api.answers['/api/v1/agent/status'] = (204, {})

    def test_the_scanner_state_is_reported_with_the_agent_token(self):
        reporter = agent.StatusReporter()
        reporter.report('connected', 'HID 0581:011c')
        reporter.report('waiting')

        self.assertEqual([request[3] for request in self.api.requests],
                         [{'scanner': 'connected', 'device': 'HID 0581:011c'}, {'scanner': 'waiting'}])
        self.assertEqual(self.api.requests[0][2], 'secret-for-tests')

    def test_an_unreachable_api_does_not_stop_the_agent(self):
        agent.API_BASE = 'http://127.0.0.1:9/api/v1'
        agent.StatusReporter().report('connected', 'HID 0581:011c')


if __name__ == '__main__':
    unittest.main()
