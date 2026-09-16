# Changelog

## 0.2.0

- Add **New post** to the page navigation and extension popup. Reveal recognized native composer dialogs and a native Start a post fallback, while keeping the feed and messages masked.
- Preserve invisible loading geometry on the own-posts page and allow the native Load more posts control.
- Recheck only new/changed post authors and batch work once per animation frame. Revoke stale ownership immediately, before verification.
- Remove the 100 ms URL/title poll from browsers with Navigation API support.
- Pass 21 standalone browser fixture checks and three route-policy tests. On a 100-post fixture, unrelated changes recheck zero authors and one author change rechecks one.

Live signed-in LinkedIn timing/compatibility and the packaged-extension smoke test remain unverified in the authoring environment.

## 0.1.0

- Initial local-only profile/post/comment filtering, default-hidden CSS, setup screen, popup, MIT license, and fixture tests.
