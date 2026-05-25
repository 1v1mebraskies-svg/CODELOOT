// CodeLoot Admin — master control panel; single source: data/games.json

const D = window.CodeLootData;
const CMS = window.CodeLootCMS;
const GAMES_JSON_URL = '/data/games.json';
const GAMES_API_URL = '/api/games';
const GITHUB_RAW_GAMES =
    'https://raw.githubusercontent.com/1v1mebraskies-svg/CODELOOT/main/data/games.json';
const ADMIN_PASSWORD = 'AdminPass';
const SENSITIVE_PASSWORD = 'jeff@';
let gamesData = null;
let pendingImageFile = null;
let editorCodes = [];
let cmsConnected = false;

// Manual save state
let hasUnsavedChanges = false;

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

function formatDeployLog(status) {
    if (!status || !status.deployment_context) return '';
    const ctx = status.deployment_context;
    const gh = status.github && !status.github.error ? status.github : null;
    const lines = [
        'Branch: <code>' + (ctx.vercel_git_branch || 'main (API writes)') + '</code>',
        'Deploy env: <code>' + (ctx.vercel_env || 'local') + '</code>',
        'GitHub token: <code>' + (ctx.github_token_set ? 'set' : 'MISSING') + '</code>',
    ];
    if (gh) {
        lines.push('Latest GitHub commit: <code>' + (gh.sha || '').slice(0, 7) + '</code> — ' + escHtml(gh.message || ''));
    }
    if (status.games_json_sha) {
        lines.push('Live games.json SHA: <code>' + status.games_json_sha.slice(0, 7) + '</code>');
    }
    return '<br><span style="color:var(--muted);font-size:12px">' + lines.join('<br>') + '</span>';
}

function escHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function loadDeployStatus() {
    if (!CMS || !CMS.cmsFetch) return null;
    try {
        const res = await CMS.cmsFetch('/api/deploy-status');
        if (!res.ok) return null;
        const status = await res.json();
        console.log('[codeloot-deploy]', status);
        return status;
    } catch (e) {
        console.warn('[codeloot-deploy] status unavailable:', e.message);
        return null;
    }
}

function updateCmsBanner(base, deployStatus) {
    let el = document.getElementById('cms-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'cms-status';
        el.style.cssText =
            'margin-bottom:16px;padding:12px 16px;border-radius:8px;font-size:14px;line-height:1.5;';
        const main = document.querySelector('.admin-main');
        if (main) {
            main.insertBefore(el, main.firstChild.nextSibling);
        }
    }

    if (base) {
        cmsConnected = true;
        el.style.background = 'rgba(46, 160, 67, 0.15)';
        el.style.border = '1px solid rgba(46, 160, 67, 0.4)';
        el.style.color = 'var(--text)';
        el.innerHTML =
            '<strong>✓ CMS Connected</strong> — Manual save to local data/games.json<br>' +
            '<span style="color:var(--muted)">Server: ' + base + ' · ' +
            '<a href="' + base + '/index.html" target="_blank" rel="noopener">View live site</a></span>';
        const saveBtn = document.getElementById('save-game-btn');
        const addBtn = document.getElementById('add-game-btn');
        if (saveBtn) saveBtn.disabled = false;
        if (addBtn) addBtn.disabled = false;
    } else {
        cmsConnected = false;
        el.style.background = 'rgba(255, 193, 7, 0.12)';
        el.style.border = '1px solid rgba(255, 193, 7, 0.4)';
        el.style.color = 'var(--text)';
        el.innerHTML =
            '<strong>⚠ CMS Connection Issue</strong> — Cannot connect to server<br>' +
            'Changes will be saved to localStorage as backup.<br>' +
            '<span style="color:var(--muted)">Start local server with: python3 server.py</span>';
        const saveBtn = document.getElementById('save-game-btn');
        const addBtn = document.getElementById('add-game-btn');
        if (saveBtn) saveBtn.disabled = false;
        if (addBtn) addBtn.disabled = false;
    }
}

async function fetchGamesJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) return null;
    return res.json();
}

async function loadGames() {
    let loaded = false;

    const sources = [
        { url: GAMES_API_URL },
        { url: GAMES_JSON_URL },
    ];

    for (let i = 0; i < sources.length && !loaded; i++) {
        try {
            const data = await fetchGamesJson(sources[i].url);
            if (data && Array.isArray(data.games)) {
                gamesData = data;
                delete gamesData._version;
                delete gamesData._timestamp;
                loaded = true;
            }
        } catch (e) {
            console.warn('Load failed for', sources[i].url, e.message);
        }
    }

    if (!loaded) {
        try {
            const localData = localStorage.getItem('codeloot_games_data');
            if (localData) {
                gamesData = JSON.parse(localData);
                loaded = true;
                setSyncStatus('Using local backup', 'warning');
            }
        } catch (e) {
            console.warn('localStorage load failed:', e.message);
        }
    }

    if (!loaded && D && D.loadGamesData) {
        try {
            if (D.clearGamesCache) D.clearGamesCache();
            gamesData = await D.loadGamesData(true);
            loaded = true;
        } catch (e) {
            console.warn('CodeLootData load failed:', e.message);
        }
    }

    if (!loaded) {
        gamesData = { games: [], metadata: { version: '1.0', last_updated: '' } };
        setSyncStatus('Failed to load games', 'error');
    }

    if (!gamesData.metadata) {
        gamesData.metadata = { version: '1.0', last_updated: '' };
    }
    if (!Array.isArray(gamesData.games)) {
        gamesData.games = [];
    }

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
    renderGamesTable(gamesData.games);
}

function setSaveStatus(msg, isError) {
    const el = document.getElementById('save-status');
    el.hidden = !msg;
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
}

function setSyncStatus(msg, type) {
    let el = document.getElementById('sync-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'sync-status';
        el.style.cssText = 'font-size:12px;color:var(--muted);margin-top:8px;';
        const header = document.querySelector('.admin-header');
        if (header) header.appendChild(el);
    }
    if (msg) {
        el.textContent = msg;
        el.style.color = type === 'error' ? 'var(--danger)' : 
                        type === 'success' ? 'var(--mint)' : 
                        type === 'warning' ? 'var(--warning)' : 'var(--muted)';
    } else {
        el.textContent = '';
    }
}

function markUnsavedChanges() {
    hasUnsavedChanges = true;
    updateSyncIndicator();
}

function clearUnsavedChanges() {
    hasUnsavedChanges = false;
    updateSyncIndicator();
}

function updateSyncIndicator() {
    let indicator = document.getElementById('unsaved-indicator');
    if (!indicator) {
        indicator = document.createElement('span');
        indicator.id = 'unsaved-indicator';
        indicator.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--warning);margin-left:8px;';
        const title = document.querySelector('.admin-header h1');
        if (title) title.appendChild(indicator);
    }
    indicator.style.display = hasUnsavedChanges ? 'inline-block' : 'none';
}

async function uploadImage(slug, file) {
    const fd = new FormData();
    fd.append('slug', slug);
    fd.append('image', file);
    let res;
    if (cmsConnected && CMS && CMS.cmsFetch) {
        res = await CMS.cmsFetch('/api/upload-image', { method: 'POST', body: fd });
    } else {
        res = await fetch('/api/upload-image', { method: 'POST', body: fd });
    }
    const data = await res.json().catch(function () {
        return {};
    });
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Image upload failed');
    }
    return data;
}

function persistLocalGamesData() {
    gamesData.metadata.last_updated = new Date().toISOString();
    try {
        localStorage.setItem('codeloot_games_data', JSON.stringify(gamesData));
    } catch (e) {
        console.warn('Failed to save to localStorage:', e.message);
    }
    if (D && D.clearGamesCache) {
        D.clearGamesCache();
    }
    renderGamesTable(gamesData.games);
}


function isEditorOpen() {
    const modal = document.getElementById('game-modal');
    return modal && modal.classList.contains('active');
}





async function performLocalSave() {
    persistLocalGamesData();

    const headers = { 'Content-Type': 'application/json' };

    let res;
    try {
        if (cmsConnected && CMS && CMS.cmsFetch) {
            res = await CMS.cmsFetch('/api/games', {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(gamesData),
            });
        } else {
            res = await fetch(GAMES_API_URL, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(gamesData),
            });
        }
    } catch (e) {
        throw new Error('Save failed: ' + e.message);
    }

    const result = await res.json().catch(function () {
        return {};
    });

    if (!res.ok || result.success === false) {
        throw new Error(result.error || result.message || 'Save failed');
    }

    clearUnsavedChanges();
    return result;
}


async function saveGames() {
    return await performLocalSave();
}






function applyGameImage(game, uploadedFilename) {
    if (uploadedFilename) {
        game.image = uploadedFilename;
        return;
    }
    game.image = D && D.gameImageFile ? D.gameImageFile(game) : game.slug + '.png';
}

async function publishGame(game, imageFile) {
    let uploadedName = null;
    let imageFiles = [];
    if (imageFile) {
        const up = await uploadImage(game.slug, imageFile);
        uploadedName = up.image;
        imageFiles = up.files || ['assets/img/' + up.image];
    }
    applyGameImage(game, uploadedName);
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
    const lines = files.length ? files.join('\n  · ') : 'data/games.json';
    return lines;
}

function renderGamesTable(games) {
    const tbody = document.getElementById('games-table-body');

    if (!tbody) {
        console.error('games-table-body element not found');
        return;
    }

    if (!games || !Array.isArray(games) || games.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7" style="text-align:center;color:var(--muted);">No games found</td></tr>';
        return;
    }

    const esc =
        D && D.escapeHtml
            ? D.escapeHtml
            : function (str) {
                  return String(str)
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;');
              };

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
    if (!game || !game.slug) return '';
    // Use GitHub raw URL for images (shared data source)
    const githubRawUrl = 'https://raw.githubusercontent.com/1v1mebraskies-svg/CODELOOT/main/assets/img/';
    return githubRawUrl + D.gameImageFile(game);
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

    const id = document.getElementById('game-id').value;
    if (id && !confirmSensitiveAction('overwrite this game')) {
        alert('Incorrect password or cancelled. Editing existing games requires sensitive action password.');
        return;
    }

    const btn = document.getElementById('save-game-btn');
    btn.disabled = true;
    setSaveStatus('Saving...', false);

    let game;

    try {
        const formGame = readFormGame();
        if (!formGame.name || !formGame.slug) {
            throw new Error('Name and slug are required');
        }

        if (id) {
            const index = gamesData.games.findIndex(function (g) {
                return String(g.id) === String(id);
            });
            if (index === -1) throw new Error('Game not found');
            game = Object.assign({}, gamesData.games[index], formGame);
            gamesData.games[index] = game;
        } else {
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

        persistLocalGamesData();

        const result = await publishGame(game, pendingImageFile);
        pendingImageFile = null;

        document.getElementById('game-modal').classList.remove('active');
        setSaveStatus('Save successful', false);

        const fileList = formatPublishedFiles(result, game);
        let message = 'Save successful!\n\n';
        message += '✓ Saved to data/games.json\n\n';
        message += 'Updated files:\n  · ' + fileList + '\n\n';
        alert(message);
        setTimeout(function () {
            setSaveStatus('');
        }, 2500);
    } catch (err) {
        console.error(err);
        setSaveStatus(err.message || 'Save failed', true);
        alert('Save failed: ' + (err.message || 'Save failed'));
    } finally {
        btn.disabled = false;
    }
}

function deleteGame(id) {
    if (!confirmSensitiveAction('delete this game')) {
        alert('Incorrect password or cancelled. Deletion requires sensitive action password.');
        return;
    }
    if (!confirm('Delete this game from the website? This removes its page and homepage card.')) return;

    const n = String(id);
    gamesData.games = gamesData.games.filter(function (g) {
        return String(g.id) !== n;
    });

    persistLocalGamesData();

    saveGames().catch(function (err) {
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
    markUnsavedChanges();
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
    markUnsavedChanges();
});

document.getElementById('add-game-btn').addEventListener('click', function () {
    openGameEditor(null);
});

document.getElementById('import-games-btn').addEventListener('click', async function () {
    if (!cmsConnected) {
        alert('CMS is not connected. Please refresh the page.');
        return;
    }
    if (!confirm('Reload games from data/games.json? This will refresh the admin panel with the latest data.')) {
        return;
    }
    try {
        const btn = this;
        btn.disabled = true;
        btn.textContent = 'Reloading...';
        await loadGames();
        alert('Games reloaded successfully!');
    } catch (err) {
        alert('Reload failed: ' + err.message);
    } finally {
        const btn = document.getElementById('import-games-btn');
        btn.disabled = !cmsConnected;
        btn.textContent = 'Reload from Data';
    }
});

document.getElementById('game-form').addEventListener('submit', handleSave);

// Add change tracking to all form inputs
const formInputs = document.querySelectorAll('#game-form input:not([type="file"]):not([type="checkbox"]):not([type="hidden"]), #game-form textarea, #game-form select');
formInputs.forEach(function(input) {
    input.addEventListener('input', function() {
        markUnsavedChanges();
    });
});

// Add change tracking to checkboxes
const checkboxes = document.querySelectorAll('#game-form input[type="checkbox"]');
checkboxes.forEach(function(checkbox) {
    checkbox.addEventListener('change', function() {
        markUnsavedChanges();
    });
});

document.getElementById('close-modal').addEventListener('click', function () {
    document.getElementById('game-modal').classList.remove('active');
    setSyncStatus('');
});
document.getElementById('cancel-modal').addEventListener('click', function () {
    document.getElementById('game-modal').classList.remove('active');
    setSyncStatus('');
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
    markUnsavedChanges();
});

document.getElementById('game-image').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    pendingImageFile = file;
    const preview = document.getElementById('image-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    markUnsavedChanges();
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
    if (!checkAuth()) {
        return;
    }

    // Add logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            sessionStorage.removeItem('codeloot_admin_auth');
            sessionStorage.removeItem('codeloot_auth_time');
            window.location.href = 'login.html';
        });
    }

    if (CMS && CMS.isFileProtocol && CMS.isFileProtocol()) {
        window.location.href = CMS.defaultCmsUrl + '/admin-index.html';
        return;
    }

    const base = CMS ? await CMS.connectCms() : null;
    const deployStatus = base ? await loadDeployStatus() : null;
    updateCmsBanner(base, deployStatus);

    try {
        await loadGames();
    } catch (err) {
        console.error('Could not load games:', err.message);
        updateCmsBanner(null, null);
    }

    if (cmsConnected) {
        setSyncStatus('CMS connected', 'success');
        setTimeout(function () {
            setSyncStatus('');
        }, 3000);
    }
}

initAdmin();
