const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ storageState: 'auth.json' });
  await page.goto('https://labs.2z2.top/user');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.waitForTimeout(1000);

  const names = await page.locator('p.font-mono, p').evaluateAll((els) =>
    els.map((e) => e.textContent).filter((t) => /^(vm|probe|bot)-\d/.test(t || ''))
  );
  console.log('Found test VMs:', names);

  for (const name of names) {
    const row = page
      .locator('p', { hasText: name })
      .first()
      .locator('xpath=ancestor::div[.//button[@title="Delete"]][1]');
    await row.getByTitle('Delete').click();
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: /delete|confirm|yes/i }).click();
    }
    await page.waitForTimeout(500);
    console.log('Deleted', name);
  }

  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'logs/after-cleanup.png' });
  await browser.close();
})();
