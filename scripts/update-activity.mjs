import { writeFile, readFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const OWNER = 'Stxqq';
export const UPDATE_MESSAGE = 'chore: refresh public profile activity [skip ci]';
const DAY = 86_400_000;
const ROOT = new URL('../', import.meta.url);
const COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const key = (date) => date.toISOString().slice(0, 10);
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

export function dateWindow(now = new Date()) {
  const end = new Date(`${key(now)}T00:00:00Z`);
  const start = new Date(+end - 364 * DAY);
  const gridStart = new Date(+start - start.getUTCDay() * DAY);
  return { start, end, gridStart };
}

export function publicRepositories(repos) {
  return repos.filter((repo) => repo.private === false && repo.fork === false
    && repo.owner?.login?.toLowerCase() === OWNER.toLowerCase());
}

export function summarize(commits, now = new Date()) {
  const { start, end, gridStart } = dateWindow(now);
  const days = Array.from({ length: 365 }, (_, i) => ({ date: key(new Date(+start + i * DAY)), count: 0 }));
  const byDate = new Map(days.map((day) => [day.date, day]));
  const seen = new Set();
  for (const commit of commits) {
    if (!commit.sha || seen.has(commit.sha)) continue;
    if (commit.author?.login?.toLowerCase() !== OWNER.toLowerCase()) continue;
    if (commit.commit?.message?.split('\n')[0] === UPDATE_MESSAGE) continue;
    const date = new Date(commit.commit?.author?.date);
    if (!Number.isFinite(+date)) continue;
    const day = byDate.get(key(date));
    if (!day) continue;
    seen.add(commit.sha);
    day.count += 1;
  }
  let streak = 0;
  let longestStreak = 0;
  for (const day of days) {
    streak = day.count ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
  }
  return { days, start, end, gridStart, total: seen.size, activeDays: days.filter((d) => d.count).length, longestStreak };
}

export function renderActivity(stats, repositoryCount) {
  const { days, start, end, gridStart, total, activeDays, longestStreak } = stats;
  const byDate = new Map(days.map((day) => [day.date, day.count]));
  const columns = Math.ceil(((+end - +gridStart) / DAY + 1) / 7);
  const level = (count) => count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
  let cells = '';
  let labels = '';
  let lastMonth = -1;
  for (let col = 0; col < columns; col++) {
    const sunday = new Date(+gridStart + col * 7 * DAY);
    const midweek = new Date(+sunday + 3 * DAY);
    if (midweek.getUTCMonth() !== lastMonth && col < columns - 2) {
      labels += `<text x="${46 + col * 13}" y="68">${MONTHS[midweek.getUTCMonth()]}</text>`;
      lastMonth = midweek.getUTCMonth();
    }
    let week = '';
    for (let row = 0; row < 7; row++) {
      const date = new Date(+sunday + row * DAY);
      const count = byDate.get(key(date));
      if (count === undefined) continue;
      week += `<rect x="${46 + col * 13}" y="${74 + row * 13}" width="10" height="10" rx="2" fill="${COLORS[level(count)]}" stroke="#ffffff" stroke-opacity=".04" stroke-width=".5"><title>${key(date)}: ${count} public ${count === 1 ? 'commit' : 'commits'}</title></rect>`;
    }
    cells += `<g class="week" style="animation-delay:${col * 18}ms">${week}</g>`;
  }
  const formattedDate = (date) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  const description = `${total} public commits across ${activeDays} active days. Longest streak: ${longestStreak} days. ${repositoryCount} public owned repositories. ${formattedDate(start)} to ${formattedDate(end)}, UTC. Default branches only; automated profile updates excluded.`;
  // Native GitHub proportions and Sunday-first rows. The self-contained CSS
  // animates once inside an SVG image; unsupported/reduced-motion viewers get
  // the fully visible static chart. No data is changed by the animation.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="204" viewBox="0 0 900 204" role="img" aria-labelledby="title desc">
<title id="title">STXQ · Public activity</title><desc id="desc">${escape(description)}</desc>
<style>
  @keyframes reveal { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
  @media (prefers-reduced-motion: no-preference) {
    .week { animation-name: reveal; animation-duration: 560ms; animation-timing-function: cubic-bezier(.16,1,.3,1); animation-fill-mode: both; animation-iteration-count: 1; }
  }
</style>
<rect width="900" height="204" fill="#0d1117"/>
<g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif">
<text x="0" y="24" font-size="16" fill="#e6edf3">${total} public ${total === 1 ? 'commit' : 'commits'} in the last year</text>
<rect x=".5" y="39.5" width="745" height="160" rx="6" fill="none" stroke="#3d444d"/>
<g font-size="12" fill="#e6edf3">${labels}<text x="15" y="95">Mon</text><text x="15" y="121">Wed</text><text x="15" y="147">Fri</text></g>
${cells}
<text x="41" y="183" fill="#9198a1" font-size="12">Learn how we count public commits</text>
<g font-size="12" fill="#9198a1"><text x="576" y="183">Less</text>${COLORS.map((color, i) => `<rect x="${607 + i * 14}" y="173" width="10" height="10" rx="2" fill="${color}"/>`).join('')}<text x="677" y="183">More</text></g>
<rect x="778" y="7" width="118" height="34" rx="6" fill="#1f6feb"/>
<text x="794" y="29" fill="#ffffff" font-size="13" font-weight="500">${end.getUTCFullYear()}</text>
</g></svg>\n`;
}

// Intentionally unauthenticated: this generator can only read public data,
// even when the workflow itself has permission to commit the resulting SVG.
export async function githubPages(path, fetcher = fetch) {
  const all = [];
  for (let page = 1; page <= 100; page++) {
    const url = new URL(path, 'https://api.github.com');
    if (url.origin !== 'https://api.github.com') throw new Error('Unexpected API origin');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    const response = await fetcher(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'stxqq-public-profile' }, signal: AbortSignal.timeout(30_000) });
    if (response.status === 409 && url.pathname.endsWith('/commits')) return all; // Empty repository.
    if (!response.ok) throw new Error(`GitHub API failed (${response.status}); keeping the previous activity card.`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Unexpected GitHub API response');
    all.push(...batch);
    if (batch.length < 100) return all;
  }
  throw new Error('Pagination limit reached; refusing to publish incomplete totals.');
}

export async function updateActivity(now = new Date()) {
  const { start, end } = dateWindow(now);
  const repos = publicRepositories(await githubPages(`/users/${OWNER}/repos?type=owner`));
  const commits = [];
  for (const repo of repos) {
    // Match author.login locally. GitHub's server-side author lookup can return
    // no results for a private profile even when its public commits are readable.
    const params = new URLSearchParams({ since: start.toISOString(), until: new Date(+end + DAY - 1).toISOString() });
    commits.push(...await githubPages(`/repos/${OWNER}/${encodeURIComponent(repo.name)}/commits?${params}`));
  }
  const stats = summarize(commits, now);
  const target = new URL('assets/activity.svg', ROOT);
  const temporary = new URL('assets/activity.svg.tmp', ROOT);
  const svg = renderActivity(stats, repos.length);
  let previous = '';
  try { previous = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (svg !== previous) {
    await writeFile(temporary, svg);
    await rename(temporary, target);
  }
  console.log(`${stats.total} public commits, ${stats.activeDays} active days, ${repos.length} public repositories.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await updateActivity();
}
