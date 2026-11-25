# 0120. Themes beside light and dark

- Status: accepted
- Date: 2026-11-25
- Decided by: the owner (he asked for more themes and named Comic, Console and Darcula; the rest was proposed to him and he took all of it)

## Context

The app had one look in a light and a dark version ([0050](0050-appearance-follows-device.md)). The owner wanted more to choose from: mostly other colours and fonts, and a comic-book look with thick borders, in colour and in black and white. Border widths, corner radii and shadows were written as fixed values in some twenty style files, so a theme could change colours only.

## Options weighed

- **Colours only.** One block of variables per theme. No comic look.
- **Colours, fonts and shape.** Border width, border style, corner radius, shadows and the font become variables as well, so a theme can set them. One round through the style files, after which a theme is one block again.
- **One list with every theme twice, light and dark.** Twenty-four entries, and "automatic" is lost.
- **Theme and appearance as two settings.** The switch for automatic, light or dark stays as it is; the theme is chosen beside it.

## Decision

Colours, fonts and shape, as two settings. The System page keeps the switch of 0050 and gets a list of themes below it. Every theme has a light and a dark version and follows that switch.

The themes, thirty-one in seven groups in the list (the owner took every one that was proposed, 2026-11-25): Standard and High contrast; Darcula, Solarized and Nord; Albert Heijn and Jumbo; Console, Neon, Tron, Synthwave, Game Boy, Commodore 64, LCD and Windows 95; Receipt, Comic, Comic in black and white, Blueprint, Newspaper, Chalkboard and Sticky notes; Sixties, Seventies and Nineties; King's Day, Easter, Pride, Halloween, Sinterklaas and Christmas. Standard is the look until now.

A button "Seasonal theme" on the row of the theme (the owner wanted no row of its own for it), off at first, shows the theme of the season in place of the chosen one and the chosen one again when the season is over: Easter from two weeks before Easter Sunday up to Easter Monday, King's Day from 21 to 27 April, Halloween from 24 to 31 October, Sinterklaas from 14 November to 5 December, Christmas from 6 to 26 December. The chosen theme stays what the list shows and what is remembered.

A theme may set: every colour variable, the font, the factor all corner radii are multiplied by, the width and style of borders, the border of a tile, three shadows (cards and tiles, buttons, floating panels), a pattern behind the page, and a mark before a section title. A theme may also carry a few rules of its own, such as the title font of Comic. Every theme has a style file of its own (owner, 2026-11-25).

The tiles of the list take the colours of the theme (owner, 2026-11-25, after seeing them red and green in every theme): to buy is the theme's strongest colour, recent its second. Red to buy and green recent ([0049](0049-colours-carry-meaning.md)) holds for the Standard theme only.

The icons of the owner's set are white drawings. A theme with light tiles (High contrast, Jumbo, Console, Receipt, Comic, Comic in black and white, some in their dark version only) turns them dark with `--tile-icon-invert`.

In Pride every tile to buy takes the next colour of the rainbow flag.

In the code the theme is called a skin (`data-skin`, `ThemeService.skin`), because "theme" already names light or dark there (`data-theme`, the stored key `theme`).

## Consequences

Builds on [0050](0050-appearance-follows-device.md) and [0089](0089-tailwind-and-css-variables.md). A style file writes no fixed border width for a box, no fixed radius and no shadow for a card or a floating panel: it uses the variables. Light and dark are written once per colour with `light-dark()`, which needs Safari 17.5, Chrome 123 or Firefox 120. The start colours in `index.html` exist once per theme; a test fails when they differ from the theme. Nine font files ship with the app, all under the Open Font License, each fetched only while a theme that uses it is shown: Bangers and Comic Neue (Comic), Tilt Neon (Neon), Orbitron (Tron), Pixelify Sans (Game Boy, Commodore 64), Patrick Hand (Chalkboard, Sticky notes), Shrikhand (Seventies), Creepster (Halloween). A remark carries the theme next to the appearance. Printing keeps the standard look.
