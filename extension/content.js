(() => {
  'use strict';
  const { profileSlug, route } = LinkedInQuietPolicy;
  const CARD = '.feed-shared-update-v2, [data-urn^="urn:li:activity:"], [data-urn^="urn:li:ugcPost:"]';
  const ACTOR = '.update-components-actor__meta-link, .feed-shared-actor__container-link, .update-components-actor a[href*="/in/"], .feed-shared-actor a[href*="/in/"]';
  let slug = null;
  let currentURL = location.href;
  let scheduled = false;
  let fullScan = true;
  let composeSession = false;
  let composerSeen = false;
  let openingAttempts = 0;
  let openingTimer = null;
  let openingDeadline = 0;
  // Keep native initialization targets measurable from document_start.
  const requestedCompose = () => /^\/feed\/?$/.test(location.pathname) && new URL(location.href).searchParams.get('shareActive') === 'true';
  document.documentElement.toggleAttribute('data-lq-compose', requestedCompose());
  const cards = new Set();
  const dirtyCards = new Set();
  const actors = new WeakMap();
  const surfaces = new Set();
  const pending = new Set();
  const layouts = new Set();
  const COMPOSER = '.share-box-v2__modal, .share-box__modal, .share-creation-state, [data-test-share-creation-modal]';
  const POST_DIALOG = '.share-box-audience-dialog, .share-box-post-settings, .share-box-visibility-options, .share-box__discard-dialog';
  const START_POST = 'button.share-box-feed-entry__trigger, button[data-control-name="share.sharebox_focus"]';
  const DIALOG = '[role="dialog"], dialog, [aria-modal="true"], .artdeco-modal';
  const composerRoots = new Set();
  const labelOf = el => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
  function isComposer(dialog) {
    if (dialog.matches('[hidden], [aria-hidden="true"], dialog:not([open])') || dialog.style.display === 'none') return false;
    if (dialog.matches(COMPOSER + ', ' + POST_DIALOG) || dialog.querySelector(COMPOSER + ', ' + POST_DIALOG)) return true;
    if (!composeSession || !dialog.matches(DIALOG)) return false;
    // Newer LinkedIn layouts use generated classes. Verify the editor and the
    // publishing control together instead of revealing arbitrary dialogs.
    const editor = dialog.querySelector('[contenteditable="true"], textarea[aria-label]');
    return !!editor && [...dialog.querySelectorAll('button, [role="button"]')].some(button => /^post$/i.test(labelOf(button)));
  }
  function startPostButtons() {
    return [...document.querySelectorAll('button, [role="button"]')].filter(button =>
      !button.closest(CARD + ', .msg-overlay-container') &&
      !button.closest('[hidden], [aria-hidden="true"]') &&
      (button.matches(START_POST) || /^start a post(?:$|[\s,.…])/i.test(labelOf(button))));
  }
  function requestComposer(event) {
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
    if (!/^\/feed\/?$/.test(location.pathname)) return;
    event?.preventDefault();
    const editor = [...composerRoots].find(el => el.isConnected)?.querySelector('[contenteditable="true"], textarea');
    if (editor) { editor.focus(); return; }
    composeSession = true;
    composerSeen = false;
    openingAttempts = 0;
    openingDeadline = Date.now() + 20000;
    clearTimeout(openingTimer); openingTimer = null;
    document.documentElement.setAttribute('data-lq-compose', '');
    schedule();
  }
  const LOAD_MORE = 'button.scaffold-finite-scroll__load-button';
  let host, shadow;
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
      .compose-actions{display:flex;flex-wrap:wrap;gap:8px} .compose-card{position:fixed;top:100px;left:50%;transform:translateX(-50%);width:calc(100% - 28px);margin:7vh 0 0}
      .save{margin-top:12px;background:#264f40;color:#fff}.save:hover{background:#35634f}.note{font-size:12px}.error{color:#a13d2d;min-height:20px} [hidden]{display:none!important}
      @media(max-width:600px){.bar{padding:0 15px;gap:8px}.brand{font-size:14px}.mark{display:none}nav{gap:4px}nav a,button{padding:7px;font-size:11px}.card{margin:40px 14px;padding:28px}h1{font-size:34px}}
    </style>
    <header class="bar"><a class="brand" href="https://www.linkedin.com/"><span class="mark">q</span>LinkedIn Quiet</a><nav aria-label="Quiet navigation"><a id="profile">My profile</a><a id="posts">My posts</a><a id="compose" href="https://www.linkedin.com/feed/?shareActive=true">New post</a><button id="settings" type="button">Settings</button></nav></header>
    <section class="card" id="card"><span class="eyebrow">A little less LinkedIn</span><h1 id="heading"></h1><p id="description"></p>
    <div id="compose-actions" class="compose-actions" hidden><button id="retry-compose" type="button">Open editor</button><button id="reload-compose" type="button">Reload posting page</button></div>
    <form id="form" hidden><label for="url">Your LinkedIn profile URL</label><input id="url" type="url" placeholder="https://www.linkedin.com/in/your-name/" required autocomplete="off"><button class="save" type="submit">Save my profile</button><p class="error" id="error" role="status"></p><p class="note">Saved only in this browser. No analytics. No account connection.</p></form></section>`;
    document.body.append(host);
    shadow.querySelector('#compose').onclick = requestComposer;
    shadow.querySelector('#retry-compose').onclick = requestComposer;
    shadow.querySelector('#reload-compose').onclick = () => location.assign('https://www.linkedin.com/feed/?shareActive=true');
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
    shadow.querySelector('#compose-actions').hidden = true;
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
  function invalidateCard(card, revoke = true) {
    if (!card) return;
    dirtyCards.add(card);
    if (!revoke) return;
    // Revoke before the next paint; verification itself is batched per frame.
    card.removeAttribute('data-lq-own');
    owned.delete(card);
    card.removeAttribute('data-lq-root');
    roots.delete(card);
  }
  function collectCards(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(CARD)) { cards.add(node); invalidateCard(node); }
    for (const card of node.querySelectorAll(CARD)) { cards.add(card); invalidateCard(card); }
  }
  function refreshOwnership() {
    if (fullScan) {
      for (const card of document.querySelectorAll(CARD)) { cards.add(card); dirtyCards.add(card); }
      fullScan = false;
    }
    for (const card of cards) {
      if (!card.isConnected || !card.matches(CARD)) {
        card.removeAttribute('data-lq-own');
        card.removeAttribute('data-lq-pending');
        cards.delete(card); owned.delete(card); pending.delete(card); dirtyCards.delete(card);
      }
    }
    for (const card of dirtyCards) {
      if (!cards.has(card)) continue;
      // Comments, mentions, and embedded reposts never establish ownership.
      const actor = [...card.querySelectorAll(ACTOR)].find(a => a.closest(CARD) === card);
      actors.set(card, actor);
      const mine = !!actor && profileSlug(actor.href) === slug;
      card.toggleAttribute('data-lq-own', mine);
      if (mine) owned.add(card); else owned.delete(card);
      card.toggleAttribute('data-lq-pending', !actor);
      if (!actor) pending.add(card); else pending.delete(card);
    }
    dirtyCards.clear();
  }
  function ancestorsOf(elements) {
    const result = new Set();
    for (const el of elements) for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) result.add(parent);
    return result;
  }
  function render() {
    scheduled = false;
    mount();
    if (!host) return;
    if (currentURL !== location.href) fullScan = true;
    currentURL = location.href;
    const mode = route(currentURL, slug);
    const isFeed = /^\/feed\/?$/.test(location.pathname);
    composeSession = mode === 'compose' || (composeSession && isFeed);
    document.documentElement.toggleAttribute('data-lq-compose', composeSession && !!slug);
    if (composeSession && !openingDeadline) openingDeadline = Date.now() + 20000;
    const approved = new Set();
    const loading = new Set();
    const composing = new Set();
    const auth = mode === 'auth';
    document.documentElement.toggleAttribute('data-lq-auth', auth);
    host.hidden = auth;
    shadow.querySelector('.bar').hidden = auth;
    let hasComposer = false;
    let hasContent = false;
    if (!auth) {
      const title = mode === 'profile' ? 'My profile · LinkedIn Quiet' : mode === 'posts' || mode === 'post' ? 'My posts · LinkedIn Quiet' : composeSession ? 'New post · LinkedIn Quiet' : 'LinkedIn Quiet';
      if (document.title !== title) document.title = title;
      if (['profile', 'posts', 'post'].includes(mode)) {
        refreshOwnership();
        const main = document.querySelector('main');
        if (mode === 'profile') {
          const top = main?.querySelector('.pv-top-card, [data-view-name="profile-top-card"]');
          const matches = top && [...top.querySelectorAll('a[href]')].some(a => {
            const path = new URL(a.href, location.href).pathname.replace(/\/overlay\/(photo|about-this-profile)\/?.*$/, '/');
            return profileSlug(path) === slug;
          });
          if (matches) approved.add(main);
          for (const id of ['interests', 'recommendations', 'people-also-viewed', 'people-you-may-know']) {
            document.getElementById(id)?.closest('section')?.setAttribute('data-lq-hide', '');
          }
        } else {
          for (const card of owned) {
            let safe = true;
            for (let outer = card.parentElement?.closest(CARD); outer; outer = outer.parentElement?.closest(CARD)) {
              if (!owned.has(outer)) { safe = false; break; }
            }
            if (safe) approved.add(card);
          }
        }
        hasContent = approved.size > 0;
        if (mode === 'posts' && main) {
          // Keep the native loading/sentinel geometry, without revealing its text.
          loading.add(main);
          for (const button of main.querySelectorAll(LOAD_MORE)) approved.add(button);
        }
      } else {
        reconcile(owned, new Set(), 'data-lq-own');
        reconcile(pending, new Set(), 'data-lq-pending');
        cards.clear(); dirtyCards.clear(); fullScan = true;
      }
      // Only recognized post-creation surfaces, never all dialogs or the feed.
      if (slug && (isFeed || ['profile', 'posts', 'post'].includes(mode))) {
        const candidates = new Set(document.querySelectorAll(DIALOG));
        for (const marker of document.querySelectorAll(COMPOSER + ', ' + POST_DIALOG)) candidates.add(marker.closest(DIALOG) || marker);
        for (const dialog of candidates) {
          if (!isComposer(dialog)) continue;
          approved.add(dialog);
          composing.add(dialog);
          hasComposer = true;
        }
        if (isFeed && composeSession && !hasComposer) {
          for (const button of startPostButtons()) approved.add(button);
        }
      }
    }
    const ancestors = ancestorsOf([...approved, ...loading]);
    for (const el of loading) ancestors.add(el);
    reconcile(composerRoots, composing, 'data-lq-composer');
    reconcile(layouts, loading, 'data-lq-layout');
    reconcile(roots, approved, 'data-lq-root');
    surfaces.clear();
    for (const root of approved) if (!root.matches(CARD)) surfaces.add(root);
    reconcile(paths, ancestors, 'data-lq-path');
    if (!composeSession) {
      composerSeen = false; openingAttempts = 0; openingDeadline = 0;
      clearTimeout(openingTimer); openingTimer = null;
    } else if (hasComposer) {
      composerSeen = true;
      clearTimeout(openingTimer); openingTimer = null;
    } else if (!composerSeen && Date.now() < openingDeadline && !openingTimer) {
      const trigger = startPostButtons().find(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true' && getComputedStyle(button).display !== 'none' && button.getClientRects().length);
      // Keep looking while lazy controls and their handlers initialize. Both the
      // retries and polling end after 20 seconds; an explicit click starts over.
      openingTimer = setTimeout(() => { openingTimer = null; schedule(); }, 1000);
      if (trigger && openingAttempts < 10) {
        openingAttempts++;
        trigger.click(); // Start a post only. Never click Post or submit a draft.
      }
    }
    const opening = composeSession && !composerSeen && Date.now() < openingDeadline;
    const key = `${slug}:${mode}:${hasContent}:${hasComposer}:${composeSession}:${opening}`;
    if (statusKey !== key) {
      statusKey = key;
      shadow.querySelector('#profile').href = slug ? `https://www.linkedin.com/in/${encodeURIComponent(slug)}/` : '#';
      shadow.querySelector('#posts').href = slug ? `https://www.linkedin.com/in/${encodeURIComponent(slug)}/recent-activity/shares/` : '#';
      for (const id of ['profile', 'posts', 'compose']) shadow.querySelector('#' + id).hidden = !slug;
      shadow.querySelector('#form').hidden = true;
      shadow.querySelector('#compose-actions').hidden = !composeSession;
      shadow.querySelector('#card').classList.toggle('compose-card', composeSession);
      shadow.querySelector('#card').hidden = auth || hasContent || hasComposer;
      shadow.querySelector('#heading').textContent = composeSession ? opening ? 'Opening your editor…' : 'Ready for your next idea.' : mode === 'blocked' ? 'Nothing to catch up on.' : 'Your space is quiet.';
      shadow.querySelector('#description').textContent = composeSession
        ? opening ? 'Waiting for LinkedIn’s posting controls to load. Your feed and messages stay hidden.' : 'Select Open editor to try again. If LinkedIn’s controls haven’t loaded, reload the posting page. Your feed stays hidden.'
        : ['post', 'posts', 'profile'].includes(mode)
          ? 'Waiting for content that matches your profile. If nothing appears, check your saved URL in Settings. Unrecognized posts stay hidden.'
          : 'The feed, messages, and notifications are tucked away. Your profile and your posts are right here when you need them.';
      if (mode === 'setup') showSettings();
    }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(render); }
  }
  new MutationObserver(mutations => {
    const contentMode = ['profile', 'posts', 'post'].includes(route(location.href, slug));
    for (const mutation of mutations) {
      const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
      if (!target || target === host) continue;
      if (contentMode) {
        const card = target.closest(CARD);
        const actor = card && actors.get(card);
        const newActor = mutation.type === 'childList' && [...mutation.addedNodes].some(node =>
          node.nodeType === Node.ELEMENT_NODE && (node.matches(ACTOR) || node.querySelector(ACTOR)));
        // Ordinary edits/comments keep focus; only ownership changes revoke visibility.
        const ownershipChanged = !actor || !actor.isConnected || target === card || target.contains(actor) || actor.contains(target) || newActor;
        invalidateCard(card, ownershipChanged);
        if (cards.has(target)) invalidateCard(target); // Includes a card that just lost its class/URN.
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) collectCards(node);
        } else if (mutation.attributeName === 'class' || mutation.attributeName === 'data-urn') {
          // A wrapper can become a card around existing content.
          if (target.matches(CARD)) { cards.add(target); invalidateCard(target); }
        }
      }
      // Revoke recycled dialogs without disturbing focus while the user types.
      for (const root of surfaces) {
        const dialogLostMarker = root.matches(DIALOG) && !isComposer(root);
        const profileIdentityChanged = root.matches('main') && root.contains(target) &&
          (target.closest('.pv-top-card, [data-view-name="profile-top-card"]') || mutation.attributeName === 'class');
        if (!root.isConnected || dialogLostMarker || profileIdentityChanged) {
          root.removeAttribute('data-lq-root'); roots.delete(root); surfaces.delete(root);
        }
      }
    }
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'class', 'data-urn', 'role', 'aria-label', 'aria-modal', 'contenteditable', 'hidden', 'aria-hidden'] });
  function maskForNavigation() {
    document.documentElement.removeAttribute('data-lq-auth');
    reconcile(roots, new Set(), 'data-lq-root');
    surfaces.clear();
    reconcile(paths, new Set(), 'data-lq-path');
    reconcile(layouts, new Set(), 'data-lq-layout');
    reconcile(composerRoots, new Set(), 'data-lq-composer');
    reconcile(owned, new Set(), 'data-lq-own');
    reconcile(pending, new Set(), 'data-lq-pending');
    cards.clear(); dirtyCards.clear(); fullScan = true;
  }
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (link.origin === location.origin && route(link.href, slug) !== route(location.href, slug)) maskForNavigation();
  }, true);
  if (window.navigation) {
    navigation.addEventListener('navigate', maskForNavigation);
    navigation.addEventListener('currententrychange', schedule);
  }
  addEventListener('popstate', () => { maskForNavigation(); schedule(); });
  addEventListener('hashchange', schedule);
  addEventListener('pageshow', schedule);
  // Modern Chrome reports navigation directly; polling is only for older engines.
  if (!window.navigation) setInterval(() => {
    if (location.href !== currentURL) { maskForNavigation(); schedule(); }
  }, 250);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.profileSlug) {
      const next = changes.profileSlug.newValue;
      slug = typeof next === 'string' ? profileSlug(`/in/${encodeURIComponent(next)}/`) : null;
      maskForNavigation();
      schedule();
    }
  });
  chrome.storage.local.get('profileSlug').then(settings => {
    slug = typeof settings.profileSlug === 'string' ? profileSlug(`/in/${encodeURIComponent(settings.profileSlug)}/`) : null;
    fullScan = true;
    schedule();
  }).catch(schedule);
  schedule();
})();
