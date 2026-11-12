import { TBit } from './barcode.types';

export interface BarcodeResult {
    input: number | string;
    encoding: number;
    left: string;
    right: string;
    bars: Array<Bar>;
    sizes: Sizes;
}

export interface Bar {
    bit: TBit;
    isGuard: boolean;
    styling: BarStyling;
    width: number;
}

export interface BarStyling {
    class: Array<string>;
    style?: Partial<CSSStyleDeclaration>;
}

export interface Sizes {
    width: number;
    height: number;
    font: number;
}
