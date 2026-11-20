import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const C = {
    teal: '#0f8a80',
    tealDark: '#0b6a62',
    brass: '#d9a441',
    red: '#c0392b',
    green: '#2f855a',
    iron: '#4b5563',
    wheel: '#7b8798',
    rail: '#8b95a5',
    steam: '#c9d1db',
    lamp: '#fde68a',
    wood: '#8a5a33'
};
const PITCH = 108;
const LOCO_AFTER_CARRIAGE = PITCH - 28;
const WIDTH = 640;
const SLEEPER = 22;

const style = `<style>
.spin{animation:spin 1.1s linear infinite}
.rod{animation:rod 1.1s linear infinite}
.puff{animation:puff 2.4s ease-out infinite;transform-box:fill-box;transform-origin:center}
.p2{animation-delay:.6s}.p3{animation-delay:1.2s}.p4{animation-delay:1.8s}
.wind{animation:wind .3s linear infinite}
.sleepers{animation:sleepers .24s linear infinite}
.wob{animation:wob 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes rod{0%{transform:translate(7px,0)}12.5%{transform:translate(5px,5px)}25%{transform:translate(0,7px)}37.5%{transform:translate(-5px,5px)}50%{transform:translate(-7px,0)}62.5%{transform:translate(-5px,-5px)}75%{transform:translate(0,-7px)}87.5%{transform:translate(5px,-5px)}100%{transform:translate(7px,0)}}
@keyframes puff{0%{transform:translate(0,0) scale(.5);opacity:.95}100%{transform:translate(-70px,-26px) scale(2.3);opacity:0}}
@keyframes wind{to{stroke-dashoffset:24}}
@keyframes sleepers{to{transform:translateX(-${SLEEPER}px)}}
@keyframes wob{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`;

const wheel = (cx, cy, r, spin) => {
    const spokes = [0, 45, 90, 135]
        .map((a) => `<line x1="${cx - r + 2}" y1="${cy}" x2="${cx + r - 2}" y2="${cy}" transform="rotate(${a} ${cx} ${cy})"/>`)
        .join('');
    return `<g${spin ? ` class="spin" style="transform-origin:${cx}px ${cy}px"` : ''} stroke="${C.wheel}" fill="none"><g stroke-width="1.5">${spokes}</g><circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="3" fill="${C.brass}" stroke="none"/></g>`;
};

const loco = ({ moving = false } = {}) => `
<rect x="28" y="92" width="116" height="8" rx="2" fill="${C.iron}"/>
<rect x="56" y="58" width="80" height="36" rx="16" fill="${C.teal}"/>
<rect x="74" y="58" width="4" height="36" fill="${C.brass}"/><rect x="108" y="58" width="4" height="36" fill="${C.brass}"/>
<rect x="126" y="55" width="15" height="41" rx="4" fill="${C.tealDark}"/>
<polygon points="128,55 124,30 142,30 138,55" fill="${C.iron}"/><rect x="121" y="25" width="24" height="6" rx="2" fill="${C.brass}"/>
<path d="M82 58a11 11 0 0 1 22 0z" fill="${C.brass}"/>
<rect x="26" y="42" width="36" height="52" rx="3" fill="${C.tealDark}"/><rect x="34" y="50" width="18" height="15" rx="2" fill="${C.lamp}"/>
<rect x="21" y="37" width="46" height="7" rx="3" fill="${C.iron}"/>
<polygon points="143,100 160,123 143,123" fill="${C.red}"/>
<circle cx="142" cy="68" r="4.5" fill="${C.lamp}"/>
${wheel(56, 108, 16, moving)}${wheel(94, 108, 16, moving)}${wheel(128, 115, 9, moving)}
<g${moving ? ' class="rod"' : ''}><rect x="52" y="105.5" width="46" height="5" rx="2.5" fill="${C.brass}"/></g>`;

const carriage = (fill, { moving = false, coupled = true } = {}) => `
${coupled ? `<rect x="90" y="94" width="${PITCH - 88}" height="5" rx="1" fill="${C.iron}"/><circle cx="${92 + (PITCH - 92) / 2}" cy="96.5" r="3" fill="${C.brass}"/>` : `<rect x="90" y="94" width="7" height="5" rx="1" fill="${C.iron}"/>`}
<rect x="6" y="97" width="80" height="6" rx="2" fill="${C.iron}"/>
<rect x="0" y="46" width="92" height="52" rx="6" fill="${fill}"/>
<rect x="-3" y="40" width="98" height="8" rx="4" fill="${C.iron}"/>
${[8, 29, 50, 71].map((x) => `<rect x="${x}" y="54" width="14" height="15" rx="2" fill="${C.lamp}"/>`).join('')}
<rect x="0" y="76" width="92" height="3" fill="${C.brass}"/><rect x="0" y="84" width="92" height="2" fill="${C.brass}" opacity=".6"/>
${wheel(22, 113, 10, moving)}${wheel(70, 113, 10, moving)}`;

const at = (x, inner) => `<g transform="translate(${x} 0)">${inner}</g>`;
const rail = (x1 = 0, x2 = WIDTH, moving = false) => {
    const count = Math.floor((x2 - x1) / SLEEPER) + (moving ? 2 : 0);
    const sleepers = Array.from({ length: count }, (_, i) => `<rect x="${x1 + 6 + i * SLEEPER}" y="127" width="10" height="4" rx="1" fill="${C.wood}"/>`).join('');
    return `<line x1="${x1}" y1="125" x2="${x2}" y2="125" stroke="${C.rail}" stroke-width="3" stroke-linecap="round"/><g${moving ? ' class="sleepers"' : ''}>${sleepers}</g>`;
};
const puffs = (x, y, n = 4) =>
    Array.from({ length: n }, (_, i) => `<circle class="puff p${i + 1}" cx="${x}" cy="${y}" r="9" fill="${C.steam}"/>`).join('');
const train = (x, count, moving, colours = [C.red, C.green]) => {
    const carriages = Array.from({ length: count }, (_, i) => at(x + i * PITCH, carriage(colours[i % colours.length], { moving }))).join('');
    return carriages + at(x + (count - 1) * PITCH + LOCO_AFTER_CARRIAGE, loco({ moving }));
};
const platform = (x1, x2, slope = true) =>
    `<rect x="${x1}" y="108" width="${x2 - x1}" height="17" fill="#98a1ad"/>${slope ? `<polygon points="${x2},106 ${x2 + 16},125 ${x2},125" fill="#98a1ad"/>` : ''}<rect x="${x1}" y="105" width="${x2 - x1 + (slope ? 2 : 0)}" height="4" rx="1" fill="#cdd3da"/>`;
const suitcase = (x) =>
    `<rect x="${x}" y="93" width="18" height="12" rx="2" fill="${C.wood}"/><path d="M${x + 5} 93v-4h8v4" fill="none" stroke="${C.wood}" stroke-width="2"/><rect x="${x}" y="97" width="18" height="2" fill="${C.brass}"/>`;
const bench = (x) =>
    `<rect x="${x}" y="94" width="40" height="4" rx="1" fill="${C.wood}"/><rect x="${x}" y="84" width="40" height="4" rx="1" fill="${C.wood}"/><rect x="${x + 4}" y="84" width="3" height="21" fill="${C.iron}"/><rect x="${x + 33}" y="84" width="3" height="21" fill="${C.iron}"/>`;
const svg = (title, body, box = `0 0 ${WIDTH} 150`) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${WIDTH}" height="${box.split(' ')[3]}" role="img" aria-label="${title}">${style}${body}</svg>`;

const tunnel = (x1, x2) => {
    const arch = (x) => `M${x - 16} 131V44a16 30 0 0 1 32 0V131`;
    const portal = (x) => `<path d="${arch(x)}z" fill="#1b2028"/><path d="${arch(x)}" fill="none" stroke="#cdd3da" stroke-width="4"/>`;
    return `<pattern id="bricks" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#9a5442"/><path d="M0 .5H24M0 6.5H24M.5 0V6M12.5 6V12" stroke="#d9c8b6" stroke-width="1" fill="none"/></pattern><rect x="${x1}" y="-40" width="${x2 - x1}" height="171" fill="url(#bricks)"/>${portal(x1 + 28)}${portal(x2 - 28)}`;
};
const clipped = (id, x1, x2, inner) =>
    `<clipPath id="${id}"><rect x="${x1}" y="0" width="${x2 - x1}" height="150"/></clipPath><g clip-path="url(#${id})">${inner}</g>`;

const scenes = {
    departing: svg(
        'A steam locomotive pulling two carriages out',
        `${rail(0, WIDTH, true)}
<g stroke="${C.rail}" stroke-width="3" stroke-linecap="round" stroke-dasharray="12 12" class="wind"><line x1="38" y1="62" x2="130" y2="62"/><line x1="14" y1="82" x2="122" y2="82"/><line x1="50" y1="102" x2="126" y2="102"/></g>
${puffs(471, 20)}
${train(150, 2, true)}`
    ),
    'left-on-the-platform': svg(
        'A lone carriage left at a stop signal while the train leaves through a tunnel',
        `${platform(0, 168)}
${suitcase(6)}
<rect x="150" y="40" width="5" height="66" fill="${C.iron}"/><rect x="152" y="42" width="34" height="9" rx="2" fill="${C.red}"/><rect x="178" y="42" width="5" height="9" fill="#fff"/><circle cx="152.5" cy="62" r="5" fill="${C.red}"/>
${tunnel(214, 356)}
${rail(0, 255)}${clipped('out', 315, WIDTH, rail(315, WIDTH, true))}
${at(36, carriage(C.red, { coupled: false }))}
${puffs(589, 20, 3)}${train(376, 1, true, [C.green])}`
    ),
    derailed: svg(
        'A locomotive off the rails, nose in the ground',
        at(
            40,
            `${rail(-40, 318)}
<path d="M318 125q16 -2 22 -16M478 125q-16 -2 -22 -16" fill="none" stroke="${C.rail}" stroke-width="3" stroke-linecap="round"/>${rail(478, 600)}
<ellipse cx="398" cy="131" rx="46" ry="9" fill="${C.wood}" opacity=".55"/>
${at(104, carriage(C.green, { coupled: false }))}
<g transform="translate(232 -2) rotate(15 56 124)">${loco()}</g>
<g fill="${C.brass}" class="wob"><polygon points="438,62 441,70 450,71 443,76 446,85 438,80 430,85 433,76 426,71 435,70"/></g>
<g fill="${C.brass}"><polygon points="474,58 476,63 482,64 477,67 479,73 474,70 469,73 471,67 466,64 472,63"/><polygon points="412,58 413.5,62 418,62.5 414.5,65 416,69 412,67 408,69 409.5,65 406,62.5 410.5,62"/></g>
<g transform="translate(484 74)"><polygon points="20,0 40,36 0,36" fill="${C.brass}"/><rect x="18" y="12" width="4" height="13" rx="2" fill="#1f2937"/><circle cx="20" cy="30" r="2.5" fill="#1f2937"/></g>`
        )
    ),
    arrived: svg(
        'The train standing at a platform under a station canopy with bunting',
        at(
            35,
            `<g fill="${C.iron}"><rect x="78" y="0" width="6" height="106"/><rect x="516" y="0" width="6" height="106"/></g>
<polygon points="60,2 540,2 528,-14 72,-14" fill="${C.tealDark}"/><rect x="60" y="0" width="480" height="5" fill="${C.brass}"/>
${Array.from({ length: 23 }, (_, i) => `<polygon points="${66 + i * 20.5},5 ${86.5 + i * 20.5},5 ${76.25 + i * 20.5},18" fill="${[C.red, C.brass, C.green][i % 3]}"/>`).join('')}
<line x1="110" y1="5" x2="110" y2="26" stroke="${C.iron}" stroke-width="2"/><line x1="166" y1="5" x2="166" y2="26" stroke="${C.iron}" stroke-width="2"/>
<rect x="92" y="26" width="92" height="20" rx="3" fill="#1f2937" stroke="${C.brass}" stroke-width="2"/><text x="138" y="40.5" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="13" font-weight="700" letter-spacing="2" fill="#f8fafc">MASTER</text>
<line x1="207" y1="5" x2="207" y2="23" stroke="${C.iron}" stroke-width="2"/><circle cx="207" cy="36" r="13" fill="#f8fafc" stroke="${C.iron}" stroke-width="3"/><path d="M207 36v-8M207 36l6 3" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
${platform(60, 540, false)}${bench(118)}${suitcase(166)}
${rail(-35, 605)}
${train(250, 1, false)}`
        ),
        `0 -18 ${WIDTH} 168`
    )
};

for (const [name, text] of Object.entries(scenes)) {
    writeFileSync(join(here, `${name}.svg`), `${text.replace(/\n/g, '')}\n`);
}
