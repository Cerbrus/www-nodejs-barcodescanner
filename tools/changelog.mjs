import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUTPUT = 'apps/product-front/src/assets/changelog.json';
const USER_FACING = [
    'apps',
    'data',
    'deployment',
    'Dockerfile',
    ':(exclude,glob)**/*.spec.ts',
    ':(exclude,glob)**/test/**',
    ':(exclude,glob)**/testing/**'
];

if (process.argv.includes('--hash')) {
    process.stdout.write(existsSync(OUTPUT) ? createHash('sha256').update(readFileSync(OUTPUT)).digest('hex') : 'none');
    process.exit(0);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const lines = (text) => text.split('\n').filter(Boolean);
const subjects = (range, paths = []) =>
    lines(git('log', '--no-merges', '--reverse', '--format=%s', range, '--', ...paths));
const upcoming = process.argv.includes('--upcoming') ? process.argv[process.argv.indexOf('--upcoming') + 1] : undefined;

const previousTag = (ref) => {
    try {
        return git('describe', '--tags', '--abbrev=0', '--match', 'v*', ref);
    } catch {
        return undefined;
    }
};

const release = (version, ref, released) => {
    const previous = previousTag(`${ref}^`);
    const range = previous ? `${previous}..${ref}` : ref;
    const shown = subjects(range, USER_FACING);
    const notes = shown.length ? shown : subjects(range);

    return { version, released, summary: notes[0] ?? version, notes };
};

const releases = lines(git('tag', '--list', 'v*')).map((tag) =>
    release(tag.slice(1), tag, git('log', '-1', '--format=%cI', tag))
);

if (upcoming && !releases.some((entry) => entry.version === upcoming)) {
    const head = release(upcoming, 'HEAD', new Date().toISOString());
    if (head.notes.length) {
        releases.push(head);
    }
}

releases.sort((a, b) => Date.parse(b.released) - Date.parse(a.released));
writeFileSync(OUTPUT, `${JSON.stringify(releases, null, 4)}\n`);
console.log(`${releases.length} releases written to ${OUTPUT}`);
