export const CUT_SHAPE = 4 / 3;
export const MOST_ZOOM = 4;

const MOST_WIDTH = 1600;

export interface Cut {
    x: number;
    y: number;
    zoom: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface Region extends Size {
    x: number;
    y: number;
}

export const WHOLE: Cut = { x: 0.5, y: 0.5, zoom: 1 };

const between = (value: number, least: number, most: number): number => Math.min(most, Math.max(least, value));

export function shownSize({ width, height }: Size, zoom: number): Size {
    const wider = width / height / CUT_SHAPE;

    return { width: Math.max(wider, 1) * zoom, height: Math.max(1 / wider, 1) * zoom };
}

export function fitCut(picture: Size, { x, y, zoom }: Cut): Cut {
    const fitted = between(zoom, 1, MOST_ZOOM);
    const shown = shownSize(picture, fitted);
    const edge = { x: 0.5 / shown.width, y: 0.5 / shown.height };

    return { x: between(x, edge.x, 1 - edge.x), y: between(y, edge.y, 1 - edge.y), zoom: fitted };
}

export function movedCut(picture: Size, cut: Cut, across: number, down: number): Cut {
    const shown = shownSize(picture, cut.zoom);

    return fitCut(picture, { ...cut, x: cut.x - across / shown.width, y: cut.y - down / shown.height });
}

export function cutRegion(picture: Size, cut: Cut): Region {
    const { x, y, zoom } = fitCut(picture, cut);
    const shown = shownSize(picture, zoom);
    const width = picture.width / shown.width;
    const height = picture.height / shown.height;

    return { x: x * picture.width - width / 2, y: y * picture.height - height / 2, width, height };
}

export function cutSize({ width }: Size): Size {
    const kept = Math.round(Math.min(width, MOST_WIDTH));

    return { width: kept, height: Math.round(kept / CUT_SHAPE) };
}
