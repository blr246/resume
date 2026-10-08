# AGENTS.md

## What this repo is

A single resume, maintained as hand-written HTML/CSS and exported to PDF with
Puppeteer. There is no framework, no bundler, and no data layer: the markup *is*
the document.

```bash
npm run build   # index.html + PRINT_CSS -> resume.pdf, prints page count
npm run check   # extracts resume.pdf's text layer and asserts it is parseable
```

## Purpose and goals

- **Readability first.** This is a document to be read, not admired.
- **Quiet and professional.** No icons, logos, color accents, gradients,
  columns, or decorative rules. One typeface, grayscale only. Do not add any
  of these.
- **Type does the work.** Hierarchy comes from size, weight, and spacing.
  Company names (`--fs-h3`) are deliberately larger than body copy so they
  catch a scanning eye.
- **Density with air.** ~10pt body, generous leading, clear separation between
  roles. When in doubt, leave whitespace.
- **Keywords over prose** in Technical Expertise: it is scanned, not read.

## Hard constraints

These are not style preferences. Breaking one produces a broken artifact even
when the page looks fine on screen.

1. **Exactly 2 pages, and no job may split across the break.**
   Page 1 holds **960px** of text (Letter, 0.5in margins). Knewton must stay
   whole *and* end at or before 960px so the break falls in the gap after it.
   Every pixel between the top of the document and the bottom of Knewton
   counts against that budget; spacing *below* Knewton does not move the
   break, it only adds total height.

   **Current state: Knewton runs 72px past that budget**, so it moves whole to
   the top of page 2 and page 1 ends with a 57px strip after Frame AI. This is
   the accepted layout. Clearing the budget is binary — reclaiming part of the
   72px makes the strip *larger*, so either reclaim it in full or leave it
   alone. Spacing alone cannot reach 72px without losing the intended
   airiness.

   **Both pages together hold 1920px and currently use ~1887px**, so ~33px of
   slack remains. Add more than that anywhere and the build reports 3 pages.
   Reclaim space from `.masthead`, `.section-title`, `.job-head`, or the gaps
   above Knewton, or trim copy across a line boundary. Never override
   `.job { break-inside: avoid }` in `PRINT_CSS`.

2. **`resume.txt` is the source of truth for all copy**, and it stays in sync
   with `index.html` *both* directions. Edit `resume.txt` first, port the
   change, and mirror back if you edit HTML directly. After any content edit,
   diff the two: render the page, normalize whitespace, and confirm every
   `resume.txt` line appears in the output and no HTML block has gone stale.

3. **`index.html` is pure ASCII.** Typographic characters go in as entities:
   `&amp;` `&rsquo;` `&ndash;` `&mdash;` `&rarr;` `&gt;`. A raw `&` or a literal
   `–` is a bug. Verify with `grep -n '[^ -~]' index.html`.

4. **Text you need read must be real text.**
   - Never use `font-variant-numeric: tabular-nums` (or `font-feature-settings:
     "tnum"`). Chromium renders the digits but omits them from the PDF text
     layer — "Jan 2025" extracts as "Jan". This has happened here.
   - Never put needed characters in CSS `content`. Extractors and screen
     readers cannot see generated content; the competency arrows were invisible
     until moved into `<dt>` as `&rarr;`.
   - `npm run check` fails if either regression returns.

5. **The PDF has no browser furniture.** `displayHeaderFooter: false` plus
   empty header/footer templates. Chromium has been known to leave a footer
   despite the flag alone.

6. **Page counts come from PDF bytes**, either `build.js`'s printed count or
   `strings resume.pdf | grep -o "/Count [0-9]*"`. Never `mdls` — it reports
   stale values for files rewritten in place.

## Screen vs. PDF

They are intentionally different, and only one of them is authoritative for
each medium:

- **`styles.css` = screen.** Airy: `--lh-body: 1.42`, section 16px, job 13px,
  bullet 4px. Review the browser version for how the resume *reads*.
- **`PRINT_CSS` in `build.js` = PDF.** Tighter: `--lh-body: 1.34`, section
  14px, job 11px, bullet 4px, heading gaps 10/7/3px (masthead / section-title
  / job-head, all below their screen values). Injected print-only, so it never
  affects what you see in the browser.

Change print density only in `PRINT_CSS`; leave `styles.css` for screen. Body
type stays 10pt in both — take space from gaps and leading, never from type.

## Workflow

1. Edit copy in `resume.txt`.
2. Port it into `index.html`, preserving the entity/ASCII rules.
3. `npm run build` — confirm **2 page(s)**.
4. `npm run check` — confirm the text layer still carries years, arrows,
   pipes, and every entity.
5. Re-verify fidelity against `resume.txt` (both directions).

If the build reports 3 pages, total height went past 1920px. See constraint 1.

## Numbers worth knowing

| Thing | Value |
|---|---|
| Text column | 720px (Letter 8.5in − 2×0.5in) |
| Page capacity | 960px (11in − 2×0.5in); 1920px for two |
| Body line | 10pt at 1.34 ≈ 17.9px in print |
| Bullet line | ~235 characters at 10pt across 7.5in |

Trimming inside the 236–288 character band saves **no** vertical space — the
bullet keeps its line count. Cut across a boundary to reclaim height.

**Measuring layout:** `emulateMediaType('print')` lays out at viewport width
and ignores `@page` margins, so set the viewport to **720px** first or
measurements come out optimistic. Per-page capacity is then 960px.

## Files

| File | Role |
|---|---|
| `resume.txt` | Source of truth for all copy; plain text, edited by hand |
| `index.html` | The markup; content mirrors `resume.txt` |
| `styles.css` | All styling; design tokens in `:root` |
| `build.js` | Puppeteer export + `PRINT_CSS` (print-only density) |
| `check.js` | ATS text-layer assertions; run via `npm run check` |
| `resume.pdf` | Generated output, tracked in git; never hand-edit |
| `README.md` | Human-facing docs; keep prescriptive, never a session log |
| `tmp/` | Scratch: test renders, screenshots, layout variants. Safe to delete; `tmp/make-compare.js` rebuilds the side-by-side set |

## Known traps

- `addStyleTag({ content: '' })` throws — guard on `PRINT_CSS.trim()`.
- Page-height savings are **non-monotonic**: tightening spacing can turn 2
  pages into 3 by pushing a `break-inside: avoid` block to the next page. A
  partial reclaim can make the bottom-of-page hole *larger*. Always measure the
  real PDF, never infer from a smaller total height.
- Layout results are sensitive to content position, not just content length.
- zsh aborts an entire `rm` on an unmatched glob; use `find … -delete`.
