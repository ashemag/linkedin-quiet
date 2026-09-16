/* Shared by the extension and policy tests. No network or browser dependencies. */
(function (root) {
  'use strict';
  function profileSlug(value) {
    try {
      const raw = String(value || '').trim();
      const url = new URL(raw.startsWith('/') ? raw : /^https?:\/\//i.test(raw) ? raw : `https://${raw}`, 'https://www.linkedin.com');
      if (url.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(url.hostname) || url.username || url.password || url.port) return null;
      const match = url.pathname.match(/^\/in\/([^/]+)\/?$/);
      if (!match) return null;
      const slug = decodeURIComponent(match[1]).normalize('NFC').toLowerCase();
      return /^[\p{L}\p{N}_-]+$/u.test(slug) ? slug : null;
    } catch { return null; }
  }
  function route(value, slug) {
    try {
      const url = new URL(value, 'https://www.linkedin.com');
      if (url.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(url.hostname)) return 'blocked';
      // Authentication must remain available even before a profile is configured.
      if (/^\/(login|uas\/login|checkpoint|challenge|uas\/consumer-email-challenge)(\/|$)/.test(url.pathname)) return 'auth';
      if (!slug) return 'setup';
      if (/^\/feed\/?$/.test(url.pathname) && url.searchParams.get('shareActive') === 'true') return 'compose';
      const match = url.pathname.match(/^\/in\/([^/]+)(\/.*)?$/);
      if (match && profileSlug(`/in/${match[1]}/`) === slug) {
        const tail = match[2] || '/';
        if (tail === '/') return 'profile';
        if (/^\/recent-activity\/(all|shares)\/?$/.test(tail)) return 'posts';
      }
      if (/^\/feed\/update\/urn:li:(activity|ugcPost|share):\d+\/?$/.test(url.pathname) || /^\/posts\/[^/]+\/?$/.test(url.pathname)) return 'post';
      return 'blocked';
    } catch { return 'blocked'; }
  }
  const api = Object.freeze({ profileSlug, route });
  if (typeof module !== 'undefined') module.exports = api;
  else root.LinkedInQuietPolicy = api;
})(globalThis);
