# Brandon Reiss — Resume

HTML resume with a Puppeteer-generated PDF.

## Quick start

```bash
npm install
npm run build      # writes resume.pdf
npm run check      # verifies the PDF text layer (ATS)
```

Open `index.html` in a browser to review the on-screen version.

Node comes from nvm (`~/.nvm`), which is on PATH.

## Files

| File | Role |
|---|---|
| `resume.txt` | **Source of truth for all copy.** Plain text, edited by hand. |
| `index.html` | The resume markup. Content mirrors `resume.txt`. |
| `styles.css` | All styling. Design tokens live in `:root`. |
| `build.js` | Puppeteer → `resume.pdf`, injects print-only CSS. |
| `check.js` | ATS text-layer check. Run after every build. |
| `resume.pdf` | Generated output. Never edit by hand. |
| `README.md` | This file. |
| `AGENTS.md` | Instructions and constraints for AI agents working in this repo. |
| `.gitignore` | Ignores `tmp/`, `node_modules/`, `.DS_Store`; tracks `resume.pdf`. |
| `tmp/` | Scratch space for test renders, screenshots, and layout variants. Safe to delete; `tmp/make-compare.js` rebuilds the side-by-side set. |

## Workflow

1. Edit copy in `resume.txt`.
2. Port the change into `index.html`.
3. Run `npm run build` (page count) and `npm run check` (ATS text layer).

Keep `resume.txt` and `index.html` in sync in both directions. If you edit
`index.html` directly, mirror the change back into `resume.txt`.

After any content change, verify fidelity by rendering the page and confirming
each line of `resume.txt` still appears in the output.

## Design goals

- **Readability first.** This is a document to be read, not admired.
- **Quiet and professional.** No color accents, icons, gradients, columns, or
  decorative rules. One typeface, grayscale only.
- **Type does the work.** Hierarchy comes from size, weight, and spacing.
- **Density with air.** ~10pt body, generous leading, clear separation between
  roles. When in doubt, leave the whitespace.

### Type tokens (`styles.css` → `:root`)

| Token | Value | Notes |
|---|---|---|
| `--fs-name` | 24pt | masthead, uppercase, letterspaced |
| `--fs-h2` | 11pt | section headings, uppercase, letterspaced |
| `--fs-h3` | 12pt | company names — larger than body so titles catch the eye |
| `--fs-body` | 10pt | body copy |
| `--fs-small` | 9.2pt | dates, locations, contact line |
| `--lh-body` | 1.42 | on-screen; the PDF overrides to 1.34 |
| `--page-pad` | 0.5in | also serves as the `@page` margin |

The **Technical Expertise** section is set at the same 10pt as body copy; it is
differentiated by its taxonomy structure (bold category, arrow, member list)
rather than by size, and is meant to be scanned for keywords, not read.

## Screen vs. PDF

The HTML and the PDF differ deliberately.

- **HTML** uses an airy rhythm: `line-height: 1.42`, 16px section gaps,
  13px job gaps, 4px bullet gaps, default heading spacing.
- **PDF** injects `PRINT_CSS` from `build.js`: `line-height: 1.34`, 14px
  section gaps, 11px job gaps, 4px bullet gaps, and the masthead / section /
  job heading gaps trimmed to 12 / 8 / 4px.

Both render body text at 10pt. Change print density in `PRINT_CSS` in
`build.js`; leave `styles.css` for the screen.

## Pagination

Target: **2 pages, with no job split across the break.** The current
configuration meets it.

Print settings that hold at 2 pages:

```
:root { --lh-body: 1.34; }
.section { margin-bottom: 14px; }
.job { margin-bottom: 11px; }
.bullets li { margin-bottom: 4px; }
.masthead { margin-bottom: 12px; }
.section-title { margin-bottom: 8px; }
.job-head { margin-bottom: 4px; }
```

Notes on what drives the result:

- **The page-1 break budget is the whole game.** Page 1 holds 960px of text.
  Knewton must stay whole *and* end at or before 960px, so the break falls in
  the gap after it. Every pixel of spacing between the top of the document and
  the bottom of Knewton counts against that budget — spacing *below* Knewton
  does not move the break, it only adds total height.
- **Headroom is ~11px.** Add a bullet or a longer summary above Knewton and
  the PDF goes to 3 pages. If that happens, take the space back from
  `.masthead`, `.section-title`, `.job-head`, or the gaps above it.
- **Jobs are never split.** `.job { break-inside: avoid }` in `styles.css` is
  what keeps Knewton intact; do not override it in `PRINT_CSS`.
- **Spend the margin before the type.** 0.5in margins over a 7.5in measure are
  what keep line counts down; shrinking type to buy margin costs more height
  than it returns, because a narrower measure wraps more often.
- Body type size stays at 10pt; take space from gaps and leading, not type.

**Editing copy:** at 10pt across the 7.5in measure, a bullet line holds about
**235 characters**. Trim within the 236–288 band and the bullet keeps its line
count, saving nothing — cut across a boundary (under 235, or a 3-line bullet
down to 2) to reclaim vertical space.

## Verifying page count

Read the count from the PDF bytes:

```bash
strings resume.pdf | grep -o "/Count [0-9]*" | head -1
```

`build.js` does this automatically and prints the result after each build.
Prefer that output over `mdls`, which reports stale values for files that are
rewritten in place.

## ATS text layer

ATS parsers (and Gemini, Adobe, etc.) read the text layer of the PDF, not the
pixels. Anything that renders but never reaches that layer is invisible to
them. After every build:

```bash
npm run check
```

`check.js` extracts the text from `resume.pdf` and fails if years, arrows,
separator lines, or any HTML entity are missing. It has caught two real bugs:

- **`font-variant-numeric: tabular-nums` drops every digit from the dates.**
  Chromium renders them fine but omits them from the text layer, so
  "Jan 2025 – Present" extracted as "Jan  Present". Do not add it back to
  `.job-dates` or `.entry-meta`.
- **Separators must be real characters in the markup.** The competency arrows
  were CSS `content: " \2192"` — invisible to HTML-based extractors until
  they were moved into `<dt>` as `&rarr;`. Same principle for pipes: they are
  `<span class="pipe">|</span>`, not borders or whitespace.

`build.js` also waits on `document.fonts.ready` before printing. The resume
uses system fonts only, so it resolves immediately — it exists so that adding
a web font later cannot print before its glyph map is ready.

What is intentionally *not* printed: the `|` in `resume.txt` job, entry, and
education lines is the file's field delimiter, not a glyph. Experience keeps
role and dates as separate runs, and Education / Early Career keep role and
institution as separate runs — leading pipes before those fields read as
clutter. Pipes render in exactly two places, the contact line and the
"Company | Location" headers, and `check.js` asserts the total is exact.

Two things that look suspicious but are fine: date ranges use an en dash
(`&ndash;`, the correct typographic form for ranges), and Chromium reports
the apostrophe as U+02BC rather than U+2019 — same glyph, and word searches
around it still match.

## Measuring layout

Query layout at the width the PDF actually uses. With `@page` margins of 0.5in
on Letter, the text column is **720px** — `emulateMediaType('print')` lays out
at the full viewport width and ignores `@page` margins, so set the viewport to
720px before measuring.

```js
await pg.setViewport({ width: 720, height: 1056 });
await pg.goto('file:///…/index.html', { waitUntil: 'networkidle0' });
await pg.emulateMediaType('print');
const h = await pg.evaluate(() =>
  document.querySelector('.page').getBoundingClientRect().height);
```

Per-page capacity at these margins: **960px** (11in − 1in).

## HTML conventions

- **Pure ASCII with entities**: `&amp;` `&rsquo;` `&ndash;` `&mdash;` `&gt;`
  `&rarr;`. Raw `&` or literal typographic characters are bugs. Find strays
  with `grep -n '[^ -~]' index.html`.
- **Rendered characters are real text**, never CSS `content` — extractors
  and screen readers cannot see generated content. Run `npm run check`.
- Semantic markup: `<article class="job">` per role, `<dl>` for the Expertise
  pairs, headings for sections.
- Print rules live in `@media print` in `styles.css`: they strip link styling,
  keep headings with their content, and prevent bullets from splitting.
- Wildcard cleanup works best with `find . -maxdepth 1 -name '*.pdf' -delete`.
