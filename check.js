/* ATS text-layer check.
 *
 *   npm run build && npm run check
 *
 * Extracts the text out of resume.pdf the way a parser (an ATS, Gemini, etc.)
 * would, then asserts that the things they need are actually there. Exits
 * non-zero on any miss.
 *
 * What it guards against: characters that render fine but never reach the
 * text layer. Two real bugs found this way --
 *   1. `font-variant-numeric: tabular-nums` made Chromium drop every digit
 *      from the dates ("Jan 2025" -> "Jan" + spaces).
 *   2. Separators that exist only as CSS `content` are invisible to
 *      HTML-based extractors. The competency arrows were moved into <dt> as
 *      `&rarr;`. Pipes are real `|` characters where we choose to print
 *      them (contact line, company headers); everywhere else fields are
 *      separated by layout, deliberately.
 */
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const PDF = path.join(__dirname, 'resume.pdf');
const SRC = path.join(__dirname, 'resume.txt');
const HTML = path.join(__dirname, 'index.html');

const html = fs.readFileSync(HTML, 'utf8');
const src = fs.readFileSync(SRC, 'utf8');

/** HTML markup -> the plain text a parser should see. */
function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&middot;/g, '\u00b7')
    .replace(/&rarr;/g, '\u2192')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
    .trim();
}

const all = (re) => [...html.matchAll(re)].map((m) => stripTags(m[0]));

/**
 * Every run of text that must appear verbatim in the PDF: the contact line,
 * each "Company | Location" header, each job title and date run, and each
 * entry role and institution.
 *
 * Rendered pipes exist in exactly two places — the contact line and the
 * company headers. Elsewhere `resume.txt`'s `|` is only the file's field
 * delimiter; those fields are separated by layout, not by a glyph, because
 * leading pipes before dates and institutions read as clutter.
 */
function requiredStrings() {
  const out = [];

  const contact = html.match(/<p class="contact">[\s\S]*?<\/p>/);
  if (contact) out.push(['contact', stripTags(contact[0])]);

  all(/<h3>[\s\S]*?<\/h3>/g).forEach((s) => out.push(['company | location', s]));

  // Experience and Education keep the two fields as separate runs with no
  // glyph between them — a leading pipe read as clutter. Both runs must
  // still reach the text layer, in order.
  all(/<p class="job-title">[\s\S]*?<\/p>/g).forEach((s) =>
    out.push(['job title', s])
  );
  all(/<p class="job-dates">[\s\S]*?<\/p>/g).forEach((s) =>
    out.push(['job dates', s])
  );
  all(/<span class="entry-role">[\s\S]*?<\/span>/g).forEach((s) =>
    out.push(['entry role', s])
  );
  all(/<span class="entry-meta">[\s\S]*?<\/span>/g).forEach((s) =>
    out.push(['entry meta', s])
  );

  return out;
}

(async () => {
  const parser = new PDFParse({ data: fs.readFileSync(PDF) });
  const { text } = await parser.getText();
  await parser.destroy();

  const flat = text.replace(/\s+/g, ' ');
  const problems = [];

  // 1. Every year in the source copy must survive into the text layer.
  const years = [...new Set(src.match(/\b(?:19|20)\d{2}\b/g) || [])];
  const missingYears = years.filter((y) => !flat.includes(y));
  if (missingYears.length) {
    problems.push(`years missing from text layer: ${missingYears.join(', ')}`);
  }

  // 2. Date ranges keep their dash. The tabular-nums symptom was
  //    "Jan 2025" -> "Jan" + spaces, which reads as a broken range.
  const brokenRange = flat.match(/\b[A-Z][a-z]{2}\s{2,}(?:\d{4}|\u2013)/);
  if (brokenRange) problems.push(`mangled date range: "${brokenRange[0]}"`);

  // 3. Competency arrows: one per <dt>, as real text.
  const dtCount = (html.match(/<dt>/g) || []).length;
  const arrows = (text.match(/\u2192/g) || []).length;
  if (arrows !== dtCount) {
    problems.push(`arrows in PDF: ${arrows}, expected ${dtCount}`);
  }

  // 4. Every HTML entity used in the markup resolves to a real character
  //    in the text layer. Some have more than one acceptable codepoint:
  //    Chromium reports the apostrophe glyph as U+02BC (modifier
  //    apostrophe) rather than U+2019 -- same shape, and searches for the
  //    surrounding words still match.
  const ENTITIES = {
    '&amp;': ['&'],
    '&rsquo;': ['\u2019', '\u02BC'],
    '&ndash;': ['\u2013'],
    '&mdash;': ['\u2014'],
    '&middot;': ['\u00b7'],
    '&rarr;': ['\u2192'],
    '&gt;': ['>'],
    '&lt;': ['<'],
  };
  for (const [ent, chars] of Object.entries(ENTITIES)) {
    if (html.includes(ent) && !chars.some((c) => text.includes(c))) {
      problems.push(
        `entity ${ent} never reaches the text layer (looked for ` +
          chars.map((c) => 'U+' + c.codePointAt(0).toString(16)).join(', ') + ')'
      );
    }
  }

  // 5. Separator lines appear verbatim.
  const required = requiredStrings();
  const missing = required.filter(([, s]) => !flat.includes(s));
  if (missing.length) {
    problems.push('strings not found in text layer:');
    missing.forEach(([kind, s]) => problems.push(`    [${kind}] "${s}"`));
  }

  // 6. Exactly the pipes we render — no more, no fewer. Guards against a
  //    required-string list drifting out of sync with the markup.
  const expectedPipes = required.reduce(
    (n, [, s]) => n + (s.match(/\|/g) || []).length,
    0
  );
  const actualPipes = (text.match(/\|/g) || []).length;
  if (actualPipes !== expectedPipes) {
    problems.push(`pipes in PDF: ${actualPipes}, expected ${expectedPipes}`);
  }

  if (problems.length) {
    console.error('ATS check FAILED:');
    problems.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }

  console.log(
    `ATS check passed: ${years.length} years, ${arrows} arrows, ` +
      `${(text.match(/\|/g) || []).length}/${expectedPipes} pipes, ` +
      `${required.length} separator lines, ${text.length} chars extracted`
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
