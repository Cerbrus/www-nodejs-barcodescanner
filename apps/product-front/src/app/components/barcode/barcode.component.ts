import { Component, Signal, computed, input } from '@angular/core';

import { BARCODE_CONSTANTS as BC, Bar, BarcodeResult, Sizes, TBit, TParity } from './';

@Component({
    selector: 'app-barcode',
    templateUrl: './barcode.component.html',
    styleUrl: './barcode.component.scss',
    standalone: true
})
export class BarcodeComponent {
    public lockRatioInput = input(true, { alias: 'lockRatio' });
    public barcodeInput = input.required<number | string>({ alias: 'barcode' });
    public widthInput = input(300, { alias: 'width', transform: this.fixWidth.bind(this) });
    public heightInput = input(200, { alias: 'height', transform: this.fixHeight.bind(this) });

    protected sizes = computed(() => {
        const width = this.fixWidth(this.widthInput());
        const height = this.fixHeight(this.heightInput());

        return { width, height, font: Math.round(width / 15) } as Sizes;
    });

    protected encodeBarcode: Signal<BarcodeResult | undefined> = computed(() => {
        const input = this.barcodeInput()?.toString() ?? '';
        const barcode = input.length === 12 ? `0${input}` : input;

        if (!/^(\d{8}|\d{13})$/.test(barcode))
            return;

        const digits = [...barcode].map((c) => BC.encoding[Number(c)]);
        const isShort = digits.length === 8;
        const encoding = isShort ? undefined : digits[0];
        const left = isShort ? digits.slice(0, 4) : digits.slice(1, 7);
        const right = isShort ? digits.slice(4, 8) : digits.slice(7, 13);
        const parity = encoding ? BC.parity[encoding.I] : 'LLLL';

        const bars = [
            this.toBars(BC.guards.startEnd, true),
            left.map((encoded, i) => this.toBars(encoded[parity[i] as TParity], false)),
            this.toBars(BC.guards.center, true),
            right.map((encoded) => this.toBars(encoded.R, false)),
            this.toBars(BC.guards.startEnd, true)
        ].flat(2).reduce((bars, bar) => {
            const last = bars.at(-1);

            if (last && this.equals(last, bar))
                last.width++;
            else
                bars.push(bar);

            return bars;
        }, [] as Array<Bar>);

        const width = this.fixWidth(this.widthInput());
        const height = this.fixHeight(this.heightInput());

        return {
            input: barcode,
            encoding: encoding?.I,
            left: left.map(e => e.I).join(''),
            right: right.map(e => e.I).join(''),
            bars,
            sizes: {
                width,
                height,
                font: Math.round(width / 15)
            }
        };
    });

    private toBars(bits: string, isGuard: boolean): Array<Bar> {
        return [...bits].map((bit) => this.toBar(bit as TBit, isGuard));
    }

    private toBar(bit: TBit, isGuard: boolean) {
        return {
            bit,
            isGuard,
            width: 1,
            styling: {
                class: [bit === '1' ? 'bg-black' : 'bg-transparent', isGuard ? 'h-full' : ''],
                style: { height: `${isGuard ? '100%' : `calc(100% - ${this.sizes().font * 2}px)`}` }
            }
        };
    }

    private fixWidth(w: number) {
        return Math.max(w, 150);
    }

    private fixHeight(h: number) {
        return this.lockRatioInput()
            ? Math.round(this.widthInput() / 2)
            : Math.max(h, Math.round(this.widthInput() / 3.75));
    }

    private equals(a: Bar, b: Bar): boolean {
        return a.bit === b.bit && a.isGuard === b.isGuard;
    }
}


/*
3 areas for the start marker (101)
42 areas (seven per digit) to encode digits 2–7, and to encode digit 1 indirectly
5 areas for the center marker (01010)
42 areas (seven per digit) to encode digits 8–13
3 areas for the end marker (101)
*/

// 8715108060109
// 8710400335481
// 8718989028404
// 5011013100156
// 7622210475183
// 8719587008942
// 8712100840006
// 3387390321074

// https://en.wikipedia.org/wiki/International_Article_Number#Binary_encoding_of_data_digits_into_EAN-13_barcode
// http://www.gomaro.ch/Specifications/EAN13e.htm

