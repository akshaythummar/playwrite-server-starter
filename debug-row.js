// Inspects the real DOM around a VM row so we can fix the selectors in create-vm.js.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ storageState: 'auth.json' });
  await page.goto('https://labs.2z2.top/user');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'debug-list.png', fullPage: true });

  // Dump the HTML of whatever contains the VM rows, so we can see real tag/class/button structure.
  const html = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('body *'))
      .filter(el => el.children.length > 0 && /started|stopped/i.test(el.textContent || ''));
    // Find the smallest element that still contains a status word - likely one row.
    candidates.sort((a, b) => a.innerHTML.length - b.innerHTML.length);
    return candidates.slice(0, 3).map(el => el.outerHTML).join('\n---\n');
  });

  console.log(html || '(no existing VM rows found — create one first, or this site has none yet)');
  await browser.close();
})();
