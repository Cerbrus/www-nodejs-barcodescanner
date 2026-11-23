# Plan: better names and sections for scanned products, and variants on the list

Decided with the owner on 2026-11-15. Built in steps, each usable by itself.

## What is wrong now

- Tapping a shop suggestion fills in the shop's full title: "De Zaanse Hoeve Halfvolle melk", "Van Gilse Poedersuiker". The owner wants the generic product: "Melk", "Poedersuiker".
- The section of a new product is guessed from a keyword list in the web app, not from the category the shop sends.
- A product can be on the list only once. To buy three kinds of cheese, the owner wants "Kaas" three times with three notes (jong, belegen, cheddar).

## Decisions

1. **Naming an unknown barcode, in this order:**
    1. The most specific existing product whose name appears as whole words in the shop title wins: "AH Geraspte kaas" → the product "Geraspte kaas", no note.
    2. If only a more generic product matches, that one is offered with the rest of the title as note: "AH Jonge kaas 48+" → "Kaas" with note "Jonge".
    3. If nothing matches, a new product name is proposed from the title without brand and amount: "Jumbo Volkoren pasta 500 g" → "Volkoren pasta".
       Always a suggestion: the owner confirms or changes it in the naming prompt.
2. **AI suggestion, deferred (owner, 2026-11-15)**: a language model gets the shop title, brand and category and the candidate product names the rules found, and answers with the product (existing or new) and the note. Without a key, or when the call fails, the rules of decision 1 apply. Failure never fails a scan. Only shop data and product names are sent. The Anthropic API is out (the owner's console belongs to his employer) and the owner will not pay, so only a free service counts; see "Free AI options" below.
3. **Variants on the list**: a product can be on the list several times, told apart by the note. The note is the variant. Two entries of one product never share a note; giving one the same note as another merges them, quantities added.
4. **A barcode can carry a variant.** Scanning it puts the product with that note on the list, or adds one to that entry.
5. **Section of a new product** comes from the shop's category first (Albert Heijn's categories, mapped on the server), and from the keyword guess when that gives nothing.
6. **Small leftovers**: the history page marks scans of unnamed barcodes whose lookup failed and opens the naming prompt with "try again"; the eight products without an emoji get the approved ones (🍇 Vijgen, 🪵 Kaneel, 🧈 Tofu, 🥡 Aluminiumfolie, 🫙 Vershoudfolie, 🎈 Condooms, ⚪ Wattenschijfjes, 🦴 Wattenstaafjes), set by a migration only where no emoji was chosen yet; the hardware agent stops sending its unused `source` field.

## Steps

1. Small leftovers (decision 6) and the section from the shop's category (decision 5).
2. Variants on the list (decisions 3 and 4): list entries get their own id; routes, offline queue, snapshot, store, list page and scan rules move from product id to entry id; a migration keeps today's entries and notes.
3. Naming rules (decision 1) on the server, offered in the naming prompt with product and note.
4. AI suggestion (decision 2), behind the rules. Deferred: the rules of step 3 come first, and this follows only if they suggest badly too often.

Each step comes with its tests and docs, and goes live only after the owner's go.

## Free AI options (researched 2026-11-15, deferred)

| Option                            | Free limit                                                                  | Prompts used for training | Catch                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cloudflare Workers AI             | 10,000 neurons a day, no card; about three times the expected use           | No                        | Models get retired (id change); JSON output not guaranteed, so validate and fall back                             |
| Google Gemini API (AI Studio key) | Per project, shown only in AI Studio, roughly 100–1000 calls a day; no card | Not in the EEA            | Free limits were cut before; terms speak of professional use and paid plans for apps offered to others in the EEA |
| Groq                              | About 30 calls a minute, 1000 a day                                         | No                        | Exact free limits only visible after login                                                                        |
| Mistral Free mode                 | Unpublished, meant for trying out                                           | Yes, unless opted out     | Least attractive                                                                                                  |
| Ollama on an always-on home PC    | Unlimited, nothing leaves the house                                         | Not applicable            | The machine has to stay on; the Pi 3B+ is far too weak                                                            |

Ruled out: GitHub Models (shut down July 2026), Hugging Face (no free credits since October 2026), Cerebras (30-day trial only), OpenRouter free models (about five odd ones, 50 calls a day).

Preference when this is picked up: Cloudflare Workers AI, with Gemini as the alternative if its Dutch is better in practice. Either way the rules stay the fallback, and the call sends only the candidates the rules found, not the whole catalog. Free tiers change often; check them again before building.
