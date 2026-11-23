import { RecipeContent } from '@barcodescanner/shared';

import { recipeCodeModules } from '../components/recipe-code/recipe-code.component';

export const SHEET = {
    width: 210,
    height: 297,
    margin: 10,
    columns: 3,
    rows: 4,
    cellHeight: 69,
    code: 50,
    nameWidth: 56,
    nameSize: 3.6,
    nameLines: 2,
    edge: 5,
    markLength: 3.5,
    markGap: 1,
    markWidth: 0.2
};

const DOTS_A_MILLIMETRE = 8;
const QUIET_ZONE = 4;
const ELLIPSIS = '…';

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function sheetPages<T>(items: Array<T>): Array<Array<T>> {
    const perPage = SHEET.columns * SHEET.rows;

    return Array.from({ length: Math.ceil(items.length / perPage) }, (_, page) =>
        items.slice(page * perPage, (page + 1) * perPage)
    );
}

export function cellBox(index: number): Box {
    const width = (SHEET.width - SHEET.margin * 2) / SHEET.columns;

    return {
        x: SHEET.margin + (index % SHEET.columns) * width,
        y: SHEET.margin + Math.floor(index / SHEET.columns) * SHEET.cellHeight,
        width,
        height: SHEET.cellHeight
    };
}

export function cutMarks(): Array<Box> {
    const { margin, columns, rows, cellHeight, markLength: length, markGap: gap, markWidth: thickness } = SHEET;
    const cellWidth = (SHEET.width - margin * 2) / columns;
    const before = margin - gap - length;
    const across = Array.from({ length: columns + 1 }, (_, column) => margin + column * cellWidth - thickness / 2);
    const down = Array.from({ length: rows + 1 }, (_, row) => margin + row * cellHeight - thickness / 2);

    return [
        ...across.flatMap((x) => [
            { x, y: before, width: thickness, height: length },
            { x, y: margin + rows * cellHeight + gap, width: thickness, height: length }
        ]),
        ...down.flatMap((y) => [
            { x: before, y, width: length, height: thickness },
            { x: SHEET.width - margin + gap, y, width: length, height: thickness }
        ])
    ];
}

export function wrapName(name: string, fits: (text: string) => boolean): Array<string> {
    const lines: Array<string> = [];
    let words = name.split(/\s+/).filter((word) => word);

    while (words.length && lines.length < SHEET.nameLines) {
        let taken = 1;
        while (taken < words.length && fits(words.slice(0, taken + 1).join(' '))) {
            taken++;
        }
        lines.push(words.slice(0, taken).join(' '));
        words = words.slice(taken);
    }
    const cut = (line: string): string => {
        let kept = line;
        while (kept && !fits(`${kept}${ELLIPSIS}`)) {
            kept = kept.slice(0, -1);
        }

        return `${kept.trimEnd()}${ELLIPSIS}`;
    };

    return lines.map((line, row) => (!fits(line) || (words.length && row === lines.length - 1) ? cut(line) : line));
}

function drawCode(context: CanvasRenderingContext2D, recipe: RecipeContent, box: Box, ink: string): number {
    const modules = recipeCodeModules(recipe);
    const size = SHEET.code * DOTS_A_MILLIMETRE;
    const module = Math.floor(size / (modules.length + QUIET_ZONE * 2));
    const drawn = module * modules.length;
    const left = Math.round((box.x + box.width / 2) * DOTS_A_MILLIMETRE - drawn / 2);
    const top =
        Math.round((box.y + (box.height - SHEET.code - SHEET.nameSize * 3) / 2) * DOTS_A_MILLIMETRE) +
        module * QUIET_ZONE;

    context.fillStyle = ink;
    modules.forEach((row, y) =>
        row.forEach((dark, x) => {
            if (dark) {
                context.fillRect(left + x * module, top + y * module, module, module);
            }
        })
    );

    return top + drawn + module * QUIET_ZONE;
}

function drawCell(context: CanvasRenderingContext2D, recipe: RecipeContent, index: number, ink: string): void {
    const box = cellBox(index);
    const dots = (millimetres: number): number => millimetres * DOTS_A_MILLIMETRE;
    const below = drawCode(context, recipe, box, ink);

    context.font = `600 ${dots(SHEET.nameSize)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    wrapName(recipe.name, (text) => context.measureText(text).width <= dots(SHEET.nameWidth)).forEach((line, row) =>
        context.fillText(line, dots(box.x + box.width / 2), below + dots(1 + row * SHEET.nameSize * 1.25))
    );
}

function drawMarks(context: CanvasRenderingContext2D, ink: string): void {
    context.fillStyle = ink;
    cutMarks().forEach(({ x, y, width, height }) =>
        context.fillRect(
            Math.round(x * DOTS_A_MILLIMETRE),
            Math.round(y * DOTS_A_MILLIMETRE),
            Math.max(1, Math.round(width * DOTS_A_MILLIMETRE)),
            Math.max(1, Math.round(height * DOTS_A_MILLIMETRE))
        )
    );
}

export function sheetImages(recipes: Array<RecipeContent>, ink: string, paper: string): Array<Blob> {
    return sheetPages(recipes).flatMap((page) => {
        const canvas = document.createElement('canvas');
        canvas.width = SHEET.width * DOTS_A_MILLIMETRE;
        canvas.height = SHEET.height * DOTS_A_MILLIMETRE;
        const context = canvas.getContext('2d');
        if (!context) {
            return [];
        }

        context.fillStyle = paper;
        context.fillRect(0, 0, canvas.width, canvas.height);
        drawMarks(context, ink);
        page.forEach((recipe, index) => drawCell(context, recipe, index, ink));
        const bytes = atob(canvas.toDataURL('image/png').split(',')[1]);

        return [new Blob([Uint8Array.from(bytes, (character) => character.charCodeAt(0))], { type: 'image/png' })];
    });
}
