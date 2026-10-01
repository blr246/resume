# Brandon Reiss — Resume

HTML resume with a Puppeteer-generated PDF.

## Quick start

```bash
npm install
npm run build      # writes resume.pdf
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
| `resume.pdf` | Generated output. Never edit by hand. |
| `tmp/` | Scratch space for test renders and screenshots. Safe to delete. |

## Workflow

1. Edit copy in `resume.txt`.
2. Port the change into `index.html`.
3. Run `npm run build` and check the page count it prints.

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

The **Technical Expertise** section is smaller (8.8–9.2pt) by design: it is
meant to be scanned for keywords, not read.

## Screen vs. PDF

The HTML and the PDF differ deliberately.

- **HTML** uses an airy rhythm: `line-height: 1.42`, 16px section gaps,
  13px job gaps, 4px bullet gaps.
- **PDF** injects `PRINT_CSS` from `build.js`: `line-height: 1.34`, 12px
  section gaps, 10px job gaps, 3px bullet gaps, and jobs allowed to split
  across pages.

Both render body text at 10pt. Change print density in `PRINT_CSS` in
`build.js`; leave `styles.css` for the screen.

## Pagination

Target: **2 pages.** The current configuration meets it.

Print settings that hold at 2 pages:

```
:root { --lh-body: 1.34; }
.section { margin-bottom: 12px; }
.job { margin-bottom: 10px; }
.bullets li { margin-bottom: 3px; }
.job { break-inside: auto; page-break-inside: auto; }
```

Notes on what drives the result:

- **Page margins cost more than font size.** 10pt at 0.5in margins is shorter
  than 9.4pt at 0.65in, because the wider measure reduces line wraps.
- **Jobs must be allowed to split.** The Frame AI block is ~390px; keeping it
  whole pushes Education onto a third page. Headers stay with their first
  bullet via `.job-head { break-after: avoid }`, and bullets never split.
- **The settings sit on the boundary.** Softening any one of them returns
  3 pages. If the build reports 3 pages, compare against the block above.
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

- **Pure ASCII with entities**: `&amp;` `&rsquo;` `&mdash;` `&ndash;` `&gt;`
  `&middot;`. Raw `&` or literal typographic characters are bugs. Find strays
  with `grep -n '[^ -~]' index.html`.
- Semantic markup: `<article class="job">` per role, `<dl>` for the Expertise
  pairs, headings for sections.
- Print rules live in `@media print` in `styles.css`: they strip link styling,
  keep headings with their content, and prevent bullets from splitting.
- Wildcard cleanup works best with `find . -maxdepth 1 -name '*.pdf' -delete`.
