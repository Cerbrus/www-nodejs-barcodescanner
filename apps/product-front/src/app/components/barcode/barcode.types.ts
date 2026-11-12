export type TBit = '0' | '1';
export type TParity = 'L' | 'G' | 'R';
export type TByteString = `${TBit}${TBit}${TBit}${TBit}${TBit}${TBit}${TBit}`;
export type TEncoding = Record<TParity, TByteString> & { I: number };
