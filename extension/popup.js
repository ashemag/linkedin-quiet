'use strict';
const input = document.querySelector('#profile');
function update(slug) {
  document.querySelector('#links').hidden = !slug;
  if (!slug) return;
  const url = `https://www.linkedin.com/in/${encodeURIComponent(slug)}/`;
  input.value = url;
  document.querySelector('#mine').href = url;
  document.querySelector('#posts').href = `${url}recent-activity/shares/`;
}
chrome.storage.local.get('profileSlug').then(({ profileSlug: slug }) => update(slug));
document.querySelector('#settings').onsubmit = async event => {
  event.preventDefault();
  const slug = LinkedInQuietPolicy.profileSlug(input.value);
  const status = document.querySelector('#status');
  if (!slug) { status.textContent = 'Enter a full HTTPS LinkedIn /in/ profile URL.'; return; }
  try {
    await chrome.storage.local.set({ profileSlug: slug });
    update(slug);
    status.textContent = 'Saved. Your open LinkedIn tabs update automatically.';
  } catch { status.textContent = 'Could not save. Reopen the extension and try again.'; }
};
