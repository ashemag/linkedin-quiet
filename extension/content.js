(() => {
  'use strict';
  const { profileSlug, route } = LinkedInQuietPolicy;
  const CARD = '.feed-shared-update-v2, [data-urn^="urn:li:activity:"], [data-urn^="urn:li:ugcPost:"]';
  const ACTOR = '.update-components-actor__meta-link, .feed-shared-actor__container-link, .update-components-actor a[href*="/in/"], .feed-shared-actor a[href*="/in/"]';
  let slug = null;
  let currentURL = location.href;
  let scheduled = false;
  let host, shadow;
  let oldTitle = '';
  let statusKey = '';
  const roots = new Set();
  const paths = new Set();
  const owned = new Set();

  function mount() {
    if (!document.body || host?.isConnected) return;
    host = document.createElement('div');
    host.id = 'linkedin-quiet';
    shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>
      :host{all:initial;visibility:visible!important;color:#243b34;font:15px/1.55 system-ui,-apple-system,sans-serif}
      *{box-sizing:border-box} a,button,input{font:inherit} a{color:inherit;text-decoration:none}
      .bar{position:fixed;inset:0 0 auto;background:#f6f5f1;border-bottom:1px solid #dedfd6;height:76px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;gap:24px}
      .brand{font-weight:650;letter-spacing:-.5px;font-size:20px;white-space:nowrap}.mark{display:inline-grid;place-items:center;width:32px;height:32px;background:#264f40;color:#f6f5f1;border-radius:50%;margin-right:10px;font-family:Georgia,serif}
      nav{display:flex;gap:8px;align-items:center}nav a,button{border:1px solid #d4dbd4;border-radius:7px;padding:9px 14px;background:transparent;cursor:pointer;color:#243b34}nav a:hover,button:hover{background:#e9ede5}
      .card{max-width:650px;margin:11vh auto 40px;padding:44px;background:#fffefb;border:1px solid #dedfd6;border-radius:16px;box-shadow:0 10px 40px #243b3405}
      .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#5b7668;font-weight:700}h1{font:normal 42px/1.15 Georgia,serif;letter-spacing:-1px;margin:20px 0}p{color:#617168}label{display:block;margin:24px 0 7px;font-weight:600}input{width:100%;padding:12px;border:1px solid #c8d2c9;border-radius:7px;background:#fff}
      .save{margin-top:12px;background:#264f40;color:#fff}.save:hover{background:#35634f}.note{font-size:12px}.error{color:#a13d2d;min-height:20px} [hidden]{display:none!important}
      @media(max-width:600px){.bar{padding:0 15px;gap:8px}.brand{font-size:16px}.mark{display:none}nav a,button{padding:8px;font-size:12px}.card{margin:40px 14px;padding:28px}h1{font-size:34px}}
    </style>
    <header class="bar"><a class="brand" href="https://www.linkedin.com/"><span class="mark">q</span>LinkedIn Quiet</a><nav aria-label="Quiet navigation"><a id="profile">My profile</a><a id="posts">My posts</a><button id="settings" type="button">Settings</button></nav></header>
    <section class="card" id="card"><span class="eyebrow">A little less LinkedIn</span><h1 id="heading"></h1><p id="description"></p>
    <form id="form" hidden><label for="url">Your LinkedIn profile URL</label><input id="url" type="url" placeholder="https://www.linkedin.com/in/your-name/" required autocomplete="off"><button class="save" type="submit">Save my profile</button><p class="error" id="error" role="status"></p><p class="note">Saved only in this browser. No analytics. No account connection.</p></form></section>`;
    document.body.append(host);
    shadow.querySelector('#settings').onclick = () => showSettings();
    shadow.querySelector('#form').onsubmit = async event => {
      event.preventDefault();
      const next = profileSlug(shadow.querySelector('#url').value);
      if (!next) { shadow.querySelector('#error').textContent = 'Enter a full LinkedIn /in/ profile URL.'; return; }
      try {
        await chrome.storage.local.set({ profileSlug: next });
        slug = next;
        location.assign(`https://www.linkedin.com/in/${encodeURIComponent(next)}/`);
      } catch { shadow.querySelector('#error').textContent = 'Could not save. Reload this tab after reloading the extension.'; }
    };
  }
  function showSettings() {
    shadow.querySelector('#card').hidden = false;
    shadow.querySelector('#heading').textContent = 'Make room for your work.';
    shadow.querySelector('#description').textContent = 'Keep your profile, your posts, and the conversations on them. Leave the rest behind.';
    shadow.querySelector('#form').hidden = false;
    shadow.querySelector('#url').value = slug ? `https://www.linkedin.com/in/${encodeURIComponent(slug)}/` : '';
    shadow.querySelector('#url').focus();
  }
  function reconcile(set, next, attribute) {
    for (const el of set) if (!next.has(el)) { el.removeAttribute(attribute); set.delete(el); }
    for (const el of next) if (!set.has(el)) { el.setAttribute(attribute, ''); set.add(el); }
  }
  function authorIsMe(card) {
    // Only the card's own actor counts. Mentions, comments and embedded reposts never do.
    const actor = [...card.querySelectorAll(ACTOR)].find(a => a.closest(CARD) === card);
    return !!actor && profileSlug(actor.href) === slug;
  }
  function render() {
    scheduled = false;
    mount();
    if (!host) return;
    currentURL = location.href;
    const mode = route(currentURL, slug);
    const approved = new Set();
    const mine = new Set();
    const auth = mode === 'auth';
    document.documentElement.toggleAttribute('data-lq-auth', auth);
    host.hidden = auth;
    // The host CSS enforces display, so explicitly hide its contents for sign-in.
    shadow.querySelector('.bar').hidden = auth;
    if (!auth) {
      const title = mode === 'profile' ? 'My profile · LinkedIn Quiet' : mode === 'posts' || mode === 'post' ? 'My posts · LinkedIn Quiet' : 'LinkedIn Quiet';
      if (document.title !== title) document.title = title;
      oldTitle = title;
      if (['profile', 'posts', 'post'].includes(mode)) {
        for (const card of document.querySelectorAll(CARD)) if (authorIsMe(card)) mine.add(card);
        if (mode === 'profile') {
          const main = document.querySelector('main');
          const top = main?.querySelector('.pv-top-card, [data-view-name="profile-top-card"]');
          const matches = top && [...top.querySelectorAll('a[href]')].some(a => {
            const path = new URL(a.href, location.href).pathname.replace(/\/overlay\/(photo|about-this-profile)\/?.*$/, '/');
            return profileSlug(path) === slug;
          });
          if (matches) approved.add(main);
          // Recommendations, interests and activity beyond original posts are distractions.
          for (const id of ['interests', 'recommendations', 'people-also-viewed', 'people-you-may-know']) {
            document.getElementById(id)?.closest('section')?.setAttribute('data-lq-hide', '');
          }
        } else {
          for (const card of mine) {
            // Never expose an owned card inside somebody else's repost/container.
            const outer = card.parentElement?.closest(CARD);
            if (!outer || mine.has(outer)) approved.add(card);
          }
        }
      }
    }
    reconcile(owned, mine, 'data-lq-own');
    const ancestors = new Set();
    for (const el of approved) for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) ancestors.add(parent);
    reconcile(roots, approved, 'data-lq-root');
    reconcile(paths, ancestors, 'data-lq-path');
    const key = `${slug}:${mode}:${approved.size > 0}`;
    if (statusKey !== key) {
      statusKey = key;
      shadow.querySelector('#profile').href = slug ? `https://www.linkedin.com/in/${encodeURIComponent(slug)}/` : '#';
      shadow.querySelector('#posts').href = slug ? `https://www.linkedin.com/in/${encodeURIComponent(slug)}/recent-activity/shares/` : '#';
      shadow.querySelector('#profile').hidden = !slug;
      shadow.querySelector('#posts').hidden = !slug;
      shadow.querySelector('#form').hidden = true;
      shadow.querySelector('#card').hidden = auth || approved.size > 0;
      shadow.querySelector('#heading').textContent = mode === 'blocked' ? 'Nothing to catch up on.' : 'Your space is quiet.';
      shadow.querySelector('#description').textContent = ['post', 'posts', 'profile'].includes(mode)
        ? 'Waiting for content that matches your profile. If nothing appears, check your saved URL in Settings. Unrecognized posts stay hidden.'
        : 'The feed, messages, and notifications are tucked away. Your profile and your posts are right here when you need them.';
      if (mode === 'setup') showSettings();
    }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; queueMicrotask(render); }
  }
  new MutationObserver(mutations => {
    if (mutations.some(m => m.type === 'childList' || m.attributeName === 'href' || m.attributeName === 'class' || m.attributeName === 'data-urn')) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'class', 'data-urn'] });
  // History changes do not always mutate the DOM. Mask immediately on in-page link clicks.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (link.origin === location.origin && route(link.href, slug) !== route(location.href, slug)) {
      reconcile(roots, new Set(), 'data-lq-root');
      reconcile(paths, new Set(), 'data-lq-path');
    }
  }, true);
  function maskForNavigation() {
    document.documentElement.removeAttribute('data-lq-auth');
    reconcile(roots, new Set(), 'data-lq-root');
    reconcile(paths, new Set(), 'data-lq-path');
  }
  // Chrome's Navigation API sees pushState/replaceState before the next paint.
  if (window.navigation) {
    navigation.addEventListener('navigate', maskForNavigation);
    navigation.addEventListener('currententrychange', schedule);
  }
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);
  setInterval(() => { if (location.href !== currentURL || document.title !== oldTitle && route(location.href, slug) !== 'auth') schedule(); }, 100);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.profileSlug) {
      const next = changes.profileSlug.newValue;
      slug = typeof next === 'string' ? profileSlug(`/in/${encodeURIComponent(next)}/`) : null;
      schedule();
    }
  });
  chrome.storage.local.get('profileSlug').then(settings => {
    slug = typeof settings.profileSlug === 'string' ? profileSlug(`/in/${encodeURIComponent(settings.profileSlug)}/`) : null;
    schedule();
  }).catch(schedule);
  schedule();
})();
