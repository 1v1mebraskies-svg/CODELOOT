// CodeLoot Admin — publishes to real site files via CMS server (python3 server.py)

const D = window.CodeLootData;
const CMS = window.CodeLootCMS;
const ADMIN_PASSWORD = 'AdminPass';
const SENSITIVE_PASSWORD = 'jeff@';
let gamesData = null;
let pendingImageFile = null;
let editorCodes = [];
let cmsConnected = false;

function checkAuth() {
    const auth = sessionStorage.getItem('codeloot_admin_auth');
    const authTime = sessionStorage.getItem('codeloot_auth_time');
    const authCheck = document.getElementById('auth-check');
    
    if (auth !== 'true' || !authTime) {
        if (authCheck) authCheck.classList.add('active');
        window.location.href = 'login.html';
        return false;
    }
    
    // Session expires after 8 hours
    const elapsed = Date.now() - parseInt(authTime);
    if (elapsed > 8 * 60 * 60 * 1000) {
        sessionStorage.removeItem('codeloot_admin_auth');
        sessionStorage.removeItem('codeloot_auth_time');
        if (authCheck) authCheck.classList.add('active');
        window.location.href = 'login.html';
        return false;
    }
    
    if (authCheck) authCheck.classList.remove('active');
    return true;
}

function confirmSensitiveAction(action) {
    const password = prompt(`Enter sensitive action password to ${action}:`);
    if (password === null) return false;
    return password === SENSITIVE_PASSWORD;
}

function updateCmsBanner(base) {
    let el = document.getElementById('cms-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'cms-status';
        el.style.cssText =
            'margin-bottom:16px;padding:12px 16px;border-radius:8px;font-size:14px;line-height:1.5;';
        const main = document.querySelector('.admin-main');
        main.insertBefore(el, main.firstChild.nextSibling);
    }

    if (base) {
        cmsConnected = true;
        el.style.background = 'rgba(46, 160, 67, 0.15)';
        el.style.border = '1px solid rgba(46, 160, 67, 0.4)';
        el.style.color = 'var(--text)';
        el.innerHTML =
            '<strong>CMS connected</strong> — Save &amp; Publish writes real files to your project:<br>' +
            '<code>data/games.json</code>, <code>index.html</code>, <code>games/*.html</code><br>' +
            '<span style="color:var(--muted)">Images uploaded to Vercel Blob Storage · ' +
            'Server: ' + base + ' · ' +
            '<a href="' + base + '/index.html" target="_blank" rel="noopener">View site</a></span>';
        document.getElementById('save-game-btn').disabled = false;
        document.getElementById('add-game-btn').disabled = false;
    } else {
        cmsConnected = false;
        el.style.background = 'rgba(255, 193, 7, 0.12)';
        el.style.border = '1px solid rgba(255, 193, 7, 0.4)';
        el.style.color = 'var(--text)';
        el.innerHTML =
            '<strong>CMS offline — Read-only mode</strong> — Games loaded from <code>data/games.json</code>.<br>' +
            'To save changes, run <code>python3 server.py</code> then refresh.<br>' +
            '<span style="color:var(--muted)">Current data source: local file · ' +
            '<a href="' + CMS.defaultCmsUrl + '/admin/index.html" target="_blank" rel="noopener">Connect to CMS</a></span>';
        document.getElementById('save-game-btn').disabled = true;
        document.getElementById('add-game-btn').disabled = true;
    }
}

async function loadGames() {
    let loadedFromCms = false;
    
    console.log('loadGames() called, cmsConnected:', cmsConnected);
    
    // Try to load from CMS API if connected
    if (cmsConnected) {
        try {
            const res = await CMS.cmsFetch('/api/games', { cache: 'no-store' });
            console.log('CMS API response status:', res.status);
            if (res.ok) {
                gamesData = await res.json();
                loadedFromCms = true;
                console.log('Loaded games from CMS API, count:', gamesData.games ? gamesData.games.length : 0);
            } else {
                console.warn('CMS API returned non-OK status:', res.status);
            }
        } catch (e) {
            console.warn('CMS fetch failed, falling back to local file:', e.message);
        }
    }
    
    // Fallback: load directly from data/games.json
    if (!loadedFromCms) {
        console.log('Attempting to load from local file: ../data/games.json');
        try {
            const res = await fetch('../data/games.json', { cache: 'no-store' });
            console.log('Local file fetch response status:', res.status);
            if (res.ok) {
                gamesData = await res.json();
                console.log('Loaded games from local file (data/games.json), count:', gamesData.games ? gamesData.games.length : 0);
            } else {
                throw new Error('Could not load games from local file, status: ' + res.status);
            }
        } catch (e) {
            console.error('Failed to load games from local file:', e.message);
            gamesData = { games: [], metadata: { version: '1.0', last_updated: '' } };
        }
    }
    
    if (!gamesData.metadata) {
        gamesData.metadata = { version: '1.0', last_updated: '' };
    }
    // Ensure all games have required fields
    gamesData.games.forEach(function(game) {
        if (!game.codes) game.codes = [];
        if (!game.short_description && game.description) game.short_description = game.description;
        if (!game.long_description) game.long_description = game.description || game.short_description || '';
        if (!game.redeem_instructions) game.redeem_instructions = [];
        // Ensure all codes have IDs
        game.codes.forEach(function(code, idx) {
            if (!code.id) code.id = idx + 1;
        });
    });
    console.log('Total games loaded after normalization:', gamesData.games.length);
    renderGamesTable(gamesData.games);
}

function setSaveStatus(msg, isError) {
    const el = document.getElementById('save-status');
    el.hidden = !msg;
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
}

async function uploadImage(slug, file) {
    const fd = new FormData();
    fd.append('slug', slug);
    fd.append('image', file);
    const res = await CMS.cmsFetch('/api/upload-image', { method: 'POST', body: fd });
    const data = await res.json().catch(function () {
        return {};
    });
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Image upload failed');
    }
    return data;
}

async function saveGames() {
    gamesData.metadata.last_updated = new Date().toISOString();
    const res = await CMS.cmsFetch('/api/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gamesData, null, 2),
    });
    const result = await res.json().catch(function () {
        return {};
    });
    if (!res.ok || result.success === false) {
        throw new Error(result.error || 'Save failed');
    }
    if (result.success) {
        D.clearGamesCache();
        // Reload gamesData from CMS to ensure sync
        await loadGames();
    }
    return result;
}

function applyGameImage(game, uploadedUrl) {
    if (uploadedUrl) {
        game.image = uploadedUrl;
        return;
    }
    game.image = D.gameImageFile(game);
}

async function publishGame(game, imageFile) {
    let uploadedUrl = null;
    let imageFiles = [];
    if (imageFile) {
        const up = await uploadImage(game.slug, imageFile);
        uploadedUrl = up.url || up.path;
        imageFiles = up.files || [up.url || up.path];
    }
    applyGameImage(game, uploadedUrl);
    gamesData.metadata.last_updated = new Date().toISOString();
    const result = await saveGames();
    result.imageFiles = imageFiles;
    return result;
}

function formatPublishedFiles(result, game) {
    const files = (result.files || []).slice();
    if (result.imageFiles) {
        result.imageFiles.forEach(function (f) {
            if (files.indexOf(f) === -1) files.push(f);
        });
    }
    const lines = files.length ? files.join('\n  · ') : 'data/games.json\n  · games/' + game.slug + '.html\n  · index.html';
    return lines;
}

function renderGamesTable(games) {
    const tbody = document.getElementById('games-table-body');
    const esc = D.escapeHtml;

    tbody.innerHTML = games.map(function (game) {
        const n = (game.codes || []).filter(function (c) {
            return c.status === 'active';
        }).length;
        return (
            '<tr data-game-id="' + game.id + '">' +
            '<td><strong>' + esc(game.name) + '</strong></td>' +
            '<td><code>' + esc(game.slug) + '</code></td>' +
            '<td>' + esc(game.category) + '</td>' +
            '<td>' + n + '</td>' +
            '<td><span class="badge ' + (game.active ? 'badge-active' : 'badge-inactive') + '">' +
            (game.active ? 'Active' : 'Inactive') + '</span></td>' +
            '<td>' + (game.featured ? '<span class="badge badge-featured">Featured</span>' : '') + '</td>' +
            '<td>' +
            '<button type="button" class="btn btn-primary" data-action="edit-game" data-game-id="' + game.id + '">Edit</button> ' +
            '<button type="button" class="btn btn-danger" data-action="delete-game" data-game-id="' + game.id + '">Delete</button>' +
            '</td></tr>'
        );
    }).join('');
}

function parseRedeemLines(text) {
    return text.split('\n').map(function (l) {
        return l.trim();
    }).filter(Boolean);
}

function formatRedeemLines(lines) {
    return (lines || []).join('\n');
}

function imagePreviewUrl(game) {
    if (!game) return '';
    
    // If image is already a full URL (starts with http), return it directly
    if (game.image && (game.image.startsWith('http://') || game.image.startsWith('https://'))) {
        return game.image;
    }
    
    // Otherwise, use local path for backward compatibility
    if (!game.slug) return '';
    const base = CMS.getApiBase() || '';
    return base + '/assets/img/' + D.gameImageFile(game);
}

function renderCodeRows() {
    const list = document.getElementById('codes-editor-list');
    const esc = D.escapeHtml;

    if (!editorCodes.length) {
        list.innerHTML = '<p style="color:var(--muted);font-size:14px;">No codes yet. Add one above or paste bulk codes below.</p>';
        return;
    }

    list.innerHTML = editorCodes.map(function (code, index) {
        return (
            '<div class="code-row" data-index="' + index + '">' +
            '<input type="text" data-field="code" value="' + esc(code.code) + '" placeholder="CODE">' +
            '<input type="text" data-field="reward" value="' + esc(code.reward) + '" placeholder="Reward">' +
            '<select data-field="status">' +
            '<option value="active"' + (code.status === 'active' ? ' selected' : '') + '>Active</option>' +
            '<option value="expired"' + (code.status === 'expired' ? ' selected' : '') + '>Expired</option>' +
            '</select>' +
            '<button type="button" class="btn btn-danger" data-action="remove-code-row" data-index="' + index + '">✕</button>' +
            '</div>'
        );
    }).join('');
}

function collectEditorCodes() {
    const rows = document.querySelectorAll('#codes-editor-list .code-row');
    const collected = [];
    rows.forEach(function (row) {
        const existing = editorCodes[Number(row.dataset.index)] || {};
        const code = row.querySelector('[data-field="code"]').value.trim();
        const reward = row.querySelector('[data-field="reward"]').value.trim();
        const status = row.querySelector('[data-field="status"]').value;
        if (!code && !reward) return;
        collected.push({
            id: existing.id || null,
            code: code,
            reward: reward || 'Unknown reward',
            status: status,
            created_at: existing.created_at || new Date().toISOString(),
        });
    });
    return collected;
}

function assignCodeIds(codes) {
    let nextId = D.nextCodeId(gamesData.games);
    return codes.map(function (c) {
        if (c.id) return c;
        const entry = Object.assign({}, c, {
            id: nextId,
            created_at: c.created_at || new Date().toISOString(),
        });
        nextId += 1;
        return entry;
    });
}

function openGameEditor(game) {
    pendingImageFile = null;
    document.getElementById('game-form').reset();
    document.getElementById('image-preview').hidden = true;

    if (game) {
        document.getElementById('modal-title').textContent = 'Edit Game';
        document.getElementById('game-id').value = game.id;
        document.getElementById('game-name').value = game.name;
        document.getElementById('game-slug').value = game.slug;
        document.getElementById('game-short-description').value = game.short_description || game.description || '';
        document.getElementById('game-long-description').value = game.long_description || game.description || '';
        document.getElementById('game-category').value = game.category || 'anime';
        document.getElementById('game-reward-label').value = game.reward_label || '';
        document.getElementById('game-update-date').value = game.update_date || '';
        document.getElementById('game-update-info').value = game.update_info || '';
        document.getElementById('game-redeem').value = formatRedeemLines(game.redeem_instructions);
        document.getElementById('game-featured').checked = !!game.featured;
        document.getElementById('game-active').checked = game.active !== false;
        editorCodes = JSON.parse(JSON.stringify(game.codes || []));

        const preview = document.getElementById('image-preview');
        preview.src = imagePreviewUrl(game) + '?t=' + Date.now();
        preview.alt = game.name;
        preview.hidden = false;
    } else {
        document.getElementById('modal-title').textContent = 'Add Game';
        document.getElementById('game-id').value = '';
        document.getElementById('game-active').checked = true;
        editorCodes = [];
    }

    renderCodeRows();
    setSaveStatus('');
    document.getElementById('game-modal').classList.add('active');
}

function readFormGame() {
    const collected = collectEditorCodes();
    const bulk = document.getElementById('bulk-codes').value.trim();
    if (bulk) {
        let nextId = D.nextCodeId(gamesData.games);
        bulk.split('\n').forEach(function (line) {
            line = line.trim();
            if (!line) return;
            const parts = line.split('|');
            collected.push({
                id: nextId,
                code: parts[0].trim(),
                reward: parts[1] ? parts[1].trim() : 'Unknown reward',
                status: 'active',
                created_at: new Date().toISOString(),
            });
            nextId += 1;
        });
        document.getElementById('bulk-codes').value = '';
    }

    return {
        name: document.getElementById('game-name').value.trim(),
        slug: document.getElementById('game-slug').value.trim(),
        short_description: document.getElementById('game-short-description').value.trim(),
        long_description: document.getElementById('game-long-description').value.trim(),
        description: document.getElementById('game-short-description').value.trim(),
        category: document.getElementById('game-category').value,
        reward_label: document.getElementById('game-reward-label').value.trim(),
        update_date: document.getElementById('game-update-date').value.trim(),
        update_info: document.getElementById('game-update-info').value.trim(),
        redeem_instructions: parseRedeemLines(document.getElementById('game-redeem').value),
        featured: document.getElementById('game-featured').checked,
        active: document.getElementById('game-active').checked,
        codes: assignCodeIds(collected),
        updated_at: new Date().toISOString(),
    };
}

async function handleSave(e) {
    e.preventDefault();
    if (!cmsConnected) {
        alert('Start the CMS server first:\n\npython3 server.py\n\nThen open:\nhttp://127.0.0.1:3000/admin/index.html');
        return;
    }

    const id = document.getElementById('game-id').value;
    // Require sensitive password for editing existing games
    if (id && !confirmSensitiveAction('overwrite this game')) {
        alert('Incorrect password or cancelled. Editing existing games requires sensitive action password.');
        return;
    }

    const btn = document.getElementById('save-game-btn');
    btn.disabled = true;
    setSaveStatus('Publishing to site files...', false);

    try {
        const formGame = readFormGame();
        if (!formGame.name || !formGame.slug) {
            throw new Error('Name and slug are required');
        }

        let game;

        if (id) {
            const index = gamesData.games.findIndex(function (g) {
                return String(g.id) === String(id);
            });
            if (index === -1) throw new Error('Game not found');
            game = Object.assign({}, gamesData.games[index], formGame);
            gamesData.games[index] = game;
        } else {
            // Check for duplicate slug
            const existingSlug = D.findGameBySlug(gamesData.games, formGame.slug);
            if (existingSlug) {
                throw new Error('A game with slug "' + formGame.slug + '" already exists. Please use a different slug.');
            }
            game = Object.assign({
                id: D.nextGameId(gamesData.games),
                created_at: new Date().toISOString(),
            }, formGame);
            gamesData.games.push(game);
        }

        const result = await publishGame(game, pendingImageFile);
        pendingImageFile = null;

        document.getElementById('game-modal').classList.remove('active');
        renderGamesTable(gamesData.games);
        setSaveStatus('');

        const base = CMS.getApiBase();
        const fileList = formatPublishedFiles(result, game);
        alert(
            'Published to disk!\n\n' +
            'Updated files:\n  · ' + fileList + '\n\n' +
            'Live page: ' + base + '/games/' + game.slug + '.html\n' +
            'Homepage: ' + base + '/index.html'
        );
    } catch (err) {
        console.error(err);
        setSaveStatus(err.message || 'Save failed', true);
        alert('Publish failed: ' + (err.message || 'Save failed'));
    } finally {
        btn.disabled = !cmsConnected;
    }
}

function deleteGame(id) {
    if (!cmsConnected) return;
    if (!confirmSensitiveAction('delete this game')) {
        alert('Incorrect password or cancelled. Deletion requires sensitive action password.');
        return;
    }
    if (!confirm('Delete this game from the website? This removes its page and homepage card.')) return;

    const n = String(id);
    gamesData.games = gamesData.games.filter(function (g) {
        return String(g.id) !== n;
    });

    saveGames().then(function () {
        renderGamesTable(gamesData.games);
    }).catch(function (err) {
        alert('Delete failed: ' + err.message);
    });
}

document.getElementById('games-table-body').addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-game-id');
    const action = btn.getAttribute('data-action');

    if (action === 'edit-game') {
        const game = gamesData.games.find(function (g) {
            return String(g.id) === String(id);
        });
        if (game) openGameEditor(game);
    } else if (action === 'delete-game') {
        deleteGame(id);
    }
});

document.getElementById('codes-editor-list').addEventListener('input', function (e) {
    const row = e.target.closest('.code-row');
    if (!row) return;
    const i = Number(row.dataset.index);
    const field = e.target.getAttribute('data-field');
    if (!editorCodes[i] || !field) return;
    editorCodes[i][field] = e.target.value;
});

document.getElementById('codes-editor-list').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action="remove-code-row"]');
    if (!btn) return;
    if (!confirmSensitiveAction('delete this code')) {
        alert('Incorrect password or cancelled. Deleting codes requires sensitive action password.');
        return;
    }
    const i = Number(btn.dataset.index);
    editorCodes.splice(i, 1);
    renderCodeRows();
});

document.getElementById('add-code-row-btn').addEventListener('click', function () {
    editorCodes.push({ code: '', reward: '', status: 'active' });
    renderCodeRows();
});

document.getElementById('add-game-btn').addEventListener('click', function () {
    openGameEditor(null);
});

document.getElementById('import-games-btn').addEventListener('click', async function () {
    if (!cmsConnected) {
        alert('Start the CMS server first:\n\npython3 server.py');
        return;
    }
    if (!confirm('Import all games from HTML files into the database? This will add any missing games from the games/ directory.')) {
        return;
    }
    try {
        const btn = this;
        btn.disabled = true;
        btn.textContent = 'Importing...';
        const res = await CMS.cmsFetch('/api/import-games', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            alert(`Import complete!\n\nTotal games: ${result.imported}\nSynced files: ${result.synced}`);
            await loadGames();
        } else {
            alert('Import failed: ' + (result.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Import failed: ' + err.message);
    } finally {
        const btn = document.getElementById('import-games-btn');
        btn.disabled = !cmsConnected;
        btn.textContent = 'Import from HTML';
    }
});

document.getElementById('game-form').addEventListener('submit', handleSave);

document.getElementById('close-modal').addEventListener('click', function () {
    document.getElementById('game-modal').classList.remove('active');
});
document.getElementById('cancel-modal').addEventListener('click', function () {
    document.getElementById('game-modal').classList.remove('active');
});

document.getElementById('game-name').addEventListener('input', function (e) {
    if (document.getElementById('game-id').value) return;
    const slug = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    document.getElementById('game-slug').value = slug;
});

document.getElementById('game-image').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    pendingImageFile = file;
    const preview = document.getElementById('image-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
});

document.getElementById('search-games').addEventListener('input', function (e) {
    const q = e.target.value.trim().toLowerCase();
    if (!gamesData) return;
    const filtered = gamesData.games.filter(function (game) {
        return D.gameSearchText(game).includes(q);
    });
    renderGamesTable(filtered);
});

async function initAdmin() {
    // Check authentication first
    if (!checkAuth()) {
        return;
    }

    // Add logout handler
    document.getElementById('logout-btn').addEventListener('click', function(e) {
        e.preventDefault();
        sessionStorage.removeItem('codeloot_admin_auth');
        sessionStorage.removeItem('codeloot_auth_time');
        window.location.href = 'login.html';
    });

    if (CMS.isFileProtocol()) {
        window.location.href = CMS.defaultCmsUrl + '/admin/index.html';
        return;
    }

    const base = await CMS.connectCms();
    updateCmsBanner(base);

    // Always try to load games, even if CMS is not connected
    try {
        await loadGames();
    } catch (err) {
        console.error('Could not load games:', err.message);
        updateCmsBanner(null);
        // Don't alert - let the fallback in loadGames handle it
    }
}

initAdmin();
