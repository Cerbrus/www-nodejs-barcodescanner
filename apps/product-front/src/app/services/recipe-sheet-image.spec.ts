import { SHEET, cellBox, sheetPages, wrapName } from './recipe-sheet-image';

const fitsIn =
    (characters: number) =>
    (text: string): boolean =>
        text.length <= characters;

describe('the sheet of recipe codes as a picture', () => {
    it('puts twelve codes on a page and the rest on the next', () => {
        const pages = sheetPages(Array.from({ length: 14 }, (_, index) => index));

        expect(pages.map((page) => page.length)).toEqual([12, 2]);
        expect(pages[1]).toEqual([12, 13]);
        expect(sheetPages([])).toEqual([]);
    });

    it('places the cells three across and four down inside the margins of an A4 page', () => {
        const width = (SHEET.width - SHEET.margin * 2) / 3;

        expect(cellBox(0)).toEqual({ x: 10, y: 10, width, height: 69 });
        expect(cellBox(2).x).toBeCloseTo(10 + width * 2);
        expect(cellBox(3)).toEqual({ x: 10, y: 79, width, height: 69 });

        const last = cellBox(11);
        expect(last.x + last.width).toBeCloseTo(SHEET.width - SHEET.margin);
        expect(last.y + last.height).toBeLessThanOrEqual(SHEET.height - SHEET.margin);
        expect(SHEET.code).toBeLessThan(width);
    });

    it('keeps a short name on one line and breaks a longer one between words', () => {
        expect(wrapName('Soep', fitsIn(20))).toEqual(['Soep']);
        expect(wrapName('Romige zalmwraps met avocado', fitsIn(20))).toEqual(['Romige zalmwraps met', 'avocado']);
    });

    it('cuts a name off after two lines with a mark that it goes on', () => {
        const lines = wrapName('Een recept met een lange naam die over twee regels moet lopen op het vel', fitsIn(20));

        expect(lines).toEqual(['Een recept met een', 'lange naam die over…']);
        expect(lines.every((line) => line.length <= 20)).toBe(true);
    });

    it('cuts one word that is too long by itself', () => {
        expect(wrapName('Hottentottententententoonstelling', fitsIn(12))).toEqual(['Hottentotte…']);
    });
});
