const MIN_COMPOUND_LENGTH = 4;
const MIN_PLURAL_S_LENGTH = 6;
const SHORT_ENDINGS = ['ei', 'ui'];

export interface NamedProduct {
    id: number;
    name: string;
}

const fold = (text: string): string =>
    text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

const words = (text: string): Array<string> =>
    fold(text)
        .split(/[^a-z]+/)
        .filter((word) => word.length > 1);

function withoutEnding(word: string): string {
    if (word.endsWith('eieren')) {
        return `${word.slice(0, -'eieren'.length)}ei`;
    }
    if (word.length > 4 && (word.endsWith('jes') || word.endsWith('tje'))) {
        return word.slice(0, -3);
    }
    if (word.length > 4 && word.endsWith('je')) {
        return word.slice(0, -2);
    }
    if (word.length > 3 && word.endsWith('en')) {
        return word.slice(0, -2);
    }
    if (word.length >= MIN_PLURAL_S_LENGTH && word.endsWith('s')) {
        return word.slice(0, -1);
    }

    return word.length > 4 && word.endsWith('e') ? word.slice(0, -1) : word;
}

export function stem(word: string): string {
    return withoutEnding(fold(word))
        .replace(/(aa|ee|oo|uu)(?=[^aeiou]$)/, (pair) => pair[0])
        .replace(/([^aeiou])\1$/, '$1')
        .replace(/v$/, 'f')
        .replace(/z$/, 's');
}

function inWord(nameStem: string, lineStem: string): boolean {
    if (lineStem === nameStem) {
        return true;
    }
    if (nameStem.length >= MIN_COMPOUND_LENGTH) {
        return lineStem.startsWith(nameStem) || lineStem.endsWith(nameStem);
    }

    return SHORT_ENDINGS.includes(nameStem) && lineStem.endsWith(nameStem);
}

export function fits(line: string, name: string): boolean {
    const lineStems = words(line).map(stem);
    const nameStems = words(name).map(stem);

    return (
        nameStems.length > 0 && nameStems.every((nameStem) => lineStems.some((lineStem) => inWord(nameStem, lineStem)))
    );
}

export function mostSpecific<T extends NamedProduct>(line: string, picked: T, products: Array<T>): T {
    const pickedStems = words(picked.name).map(stem);
    const narrower = products.filter(
        ({ id, name }) =>
            id !== picked.id &&
            words(name).map(stem).join(' ').length > pickedStems.join(' ').length &&
            pickedStems.every((pickedStem) => fold(name).includes(pickedStem)) &&
            fits(line, name)
    );

    return narrower.sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name))[0] ?? picked;
}
