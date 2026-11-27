import { WHOLE, cutRegion, cutSize, fitCut, movedCut, shownSize } from './picture-cut';

const WIDE = { width: 3000, height: 1500 };
const TALL = { width: 1200, height: 1600 };
const FITTING = { width: 800, height: 600 };

describe('the cut of a picture', () => {
    it('lets a picture cover the frame: a wide one is wider than it, a tall one higher', () => {
        expect(shownSize(FITTING, 1)).toEqual({ width: 1, height: 1 });
        expect(shownSize(WIDE, 1)).toEqual({ width: 1.5, height: 1 });
        expect(shownSize(TALL, 1).width).toBe(1);
        expect(shownSize(TALL, 1).height).toBeCloseTo(16 / 9);
        expect(shownSize(WIDE, 2)).toEqual({ width: 3, height: 2 });
    });

    it('takes the middle of a picture when nothing was moved', () => {
        expect(cutRegion(WIDE, WHOLE)).toEqual({ x: 500, y: 0, width: 2000, height: 1500 });
        expect(cutRegion(FITTING, WHOLE)).toEqual({ x: 0, y: 0, width: 800, height: 600 });

        const tall = cutRegion(TALL, WHOLE);
        expect([tall.x, tall.width, tall.height]).toEqual([0, 1200, 900]);
        expect(tall.y).toBeCloseTo(350);
    });

    it('never moves the frame off the picture, and keeps the zoom between whole and four times', () => {
        expect(fitCut(WIDE, { x: 0, y: 0, zoom: 1 })).toEqual({ x: 1 / 3, y: 0.5, zoom: 1 });
        expect(fitCut(WIDE, { x: 1, y: 1, zoom: 1 }).x).toBeCloseTo(2 / 3);
        expect(fitCut(FITTING, { x: 0.2, y: 0.9, zoom: 0.3 })).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
        expect(fitCut(FITTING, { x: 0, y: 1, zoom: 9 })).toEqual({ x: 0.125, y: 0.875, zoom: 4 });
    });

    it('moves the picture under the frame by a share of the frame', () => {
        expect(movedCut(WIDE, WHOLE, 0.15, 0)).toEqual({ x: 0.4, y: 0.5, zoom: 1 });
        expect(movedCut(WIDE, WHOLE, -9, 0.3).x).toBeCloseTo(2 / 3);

        const closer = movedCut(FITTING, { x: 0.5, y: 0.5, zoom: 2 }, -0.2, 0.1);
        expect([closer.x, closer.y]).toEqual([0.6, 0.45]);
        expect(cutRegion(FITTING, closer)).toEqual({ x: 280, y: 120, width: 400, height: 300 });
    });

    it('keeps a cut at most 1600 wide, in the shape of a tile', () => {
        expect(cutSize({ width: 2000, height: 1500 })).toEqual({ width: 1600, height: 1200 });
        expect(cutSize({ width: 400, height: 300 })).toEqual({ width: 400, height: 300 });
    });
});
