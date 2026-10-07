// Run once: opens a real browser, you log in by hand, then press Enter in the terminal.
// Saves cookies/storage to auth.json so create-vm.js can reuse the session.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://labs.2z2.top/user');

  console.log('Log in in the opened browser window, then press Enter here...');
  await new Promise((resolve) => process.stdin.once('data', resolve));

  await page.context().storageState({ path: 'auth.json' });
  console.log('Saved session to auth.json');
  await browser.close();
})();
