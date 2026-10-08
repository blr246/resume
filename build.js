const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const INPUT = path.join(__dirname, 'index.html');
const OUTPUT = path.join(__dirname, 'resume.pdf');

/**
 * CSS injected ONLY when printing (wrapped in @media print, so the HTML you
 * view in a browser is untouched).
 *
 * Why: the on-screen layout uses an airy rhythm (line-height 1.42, 16px
 * section gaps) which looks good in a browser but runs to 3 printed pages.
 * These values are the tightest config that lands the PDF on 2 pages while
 * keeping the body at 10pt. If you change any of them, re-check the page
 * count printed below -- we are right on the boundary.
 *
 * See README.md ("Pagination") for the measurements behind each number.
 */
const PRINT_CSS = `
  :root { --lh-body: 1.34; }
  .section { margin-bottom: 14px; }
  .job { margin-bottom: 11px; }
  .bullets li { margin-bottom: 4px; }

  /* Page-1 break budget: Knewton must stay whole AND land on page 1, so its
     block has to end at <= 960px (the page-1 text height). These three
     values are the spacing above Knewton that sits below its screen value;
     together they leave ~4px of headroom. Anything added before Knewton (a
     bullet, a longer summary) eats into that and pushes the PDF to 3 pages,
     or leaves a blank strip at the bottom of page 1. Re-measure after edits. */
  .masthead { margin-bottom: 10px; }
  .section-title { margin-bottom: 7px; }
  .job-head { margin-bottom: 3px; }

  /* Jobs stay whole across page breaks (Knewton must not split); bullets
     never split either. See README.md ("Pagination"). */
`;

/** Read the page count straight out of the PDF bytes. */
function countPages(buffer) {
  const s = buffer.toString('latin1');
  const counts = [...s.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  if (counts.length) return Math.max(...counts);
  const pages = s.match(/\/Type\s*\/Page[^s]/g);
  return pages ? pages.length : null;
}

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    await page.goto('file://' + INPUT, { waitUntil: 'networkidle0' });
    // Wait for font loading before printing. With system fonts this resolves
    // immediately, but if a web font is ever added, printing before its glyph
    // map is ready can leave glyphs drawn with no character codes in the PDF
    // text layer (invisible to ATS parsers -- see check.js).
    await page.evaluateHandle('document.fonts.ready');
    await page.addStyleTag({ content: PRINT_CSS });

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true, // obey @page { size: Letter } from styles.css
      // Belt and braces against Chromium's default page furniture: the flag
      // alone has been known to leave a footer behind.
      displayHeaderFooter: false,
      headerTemplate: '<span></span>',
      footerTemplate: '<span></span>',
    });

    fs.writeFileSync(OUTPUT, pdf);

    const pages = countPages(Buffer.from(pdf));
    const bytes = Buffer.from(pdf).length;
    console.log(`Wrote ${OUTPUT}`);
    console.log(`  ${pages} page(s), ${(bytes / 1024).toFixed(0)} KB`);
    if (pages > 2) console.log('  !! over the 2-page target -- see README.md');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
