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
  .section { margin-bottom: 12px; }
  .job { margin-bottom: 10px; }
  .bullets li { margin-bottom: 3px; }

  /* Let a job span a page break so the Frame AI block stops forcing a
     spill onto a third page. Headers are kept with their first bullet by
     .job-head { break-after: avoid }, and bullets never split. */
  .job { break-inside: auto; page-break-inside: auto; }
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
