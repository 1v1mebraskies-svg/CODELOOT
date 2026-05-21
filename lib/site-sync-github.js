/**
 * Sync game page shells and remove stale pages via GitHub API after games.json updates.
 */
const { createOrUpdateFile, deleteFile } = require('./github-api.js');

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gameImageFile(game) {
  if (game.image) return game.image;
  if (game.slug) return game.slug + '.png';
  return 'code-loot-hero.png';
}

function buildGamePageShell(game) {
  const slug = game.slug;
  const name = game.name || slug;
  const desc = game.long_description || game.short_description || game.description || '';
  const img = gameImageFile(game);
  const count = (game.codes || []).filter((c) => c.status === 'active').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${esc(name)} codes: ${esc(desc)}. ${count} verified codes with quick copy and daily monitoring.">
    <title>${esc(name)} Codes | CodeLoot</title>
    <link rel="stylesheet" href="../style.css">
    <link rel="icon" href="../assets/favicon.png" type="image/png">
    <link rel="canonical" href="https://codeloot.codes/games/${esc(slug)}.html">
</head>
<body data-site-root=".." data-game-slug="${esc(slug)}">
    <header class="site-header">
        <nav class="navbar container" aria-label="Primary navigation">
            <a class="brand" href="../index.html" aria-label="CodeLoot home">
                <span class="brand-mark">CL</span>
                <span class="brand-name">CodeLoot</span>
            </a>
            <form class="site-search" role="search" data-site-search>
                <label class="sr-only" for="site-search">Search games</label>
                <input id="site-search" type="search" name="q" placeholder="Search Roblox games" autocomplete="off" data-game-search>
                <button type="submit">Search</button>
            </form>
        </nav>
    </header>
    <main>
        <section class="game-hero">
            <div class="container">
                <div class="game-banner card">
                    <img src="../assets/img/${esc(img)}" onerror="this.src='../assets/img/code-loot-hero.png'" alt="${esc(name)} banner">
                    <div class="game-banner-copy">
                        <p class="eyebrow">Roblox codes</p>
                        <h1>${esc(name)} Codes</h1>
                        <p>${esc(desc)}</p>
                    </div>
                </div>
            </div>
        </section>
        <section class="container stats-grid game-stats" aria-label="${esc(name)} code stats">
            <article class="stat-card card">
                <span class="stat-value">${count}</span>
                <span class="stat-label">active codes tracked</span>
            </article>
        </section>
        <section class="container content-layout">
            <div class="content-main card">
                <div class="panel-heading">
                    <p class="eyebrow">Active codes</p>
                    <h2>Working ${esc(name)} rewards</h2>
                </div>
                <div class="code-grid" data-codes-grid></div>
                <section class="no-codes" hidden>
                    <p class="eyebrow">No active codes</p>
                    <h2>No working codes right now</h2>
                </section>
            </div>
        </section>
    </main>
    <footer class="site-footer">
        <div class="container footer-grid">
            <div>
                <a class="brand footer-brand" href="../index.html" aria-label="CodeLoot home">
                    <span class="brand-mark">CL</span>
                    <span class="brand-name">CodeLoot</span>
                </a>
            </div>
        </div>
    </footer>
    <script src="../js/codeloot-data.js"></script>
    <script src="../app.js"></script>
</body>
</html>
`;
}

async function syncGamePagesToGithub(gamesData, options) {
  const opts = options || {};
  const slugFilter = Array.isArray(opts.slugs) && opts.slugs.length ? new Set(opts.slugs) : null;
  const games = gamesData.games || [];
  const active = games.filter((g) => g.active !== false && g.slug);
  const toSync = slugFilter
    ? active.filter((g) => slugFilter.has(g.slug))
    : active;
  const files = ['data/games.json'];
  const removed = [];

  const results = await Promise.all(
    toSync.map(async (game) => {
      const path = `games/${game.slug}.html`;
      const content = buildGamePageShell(game);
      await createOrUpdateFile(path, content, `Sync game page: ${game.name}`);
      return path;
    })
  );
  files.push(...results);

  return { files, removed, synced: toSync.length };
}

async function removeGamePagesFromGithub(slugs) {
  const removed = [];
  for (const slug of slugs) {
    if (!slug) continue;
    try {
      await deleteFile(`games/${slug}.html`, `Remove deleted game page: ${slug}`);
      removed.push(`games/${slug}.html`);
    } catch (e) {
      console.warn('Could not remove page:', slug, e.message);
    }
  }
  return removed;
}

module.exports = {
  syncGamePagesToGithub,
  removeGamePagesFromGithub,
};
