import { describeElement } from './remark-target';

describe('describeElement', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('numbers each step of the path by its position among its siblings', () => {
        document.body.innerHTML =
            '<app-system-page><div class="page"><div class="card"></div><div class="card"><div class="row"></div><div class="row"></div><div class="row"><button>Go</button></div></div></div></app-system-page>';
        const row = document.querySelectorAll('.row')[2];

        expect(describeElement(row).path).toBe('app-system-page#0 > div.page#0 > div.card#1 > div.row#2');
    });

    it('keeps only the last four steps', () => {
        document.body.innerHTML = '<section><div><div><div><div class="row"></div></div></div></div></section>';

        expect(describeElement(document.querySelector('.row') as Element).path).toBe(
            'div#0 > div#0 > div#0 > div.row#0'
        );
    });
});
