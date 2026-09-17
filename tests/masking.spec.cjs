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
test('posting composer is usable without revealing the feed or other dialogs', async ({page}) => {
  await open(page, '/feed/?shareActive=true', card('example','own') + '<div class="artdeco-modal share-box-v2__modal" role="dialog"><div id="editor" role="textbox" aria-label="Write a post" contenteditable="true"></div><button id="publish">Post</button></div><div role="dialog" id="unrelated">Message dialog</div>');
  await expect(page.locator('#editor')).toBeVisible();
  await page.locator('#editor').fill('A draft for my next post');
  await expect(page.locator('#editor')).toBeFocused();
  await expect(page.locator('#publish')).toBeVisible();
  expect(await shown(page,'#own')).toBe(false);
  expect(await shown(page,'#unrelated')).toBe(false);
  await page.evaluate(()=>history.replaceState({},'','/feed/'));
  await expect(page.locator('#editor')).toBeVisible();
  await page.locator('#editor').evaluate(el=>el.closest('[role="dialog"]').remove());
  expect(await shown(page,'#own')).toBe(false);
});
test('native loading areas retain layout and load-more buttons are usable',async ({page})=>{
  await open(page,'/in/example/recent-activity/shares/','<div id="sentinel" style="height:20px">Hidden loader</div><button class="scaffold-finite-scroll__load-button" id="more">Load more</button>');
  await expect(page.locator('main')).toHaveAttribute('data-lq-layout','');
  expect(await page.locator('#sentinel').evaluate(el=>el.getBoundingClientRect().height)).toBe(20);
  expect(await shown(page,'#sentinel')).toBe(false);
  await expect(page.locator('#more')).toBeVisible();
});
test('unrelated changes do not recheck all authors',async ({page})=>{
  await open(page,'/in/example/recent-activity/shares/',Array.from({length:100},(_,i)=>card('example','p'+i)).join('')+'<span id="noise"></span>');
  await expect(page.locator('#p99')).toHaveAttribute('data-lq-own','');
  await page.evaluate(()=>{
    window.actorChecks=0;
    const original=Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll=function(selector){
      if(selector.startsWith('.update-components-actor__meta-link'))window.actorChecks++;
      return original.call(this,selector);
    };
    document.querySelector('#noise').className='changed';
  });
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>window.actorChecks)).toBe(0);
  await page.locator('#p50 a').evaluate(el=>el.href='/in/other/');
  await expect(page.locator('#p50')).not.toHaveAttribute('data-lq-own','');
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>window.actorChecks)).toBe(1);
});
test('generated-class composer keeps its native publishing footer visible', async ({page}) => {
  await open(page, '/feed/?shareActive=true', card('example','own') + '<dialog open class="generated-layout"><div role="textbox" contenteditable="true" aria-label="Write a post" id="modern-editor"></div><footer><button id="modern-post">Post</button></footer></dialog><div role="dialog" id="message"><div role="textbox" contenteditable="true"></div><button>Send</button></div>');
  await expect(page.locator('#modern-editor')).toBeVisible();
  await expect(page.locator('#modern-post')).toBeVisible();
  expect(await shown(page, '#own')).toBe(false);
  expect(await shown(page, '#message')).toBe(false);
});
test('semantic composer is not allowed on messaging routes', async ({page}) => {
  await open(page, '/messaging/', '<div role="dialog"><div role="textbox" contenteditable="true" id="unrelated-editor"></div><button>Post</button></div>');
  expect(await shown(page, '#unrelated-editor')).toBe(false);
});
