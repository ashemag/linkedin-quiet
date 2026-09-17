# LinkedIn Quiet

**Your profile. Your posts. Conversations on your posts. Everything else stays quiet.**

An open-source Chrome extension that masks LinkedIn's feed, messages, notifications, search, jobs, network, other profiles, and recommendation sidebars. No account connection, server, analytics, or runtime dependencies. MIT licensed.

## Install in Chrome

1. Download and unzip the [latest release](https://github.com/ashemag/linkedin-quiet/releases/latest), or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.
4. Open or refresh LinkedIn. Enter your full profile URL, for example `https://www.linkedin.com/in/your-name/`. You can also save it from the extension popup.
5. Use **My profile**, **My posts**, or **New post** in the new navigation bar. **New post** is also in the extension popup.

No build step is needed. To update, replace the extension files, click **Reload** on its Chrome extension card, and refresh LinkedIn tabs. To temporarily see normal LinkedIn, disable the extension on `chrome://extensions` and reload the page.

## What stays visible

| Area | Behavior |
| --- | --- |
| Your profile | Main profile content, after matching its top-card profile link to your saved URL |
| Your posts | Original post cards whose author link matches your saved profile |
| Create a post | **New post** opens LinkedIn’s native composer; the feed remains masked |
| Comments and replies on your posts | Native comments and inline reply controls inside an approved post |
| Direct post links | Hidden until the displayed post's author can be verified |
| Feed, messages, notifications, other profiles, jobs, network | Masked, including direct URLs |
| Reactions/comments activity tabs | Masked; they can expose other people's posts |
| Embedded reposts and recommendations | Hidden when recognized; embedded posts are never used as ownership evidence |
| Sign-in and security challenges | Available so you can sign in normally |

The saved URL defines whose content you want to see. It is **not** an account-authentication check. If you switch LinkedIn accounts, update the URL in Settings.

## Privacy

Only a profile identifier is stored in `chrome.storage.local`. The extension examines the DOM of LinkedIn pages already open in your browser to find profile and author links. It makes no network requests and does not store posts, comments, messages, credentials, or browsing history. It only requests Chrome's `storage` permission and declares content scripts for `https://linkedin.com/*` and `https://www.linkedin.com/*`.

This is a visual attention filter, not a network blocker or security boundary: LinkedIn can still load masked content in the background. It does not mute browser/OS push notifications or email; manage those separately if desired. Notification counts in the page title are replaced while masking is active.

## Compatibility and limitations

This release is tested against synthetic LinkedIn-style DOM fixtures. The suite also includes an unpacked-extension smoke test for Chromium. The missing-editor issue was observed in a signed-in LinkedIn session, but the corrected composer has **not yet been verified in that live session**. LinkedIn frequently changes its markup and uses different layouts across accounts. Unknown post layouts stay hidden. If your profile or posts remain masked, verify your saved URL first; a selector update may be needed.

Supported profile routes are `/in/<you>/` and `/in/<you>/recent-activity/shares/` (also `all/`, filtered to your own posts). The native post composer is allowed on the feed and your own profile/post routes. On an explicit **New post** request, the extension exposes LinkedIn's real **Start a post** control while preserving the invisible page layout needed by lazy-loaded controls. You click that native control directly; the extension does not simulate the click. It can discover controls and composers inside LinkedIn's open shadow DOM as well as older document-level dialogs. Discovery checks stop after 20 seconds. **New post** on the same page or **Open editor** explicitly looks again; clicking New post while writing focuses the existing editor without discarding the draft. **Reload posting page** is available if native controls never appear. Recognized composer settings dialogs are allowed; unfamiliar media/audience dialogs may still need selector updates. Profile detail/editor overlays, standalone article readers, private sharing, and other routes remain masked. Inline comments are supported. The extension never clicks Post, submits a draft, or calls LinkedIn APIs for you. It does not auto-scroll; native scroll-triggered loading and recognized **Load more posts** buttons remain available on your posts page.

Masking CSS is injected at `document_start` before the page renders. DOM mutations invalidate changed cards immediately and batch verification once per animation frame. Existing authors are not rechecked for unrelated changes. The Navigation API revokes visible roots on in-page navigation; a URL check is used only in browsers without that API. Invisible loading areas retain their layout on your posts page and during explicit posting sessions so native loading observers can still run. No DOM-based extension can guarantee perfect filtering across arbitrary future LinkedIn layouts.

## Development

Node.js 22+:

```sh
npm ci
npx playwright install chromium
npm test
npm run package
```

`extension/` is the complete distributable. `dist/linkedin-quiet-0.2.3.zip` contains the extension plus its license, README, and privacy notice. The packaging script requires the standard `zip` command.

- `policy.js`: shared strict URL/profile rules.
- `content.js`: ownership checks, local setup, and navigation handling.
- `quiet.css`: default-hidden styling and distraction suppression.
- `popup.*`: local configuration and shortcuts.
- `tests/`: route policy, visibility, ownership, navigation, and unpacked-extension checks.

See [CONTRIBUTING.md](CONTRIBUTING.md) for selector updates and bug reports. Independent project; not affiliated with or endorsed by LinkedIn.

The GitHub Actions template is in `ci/github-actions.yml`. To enable it, copy it to `.github/workflows/test.yml` using a GitHub credential with workflow permissions.

### Standalone browser checks

If your environment cannot launch Playwright, run `node scripts/browser-check.mjs` and open `http://127.0.0.1:8765`. This executes 34 synthetic visibility/navigation/composer/loading checks using the production CSS and scripts, with test-only localhost URL and Chrome-storage adapters. Version 0.2.3 passed all 34 checks in the Codex in-app browser and three Node policy tests. New regressions cover a native Start a post control and an already-open composer inside shadow DOM, including keeping unrelated dialogs, the feed, and messages hidden and removing temporary shadow masking after navigation. The 100-post fixture verified zero author rechecks after an unrelated mutation and exactly one after one author-link edit. This measures extension work, not end-to-end LinkedIn server latency. Composer tests submit only a local fixture; no real LinkedIn post was published. The full Playwright suite and actual unpacked-extension smoke test were not executed successfully in the authoring sandbox because it blocked Chromium launch.
