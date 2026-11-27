# 0130. The Recipes page shows a recipe as a tile with its picture

- Status: accepted
- Date: 2026-11-28
- Decided by: the owner
- Changes one part of [0101](0101-recipes-tab-and-pages.md) and [0127](0127-recipe-categories.md): a recipe on the Recipes page is a tile, no longer a row

## Context

The Recipes page lists recipes as rows in a card per category: the name, the number of products with their icons, and a button that puts the recipe on the list ([0101](0101-recipes-tab-and-pages.md), [0127](0127-recipe-categories.md)). With a picture per recipe ([0129](0129-recipe-pictures.md)) the owner wants tiles, laid out like the shopping list with its sections.

The list page has tiles of at least 96 pixels wide, three to four beside each other on a phone, with an icon above the name.

The owner first drew a tile with the name and the products over the top of the picture and the button at the bottom right. Layouts were then drawn at phone width, with the app's colours and icons and pictures of recipe pages, light and dark ones, and the chosen one was drawn in all 31 themes from the app's own theme files, in light and dark. The owner chose from those.

## Options weighed

- **Text over the top of the picture**, on a dark fade, as the owner drew it. The text covers the top third of the dish.
- **Text over the bottom of the picture**, with the button at the top right.
- **A caption under the picture**: the picture stays clean, the name and the products are on the card below it. Tried with the icons on the picture and the name under it, on one line and on two.
- **Rows with a small picture at the left**, one recipe per row.
- **The tiles of the list**, 96 pixels, with a square picture and no room for a button.
- **The button** at the top right of the picture, or in the row of the icons. In the row it takes room from the icons.
- **The shape**: 4 to 3, or square. Square shows more of the picture above the text and costs a row of tiles on a screen.
- **The number of products** beside the icons, or the icons alone.
- **Per theme**: one dark fade everywhere, or a band, a text colour and a filter on the picture that a theme can set.

## Decision

**A recipe is a tile** of at least 150 pixels wide, so two fit beside each other on a phone. The picture fills the tile in a fixed shape of 4 to 3 and is cropped to it.

```
+------------------------------+
|                       [cart] |
|                              |
|                              |
| Recipe name                  |
| [A][B][C][D]                 |
+------------------------------+
```

**Over the bottom of the picture** lie the name, on at most two lines, and under it the icons of the products, without their number. A band lies behind them so they stay readable on a light picture.

**The button** that puts the recipe on the list is at the top right of the picture.

**Tapping a tile** opens the recipe. In select mode it ticks the tile; the tick, or the warning for a recipe that holds a draft ([0123](0123-draft-products.md)), sits where the button was.

**The headings per category and the row of category buttons stay** as they are ([0127](0127-recipe-categories.md)).

**A theme sets how the text lies on the picture**, with variables that have a value in the standard theme:

- the colour of the band and the colour of the text on it, black and white unless a theme says otherwise;
- the shape of the band: a fade that runs out into the picture, or a flat band with a sharp edge for the themes with hard edges;
- a filter on the picture, none unless a theme says otherwise: one colour in Game Boy, Console, Commodore 64 and Blueprint, black and white in Receipt, Ink, Newspaper and LCD, shifted colours in a few others.

**The icons of the products** on a picture take the colour of the text of the band, on a background of that same colour, mostly see-through. A theme that turns the icons dark elsewhere does not do so here.

**A recipe without a picture** has the same tile with the placeholder of [0129](0129-recipe-pictures.md), without a band: the name and the icons take the theme's colour for text on a tile.

**The edge of a tile** follows the theme as a card does: its corners, its border and its shadow.

## Consequences

- The small picture is 4 to 3. Its width is chosen for a tile on a phone with a sharp screen.
- The icons of the products are drawn as a mask on the tile, so they can take any colour; elsewhere they stay pictures.
- A new theme may leave the new variables alone and gets the black fade, white text and no filter.
- A filter makes the food of a few themes hard to recognise. Those are the themes that are a joke already.
- The recipe page shows the large picture above the text, with the filter of the theme.
