import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readRecipePage } from './recipe-page';

const PAGE = 'https://food.example/recepten/soep';
const data = (value: unknown): string => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const SOUP = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Tomatensoep',
    recipeYield: '4 personen',
    image: 'https://static.food.example/soep.jpg',
    recipeIngredient: ['1 kg tomaten', ' 2 uien '],
    recipeInstructions: [
        { '@type': 'HowToStep', text: 'Snijd de uien.' },
        { '@type': 'HowToStep', text: 'Kook <b>20</b> minuten.' }
    ]
};

describe('the recipe data of a page', () => {
    it('reads the name, the servings, the ingredient lines and the steps as one text', () => {
        assert.deepEqual(readRecipePage(`<html><head>${data(SOUP)}</head></html>`, PAGE), {
            text: 'Tomatensoep\n4 personen\n1 kg tomaten\n2 uien\nSnijd de uien.\nKook 20 minuten.',
            picture: 'https://static.food.example/soep.jpg'
        });
    });

    it('finds the recipe among other data: in a list, in a graph, and with more than one type', () => {
        const other = { '@type': 'BreadcrumbList', itemListElement: [] };

        assert.match(readRecipePage(data([other, SOUP]), PAGE).text ?? '', /^Tomatensoep/);
        assert.match(readRecipePage(data({ '@graph': [other, SOUP] }), PAGE).text ?? '', /^Tomatensoep/);
        assert.match(
            readRecipePage(data(other) + data({ ...SOUP, '@type': ['Recipe', 'Thing'] }), PAGE).text ?? '',
            /^Tomatensoep/
        );
        assert.match(
            readRecipePage(`<script type="application/ld+json">{ kapot</script>${data(SOUP)}`, PAGE).text ?? '',
            /^Tomatensoep/
        );
    });

    it('takes the steps in every shape a site writes them', () => {
        const steps = (recipeInstructions: unknown): Array<string> =>
            (readRecipePage(data({ ...SOUP, recipeYield: undefined, recipeInstructions }), PAGE).text ?? '')
                .split('\n')
                .slice(3);

        assert.deepEqual(steps('Roer alles door elkaar.'), ['Roer alles door elkaar.']);
        assert.deepEqual(steps(['Snijd.', 'Kook.']), ['Snijd.', 'Kook.']);
        assert.deepEqual(
            steps([
                { '@type': 'HowToSection', name: 'Saus', itemListElement: [{ text: 'Roer.' }, { text: 'Proef.' }] },
                { '@type': 'HowToStep', name: 'Dien op.' }
            ]),
            ['Roer.', 'Proef.', 'Dien op.']
        );
        assert.deepEqual(steps(undefined), []);
    });

    it('writes signs as themselves and takes the first of several servings', () => {
        const page = readRecipePage(
            data({
                ...SOUP,
                name: 'Mac &amp; cheese',
                recipeYield: ['4', '4 porties'],
                recipeIngredient: ['200&nbsp;g kaas &#233;n &#x2019;room&#x2019;']
            }),
            PAGE
        );

        assert.equal(page.text?.split('\n').slice(0, 3).join('|'), 'Mac & cheese|4|200 g kaas én ’room’');
    });

    it('takes the picture of the recipe in every shape, else the one for link previews, and only an https address', () => {
        const picture = (image: unknown, head = ''): string =>
            readRecipePage(head + data({ ...SOUP, image }), PAGE).picture;
        const preview = '<meta content="https://static.food.example/voorbeeld.jpg" property="og:image">';

        assert.equal(
            picture(['https://static.food.example/a.jpg', 'https://static.food.example/b.jpg']),
            'https://static.food.example/a.jpg'
        );
        assert.equal(
            picture({ '@type': 'ImageObject', url: 'https://static.food.example/c.jpg' }),
            'https://static.food.example/c.jpg'
        );
        assert.equal(picture('/media/d.jpg'), 'https://food.example/media/d.jpg');
        assert.equal(picture(undefined, preview), 'https://static.food.example/voorbeeld.jpg');
        assert.equal(picture('http://static.food.example/e.jpg', preview), 'https://static.food.example/voorbeeld.jpg');
        assert.equal(picture('http://static.food.example/e.jpg'), '');
        assert.equal(
            picture(undefined, "<meta name='og:image' content='/media/f.jpg'>"),
            'https://food.example/media/f.jpg'
        );
    });

    it('gives no text for a page without a recipe or without ingredients, and still its preview picture', () => {
        const preview = '<meta property="og:image" content="https://static.food.example/voorbeeld.jpg" />';

        assert.deepEqual(readRecipePage(`<html>${preview}<p>geen recept</p></html>`, PAGE), {
            text: undefined,
            picture: 'https://static.food.example/voorbeeld.jpg'
        });
        assert.equal(readRecipePage(data({ ...SOUP, recipeIngredient: [] }), PAGE).text, undefined);
        assert.equal(readRecipePage(data({ ...SOUP, name: '' }), PAGE).text, undefined);
        assert.deepEqual(readRecipePage('', PAGE), { text: undefined, picture: '' });
    });
});
