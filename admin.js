// CodeLoot Admin — publishes to real site files via Vercel API routes
// VERSION: 2026-05-21-10:04-DEBUG

console.log('=== ADMIN.JS LOADED ===');
console.log('window.location.href:', window.location.href);
console.log('document.currentScript:', document.currentScript);
console.log('import.meta:', typeof import.meta !== 'undefined' ? import.meta : 'not available');

const D = window.CodeLootData;
const CMS = window.CodeLootCMS;
const ADMIN_PASSWORD = 'AdminPass';
const SENSITIVE_PASSWORD = 'jeff@';
let gamesData = null;
let pendingImageFile = null;
let editorCodes = [];
let cmsConnected = false;

// Autosync state
let currentVersion = null;
let autosaveTimer = null;
let pollTimer = null;
let isAutosaving = false;
let hasUnsavedChanges = false;
const AUTOSAVE_DELAY = 3000; // 3 seconds of inactivity before autosave
const POLL_INTERVAL = 10000; // Check for remote changes every 10 seconds

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
            '<strong>✓ Live Autosync Active</strong> — Changes save instantly to GitHub (shared data source)<br>' +
            '<code>data/games.json</code> — Admin &amp; public site use same data<br>' +
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
            '<strong>⚠ CMS Connection Issue</strong> — Cannot connect to GitHub API<br>' +
            'Changes will be saved to localStorage as backup.<br>' +
            '<span style="color:var(--muted)">Check GITHUB_TOKEN in Vercel settings</span>';
        const saveBtn = document.getElementById('save-game-btn');
        const addBtn = document.getElementById('add-game-btn');
        if (saveBtn) saveBtn.disabled = false;
        if (addBtn) addBtn.disabled = false;
    }
}

async function loadGames() {
    console.log('=== ADMIN DATA LOADER ===');
    console.log('Exact file path: /Users/jeff/Desktop/CODELOOT/data/games.json');
    console.log('Exact fetch URL: /data/games.json');
    
    try {
        const response = await fetch('/data/games.json', { cache: 'no-store' });
        console.log('Fetch status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('DIRECT LIVE DATA:', data);
            console.log('Games count loaded:', data.games ? data.games.length : 0);
            
            gamesData = data;
            currentVersion = null;
            
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
            
            console.log('Total games after normalization:', gamesData.games.length);
            renderGamesTable(gamesData.games);
        } else {
            console.error('Failed to load games.json, status:', response.status);
            gamesData = { games: [], metadata: { version: '1.0', last_updated: '' } };
            renderGamesTable([]);
        }
    } catch (e) {
        console.error('Error loading games.json:', e);
        gamesData = { games: [], metadata: { version: '1.0', last_updated: '' } };
        renderGamesTable([]);
    }
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
    const res = await CMS.cmsFetch('/api/upload-image', { method: 'POST', body: fd });
    const data = await res.json().catch(function () {
        return {};
    });
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Image upload failed');
    }
    return data;
}

async function saveGames(skipVersionCheck = false) {
    gamesData.metadata.last_updated = new Date().toISOString();
    
    // Always save to localStorage as backup
    try {
        localStorage.setItem('codeloot_games_data', JSON.stringify(gamesData));
        console.log('Saved to localStorage as backup');
    } catch (e) {
        console.warn('Failed to save to localStorage:', e.message);
    }
    
    // Try to save to CMS API if connected
    if (cmsConnected) {
        const headers = { 'Content-Type': 'application/json' };
        // Include version for conflict detection unless skipping
        if (!skipVersionCheck && currentVersion) {
            headers['X-If-Version'] = currentVersion;
        }
        
        const res = await CMS.cmsFetch('/api/games', {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(gamesData, null, 2),
        });
        const result = await res.json().catch(function () {
            return {};
        });
        
        if (res.status === 409) {
            // Conflict detected
            throw new ConflictError(result.message, result.currentData);
        }
        
        if (!res.ok || result.success === false) {
            throw new Error(result.error || 'Save failed');
        }
        if (result.success) {
            // Update current version after successful save
            currentVersion = result.version;
            D.clearGamesCache();
            clearUnsavedChanges();
            // Reload gamesData from CMS to ensure sync
            await loadGames();
        }
        return result;
    } else {
        // If CMS not connected, return success with localStorage-only flag
        console.warn('CMS not connected, saved to localStorage only');
        clearUnsavedChanges();
        return { success: true, localStorageOnly: true, message: 'Saved to localStorage (CMS offline)' };
    }
}

// Custom error for conflicts
class ConflictError extends Error {
    constructor(message, currentData) {
        super(message);
        this.name = 'ConflictError';
        this.currentData = currentData;
    }
}

// Autosave with debouncing
function triggerAutosave() {
    if (autosaveTimer) {
        clearTimeout(autosaveTimer);
    }
    
    setSyncStatus('Autosaving in 3s...', 'warning');
    
    autosaveTimer = setTimeout(async function() {
        if (!hasUnsavedChanges || isAutosaving) {
            setSyncStatus('');
            return;
        }
        
        isAutosaving = true;
        setSyncStatus('Autosaving...', 'warning');
        
        try {
            await saveGames();
            setSyncStatus('Autosaved successfully', 'success');
            setTimeout(() => setSyncStatus(''), 2000);
        } catch (err) {
            console.error('Autosave failed:', err);
            if (err instanceof ConflictError) {
                setSyncStatus('Conflict detected - please refresh', 'error');
            } else {
                setSyncStatus('Autosave failed - ' + err.message, 'error');
            }
        } finally {
            isAutosaving = false;
        }
    }, AUTOSAVE_DELAY);
}

// Poll for remote changes
async function pollForRemoteChanges() {
    if (!cmsConnected || !currentVersion) {
        return;
    }
    
    try {
        const res = await CMS.cmsFetch('/api/sync-status');
        const data = await res.json();
        
        if (data.success && data.version && data.version !== currentVersion) {
            // Remote changes detected
            if (!hasUnsavedChanges) {
                // No local changes, safe to reload
                console.log('Remote changes detected, reloading...');
                setSyncStatus('Syncing changes...', 'warning');
                await loadGames();
                setSyncStatus('Synced', 'success');
                setTimeout(() => setSyncStatus(''), 2000);
            } else {
                // Local unsaved changes exist, warn user
                setSyncStatus('Remote changes available - save or discard local changes', 'warning');
            }
        }
    } catch (err) {
        console.warn('Poll for changes failed:', err.message);
    }
}

function startPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }
    pollTimer = setInterval(pollForRemoteChanges, POLL_INTERVAL);
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function applyGameImage(game, uploadedFilename) {
    if (uploadedFilename) {
        game.image = uploadedFilename;
        return;
    }
    game.image = D.gameImageFile(game);
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
    console.log('renderGamesTable called with games:', games);
    console.log('games is array?', Array.isArray(games));
    console.log('games length:', games ? games.length : 'N/A');
    
    const tbody = document.getElementById('games-table-body');
    console.log('tbody element:', tbody);
    
    if (!tbody) {
        console.error('games-table-body element not found!');
        return;
    }
    
    if (!games || !Array.isArray(games) || games.length === 0) {
        console.warn('No games to render, showing empty table');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);">No games found</td></tr>';
        return;
    }
    
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
    
    console.log('Table rendered with', games.length, 'games');
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
    // Require sensitive password for editing existing games
    if (id && !confirmSensitiveAction('overwrite this game')) {
        alert('Incorrect password or cancelled. Editing existing games requires sensitive action password.');
        return;
    }

    const btn = document.getElementById('save-game-btn');
    btn.disabled = true;
    setSaveStatus('Saving...', false);

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

        setSaveStatus('Publishing...', false);
        
        const result = await publishGame(game, pendingImageFile);
        pendingImageFile = null;

        document.getElementById('game-modal').classList.remove('active');
        renderGamesTable(gamesData.games);
        setSaveStatus('');

        const base = CMS.getApiBase();
        const fileList = formatPublishedFiles(result, game);
        
        let message = 'Published successfully!\n\n';
        if (result.localStorageOnly) {
            message += '⚠️ CMS is offline - saved to localStorage only.\n';
            message += 'Changes will sync when CMS reconnects.\n\n';
        } else {
            message += '✓ Saved to GitHub (shared data source)\n';
            message += '✓ Live site updated instantly\n\n';
        }
        message += 'Updated files:\n  · ' + fileList + '\n\n';
        if (cmsConnected) {
            message += 'Admin and public site now use the same data.';
        }
        alert(message);
    } catch (err) {
        console.error(err);
        setSaveStatus(err.message || 'Save failed', true);
        
        if (err instanceof ConflictError) {
            // Show conflict resolution dialog
            const shouldOverwrite = confirm(
                'Conflict detected: The data was modified by another user.\n\n' +
                'Click OK to overwrite their changes with your changes.\n' +
                'Click Cancel to refresh and see their changes.'
            );
            if (shouldOverwrite) {
                // Force save without version check
                try {
                    const result = await saveGames(true);
                    document.getElementById('game-modal').classList.remove('active');
                    renderGamesTable(gamesData.games);
                    setSaveStatus('');
                    alert('Published successfully (overwrote remote changes)');
                } catch (retryErr) {
                    alert('Failed to overwrite: ' + retryErr.message);
                }
            } else {
                // Refresh to get latest data
                await loadGames();
                alert('Data refreshed. Please try again.');
            }
        } else {
            alert('Publish failed: ' + (err.message || 'Save failed'));
        }
    } finally {
        btn.disabled = false;
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
    markUnsavedChanges();
    triggerAutosave();
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
    triggerAutosave();
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

// Add autosave triggers to all form inputs
const formInputs = document.querySelectorAll('#game-form input:not([type="file"]):not([type="checkbox"]):not([type="hidden"]), #game-form textarea, #game-form select');
formInputs.forEach(function(input) {
    input.addEventListener('input', function() {
        markUnsavedChanges();
        triggerAutosave();
    });
});

// Add autosave triggers to checkboxes
const checkboxes = document.querySelectorAll('#game-form input[type="checkbox"]');
checkboxes.forEach(function(checkbox) {
    checkbox.addEventListener('change', function() {
        markUnsavedChanges();
        triggerAutosave();
    });
});

document.getElementById('close-modal').addEventListener('click', function () {
    document.getElementById('game-modal').classList.remove('active');
    // Cancel autosave if modal is closed
    if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
    }
    setSyncStatus('');
});
document.getElementById('cancel-modal').addEventListener('click', function () {
    document.getElementById('game-modal').classList.remove('active');
    // Cancel autosave if modal is closed
    if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
    }
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
    triggerAutosave();
});

document.getElementById('game-image').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    pendingImageFile = file;
    const preview = document.getElementById('image-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    markUnsavedChanges();
    triggerAutosave();
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
    console.log('=== initAdmin() CALLED ===');
    
    // Check authentication first
    if (!checkAuth()) {
        console.log('initAdmin: auth check failed');
        return;
    }
    console.log('initAdmin: auth check passed');

    // Add logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            sessionStorage.removeItem('codeloot_admin_auth');
            sessionStorage.removeItem('codeloot_auth_time');
            stopPolling();
            window.location.href = 'login.html';
        });
    }

    if (CMS.isFileProtocol()) {
        console.log('initAdmin: file protocol detected, redirecting');
        window.location.href = CMS.defaultCmsUrl + '/admin/index.html';
        return;
    }

    console.log('initAdmin: Connecting to CMS API...');
    const base = await CMS.connectCms();
    console.log('initAdmin: CMS connection result:', base);
    updateCmsBanner(base);

    // Always try to load games, even if CMS is not connected
    try {
        console.log('initAdmin: About to call loadGames()');
        await loadGames();
        console.log('initAdmin: loadGames() completed');
    } catch (err) {
        console.error('initAdmin: Could not load games:', err.message);
        updateCmsBanner(null);
        // Don't alert - let the fallback in loadGames handle it
    }

    // Start polling for remote changes if CMS is connected
    if (cmsConnected) {
        startPolling();
        setSyncStatus('Real-time sync active', 'success');
    } else {
        console.warn('initAdmin: CMS not connected, polling disabled');
    }
    
    console.log('=== initAdmin() COMPLETED ===');
}

initAdmin();
