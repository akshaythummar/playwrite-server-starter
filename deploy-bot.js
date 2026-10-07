// Opens the remote XFCE desktop, opens a terminal, and fires the bot's setup+run command chain.
// Then verifies it actually started (vs crashed) by reading the bot's log through the remote
// clipboard (xclip) - confirmed working and exact, unlike OCR on the VNC canvas.
// Coordinates (55,13)=Applications menu, (83,71)=Terminal Emulator were calibrated against the
// linuxserver/webtop:ubuntu-xfce image at 1280x720 - recalibrate with calibrate-desktop.js if the
// image/resolution ever changes.
const APPS_MENU = { x: 55, y: 13 };
const TERMINAL_ITEM = { x: 83, y: 71 };

const REPO_DIR = 'TeraBox-Downloader-Bot';
const LOG_FILE = 'bot.log';

// Just long enough to confirm the command was typed and Enter landed - the remote shell keeps
// running the install/launch chain in the background after we disconnect (confirmed: closing the
// Playwright page does not kill the remote session).
const CONFIRM_WAIT_MS = 5000;

const VERIFY_INTERVAL_MS = 15 * 1000;
const VERIFY_TIMEOUT_MS = 5 * 60 * 1000; // apt+pip+gdown can be slow on a cold VM

const SUCCESS_RE = /Bot is running/i;
const FAILURE_RE = /Traceback \(most recent call last\)|ModuleNotFoundError|No module named|command not found|Permission denied|E: Unable to/i;

const DEPLOY_CMD = [
  'sudo apt update',
  'sudo apt install -y python3 python3-pip python3-venv git ffmpeg',
  `git clone -b amazon-ktworker https://github.com/akshaythummar/TeraBox-Downloader-Bot.git`,
  `cd ${REPO_DIR}`,
  'python3 -m venv venv',
  'source venv/bin/activate',
  'pip install -r requirements.txt',
  'pip install gdown',
  'gdown 1V7rUX-G5r5iNXc88aGss4xX6JMyMwPd0 -O config.py',
  'head -5 config.py',
  // Backgrounded + logged so this terminal frees up and a second terminal can read the log.
  `nohup python main.py > ${LOG_FILE} 2>&1 & disown`,
].join(' && ');

async function openTerminal(page) {
  await page.mouse.click(APPS_MENU.x, APPS_MENU.y);
  await page.waitForTimeout(1000);
  await page.mouse.click(TERMINAL_ITEM.x, TERMINAL_ITEM.y);
  await page.waitForTimeout(3000);
}

async function readClipboard(page) {
  return page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
}

async function deployBot(browser, desktopUrl, { screenshotPath } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();

  // The tunnel URL resolves before it's actually reachable - first load(s) can
  // come back "can't be reached"; it settles within a few seconds.
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await page.goto(desktopUrl, { waitUntil: 'networkidle', timeout: 15000 });
      break;
    } catch {
      await page.waitForTimeout(3000);
    }
  }
  await page.waitForTimeout(6000);

  await openTerminal(page);
  await page.keyboard.type(DEPLOY_CMD);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(CONFIRM_WAIT_MS);

  // Separate terminal so we're not fighting the one running apt/pip/gdown for input.
  await openTerminal(page);

  let result = { ok: false, reason: 'timeout', log: '' };
  const deadline = Date.now() + VERIFY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await page.keyboard.type(`cat ~/${REPO_DIR}/${LOG_FILE} 2>/dev/null | xclip -selection clipboard`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const text = await readClipboard(page);
    if (SUCCESS_RE.test(text)) {
      result = { ok: true, log: text };
      break;
    }
    if (FAILURE_RE.test(text)) {
      result = { ok: false, reason: 'crash', log: text };
      break;
    }
    await page.waitForTimeout(VERIFY_INTERVAL_MS);
  }

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  await context.close();
  return result;
}

module.exports = { deployBot, DEPLOY_CMD, SUCCESS_RE, FAILURE_RE };
