import { seasonSkin } from './season';

const on = (year: number, month: number, day: number): string | undefined =>
    seasonSkin(new Date(year, month - 1, day, 15, 30));

describe('seasonSkin', () => {
    it('gives no theme outside the seasons', () => {
        expect([on(2026, 1, 15), on(2026, 7, 1), on(2026, 11, 13), on(2026, 12, 27)]).toEqual([
            undefined,
            undefined,
            undefined,
            undefined
        ]);
    });

    it('gives Easter from two weeks before Easter Sunday up to Easter Monday, in whatever month it falls', () => {
        expect([on(2026, 3, 21), on(2026, 3, 22), on(2026, 4, 5), on(2026, 4, 6), on(2026, 4, 7)]).toEqual([
            undefined,
            'easter',
            'easter',
            'easter',
            undefined
        ]);
        expect([on(2027, 3, 28), on(2027, 3, 29), on(2027, 3, 30)]).toEqual(['easter', 'easter', undefined]);
    });

    it("gives King's Day in the week up to 27 April", () => {
        expect([on(2026, 4, 20), on(2026, 4, 21), on(2026, 4, 27), on(2026, 4, 28)]).toEqual([
            undefined,
            'koningsdag',
            'koningsdag',
            undefined
        ]);
    });

    it('gives Halloween in the last week of October', () => {
        expect([on(2026, 10, 23), on(2026, 10, 24), on(2026, 10, 31), on(2026, 11, 1)]).toEqual([
            undefined,
            'halloween',
            'halloween',
            undefined
        ]);
    });

    it('gives Sinterklaas from 14 November to 5 December, and Christmas from the day after to 26 December', () => {
        expect([on(2026, 11, 14), on(2026, 11, 25), on(2026, 12, 5), on(2026, 12, 6), on(2026, 12, 26)]).toEqual([
            'sinterklaas',
            'sinterklaas',
            'sinterklaas',
            'christmas',
            'christmas'
        ]);
    });
});
