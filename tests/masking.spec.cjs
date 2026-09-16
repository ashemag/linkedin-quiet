const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../extension', name), 'utf8');
const card = (author, id = author, extra = '') => `<article class="feed-shared-update-v2" data-urn="urn:li:activity:${id}" id="${id}"><div class="update-components-actor"><a class="update-components-actor__meta-link" href="/in/${author}/">${author}</a></div><p>${author}'s post</p>${extra}<div class="comments-comments-list"><p id="comment-${id}">A comment from someone else</p><div contenteditable="true" role="textbox" aria-label="Write a comment"></div></div></article>`;
async function open(page, pathname, content, slug = 'example') {
  await page.route('https://www.linkedin.com/**', route => route.fulfill({contentType:'text/html', body:`<!doctype html><html><head><title>(7) LinkedIn</title><style>${read('quiet.css')}</style><script>${read('policy.js')}</script><script>window.savedSlug=${JSON.stringify(slug)};window.storageListeners=[];window.chrome={storage:{local:{get:async()=>({profileSlug:window.savedSlug}),set:async v=>{window.savedSlug=v.profileSlug;for(const fn of window.storageListeners)fn({profileSlug:{newValue:v.profileSlug}},'local');}},onChanged:{addListener:fn=>window.storageListeners.push(fn)}}};</script><script>${read('content.js')}</script></head><body><header id="global-nav">Messages Notifications Search</header><div class="scaffold-layout"><main>${content}</main><aside>Recommended people</aside></div><div class="msg-overlay-container">Private inbox content</div></body></html>`}));
  await page.goto(`https://www.linkedin.com${pathname}`);
  await expect(page.locator('#linkedin-quiet')).toBeAttached();
}
async function shown(page, selector) {
  return page.locator(selector).evaluate(el => {
    const style = getComputedStyle(el);
    return style.visibility === 'visible' && el.getClientRects().length > 0;
  });
}
test('feed and messages remain hidden, even if the feed contains my own post', async ({page}) => {
  await open(page, '/feed/', card('example', 'own'));
  expect(await shown(page, '#own')).toBe(false);
  expect(await shown(page, '.msg-overlay-container')).toBe(false);
  expect(await shown(page, '#global-nav')).toBe(false);
  await expect(page).toHaveTitle('LinkedIn Quiet');
  await page.evaluate(() => history.pushState({}, '', '/messaging/'));
  expect(await shown(page, '#own')).toBe(false);
});
test('only original own posts and their comments are shown', async ({page}) => {
  await open(page, '/in/example/recent-activity/shares/', card('example','own') + card('someone','other', '<a href="/in/example/">Mention of me</a>'));
  await expect(page.locator('#own')).toHaveAttribute('data-lq-root', '');
  expect(await shown(page, '#own')).toBe(true);
  expect(await shown(page, '#comment-own')).toBe(true);
  expect(await shown(page, '#other')).toBe(false);
  await page.locator('#own [contenteditable]').fill('A reply draft');
  await expect(page.locator('#own [contenteditable]')).toHaveText('A reply draft');
  expect(await shown(page, 'aside')).toBe(false);
});
test('direct links require author evidence; mentions do not grant access', async ({page}) => {
  await open(page, '/feed/update/urn:li:activity:123/', card('someone','other', '<a href="/in/example/">My comment</a>'));
  expect(await shown(page, '#other')).toBe(false);
  await page.locator('main').evaluate((el, html) => el.insertAdjacentHTML('beforeend',html), card('example','own'));
  await expect(page.locator('#own')).toHaveAttribute('data-lq-root','');
  expect(await shown(page, '#own')).toBe(true);
});
test('embedded own posts cannot reveal somebody else’s repost', async ({page}) => {
  await open(page, '/in/example/recent-activity/all/', card('someone','outer',card('example','nested')));
  expect(await shown(page, '#outer')).toBe(false);
  expect(await shown(page, '#nested')).toBe(false);
});
test('new and recycled cards are rechecked', async ({page}) => {
  await open(page, '/in/example/recent-activity/shares/', card('example','own'));
  await expect(page.locator('#own')).toHaveAttribute('data-lq-root','');
  await page.locator('#own a').evaluate(el => el.href='/in/someone/');
  await expect(page.locator('#own')).not.toHaveAttribute('data-lq-root','');
  expect(await shown(page, '#own')).toBe(false);
  await page.locator('main').evaluate((el,html)=>el.insertAdjacentHTML('beforeend',html),card('someone','new'));
  expect(await shown(page, '#new')).toBe(false);
});
test('own profile needs matching top-card identity and keeps sidebars masked', async ({page}) => {
  await open(page, '/in/example/', '<section class="pv-top-card"><a href="/in/example/overlay/photo/">Photo</a><h1 id="name">Example Person</h1></section><section><div id="experience">My experience</div></section><section><div id="interests">Suggested interests</div></section>');
  await expect(page.locator('main')).toHaveAttribute('data-lq-root','');
  expect(await shown(page, '#experience')).toBe(true);
  expect(await shown(page, '#interests')).toBe(false);
  expect(await shown(page, 'aside')).toBe(false);
  await page.evaluate(()=>history.pushState({},'','/in/someone/'));
  await expect(page.locator('main')).not.toHaveAttribute('data-lq-root','');
  expect(await shown(page, '#experience')).toBe(false);
});
test('an allowed URL cannot reveal stale content from another profile', async ({page}) => {
  await open(page, '/in/example/', '<section class="pv-top-card"><a href="/in/someone/overlay/photo/">Photo</a><h1 id="name">Someone else</h1></section>');
  expect(await shown(page, '#name')).toBe(false);
});
test('setup masks content and authentication remains usable', async ({page}) => {
  await open(page, '/feed/', '<p id="secret">Distractions</p>', null);
  expect(await shown(page, '#secret')).toBe(false);
  await page.goto('https://www.linkedin.com/login');
  await expect(page.locator('html')).toHaveAttribute('data-lq-auth','');
  expect(await shown(page, '#secret')).toBe(true);
  await page.evaluate(()=>history.pushState({},'','/feed/'));
  await expect(page.locator('html')).not.toHaveAttribute('data-lq-auth','');
  expect(await shown(page, '#secret')).toBe(false);
});
test('changing the saved profile revokes old access', async ({page}) => {
  await open(page, '/in/example/recent-activity/shares/', card('example','own'));
  await expect(page.locator('#own')).toHaveAttribute('data-lq-root','');
  await page.evaluate(()=>chrome.storage.local.set({profileSlug:'someone'}));
  await expect(page.locator('#own')).not.toHaveAttribute('data-lq-root','');
  expect(await shown(page, '#own')).toBe(false);
});
test('CSS alone masks the site before JavaScript starts', async ({page}) => {
  await page.setContent(`<style>${read('quiet.css')}</style><p id="feed">Distractions</p>`);
  expect(await shown(page,'#feed')).toBe(false);
});
