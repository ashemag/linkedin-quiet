# Contributing

Small improvements, accessibility fixes, and anonymized layout fixtures are welcome.

1. Fork and clone the repository.
2. Run `npm ci` and `npx playwright install chromium`.
3. Make your change and run `npm test`.
4. Open a pull request describing the behavior and your validation.

For layout bugs, include Chrome version, extension version, route type (profile/posts/direct post), and a redacted minimal markup example when possible. Never upload private messages, credentials, personal contact information, or an unredacted page export.

Ownership must come from the post's own author link. Never allow a card because it mentions the user, contains a comment by them, or embeds one of their posts. Keep unknown layouts hidden and add a regression test for each selector change.
