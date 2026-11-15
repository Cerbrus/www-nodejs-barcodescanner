import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const OUTPUT = 'apps/product-front/src/assets/changelog.json';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const lines = (text) => text.split('\n').filter(Boolean);

const tags = lines(git('tag', '--list', 'v*'));
const releases = tags.map((tag) => {
    const previous = (() => {
        try {
            return git('describe', '--tags', '--abbrev=0', '--match', 'v*', `${tag}^`);
        } catch {
            return undefined;
        }
    })();
    const notes = lines(git('log', '--no-merges', '--format=%s', previous ? `${previous}..${tag}` : tag));

    return {
        version: tag.slice(1),
        released: git('log', '-1', '--format=%cI', tag),
        summary: notes[0] ?? tag,
        notes
    };
});

releases.sort((a, b) => Date.parse(b.released) - Date.parse(a.released));
writeFileSync(OUTPUT, `${JSON.stringify(releases, null, 4)}\n`);
console.log(`${releases.length} releases written to ${OUTPUT}`);
