import keyboard
import time
import re
import requests

apiEndpoint = 'http://localhost:5000/barcode/{}'
input = ''

def key_press(event):
    global input
    if re.match(r'[0-9]', event.name):
        input += event.name
    elif event.name == 'enter' and input and len(input) > 0:
        try:
            print('Scanned barcode:', input)
            result = requests.get(apiEndpoint.format(input))
            print('Result:', result.json())
        except Exception as e:
            print('Error sending request:', e)
        input = ''


keyboard.on_press(key_press)

while True:
    time.sleep(1)