export interface InlineSegment {
    text: string;
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
    code?: boolean;
    href?: string;
}

export type MarkdownBlock =
    | { type: 'paragraph'; lines: Array<Array<InlineSegment>> }
    | { type: 'heading'; level: number; inline: Array<InlineSegment> }
    | { type: 'list'; ordered: boolean; items: Array<Array<InlineSegment>> }
    | { type: 'quote'; lines: Array<Array<InlineSegment>> }
    | { type: 'code'; text: string };

type Style = Omit<InlineSegment, 'text'>;

const INLINE =
    /`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(?!\s)(.+?)(?<!\s)\*\*|__(?!\s)(.+?)(?<!\s)__|~~(?!\s)(.+?)(?<!\s)~~|\*(?![\s*])(.+?)(?<![\s*])\*|(?<![\w])_(?![\s_])(.+?)(?<![\s_])_(?!\w)|(https?:\/\/[^\s<]+)/;
const TRAILING = /[.,;:!?)]+$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const FENCE = /^\s*```/;

export const parseInline = (text: string, style: Style = {}): Array<InlineSegment> => {
    const found = INLINE.exec(text);
    if (!found) {
        return text ? [{ ...style, text }] : [];
    }
    const [whole, code, label, href, bold, boldUnderscore, strike, italic, italicUnderscore, bare] = found;
    const before = text.slice(0, found.index);
    let match: Array<InlineSegment>;
    let consumed = whole;
    if (code !== undefined) {
        match = [{ ...style, text: code, code: true }];
    } else if (label !== undefined) {
        match = parseInline(label, { ...style, href });
    } else if (bold !== undefined || boldUnderscore !== undefined) {
        match = parseInline(bold ?? boldUnderscore, { ...style, bold: true });
    } else if (strike !== undefined) {
        match = parseInline(strike, { ...style, strike: true });
    } else if (italic !== undefined || italicUnderscore !== undefined) {
        match = parseInline(italic ?? italicUnderscore, { ...style, italic: true });
    } else {
        const url = bare.replace(TRAILING, '');
        consumed = url;
        match = [{ ...style, text: url, href: url }];
    }
    return [...parseInline(before, style), ...match, ...parseInline(text.slice(found.index + consumed.length), style)];
};

const isBlockStart = (line: string): boolean =>
    !line.trim() ||
    FENCE.test(line) ||
    HEADING.test(line) ||
    QUOTE.test(line) ||
    BULLET.test(line) ||
    NUMBERED.test(line);

export const parseMarkdown = (source: string): Array<MarkdownBlock> => {
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    const blocks: Array<MarkdownBlock> = [];
    let at = 0;
    while (at < lines.length) {
        const line = lines[at];
        const heading = HEADING.exec(line);
        const listPattern = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : undefined;
        if (!line.trim()) {
            at++;
        } else if (FENCE.test(line)) {
            const code: Array<string> = [];
            for (at++; at < lines.length && !FENCE.test(lines[at]); at++) {
                code.push(lines[at]);
            }
            at++;
            blocks.push({ type: 'code', text: code.join('\n') });
        } else if (heading) {
            blocks.push({ type: 'heading', level: heading[1].length, inline: parseInline(heading[2]) });
            at++;
        } else if (listPattern) {
            const items: Array<Array<InlineSegment>> = [];
            for (
                let item = listPattern.exec(lines[at]);
                item;
                item = at < lines.length ? listPattern.exec(lines[at]) : null
            ) {
                items.push(parseInline(item[1]));
                at++;
            }
            blocks.push({ type: 'list', ordered: listPattern === NUMBERED, items });
        } else if (QUOTE.test(line)) {
            const quoted: Array<Array<InlineSegment>> = [];
            for (let item = QUOTE.exec(lines[at]); item; item = at < lines.length ? QUOTE.exec(lines[at]) : null) {
                quoted.push(parseInline(item[1]));
                at++;
            }
            blocks.push({ type: 'quote', lines: quoted });
        } else {
            const paragraph: Array<Array<InlineSegment>> = [];
            for (; at < lines.length && (!paragraph.length || !isBlockStart(lines[at])); at++) {
                paragraph.push(parseInline(lines[at].trim()));
            }
            blocks.push({ type: 'paragraph', lines: paragraph });
        }
    }
    return blocks;
};
