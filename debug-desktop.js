// Tests just the "Launch Desktop -> grab URL" step against an already-existing VM.
const { chromium } = require('playwright');

const VM_NAME = process.argv[2];
if (!VM_NAME) throw new Error('usage: node debug-desktop.js <vm-name>');
const CF_URL_RE = /https:\/\/[a-z0-9.-]*trycloudflare\.com\S*|https:\/\/\S*\.2z2\.top\S*/i;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ storageState: 'auth.json' });
  await page.goto('https://labs.2z2.top/user');

  const row = page
    .locator('p', { hasText: VM_NAME })
    .first()
    .locator('xpath=ancestor::div[.//button[@title="Launch Desktop"]][1]');
  await row.waitFor();
  await row.getByTitle('Launch Desktop').click();

  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  console.log('Dialog opened, waiting for tunnel URL (up to 6 min)...');

  await page.waitForFunction(
    (reStr) => new RegExp(reStr, 'i').test(document.body.innerText),
    CF_URL_RE.source,
    { timeout: 6 * 60 * 1000 }
  );

  const bodyText = await dialog.innerText();
  const match = bodyText.match(CF_URL_RE);
  console.log('VM URL:', match ? match[0] : '(not found)');
  console.log('--- dialog text ---\n', bodyText);

  await browser.close();
})();
