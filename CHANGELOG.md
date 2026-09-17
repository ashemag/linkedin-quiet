# Changelog

## 0.2.3

- Find LinkedIn's native Start a post control and composer inside open shadow DOM, matching LinkedIn's current desktop layout.
- Show the actual native Start a post control so the user's click carries browser user activation; stop trying to open it with a scripted click.
- Recognize current composers that no longer use a dialog role while keeping unrelated dialogs, feed cards, and messages masked.
- Reinstall the shadow-root mask if LinkedIn replaces a component's contents while opening the editor.
- Pass 34 local browser fixture checks and three route-policy tests, including shadow-root trigger, composer, and cleanup regressions.

## 0.2.2

- Preserve invisible feed-page geometry during posting so lazy native controls can initialize without exposing feed content or messages.
- Continue bounded initialization checks for 20 seconds instead of exhausting retries in 1.4 seconds; stop automatic opening once the composer appears.
- Make New post retry on the current posting page and focus an existing draft instead of navigating away.
- Replace instructions pointing to a missing button with Open editor and Reload posting page controls.
- Recognize Start a post controls with extra accessible help text and native editables without an explicit textbox role.
- Remove the temporary local diagnostic before packaging.
- Pass 31 local browser fixture checks and three route-policy tests. The lazy-loading and delayed-handler regressions fail on 0.2.1 and pass here. Work was based on the supplied screenshot; this release has not been verified in the user's live LinkedIn session.

## 0.2.1

- Recognize newer native composer dialogs using their editable field and Post control, instead of relying solely on older class names.
- Keep native composer footers visible so their Post button is not masked.
- Open the native Start a post control when LinkedIn ignores an explicit new-post URL; use bounded initialization retries and stop after the composer is seen.
- Recognize Start a post by its accessible label as well as older selectors.
- Pass 24 browser fixture checks and three route-policy tests. The original missing-editor issue was observed live; the fix still needs live-session verification.

## 0.2.0

- Add **New post** to the page navigation and extension popup. Reveal recognized native composer dialogs and a native Start a post fallback, while keeping the feed and messages masked.
- Preserve invisible loading geometry on the own-posts page and allow the native Load more posts control.
- Recheck only new/changed post authors and batch work once per animation frame. Revoke stale ownership immediately, before verification.
- Remove the 100 ms URL/title poll from browsers with Navigation API support.
- Pass 21 standalone browser fixture checks and three route-policy tests. On a 100-post fixture, unrelated changes recheck zero authors and one author change rechecks one.

Live signed-in LinkedIn timing/compatibility and the packaged-extension smoke test remain unverified in the authoring environment.

## 0.1.0

- Initial local-only profile/post/comment filtering, default-hidden CSS, setup screen, popup, MIT license, and fixture tests.
