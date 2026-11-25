import { Skin } from './skins';

interface Season {
    skin: Skin;
    from: Date;
    to: Date;
}

const DAYS_BEFORE_EASTER = 14;

function easterSunday(year: number): Date {
    const century = Math.floor(year / 100);
    const golden = year % 19;
    const epact =
        (19 * golden +
            century -
            Math.floor(century / 4) -
            Math.floor((century - Math.floor((century + 8) / 25) + 1) / 3) +
            15) %
        30;
    const weekday = (32 + 2 * (century % 4) + 2 * Math.floor((year % 100) / 4) - epact - ((year % 100) % 4)) % 7;
    const correction = Math.floor((golden + 11 * epact + 22 * weekday) / 451);
    const total = epact + weekday - 7 * correction + 114;

    return new Date(year, Math.floor(total / 31) - 1, (total % 31) + 1);
}

function seasons(year: number): Array<Season> {
    const easter = easterSunday(year);

    return [
        {
            skin: 'easter',
            from: new Date(year, easter.getMonth(), easter.getDate() - DAYS_BEFORE_EASTER),
            to: new Date(year, easter.getMonth(), easter.getDate() + 1)
        },
        { skin: 'koningsdag', from: new Date(year, 3, 21), to: new Date(year, 3, 27) },
        { skin: 'halloween', from: new Date(year, 9, 24), to: new Date(year, 9, 31) },
        { skin: 'sinterklaas', from: new Date(year, 10, 14), to: new Date(year, 11, 5) },
        { skin: 'christmas', from: new Date(year, 11, 6), to: new Date(year, 11, 26) }
    ];
}

export function seasonSkin(now: Date): Skin | undefined {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return seasons(day.getFullYear()).find((season) => day >= season.from && day <= season.to)?.skin;
}
