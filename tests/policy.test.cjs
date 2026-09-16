const { test } = require('node:test');
const assert = require('node:assert/strict');
const { profileSlug, route } = require('../extension/policy.js');
test('accepts only exact LinkedIn profile URLs', () => {
  assert.equal(profileSlug('https://www.linkedin.com/in/Example-Person/?x=1'), 'example-person');
  assert.equal(profileSlug('linkedin.com/in/example-person'), 'example-person');
  assert.equal(profileSlug('/in/jo%C3%A3o/'), 'joão');
  for (const value of ['https://linkedin.com.evil.com/in/me/', 'https://evil.com/in/me/', 'javascript:alert(1)', 'https://linkedin.com/in/foo%2Fbar', 'https://me@linkedin.com/in/me', 'http://linkedin.com/in/me', 'https://linkedin.com/in/me/recent-activity/all/', '', 'me']) assert.equal(profileSlug(value), null, value);
});
test('routes are closed by default', () => {
  const me = 'example';
  for (const path of ['/feed/', '/messaging/', '/notifications/', '/jobs/', '/mynetwork/', '/search/', '/in/someone-else/', '/in/example/recent-activity/comments/', '/in/example/recent-activity/reactions/', '/in/example/details/skills/', '/unknown']) assert.equal(route(path, me), 'blocked', path);
  assert.equal(route('/in/example/', me), 'profile');
  assert.equal(route('/in/example/recent-activity/shares/', me), 'posts');
  assert.equal(route('/in/example/recent-activity/all/', me), 'posts');
  assert.equal(route('/feed/update/urn:li:activity:123/', me), 'post');
  assert.equal(route('/posts/example_test-activity-123-abcd', me), 'post');
  assert.equal(route('/login', null), 'auth');
  assert.equal(route('/checkpoint/challenge', null), 'auth');
  assert.equal(route('/feed/', null), 'setup');
});

test('posting routes reveal a composer without admitting the feed', () => {
  assert.equal(profileSlug('https://www.linkedin.com/feed/?shareActive=true'), null);
  assert.equal(route('/feed/?shareActive=true', 'example'), 'compose');
  assert.equal(route('/feed/?shareActive=false', 'example'), 'blocked');
  assert.equal(route('/feed/', 'example'), 'blocked');
  assert.equal(route('/feed/?shareActive=true', null), 'setup');
  assert.equal(route('/messaging/?shareActive=true', 'example'), 'blocked');
});
