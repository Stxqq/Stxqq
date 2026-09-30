import test from 'node:test';
import assert from 'node:assert/strict';
import { dateWindow, publicRepositories, summarize, renderActivity, githubPages, UPDATE_MESSAGE } from './update-activity.mjs';

const now = new Date('2026-09-30T11:00:00Z');
const commit = (sha, date, message = 'Build something', author = 'Stxqq') => ({ sha, author: { login: author }, commit: { author: { date }, message } });

test('calendar covers 365 UTC days and aligns to Sunday, including leap years', () => {
  for (const value of [now, new Date('2024-03-01'), new Date('2026-01-04')]) {
    const { start, end, gridStart } = dateWindow(value);
    assert.equal((end - start) / 86_400_000, 364);
    assert.equal(gridStart.getUTCDay(), 0);
    assert.equal(start.getUTCHours(), 0);
    assert.ok(gridStart <= start);
  }
});

test('only explicitly public, owned, non-fork repositories are included', () => {
  const repo = { name: 'public', private: false, fork: false, owner: { login: 'Stxqq' } };
  assert.deepEqual(publicRepositories([repo, { ...repo, private: true }, { ...repo, private: undefined }, { ...repo, fork: true }, { ...repo, owner: { login: 'other' } }]), [repo]);
});

test('totals exclude other authors, duplicates, automated updates and out-of-range dates', () => {
  const result = summarize([
    commit('a', '2026-09-29T23:30:00-02:00'),
    commit('a', '2026-09-30T01:30:00Z'),
    commit('b', '2026-09-29T12:00:00Z'),
    commit('c', '2026-09-30T12:00:00Z', UPDATE_MESSAGE),
    commit('d', '2026-09-30T12:00:00Z', 'Other', 'someone'),
    commit('e', '2026-10-01T00:00:00Z'),
    commit('f', '2025-09-30T23:59:59Z'),
    commit('g', 'invalid'),
  ], now);
  assert.equal(result.total, 2);
  assert.equal(result.activeDays, 2);
  assert.equal(result.longestStreak, 2);
  assert.equal(result.days.at(-1).count, 1);
});

test('empty activity remains truthful, accessible, and renders one cell per day', () => {
  const stats = summarize([], now);
  const svg = renderActivity(stats, 0);
  assert.equal(stats.total, 0);
  assert.match(svg, /0 public commits across 0 active days/);
  assert.equal((svg.match(/<title>\d{4}-/g) || []).length, 365);
  assert.doesNotMatch(svg, /<title>2026-10-01/);
});

test('API pagination sends no credentials and fails on incomplete data', async () => {
  const calls = [];
  const result = await githubPages('/users/Stxqq/repos', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => calls.length === 1 ? Array(100).fill({ id: 1 }) : [{ id: 2 }] };
  });
  assert.equal(result.length, 101);
  assert.equal(calls[1].url.searchParams.get('page'), '2');
  assert.ok(calls.every(({ options }) => !Object.keys(options.headers).some((name) => name.toLowerCase() === 'authorization')));
  await assert.rejects(githubPages('/users/Stxqq/repos', async () => ({ ok: false, status: 403 })), /keeping the previous/);
  await assert.rejects(githubPages('https://example.com/data'), /Unexpected API origin/);
});
