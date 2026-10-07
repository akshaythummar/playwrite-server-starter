// Shared VM dashboard helpers used by create-vm.js and run-bot-forever.js.
const CF_URL_RE = /https:\/\/[a-z0-9.-]*trycloudflare\.com\S*|https:\/\/\S*\.2z2\.top\S*/i;
const STATUS_RE = /\b(started|stopped|starting|paused|failed|error|pending|creating)\b/i;

function rowFor(page, name) {
  return page
    .locator('p', { hasText: name })
    .first()
    .locator('xpath=ancestor::div[.//button[@title="Launch Desktop"]][1]');
}

async function getStatus(row) {
  return (await row.innerText()).match(STATUS_RE)?.[1]?.toLowerCase();
}

async function destroyVM(page, row) {
  await row.getByTitle('Delete').click();
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: /delete|confirm|yes/i }).click();
  }
  await page.getByRole('button', { name: 'Refresh' }).click();
}

// The dashboard only allows 1 VM at a time - whether it's ours (left over from a
// crashed run) or someone manually created one through the UI, Create VM would
// otherwise fail with an error toast and strand createVM() waiting on a Refresh
// button that's blocked behind that toast. Clear the slate first, every time.
async function clearExistingVMs(page) {
  await page.goto('https://labs.2z2.top/user');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.waitForTimeout(500);
  // Click the first Delete button repeatedly rather than scoping to "a row" -
  // locator('div', {has: ...}).first() can resolve to an ancestor wrapping
  // multiple rows when 2+ VMs exist, causing a strict-mode ambiguous-click error.
  while (await page.getByTitle('Delete').first().isVisible().catch(() => false)) {
    await page.getByTitle('Delete').first().click();
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: /delete|confirm|yes/i }).click();
    }
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Refresh' }).click();
  }
}

async function createVM(page, name) {
  await clearExistingVMs(page);
  await page.getByRole('button', { name: 'New VM' }).click();
  await page.getByPlaceholder('my-vm').fill(name);
  await page.getByRole('button', { name: 'Create VM' }).click();
  // The new row needs a manual refresh before its action buttons show up.
  await page.getByRole('button', { name: 'Refresh' }).click();
  const row = rowFor(page, name);
  await row.waitFor();
  return row;
}

// Clicks Launch Desktop and waits for the cloudflared tunnel URL to show up in the dialog.
async function getDesktopUrl(page, row) {
  await row.getByTitle('Launch Desktop').click();
  const dialog = page.getByRole('dialog');
  try {
    await dialog.waitFor();
    await page.waitForFunction(
      (reStr) => new RegExp(reStr, 'i').test(document.body.innerText),
      CF_URL_RE.source,
      { timeout: 6 * 60 * 1000 }
    );
    const bodyText = await dialog.innerText();
    return bodyText.match(CF_URL_RE)[0];
  } finally {
    // Must run even on timeout/throw - an open dialog blocks every button behind it
    // for the next cycle (this caused a ~45min stuck loop in practice).
    await page.keyboard.press('Escape').catch(() => {});
  }
}

module.exports = {
  CF_URL_RE,
  STATUS_RE,
  rowFor,
  createVM,
  getStatus,
  destroyVM,
  getDesktopUrl,
  clearExistingVMs,
};
