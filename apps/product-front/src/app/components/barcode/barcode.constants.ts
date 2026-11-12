import { TEncoding, TParity } from './barcode.types';

const BARCODE_CONSTANTS = {
    parity: [
        'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL',
        'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG',
        'LGLGGL', 'LGGLGL'
    ] as Array<`${TParity}${TParity}${TParity}${TParity}${TParity}${TParity}`>,
    encoding: [
        { I: 0, L: '0001101', G: '0100111', R: '1110010' },
        { I: 1, L: '0011001', G: '0110011', R: '1100110' },
        { I: 2, L: '0010011', G: '0011011', R: '1101100' },
        { I: 3, L: '0111101', G: '0100001', R: '1000010' },
        { I: 4, L: '0100011', G: '0011101', R: '1011100' },
        { I: 5, L: '0110001', G: '0111001', R: '1001110' },
        { I: 6, L: '0101111', G: '0000101', R: '1010000' },
        { I: 7, L: '0111011', G: '0010001', R: '1000100' },
        { I: 8, L: '0110111', G: '0001001', R: '1001000' },
        { I: 9, L: '0001011', G: '0010111', R: '1110100' }
    ] as Array<TEncoding>,
    guards: {
        startEnd: '101',
        center: '01010'
    }
} as const;

export { BARCODE_CONSTANTS };
