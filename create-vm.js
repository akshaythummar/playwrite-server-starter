// One-shot: create a VM (retrying if it doesn't reach "started"), open its desktop, print the tunnel URL.
// Needs auth.json from save-session.js (run that once first).
const { chromium } = require('playwright');
const { createVM, getStatus, destroyVM, getDesktopUrl } = require('./vm-lib');

const MAX_ATTEMPTS = 3; // ponytail: retry ceiling to avoid looping forever on a broken VM pool

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ storageState: 'auth.json' });

  let row;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const name = `vm-${Date.now()}-${attempt}`;
    row = await createVM(page, name);

    const status = await getStatus(row);
    console.log(`Attempt ${attempt}: VM ${name} status = ${status}`);
    if (status === 'started') break;

    console.log('Not running, destroying and retrying...');
    await destroyVM(page, row);
    row = null;
  }
  if (!row) throw new Error(`VM never reached "started" after ${MAX_ATTEMPTS} attempts`);

  console.log('Waiting for cloudflared tunnel URL (can take 2-5 min on first run)...');
  const url = await getDesktopUrl(page, row);
  console.log('VM URL:', url);

  await browser.close();
})();
