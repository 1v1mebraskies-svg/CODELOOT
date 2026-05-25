"""Generate game pages and homepage cards from games.json."""
import html
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT / 'games'
INDEX_FILE = ROOT / 'index.html'

from image_utils import resolve_game_image

CATEGORY_LABELS = {
    'anime': 'Anime Games',
    'pvp': 'PvP Games',
    'rng': 'RNG / Simulator Games',
    'horror': 'Horror / Survival Games',
    'general': 'General',
}


def esc(text):
    return html.escape(str(text or ''), quote=True)


def active_codes(game):
    return [c for c in game.get('codes', []) if c.get('status') == 'active']


def code_count(game):
    return len(active_codes(game))


def game_image_file(game):
    return resolve_game_image(game)


def short_desc(game):
    return game.get('short_description') or game.get('description') or ''


def long_desc(game):
    return game.get('long_description') or game.get('description') or short_desc(game)


def redeem_list(game):
    steps = game.get('redeem_instructions')
    if steps and isinstance(steps, list):
        return [s for s in steps if s.strip()]
    name = game.get('name', 'the game')
    return [
        f'Open {name} on Roblox.',
        'Find the code redemption menu in settings.',
        'Paste the code exactly as shown.',
        'Enjoy your rewards!',
    ]


def update_date(game):
    return game.get('update_date') or datetime.now().strftime('%b %d, %Y')


def update_info(game):
    return game.get('update_info') or 'Codes are verified and updated regularly. Check back often for new rewards.'


def reward_stat(game):
    return game.get('reward_label') or 'Verified'


def build_codes_html(codes):
    lines = []
    for code in codes:
        lines.append(
            '                    <article class="code-card">\n'
            f'                        <div>\n'
            f'                            <h3>{esc(code["code"])}</h3>\n'
            f'                            <p>{esc(code["reward"])}</p>\n'
            '                        </div>\n'
            f'                        <button class="copy-button" type="button" data-code="{esc(code["code"])}">Copy</button>\n'
            '                    </article>'
        )
    return '\n\n'.join(lines)


def nav_games(all_games, current_slug, limit=6):
    items = []
    for g in all_games:
        if g.get('active') is False:
            continue
        slug = g.get('slug')
        if not slug:
            continue
        current = ' aria-current="page"' if slug == current_slug else ''
        items.append(f'                <li><a href="{esc(slug)}.html"{current}>{esc(g["name"])}</a></li>')
        if len(items) >= limit:
            break
    return '\n'.join(items)


def related_games(all_games, game, limit=2):
    cat = game.get('category')
    others = [
        g for g in all_games
        if g.get('slug') != game.get('slug') and g.get('active') is not False and g.get('category') == cat
    ]
    if len(others) < limit:
        others = [g for g in all_games if g.get('slug') != game.get('slug') and g.get('active') is not False]
    cards = []
    for g in others[:limit]:
        n = code_count(g)
        cards.append(
            f'                    <a class="related-card card" href="{esc(g["slug"])}.html">\n'
            f'                        <span>{n} active</span>\n'
            f'                        <strong>{esc(g["name"])}</strong>\n'
            '                    </a>'
        )
    return '\n\n'.join(cards)


def datalist_options(all_games):
    names = sorted({g['name'] for g in all_games if g.get('active') is not False and g.get('name')})
    return '\n'.join(f'                    <option value="{esc(n)}"></option>' for n in names)


def generate_game_page(game, all_games):
    slug = game['slug']
    name = game['name']
    codes = active_codes(game)
    count = len(codes)
    img = game_image_file(game)
    img_src = f'../assets/img/{img}'
    fallback = '../assets/img/code-loot-hero.png'
    last_checked = update_date(game)
    codes_block = build_codes_html(codes)
    no_codes = '' if count else '''
                <section class="no-codes">
                    <p class="eyebrow">No active codes</p>
                    <h2>No working codes right now</h2>
                    <p>Check back after the next game update. Expired codes move out of the active list when they stop redeeming.</p>
                </section>'''
    checklist = '\n'.join(f'                        <li>{esc(line)}</li>' for line in redeem_list(game))

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="{esc(name)} codes: {esc(short_desc(game))}. {count} verified codes with quick copy and daily monitoring. Latest updates for Roblox.">
    <meta name="keywords" content="{esc(name)} codes, Roblox codes, verified rewards">
    <title>{esc(name)} Codes | {count} Verified Rewards | CodeLoot</title>
    <link rel="stylesheet" href="../style.css">
    <link rel="icon" href="../assets/favicon.png" type="image/png">
    <link rel="canonical" href="https://codeloot.codes/games/{esc(slug)}.html">
</head>
<body data-site-root=".." data-game-slug="{esc(slug)}">
    <header class="site-header">
        <nav class="navbar container" aria-label="Primary navigation">
            <a class="brand" href="../index.html" aria-label="CodeLoot home">
                <span class="brand-mark">CL</span>
                <span class="brand-name">CodeLoot</span>
            </a>

            <form class="site-search" role="search" data-site-search>
                <label class="sr-only" for="site-search">Search games</label>
                <input id="site-search" type="search" name="q" placeholder="Search Roblox games" autocomplete="off" list="game-list" data-game-search>
                <button type="submit">Search</button>
                <datalist id="game-list">
{datalist_options(all_games)}
                </datalist>
            </form>

            <ul class="nav-links" aria-label="Game pages">
{nav_games(all_games, slug)}
            </ul>
        </nav>
    </header>

    <main>
        <section class="game-hero">
            <div class="container">
                <div class="game-banner card">
                    <img src="{esc(img_src)}" onerror="this.src='{esc(fallback)}'" alt="{esc(name)} banner">
                    <div class="game-banner-copy">
                        <p class="eyebrow">Roblox codes</p>
                        <h1>{esc(name)} Codes</h1>
                        <p>{esc(long_desc(game))}</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="container stats-grid game-stats" aria-label="{esc(name)} code stats">
            <article class="stat-card card">
                <span class="stat-value">{count}</span>
                <span class="stat-label">active codes tracked</span>
            </article>
            <article class="stat-card card">
                <span class="stat-value">{esc(reward_stat(game))}</span>
                <span class="stat-label">common reward</span>
            </article>
            <article class="stat-card card">
                <span class="stat-value">{esc(last_checked)}</span>
                <span class="stat-label">last checked</span>
            </article>
            <article class="stat-card card">
                <span class="stat-value">Roblox</span>
                <span class="stat-label">platform</span>
            </article>
        </section>

        <section class="container content-layout">
            <div class="content-main card">
                <div class="panel-heading">
                    <p class="eyebrow">Active codes</p>
                    <h2>Working {esc(name)} rewards</h2>
                    <p>Codes are case-sensitive. Copy and paste them exactly as shown.</p>
                </div>

                <div class="code-grid" data-codes-grid>
{codes_block}
                </div>
{no_codes}
            </div>

            <aside class="sidebar-stack">
                <section class="side-panel card">
                    <p class="eyebrow">Before redeeming</p>
                    <h2>Checklist</h2>
                    <ul class="check-list">
{checklist}
                    </ul>
                </section>

                <section class="side-panel card">
                    <p class="eyebrow">Update note</p>
                    <h2>{esc(last_checked)}</h2>
                    <p>{esc(update_info(game))}</p>
                </section>
            </aside>
        </section>

        <section class="ad-section">
            <div class="container">
                <div class="ad-label">Advertisement</div>
                <div class="ad-container">
                    <div class="ad-placeholder ad-728x90">
                        <span>[728x90] Ad Space</span>
                    </div>
                </div>
            </div>
        </section>

        <section class="section-sm">
            <div class="container related-layout">
                <div class="section-heading compact">
                    <p class="eyebrow">Related games</p>
                    <h2>More Roblox codes</h2>
                </div>

                <div class="related-grid">
{related_games(all_games, game)}
                </div>
            </div>
        </section>
    </main>

    <section class="footer-ad">
        <div class="container">
            <div class="ad-label">Advertisement</div>
            <div class="ad-container">
                <div class="ad-placeholder ad-728x90">
                    <span>[728x90] Ad Space</span>
                </div>
            </div>
        </div>
    </section>

    <footer class="site-footer">
        <div class="container footer-grid">
            <div>
                <a class="brand footer-brand" href="../index.html" aria-label="CodeLoot home">
                    <span class="brand-mark">CL</span>
                    <span class="brand-name">CodeLoot</span>
                </a>
                <p>Independent Roblox codes resource. Code availability can change without notice and CodeLoot is not affiliated with Roblox Corporation.</p>
            </div>
            <div class="footer-links">
                <strong>Games</strong>
                <a href="blox-fruits.html">Blox Fruits</a>
                <a href="king-legacy.html">King Legacy</a>
                <a href="anime-defenders.html">Anime Defenders</a>
            </div>
            <div class="footer-links">
                <strong>Company</strong>
                <a href="../about.html">About</a>
                <a href="../contact.html">Contact</a>
                <a href="../privacy-policy.html">Privacy</a>
            </div>
            <div class="footer-links">
                <strong>Legal</strong>
                <a href="../terms-of-service.html">Terms</a>
                <a href="../privacy-policy.html">Privacy Policy</a>
            </div>
        </div>
    </footer>

    <script src="../js/codeloot-data.js"></script>
    <script src="../app.js"></script>
</body>
</html>
'''


def featured_card(game):
    n = code_count(game)
    img = game_image_file(game)
    return f'''                    <a class="featured-card card" href="games/{esc(game["slug"])}.html" data-game-card data-game-name="{esc(game["name"])}" data-game-slug="{esc(game["slug"])}">
                        <img src="assets/img/{esc(img)}" onerror="this.src='assets/img/code-loot-hero.png'" alt="{esc(game["name"])} banner">
                        <div class="featured-card-copy">
                            <span>{n} verified codes</span>
                            <h3>{esc(game["name"])}</h3>
                            <p>{esc(short_desc(game))}</p>
                        </div>
                    </a>'''


def game_card(game, meta2='Verified'):
    n = code_count(game)
    img = game_image_file(game)
    link = 'View codes' if n else 'View status'
    return f'''                    <a class="game-card card" href="games/{esc(game["slug"])}.html" data-game-card data-game-name="{esc(game["name"])}" data-game-slug="{esc(game["slug"])}">
                        <img src="assets/img/{esc(img)}" onerror="this.src='assets/img/code-loot-hero.png'" alt="{esc(game["name"])} banner">
                        <div class="game-card-body">
                            <div class="card-meta">
                                <span>{n} active</span>
                                <span>{esc(meta2)}</span>
                            </div>
                            <h3>{esc(game["name"])}</h3>
                            <p>{esc(short_desc(game))}</p>
                            <span class="text-link">{link}</span>
                        </div>
                    </a>'''


def replace_grid_in_section(content, section_pattern, grid_class, new_inner):
    pattern = re.compile(
        rf'({section_pattern}[\s\S]*?<div class="{grid_class}">)\s*[\s\S]*?(\s*</div>\s*</div>\s*</section>)',
        re.MULTILINE,
    )
    if not pattern.search(content):
        return content
    inner = '\n\n' + new_inner + '\n                '
    return pattern.sub(rf'\1{inner}\2', content, count=1)


def sync_index(data):
    if not INDEX_FILE.exists():
        return []
    games = [g for g in data.get('games', []) if g.get('active') is not False]
    content = INDEX_FILE.read_text(encoding='utf-8')

    featured = [g for g in games if g.get('featured')]
    featured_html = '\n\n'.join(featured_card(g) for g in featured)
    content = replace_grid_in_section(
        content,
        r'<section class="featured-games"',
        'featured-grid',
        featured_html,
    )

    section_aria = {
        'anime': 'Anime Games',
        'pvp': 'PvP Games',
        'rng': 'RNG / Simulator Games',
        'horror': 'Horror / Survival Games',
        'general': 'General Games',
    }
    for cat, aria in section_aria.items():
        section_games = [g for g in games if g.get('category') == cat]
        if not section_games:
            continue
        cards = '\n\n'.join(game_card(g) for g in section_games)
        content = replace_grid_in_section(
            content,
            rf'<section class="section" aria-label="{re.escape(aria)}"',
            'game-grid',
            cards,
        )

    datalist = '\n'.join(
        f'                    <option value="{esc(g["name"])}"></option>'
        for g in sorted(games, key=lambda x: x.get('name', ''))
    )
    content = re.sub(
        r'(<datalist id="game-list">)[\s\S]*?(</datalist>)',
        r'\1\n' + datalist + '\n                \2',
        content,
        count=1,
    )

    INDEX_FILE.write_text(content, encoding='utf-8')
    return ['index.html']


def normalize_game(game):
    if not game.get('short_description') and game.get('description'):
        game['short_description'] = game['description']
    if not game.get('long_description'):
        game['long_description'] = game.get('description', '')
    if game.get('slug'):
        game['image'] = game_image_file(game)
    return game


def normalize_all(data):
    for g in data.get('games', []):
        normalize_game(g)
    return data
