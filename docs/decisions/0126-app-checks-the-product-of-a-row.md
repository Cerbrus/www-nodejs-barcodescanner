# 0126. The app checks the product an import picks, by the words in the ingredient line

- Status: accepted
- Date: 2026-11-27
- Decided by: the owner

## Context

The import asks the model which product of the app an ingredient is ([0122](0122-recipes-imported-with-gemini.md)). The question told it to pick nothing when in doubt and never a product that is merely similar. It still put "harissa" on Pikante saus, "veldsla" on Rucola, "kwark" on Yoghurt and "runderchipolata" on Worst. A sentence that allowed a broader product with the kind in the note, written to get "Oreo-koekjes" on Koekjes, invited part of that.

Three things were tried on 2026-11-27, with the real products:

- **A certainty per row from the model.** Wrong picks scored 80 to 100 and right ones 90 to 100, so no bar separates them.
- **Fuzzy matching**, the measures behind the libraries for it: the distance in edits and the share of letter pairs. They compare letters and the problem is meaning. They accept "roomkaas" for Room and "champignons" for Ham, and refuse "1 ui" for Uien and "1 ei" for Eieren. Of thirteen wrong picks they let six or seven through.
- **Dutch word forms.** The name of the product has to be in the line, plural and singular alike, as a word or as the start or end of a longer word. It kept the most right picks and let the fewest wrong ones through.

## Options weighed

- **More words in the question** about certainty.
- **A bar on the model's own certainty.**
- **A fuzzy matching library.**
- **A check by the app on Dutch word forms.**

## Decision

**The question** no longer allows a broader product. It still asks for whatever the line says more than the product's name, a brand or a kind included, in the note. For every row the model gives the line as the recipe has it, its pick, and always the name it would give the product.

**The app checks each pick** (`core/rules/product-match.ts`). Every word of the product's name has to be in the line. Words are compared by their stem: the plural ending off, a doubled vowel made single (`tomaat`, `tomaten`), `ei` and `eieren`, `olijf` and `olijven`. A stem of four letters or more may also be the start or the end of a longer word (`roomboter`, `rodewijnazijn`, `zalmflakes`); `ei` and `ui` may be the end of one.

**A narrower product wins.** When another product also fits the line and holds the picked name, the app takes that one: Koekkruiden before Kruiden, Tomatenpuree before Tomaten. The app never looks for a product by itself beyond that.

**A pick that is refused** becomes a draft product ([0123](0123-draft-products.md)) under the name the model gave, when that name is in the line too; the model often repeats its wrong pick as the name. Otherwise the name is the line without its amount. A name that equals a product is that product.

**No certainty from the model and no fuzzy matching library.**

## Consequences

- An ingredient that goes by another name than the product, such as "romaatjes" for Cherrytomaten or "bosui" for Lente-ui, becomes a draft. The owner replaces it at the review ([0124](0124-replacing-a-draft-product.md)).
- Still wrong after the check, because the name is in the line: "gecondenseerde melk" on Melk, and a bag of mixed vegetables on Groenten.
- A name made from the line keeps its adjectives: "milde harissa" becomes the draft Milde harissa.
- The word forms are about twenty lines of rules, not a stemming library. A form they miss costs a draft, not a wrong product.
