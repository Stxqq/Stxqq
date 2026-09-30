import { writeFile, readFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const OWNER = 'Stxqq';
export const UPDATE_MESSAGE = 'chore: refresh public profile activity [skip ci]';
const DAY = 86_400_000;
const ROOT = new URL('../', import.meta.url);
const COLORS = ['#151e2e', '#163b7c', '#205cca', '#3985ff', '#9cc5ff'];
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const key = (date) => date.toISOString().slice(0, 10);
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

export function dateWindow(now = new Date()) {
  const end = new Date(`${key(now)}T00:00:00Z`);
  const start = new Date(+end - 364 * DAY);
  const gridStart = new Date(+start - ((start.getUTCDay() + 6) % 7) * DAY);
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
    const monday = new Date(+gridStart + col * 7 * DAY);
    const thursday = new Date(+monday + 3 * DAY);
    if (thursday.getUTCMonth() !== lastMonth && col < columns - 2) {
      labels += `<text x="${65 + col * 17}" y="194">${MONTHS[thursday.getUTCMonth()]}</text>`;
      lastMonth = thursday.getUTCMonth();
    }
    for (let row = 0; row < 7; row++) {
      const date = new Date(+monday + row * DAY);
      const count = byDate.get(key(date));
      if (count === undefined) continue;
      cells += `<rect x="${65 + col * 17}" y="${211 + row * 17}" width="12" height="12" rx="3" fill="${COLORS[level(count)]}"><title>${key(date)}: ${count} öffentliche Commits</title></rect>`;
    }
  }
  const metrics = [[String(total), 'Öffentliche Commits'], [String(activeDays), 'Aktive Tage'], [String(longestStreak), 'Längste Serie · Tage'], [String(repositoryCount), 'Öffentliche Repositories']];
  const formattedDate = (date) => new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const description = `${total} öffentliche Commits an ${activeDays} Tagen. ${repositoryCount} öffentliche eigene Repositories. Zeitraum ${formattedDate(start)} bis ${formattedDate(end)}, UTC. Nur Standard-Branches; automatische Profilaktualisierungen ausgeschlossen.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="415" viewBox="0 0 1000 415" role="img" aria-labelledby="title desc">
<title id="title">STXQ · Öffentliche Aktivität</title><desc id="desc">${escape(description)}</desc>
<rect x=".5" y=".5" width="999" height="414" rx="20" fill="#090e18" stroke="#223047"/>
<g font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif">
<circle cx="33" cy="33" r="4" fill="#3985ff"/><text x="47" y="38" fill="#bed0ed" font-size="12" letter-spacing="2">STXQ / ACTIVITY</text>
<text x="968" y="38" text-anchor="end" fill="#9eabc0" font-size="12">${formattedDate(start)} – ${formattedDate(end)}</text>
${metrics.map(([value, label], i) => `<text x="${32 + i * 242}" y="108" font-size="36" font-weight="600" fill="#f2f6ff">${value}</text><text x="${32 + i * 242}" y="133" font-size="13" fill="#9eabc0">${label}</text>`).join('')}
<path d="M32 159H968" stroke="#202b3d"/>
<g fill="#9eabc0" font-size="11">${labels}<text x="32" y="220">Mo</text><text x="32" y="254">Mi</text><text x="32" y="288">Fr</text><text x="32" y="322">So</text></g>
${cells}
<text x="32" y="358" fill="#aebdd3" font-size="12">Ein Tag. Ein Feld. Echte öffentliche Commits.</text>
<g fill="#9eabc0" font-size="11"><text x="734" y="358">Weniger</text>${COLORS.map((color, i) => `<rect x="${790 + i * 19}" y="347" width="12" height="12" rx="3" fill="${color}"/>`).join('')}<text x="895" y="358">Mehr</text></g>
<path d="M32 377H968" stroke="#202b3d"/>
<text x="32" y="400" fill="#889bb8" font-size="11">365 Tage · Standard-Branches · UTC · ohne automatische Profil-Updates</text>
<text x="968" y="400" text-anchor="end" fill="#889bb8" font-size="11">Stand ${formattedDate(end)}</text>
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
