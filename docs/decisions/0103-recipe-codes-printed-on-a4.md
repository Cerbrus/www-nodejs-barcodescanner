# 0103. Recipe codes are printed on A4, twelve to a page

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner

## Context

The owner wants to pick recipes and print their codes ([0101](0101-recipes-tab-and-pages.md)). With product ids a code is small: about 40 modules a side for twenty ingredients (estimated, not measured).

## Options weighed

- A fixed grid.
- A choice of size before printing: small with twenty to a page, large with six. The small size may not scan for a big recipe, and it is one more step.

## Decision

A4 portrait, three columns by four rows. Each cell holds the code, 50 mm wide, with the recipe's name centred below it, on two lines when it is long. Thin dashed lines between the cells show where to cut. The sheet is black on white whatever the app's appearance. More than twelve recipes go on to the next page. The browser's print dialog does the printing; the print styling shows the sheet and nothing else. Printing one recipe from its page gives the same sheet with one code.

## Consequences

The sizes can be changed later if a code proves hard to scan or the sheet wastes paper.
