import { SHEET, cellBox, cutMarks, sheetPages, wrapName } from './recipe-sheet-image';

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

    it('marks every cut with a short line at each end, outside the cells and inside what a printer reaches', () => {
        const marks = cutMarks();
        const cells = { left: 10, top: 10, right: 200, bottom: 286 };
        const inCells = (mark: { x: number; y: number; width: number; height: number }): boolean =>
            mark.x + mark.width > cells.left &&
            mark.x < cells.right &&
            mark.y + mark.height > cells.top &&
            mark.y < cells.bottom;

        expect(marks.length).toBe((3 + 1) * 2 + (4 + 1) * 2);
        expect(marks.filter(inCells)).toEqual([]);
        expect(
            marks.every(
                (mark) =>
                    mark.x >= SHEET.edge &&
                    mark.y >= SHEET.edge &&
                    mark.x + mark.width <= SHEET.width - SHEET.edge &&
                    mark.y + mark.height <= SHEET.height - SHEET.edge
            )
        ).toBe(true);
        expect(marks.filter((mark) => mark.height > mark.width).map((mark) => Math.round(mark.x * 10) / 10)).toEqual([
            9.9, 9.9, 73.2, 73.2, 136.6, 136.6, 199.9, 199.9
        ]);
        expect(marks.filter((mark) => mark.width > mark.height).map((mark) => Math.round(mark.y * 10) / 10)).toEqual([
            9.9, 9.9, 78.9, 78.9, 147.9, 147.9, 216.9, 216.9, 285.9, 285.9
        ]);
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
