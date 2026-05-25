// Simple CodeLoot Admin - Direct API access to data/games.json

const API_URL = '/api/games';
const UPLOAD_URL = '/api/upload-image';
let gamesData = { games: [], metadata: { version: '1.0', last_updated: '' } };
let pendingImageFile = null;
let editorCodes = [];

// Authentication
function checkAuth() {
    const auth = sessionStorage.getItem('codeloot_admin_auth');
    const authTime = sessionStorage.getItem('codeloot_auth_time');
    
    if (auth !== 'true' || !authTime) {
        window.location.href = 'login.html';
        return false;
    }
    
    // Session expires after 8 hours
    const elapsed = Date.now() - parseInt(authTime);
    if (elapsed > 8 * 60 * 60 * 1000) {
        sessionStorage.removeItem('codeloot_admin_auth');
        sessionStorage.removeItem('codeloot_auth_time');
        window.location.href = 'login.html';
        return false;
    }
    
    return true;
}

// Escape HTML
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Load games from API
async function loadGames() {
    try {
        const res = await fetch(API_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load games');
        
        const data = await res.json();
        gamesData = data;
        
        if (!gamesData.metadata) {
            gamesData.metadata = { version: '1.0', last_updated: '' };
        }
        if (!Array.isArray(gamesData.games)) {
            gamesData.games = [];
        }
        
        // Normalize games data
        gamesData.games.forEach(function(game) {
            if (!game.codes) game.codes = [];
            if (!game.short_description && game.description) game.short_description = game.description;
            if (!game.long_description) game.long_description = game.description || game.short_description || '';
            if (!game.redeem_instructions) game.redeem_instructions = [];
            game.codes.forEach(function(code, idx) {
                if (!code.id) code.id = idx + 1;
            });
        });
        
        renderGamesTable(gamesData.games);
        setStatus('Games loaded successfully', false);
    } catch (err) {
        console.error('Load error:', err);
        setStatus('Error loading games: ' + err.message, true);
        gamesData = { games: [], metadata: { version: '1.0', last_updated: '' } };
        renderGamesTable([]);
    }
}

// Save games to API
async function saveGames() {
    try {
        gamesData.metadata.last_updated = new Date().toISOString();
        
        const res = await fetch(API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gamesData)
        });
        
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || 'Save failed');
        }
        
        const result = await res.json();
        if (!result.success) {
            throw new Error(result.error || 'Save failed');
        }
        
        return result;
    } catch (err) {
        console.error('Save error:', err);
        throw err;
    }
}

// Upload image
async function uploadImage(slug, file) {
    const formData = new FormData();
    formData.append('slug', slug);
    formData.append('image', file);
    
    const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        body: formData
    });
    
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Image upload failed');
    }
    
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error || 'Image upload failed');
    }
    
    return data;
}

// Set status message
function setStatus(msg, isError) {
    const el = document.getElementById('save-status');
    if (el) {
        el.hidden = !msg;
        el.textContent = msg || '';
        el.classList.toggle('error', !!isError);
    }
}

// Render games table
function renderGamesTable(games) {
    const tbody = document.getElementById('games-table-body');
    if (!tbody) return;
    
    if (!games || games.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);">No games found</td></tr>';
        return;
    }
    
    tbody.innerHTML = games.map(function(game) {
        const activeCodes = (game.codes || []).filter(function(c) {
            return c.status === 'active';
        }).length;
        
        return (
            '<tr data-game-id="' + game.id + '">' +
            '<td><strong>' + escapeHtml(game.name) + '</strong></td>' +
            '<td><code>' + escapeHtml(game.slug) + '</code></td>' +
            '<td>' + escapeHtml(game.category || 'general') + '</td>' +
            '<td>' + activeCodes + '</td>' +
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

// Get next game ID
function getNextGameId() {
    if (!gamesData.games || gamesData.games.length === 0) return 1;
    return Math.max(...gamesData.games.map(function(g) { return g.id || 0; })) + 1;
}

// Get next code ID
function getNextCodeId() {
    let maxId = 0;
    gamesData.games.forEach(function(game) {
        (game.codes || []).forEach(function(code) {
            if (code.id > maxId) maxId = code.id;
        });
    });
    return maxId + 1;
}

// Open game editor
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
        document.getElementById('game-category').value = game.category || 'general';
        document.getElementById('game-reward-label').value = game.reward_label || '';
        document.getElementById('game-update-date').value = game.update_date || '';
        document.getElementById('game-update-info').value = game.update_info || '';
        document.getElementById('game-redeem').value = (game.redeem_instructions || []).join('\n');
        document.getElementById('game-featured').checked = !!game.featured;
        document.getElementById('game-active').checked = game.active !== false;
        
        editorCodes = JSON.parse(JSON.stringify(game.codes || []));
        
        // Show image preview
        if (game.image) {
            const preview = document.getElementById('image-preview');
            preview.src = 'assets/img/' + game.image + '?t=' + Date.now();
            preview.alt = game.name;
            preview.hidden = false;
        }
    } else {
        document.getElementById('modal-title').textContent = 'Add Game';
        document.getElementById('game-id').value = '';
        document.getElementById('game-active').checked = true;
        editorCodes = [];
    }
    
    renderCodeRows();
    setStatus('');
    document.getElementById('game-modal').classList.add('active');
}

// Render code rows
function renderCodeRows() {
    const list = document.getElementById('codes-editor-list');
    if (!list) return;
    
    if (!editorCodes.length) {
        list.innerHTML = '<p style="color:var(--muted);font-size:14px;">No codes yet. Add one above or paste bulk codes below.</p>';
        return;
    }
    
    list.innerHTML = editorCodes.map(function(code, index) {
        return (
            '<div class="code-row" data-index="' + index + '">' +
            '<input type="text" data-field="code" value="' + escapeHtml(code.code) + '" placeholder="CODE">' +
            '<input type="text" data-field="reward" value="' + escapeHtml(code.reward) + '" placeholder="Reward">' +
            '<select data-field="status">' +
            '<option value="active"' + (code.status === 'active' ? ' selected' : '') + '>Active</option>' +
            '<option value="expired"' + (code.status === 'expired' ? ' selected' : '') + '>Expired</option>' +
            '</select>' +
            '<button type="button" class="btn btn-danger" data-action="remove-code-row" data-index="' + index + '">✕</button>' +
            '</div>'
        );
    }).join('');
}

// Collect codes from editor
function collectEditorCodes() {
    const rows = document.querySelectorAll('#codes-editor-list .code-row');
    const collected = [];
    
    rows.forEach(function(row) {
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
            created_at: existing.created_at || new Date().toISOString()
        });
    });
    
    return collected;
}

// Assign IDs to codes
function assignCodeIds(codes) {
    let nextId = getNextCodeId();
    return codes.map(function(c) {
        if (c.id) return c;
        return Object.assign({}, c, {
            id: nextId++,
            created_at: c.created_at || new Date().toISOString()
        });
    });
}

// Parse redeem instructions
function parseRedeemLines(text) {
    return text.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
}

// Handle save
async function handleSave(e) {
    e.preventDefault();
    
    const btn = document.getElementById('save-game-btn');
    btn.disabled = true;
    setStatus('Saving...', false);
    
    try {
        const id = document.getElementById('game-id').value;
        const name = document.getElementById('game-name').value.trim();
        const slug = document.getElementById('game-slug').value.trim();
        const shortDescription = document.getElementById('game-short-description').value.trim();
        const longDescription = document.getElementById('game-long-description').value.trim();
        
        if (!name || !slug || !shortDescription) {
            throw new Error('Name, slug, and short description are required');
        }
        
        // Collect codes
        let collected = collectEditorCodes();
        const bulk = document.getElementById('bulk-codes').value.trim();
        if (bulk) {
            let nextId = getNextCodeId();
            bulk.split('\n').forEach(function(line) {
                line = line.trim();
                if (!line) return;
                const parts = line.split('|');
                collected.push({
                    id: nextId++,
                    code: parts[0].trim(),
                    reward: parts[1] ? parts[1].trim() : 'Unknown reward',
                    status: 'active',
                    created_at: new Date().toISOString()
                });
            });
            document.getElementById('bulk-codes').value = '';
        }
        
        const codes = assignCodeIds(collected);
        
        const gameData = {
            name: name,
            slug: slug,
            short_description: shortDescription,
            long_description: longDescription,
            description: shortDescription,
            category: document.getElementById('game-category').value,
            reward_label: document.getElementById('game-reward-label').value.trim(),
            update_date: document.getElementById('game-update-date').value.trim(),
            update_info: document.getElementById('game-update-info').value.trim(),
            redeem_instructions: parseRedeemLines(document.getElementById('game-redeem').value),
            featured: document.getElementById('game-featured').checked,
            active: document.getElementById('game-active').checked,
            codes: codes,
            updated_at: new Date().toISOString()
        };
        
        // Upload image if pending
        if (pendingImageFile) {
            setStatus('Uploading image...', false);
            const uploadResult = await uploadImage(slug, pendingImageFile);
            gameData.image = uploadResult.image;
            pendingImageFile = null;
        }
        
        // Add or update game
        if (id) {
            const index = gamesData.games.findIndex(function(g) {
                return String(g.id) === String(id);
            });
            if (index === -1) throw new Error('Game not found');
            
            // Preserve existing image if not uploaded
            if (!gameData.image && gamesData.games[index].image) {
                gameData.image = gamesData.games[index].image;
            }
            
            gameData.id = parseInt(id);
            gameData.created_at = gamesData.games[index].created_at;
            gamesData.games[index] = gameData;
        } else {
            // Check for duplicate slug
            const existingSlug = gamesData.games.find(function(g) {
                return g.slug === slug;
            });
            if (existingSlug) {
                throw new Error('A game with slug "' + slug + '" already exists');
            }
            
            gameData.id = getNextGameId();
            gameData.created_at = new Date().toISOString();
            gameData.image = gameData.image || slug + '.png';
            gamesData.games.push(gameData);
        }
        
        // Save to API
        setStatus('Saving to data/games.json...', false);
        await saveGames();
        
        // Refresh table
        renderGamesTable(gamesData.games);
        
        // Close modal
        document.getElementById('game-modal').classList.remove('active');
        
        setStatus('Saved successfully!', false);
        setTimeout(function() { setStatus(''); }, 3000);
        
    } catch (err) {
        console.error('Save error:', err);
        setStatus('Error: ' + err.message, true);
        alert('Save failed: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

// Delete game
async function deleteGame(id) {
    if (!confirm('Delete this game from the website? This cannot be undone.')) return;
    
    try {
        const n = String(id);
        gamesData.games = gamesData.games.filter(function(g) {
            return String(g.id) !== n;
        });
        
        setStatus('Deleting game...', false);
        await saveGames();
        
        renderGamesTable(gamesData.games);
        setStatus('Game deleted successfully', false);
        setTimeout(function() { setStatus(''); }, 3000);
    } catch (err) {
        console.error('Delete error:', err);
        setStatus('Error deleting game: ' + err.message, true);
        alert('Delete failed: ' + err.message);
    }
}

// Initialize
async function initAdmin() {
    if (!checkAuth()) return;
    
    // Logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            sessionStorage.removeItem('codeloot_admin_auth');
            sessionStorage.removeItem('codeloot_auth_time');
            window.location.href = 'login.html';
        });
    }
    
    // Load games
    await loadGames();
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initAdmin();
    
    // Table actions
    document.getElementById('games-table-body').addEventListener('click', function(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        
        const id = btn.getAttribute('data-game-id');
        const action = btn.getAttribute('data-action');
        
        if (action === 'edit-game') {
            const game = gamesData.games.find(function(g) {
                return String(g.id) === String(id);
            });
            if (game) openGameEditor(game);
        } else if (action === 'delete-game') {
            deleteGame(id);
        }
    });
    
    // Add game button
    document.getElementById('add-game-btn').addEventListener('click', function() {
        openGameEditor(null);
    });
    
    // Reload button
    document.getElementById('import-games-btn').addEventListener('click', async function() {
        if (!confirm('Reload games from data/games.json?')) return;
        await loadGames();
    });
    
    // Form submit
    document.getElementById('game-form').addEventListener('submit', handleSave);
    
    // Close modal
    document.getElementById('close-modal').addEventListener('click', function() {
        document.getElementById('game-modal').classList.remove('active');
        setStatus('');
    });
    
    document.getElementById('cancel-modal').addEventListener('click', function() {
        document.getElementById('game-modal').classList.remove('active');
        setStatus('');
    });
    
    // Auto-generate slug from name
    document.getElementById('game-name').addEventListener('input', function(e) {
        if (document.getElementById('game-id').value) return;
        const slug = e.target.value
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        document.getElementById('game-slug').value = slug;
    });
    
    // Image upload
    document.getElementById('game-image').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        pendingImageFile = file;
        const preview = document.getElementById('image-preview');
        preview.src = URL.createObjectURL(file);
        preview.alt = 'Image preview';
        preview.hidden = false;
    });
    
    // Code editor
    document.getElementById('codes-editor-list').addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action="remove-code-row"]');
        if (!btn) return;
        const i = Number(btn.dataset.index);
        editorCodes.splice(i, 1);
        renderCodeRows();
    });
    
    document.getElementById('add-code-row-btn').addEventListener('click', function() {
        editorCodes.push({ code: '', reward: '', status: 'active' });
        renderCodeRows();
    });
    
    // Search
    document.getElementById('search-games').addEventListener('input', function(e) {
        const q = e.target.value.trim().toLowerCase();
        if (!gamesData) return;
        const filtered = gamesData.games.filter(function(game) {
            return (game.name || '').toLowerCase().includes(q) ||
                   (game.slug || '').toLowerCase().includes(q) ||
                   (game.description || '').toLowerCase().includes(q);
        });
        renderGamesTable(filtered);
    });
});
