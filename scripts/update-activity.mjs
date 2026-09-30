import { writeFile, readFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const OWNER = 'Stxqq';
export const UPDATE_MESSAGE = 'chore: refresh public profile activity [skip ci]';
const DAY = 86_400_000;
const ROOT = new URL('../', import.meta.url);
const COLORS = ['#283345', '#3670ad', '#549aea', '#88c3ff', '#d3edff'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
      labels += `<text x="${91 + col * 20}" y="168">${MONTHS[thursday.getUTCMonth()]}</text>`;
      lastMonth = thursday.getUTCMonth();
    }
    for (let row = 0; row < 7; row++) {
      const date = new Date(+monday + row * DAY);
      const count = byDate.get(key(date));
      if (count === undefined) continue;
      const intensity = level(count);
      const x = 91 + col * 20;
      const y = 190 + row * 20;
      const today = key(date) === key(end);
      cells += `<g><title>${key(date)}: ${count} public ${count === 1 ? 'commit' : 'commits'}${today ? ' (today)' : ''}</title><rect x="${x}" y="${y}" width="15" height="15" rx="4.5" fill="url(#cell-${intensity})" stroke="${today ? '#e3f2ff' : '#d7eaff'}" stroke-opacity="${today ? '.8' : intensity ? '.28' : '.07'}" stroke-width="${today ? '1.2' : '.65'}"/>${intensity ? `<path d="M${x + 4} ${y + 1.7}h7" stroke="#fff" stroke-opacity=".36" stroke-width=".8" stroke-linecap="round"/>` : ''}</g>`;
    }
  }
  const metrics = [[String(total), 'Public commits'], [String(activeDays), 'Active days'], [String(longestStreak), 'Longest streak', 'days'], [String(repositoryCount), 'Public repositories']];
  const formattedDate = (date) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  const description = `${total} public commits across ${activeDays} active days. Longest streak: ${longestStreak} days. ${repositoryCount} public owned repositories. ${formattedDate(start)} to ${formattedDate(end)}, UTC. Default branches only; automated profile updates excluded.`;
  // GitHub renders a self-contained image. Layered gradients and edge reflections
  // create glass depth without scripts, external fonts, or external assets.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="590" viewBox="0 0 1200 590" role="img" aria-labelledby="title desc">
<title id="title">STXQ · Public activity</title><desc id="desc">${escape(description)}</desc>
<defs>
  <linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#283343"/><stop offset=".43" stop-color="#121c2b"/><stop offset="1" stop-color="#0e1520"/></linearGradient>
  <radialGradient id="light" cx=".05" cy="0" r=".95"><stop stop-color="#dceeff" stop-opacity=".22"/><stop offset=".55" stop-color="#bfdcff" stop-opacity=".015"/><stop offset="1" stop-color="#bfdcff" stop-opacity="0"/></radialGradient>
  <radialGradient id="blue" cx=".9" cy="1" r=".85"><stop stop-color="#357fe0" stop-opacity=".32"/><stop offset=".66" stop-color="#357fe0" stop-opacity=".04"/><stop offset="1" stop-color="#357fe0" stop-opacity="0"/></radialGradient>
  <linearGradient id="edge" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#f1f8ff" stop-opacity=".65"/><stop offset=".22" stop-color="#c9e2ff" stop-opacity=".16"/><stop offset=".54" stop-color="#b0d6ff" stop-opacity=".055"/><stop offset=".83" stop-color="#d7ecff" stop-opacity=".26"/><stop offset="1" stop-color="#ecf7ff" stop-opacity=".48"/></linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".09"/><stop offset=".5" stop-color="#c5dcff" stop-opacity=".025"/><stop offset="1" stop-color="#fff" stop-opacity=".065"/></linearGradient>
  <linearGradient id="well" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#091321" stop-opacity=".5"/><stop offset="1" stop-color="#111f34" stop-opacity=".24"/></linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#fff" stop-opacity=".25"/><stop offset=".45" stop-color="#dfedff" stop-opacity=".045"/><stop offset="1" stop-color="#bfdcff" stop-opacity=".18"/></linearGradient>
  <linearGradient id="shine"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".34" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="numbers" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#d3e2f4"/></linearGradient>
  ${COLORS.map((color, i) => `<linearGradient id="cell-${i}" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="${i ? COLORS[Math.min(4, i + 1)] : '#8299b7'}" stop-opacity="${i ? '1' : '.13'}"/><stop offset="1" stop-color="${color}" stop-opacity="${i ? '1' : '.42'}"/></linearGradient>`).join('')}
</defs>
<rect x="6" y="6" width="1188" height="578" rx="36" fill="url(#base)"/>
<rect x="6" y="6" width="1188" height="578" rx="36" fill="url(#light)"/>
<rect x="6" y="6" width="1188" height="578" rx="36" fill="url(#blue)"/>
<rect x="6.75" y="6.75" width="1186.5" height="576.5" rx="35.25" fill="none" stroke="url(#edge)" stroke-width="1.5"/>
<rect x="10" y="10" width="1180" height="570" rx="32" fill="none" stroke="#fff" stroke-opacity=".035"/>
<path d="M52 8H780" stroke="url(#shine)" stroke-width="1.5"/>
<g font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Arial, sans-serif">
<text x="48" y="72" fill="#f3f7fe" font-size="34" font-weight="600" letter-spacing="-1">Activity</text>
<text x="49" y="101" fill="#b5c3d6" font-size="16">A year of public code.</text>
<rect x="920" y="40" width="232" height="37" rx="18.5" fill="url(#glass)" stroke="url(#rim)"/>
<circle cx="940" cy="58.5" r="3" fill="#c9e3ff"/>
<text x="955" y="63" fill="#e1ebf9" font-size="14">Updated ${formattedDate(end)}</text>
<text x="1151" y="101" text-anchor="end" fill="#b5c3d6" font-size="14">${formattedDate(start)} – ${formattedDate(end)}</text>
<rect x="41" y="135" width="1118" height="246" rx="23" fill="url(#well)" stroke="url(#rim)"/>
<g fill="#becadd" font-size="14">${labels}<text x="55" y="202">M</text><text x="55" y="242">W</text><text x="55" y="282">F</text><text x="55" y="322">S</text></g>
${cells}
<rect x="62" y="346" width="12" height="12" rx="3.5" fill="none" stroke="#d6e9ff" stroke-opacity=".8"/>
<text x="84" y="357" fill="#afc0d5" font-size="13">Today</text>
<g fill="#afc0d5" font-size="13"><text x="932" y="357">Less</text>${COLORS.map((color, i) => `<rect x="${975 + i * 23}" y="345" width="15" height="15" rx="4.5" fill="url(#cell-${i})" stroke="#e0edff" stroke-opacity=".14" stroke-width=".65"/>`).join('')}<text x="1101" y="357">More</text></g>
<rect x="41" y="403" width="1118" height="132" rx="25" fill="url(#glass)" stroke="url(#rim)"/>
<path d="M318 434v70M597 434v70M876 434v70" stroke="#d1e3ff" stroke-opacity=".12"/>
${metrics.map(([value, label, unit], i) => `<text x="${69 + i * 279}" y="466" font-size="41" font-weight="500" letter-spacing="-1" fill="url(#numbers)">${value}${unit ? `<tspan font-size="16" letter-spacing="0" dx="9" fill="#b7c8df">${unit}</tspan>` : ''}</text><text x="${70 + i * 279}" y="502" font-size="15" fill="#c2d0e3">${label}</text>`).join('')}
<text x="49" y="565" fill="#a0b3ce" font-size="12.5">Public repositories · Default branches · UTC</text>
<text x="1151" y="565" text-anchor="end" fill="#bbcee7" font-size="12.5">STXQ</text>
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
