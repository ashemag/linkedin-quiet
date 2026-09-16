const { test, expect, chromium } = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
test('real unpacked extension injects masking and stores popup settings', async () => {
  const extensionPath = path.join(__dirname, '../extension');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-test-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    await context.route('https://www.linkedin.com/**', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>LinkedIn</title></head><body><main><p id="feed">Feed distractions</p></main></body></html>'}));
    const page = await context.newPage();
    await page.goto('https://www.linkedin.com/feed/');
    await expect(page.locator('#linkedin-quiet')).toBeAttached();
    await expect(page.locator('#feed')).toBeHidden();
    const session = await context.newCDPSession(page);
    const { executionContexts } = { executionContexts: [] };
    session.on('Runtime.executionContextCreated', ({context})=>executionContexts.push(context));
    await session.send('Runtime.enable');
    const isolated = executionContexts.find(c=>c.origin.startsWith('chrome-extension://'));
    expect(isolated).toBeTruthy();
    const popup = await context.newPage();
    await popup.goto(`${isolated.origin}/popup.html`);
    await popup.locator('#profile').fill('https://www.linkedin.com/in/example/');
    await popup.getByRole('button',{name:'Save profile'}).click();
    await expect(popup.locator('#status')).toContainText('Saved.');
    await expect(popup.locator('#posts')).toHaveAttribute('href','https://www.linkedin.com/in/example/recent-activity/shares/');
    await expect(page.locator('#feed')).toBeHidden();
  } finally { await context.close(); fs.rmSync(profile,{recursive:true,force:true}); }
});
