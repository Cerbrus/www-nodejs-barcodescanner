import { RemarkTarget } from '../models';

const MEANINGFUL = 'app-item-tile, button, a, input, select, textarea, [role="option"], .card, .row, .toast, h1, h2';
const TEXT_FIELD = 'input, textarea, select';
const MAX_TEXT_LENGTH = 120;
const MAX_PATH_STEPS = 4;
const GENERATED_CLASS = /^(ng-|_ng|ng_)/;

export function isTextField(element: Element | null): boolean {
    return element?.closest(TEXT_FIELD) !== null && element !== null;
}

export function describeElement(element: Element): RemarkTarget {
    const subject = element.closest(MEANINGFUL) ?? element;
    const component = componentOf(subject);

    return withoutEmpty({
        component,
        label: subject.getAttribute('aria-label') ?? subject.getAttribute('title') ?? undefined,
        text: textOf(subject),
        path: pathTo(subject)
    });
}

function componentOf(element: Element): string | undefined {
    for (let current: Element | null = element; current; current = current.parentElement) {
        if (current.tagName.toLowerCase().startsWith('app-')) {
            return current.tagName.toLowerCase();
        }
    }

    return undefined;
}

function textOf(element: Element): string | undefined {
    const text = element.matches(TEXT_FIELD) ? (element.getAttribute('placeholder') ?? element.getAttribute('name') ?? '') : (element.textContent ?? '');

    return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH) || undefined;
}

function pathTo(element: Element): string {
    const steps: Array<string> = [];
    for (let current: Element | null = element; current && steps.length < MAX_PATH_STEPS && current !== document.body; current = current.parentElement) {
        const name = Array.from(current.classList).find((className) => !GENERATED_CLASS.test(className));
        steps.unshift(`${current.tagName.toLowerCase()}${name ? `.${name}` : ''}`);
    }

    return steps.join(' > ');
}

function withoutEmpty(target: RemarkTarget): RemarkTarget {
    return Object.fromEntries(Object.entries(target).filter(([, value]) => value)) as RemarkTarget;
}
