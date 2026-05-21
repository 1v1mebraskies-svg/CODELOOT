/**
 * Shared CodeLoot data layer — single source: data/games.json
 */
(function (global) {
    const API_URL = '/api/games';
    const FALLBACK_URL = '/data/games.json';

    let cache = null;
    let loadPromise = null;

    function normalizeGamesData(data) {
        if (!data || !Array.isArray(data.games)) {
            return { games: [], metadata: { version: '1.0', last_updated: '' } };
        }
        if (!data.metadata) {
            data.metadata = { version: '1.0', last_updated: '' };
        }
        return data;
    }

    async function loadGamesData(force) {
        if (!force && cache) {
            return cache;
        }
        if (!force && loadPromise) {
            return loadPromise;
        }

        loadPromise = (async function () {
            const urls = [API_URL, FALLBACK_URL];
            for (let i = 0; i < urls.length; i++) {
                try {
                    const res = await fetch(urls[i], { cache: 'no-store' });
                    if (res.ok) {
                        cache = normalizeGamesData(await res.json());
                        return cache;
                    }
                } catch (e) {
                    /* try next */
                }
            }
            cache = { games: [], metadata: { version: '1.0', last_updated: '' } };
            return cache;
        })();

        return loadPromise;
    }

    function clearGamesCache() {
        cache = null;
        loadPromise = null;
    }

    function getSlugFromPath(pathname) {
        const m = (pathname || '').match(/\/games\/([^/]+)\.html$/);
        return m ? m[1] : null;
    }

    function slugFromHref(href) {
        if (!href) return null;
        const m = href.match(/games\/([^/]+)\.html/);
        return m ? m[1] : null;
    }

    function nextGameId(games) {
        return games.reduce(function (max, g) {
            return Math.max(max, Number(g.id) || 0);
        }, 0) + 1;
    }

    function nextCodeId(games) {
        let max = 0;
        games.forEach(function (g) {
            (g.codes || []).forEach(function (c) {
                max = Math.max(max, Number(c.id) || 0);
            });
        });
        return max + 1;
    }

    function findGameById(games, id) {
        const n = Number(id);
        return games.find(function (g) {
            return Number(g.id) === n;
        });
    }

    function findGameBySlug(games, slug) {
        return games.find(function (g) {
            return g.slug === slug;
        });
    }

    function findCodeById(game, codeId) {
        return (game.codes || []).find(function (c) {
            return String(c.id) === String(codeId);
        });
    }

    function activeCodeCount(game) {
        return (game.codes || []).filter(function (c) {
            return c.status === 'active';
        }).length;
    }

    function gameSearchText(game) {
        return [
            game.name,
            game.slug,
            game.description,
            game.short_description,
            game.long_description,
            game.category,
        ].join(' ').toLowerCase();
    }

    /** Image filename for cards/pages (e.g. anime-vanguards.png). */
    function gameImageFile(game) {
        if (!game) return 'code-loot-hero.png';
        if (game.image) return game.image;
        if (game.slug) return game.slug + '.png';
        return 'code-loot-hero.png';
    }

    function gameImageSrc(game, siteRoot) {
        if (!game) return 'code-loot-hero.png';
        
        // If image is already a full URL (starts with http), return it directly
        if (game.image && (game.image.startsWith('http://') || game.image.startsWith('https://'))) {
            return game.image;
        }
        
        // Otherwise, use local path for backward compatibility
        const root = siteRoot === '.' ? '' : siteRoot || '';
        const filename = gameImageFile(game);
        return root + '/assets/img/' + filename;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    global.CodeLootData = {
        loadGamesData: loadGamesData,
        clearGamesCache: clearGamesCache,
        getSlugFromPath: getSlugFromPath,
        slugFromHref: slugFromHref,
        nextGameId: nextGameId,
        nextCodeId: nextCodeId,
        findGameById: findGameById,
        findGameBySlug: findGameBySlug,
        findCodeById: findCodeById,
        activeCodeCount: activeCodeCount,
        gameSearchText: gameSearchText,
        gameImageFile: gameImageFile,
        gameImageSrc: gameImageSrc,
        escapeHtml: escapeHtml,
    };
})(typeof window !== 'undefined' ? window : global);
