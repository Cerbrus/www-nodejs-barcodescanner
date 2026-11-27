# 0122. A recipe is imported from a link or pasted text, read by Google's Gemini on its free tier

- Status: accepted
- Date: 2026-11-27
- Decided by: the owner

## Context

The owner wants to hand the app a link to a recipe and get a recipe in the app. A recipe row points at a product of the app, has a whole quantity and a note ([0105](0105-recipe-tables-and-routes.md), [0057](0057-list-entry-ids-and-variants.md)); a recipe page on the web has lines such as "150 g warmgerookte zalmflakes". Turning those lines into products, quantities and notes is the work.

What was found on 2026-11-26 and 2026-11-27:

- Recipe sites carry the recipe as `schema.org/Recipe` data in the page. The Allerhande page that was tried has the name, eight ingredient lines and the steps.
- The site of that page refuses a plain fetch from a server (status 403). The API on the Pi can therefore not count on fetching a link itself.
- An installed web app cannot be a target of the share sheet on an iPhone: Safari does not support `share_target`.
- A language model for product names was weighed before and deferred, because only a free service counts ([0056](0056-naming-sections-variants.md)). The free options are in [../archive/naming-plan.md](../archive/naming-plan.md).
- Google's terms of 2026-03-23 allow only paid use "when making API Clients available to users" in the European Economic Area and call the service one for professional use. This app is used by its developer and the accounts of one household. Paid use needs a billing account. The pricing page says content sent on the free tier is used to improve Google's products; the terms say the paid rules for data apply in the European Economic Area on the free tier too.
- Gemini has a tool that fetches a link itself. Whether it gets through to a site that refuses the Pi, and whether it works on the free tier, is not known. The tool exists only in Gemini's own API, not in its OpenAI-style one.

## Options weighed

- **The service**: Google Gemini, Cloudflare Workers AI, a model on a computer at home, or no model at all and only the rules of [0056](0056-naming-sections-variants.md).
- **Google's terms**: accept the free tier, attach a billing account, or pick another service.
- **How a recipe gets in**: a field in the app that takes a link, a shortcut in the phone's share sheet that reads the open page and posts it, or both.
- **What the model is told about the products**: every product name, only the candidates the rules found, or nothing.
- **Who may import**: every account with a limit per hour, or the owner.
- **The API of the service**: Gemini's own, or the OpenAI-style one that other services also speak.

## Decision

**The service.** Google Gemini on its free tier. No billing account is attached, here or anywhere else. The owner accepts that the terms do not clearly cover this use; the feature is built so that losing the key costs little.

**Getting a recipe in.** A field in the app takes a link or pasted recipe text. No shortcut and no other code outside the app. For a link, Gemini's own fetch tool is tried first on the site that refuses the Pi; that test decides the next point. Pasted text always works and is what the app points to when a link cannot be read.

**The API.** Decided by the fetch test. When the tool gets through on the free tier: Gemini's own API. When it does not: the OpenAI-style API, with the address, key and model as settings, so another service can take over without new code. Either way the call is a plain `fetch` with a timeout, as the connectors do it, and no package of the service is added.

**The work of the model.** It turns the ingredient lines into rows: which product, which quantity, which note. It gets the names and ids of every product, the names of the sections and the names of the icons. Nothing else leaves: no barcodes, no list, no history, no account. Its answer is forced into a fixed shape and checked again by the API; a product id that does not exist is dropped.

**Quantities and notes**, as the owner writes them by hand:

- Something that is counted becomes the quantity: two avocados is quantity 2.
- Something that is weighed or measured is quantity 1 with the amount in the note, written without a space: `500g`, `500ml`.
- A variant comes first in the note, with a capital, then the amount: `Bruin, 500g`.

**An ingredient without a product** becomes a new product, marked as a draft ([0123](0123-draft-products.md)).

**After the import.** The recipe is saved and opens as it was saved; the owner changes it with the pencil or deletes it. It first opened in edit mode, where the save button stays off until something changes, which looked like a failure.

**Who.** Only the owner imports.

**Without the service.** With no key the field is not shown. A failed call says so and saves nothing.

## Consequences

- The earlier preference for Cloudflare Workers AI in the archived naming plan does not apply to this feature. The note there to send only the candidates the rules found was written for naming a barcode; here every product name goes along.
- The key is a setting on the Pi, read through `AppConfig`, and gets a place in the settings table of the deployment doc and in the template.
- The content security policy stays as it is: the call leaves from the API, not from the browser.
- Deleting an imported recipe leaves the draft products it brought. They wait in the inbox, and one that no recipe uses any more can be deleted there.
- Free limits are not published and have been cut before. The limits of the project are visible only in Google AI Studio. Read there on 2026-11-28: the default model `gemini-3.5-flash-lite` gets 15 requests a minute, 250,000 input tokens a minute and 500 requests a day; the larger free models get 5 requests a minute, 250,000 tokens a minute and 20 requests a day, so a larger model suits an occasional retry and not the default.
