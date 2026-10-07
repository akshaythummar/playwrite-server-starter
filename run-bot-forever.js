// Keeps the Telegram bot alive despite the dashboard's 55-min VM auto-stop:
// create VM -> deploy+verify bot -> poll dashboard status -> once it's no longer
// "started", destroy it and create a fresh one. Loops forever.
const { chromium } = require('playwright');
const { createVM, getStatus, destroyVM, getDesktopUrl } = require('./vm-lib');
const { deployBot } = require('./deploy-bot');

const MAX_CREATE_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 10 * 1000;
const ERROR_BACKOFF_MS = 30 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(cycle, msg) {
  console.log(`[${new Date().toISOString()}] [cycle ${cycle}] ${msg}`);
}

async function launchSession() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ storageState: 'auth.json' });
  return { browser, page };
}

async function runCycle(browser, page, cycle) {
  let row;
  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
    const name = `bot-${Date.now()}-${attempt}`;
    row = await createVM(page, name);
    const status = await getStatus(row);
    log(cycle, `attempt ${attempt}: ${name} -> ${status}`);
    if (status === 'started') break;
    await destroyVM(page, row);
    row = null;
  }
  if (!row) throw new Error('VM never reached "started"');

  // From here on, ANY failure must still destroy this VM - otherwise it's leaked
  // (occupies the 1-VM slot for up to 55min) and every subsequent cycle fails too.
  try {
    log(cycle, 'waiting for tunnel URL...');
    const url = await getDesktopUrl(page, row);
    log(cycle, `desktop URL: ${url}`);

    log(cycle, 'opening desktop, sending deploy commands, verifying bot startup via log...');
    const deployResult = await deployBot(browser, url, { screenshotPath: `logs/cycle-${cycle}.png` });
    if (!deployResult.ok) {
      log(cycle, `bot did not start (${deployResult.reason}): ${deployResult.log.slice(-300) || '(empty log)'}`);
      return; // outer loop immediately spins up a fresh VM
    }
    log(cycle, `bot confirmed running: ${deployResult.log.trim().split('\n').pop()}`);

    // Poll until this VM is no longer "started" (auto-stop, crash, manual stop, etc).
    // Plain sleep (not page.waitForTimeout) - must not depend on the page being alive.
    while (true) {
      await sleep(POLL_INTERVAL_MS);
      await page.goto('https://labs.2z2.top/user');
      await page.getByRole('button', { name: 'Refresh' }).click();
      const status = await getStatus(row).catch(() => undefined);
      if (status !== 'started') {
        log(cycle, `status is now "${status}" - recycling VM`);
        break;
      }
    }
  } finally {
    await destroyVM(page, row).catch(() => {});
  }
}

(async () => {
  let { browser, page } = await launchSession();

  let cycle = 0;
  while (true) {
    cycle++;
    try {
      if (!browser.isConnected() || page.isClosed()) {
        log(cycle, 'browser/page was closed - relaunching a fresh session');
        ({ browser, page } = await launchSession());
      }
      await runCycle(browser, page, cycle);
    } catch (err) {
      log(cycle, `ERROR: ${err.message} - backing off and retrying`);
      await sleep(ERROR_BACKOFF_MS); // plain sleep - the page/browser may be dead right now
    }
  }
})();
