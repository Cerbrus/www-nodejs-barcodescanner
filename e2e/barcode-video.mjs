import { writeFileSync } from 'node:fs';

const LEFT = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const WIDTH = 640;
const HEIGHT = 480;
const MODULE_PIXELS = 4;
const BAR_TOP = 90;
const BAR_BOTTOM = 390;
const WHITE = 235;
const BLACK = 16;
const NO_COLOUR = 128;

const complement = (bits) => [...bits].map((bit) => (bit === '1' ? '0' : '1')).join('');
const reverse = (bits) => [...bits].reverse().join('');

export function withCheckDigit(twelveDigits) {
    const sum = [...twelveDigits].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);

    return `${twelveDigits}${(10 - (sum % 10)) % 10}`;
}

function modules(code) {
    const digits = [...code].map(Number);
    const parity = PARITY[digits[0]];
    const left = digits.slice(1, 7).map((digit, index) => (parity[index] === 'L' ? LEFT[digit] : reverse(complement(LEFT[digit]))));
    const right = digits.slice(7).map((digit) => complement(LEFT[digit]));

    return `101${left.join('')}01010${right.join('')}101`;
}

export function writeBarcodeVideo(path, code) {
    const bars = modules(code);
    const start = Math.round((WIDTH - bars.length * MODULE_PIXELS) / 2);
    const luminance = Buffer.alloc(WIDTH * HEIGHT, WHITE);

    for (let y = BAR_TOP; y < BAR_BOTTOM; y++) {
        for (let index = 0; index < bars.length; index++) {
            if (bars[index] === '1') {
                luminance.fill(BLACK, y * WIDTH + start + index * MODULE_PIXELS, y * WIDTH + start + (index + 1) * MODULE_PIXELS);
            }
        }
    }

    const colour = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2) * 2, NO_COLOUR);
    const frame = Buffer.concat([Buffer.from('FRAME\n'), luminance, colour]);

    writeFileSync(path, Buffer.concat([Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F10:1 Ip A1:1 C420jpeg\n`), frame, frame]));
}
