const { chromium } = require('playwright');
const URL = process.argv[2];

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(6000);

  await page.mouse.click(55, 13);
  await page.waitForTimeout(1000);
  await page.mouse.click(83, 71);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'p5-after-terminal-click.png' });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'p5-after-more-wait.png' });

  await browser.close();
})();
