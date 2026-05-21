// CODELOOT Admin Panel — reliable save with phased status feedback
let gamesData = null;
let currentEditingGameId = null;
let lastSaveVersion = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadGames();
    setupEventListeners();
    await checkSyncStatus();
});

async function loadGames() {
    try {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';

        const response = await fetch('/api/games');
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.detail || body.error || 'Failed to fetch games');
        }

        gamesData = await response.json();
        lastSaveVersion = gamesData._version || null;
        console.log('Loaded games:', gamesData.games?.length, 'version:', lastSaveVersion);

        renderGamesTable();
        document.getElementById('loading').style.display = 'none';
        document.getElementById('gamesTableContainer').style.display = 'block';
    } catch (error) {
        console.error('Error loading games:', error);
        showError('Failed to load games: ' + error.message);
        document.getElementById('loading').style.display = 'none';
    }
}

function renderGamesTable() {
    const tbody = document.getElementById('gamesTableBody');
    tbody.innerHTML = '';

    if (!gamesData || !gamesData.games || gamesData.games.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">No games found</td></tr>';
        return;
    }

    gamesData.games.forEach(game => {
        const row = document.createElement('tr');
        const imageHtml = game.image
            ? `<img src="/assets/img/${game.image}" alt="${game.name}" style="max-width:50px;max-height:40px;object-fit:cover;">`
            : '<span style="color:#999;">No image</span>';

        row.innerHTML = `
            <td>${game.id}</td>
            <td>${imageHtml}</td>
            <td><strong>${escapeHtml(game.name)}</strong></td>
            <td>${escapeHtml(game.slug)}</td>
            <td>${escapeHtml(game.category || 'general')}</td>
            <td>${game.featured ? '\u2713' : ''}</td>
            <td><span class="badge ${game.active ? 'active' : 'inactive'}">${game.active ? 'Active' : 'Inactive'}</span></td>
            <td>${(game.codes || []).length}</td>
            <td class="actions">
                <button class="btn btn-sm btn-primary" onclick="editGame(${game.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteGame(${game.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function setupEventListeners() {
    document.getElementById('addGameBtn').addEventListener('click', openGameModal);
    document.getElementById('gameForm').addEventListener('submit', handleGameSubmit);
    document.getElementById('cancelBtn').addEventListener('click', () => {
        document.getElementById('gameModal').style.display = 'none';
    });
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('gameModal').style.display = 'none';
    });
    document.getElementById('gameImage').addEventListener('change', handleImagePreview);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('gameModal');
        if (e.target === modal) modal.style.display = 'none';
    });

    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            retryBtn.style.display = 'none';
            document.getElementById('gameForm').dispatchEvent(new Event('submit'));
        });
    }
}

function openGameModal(game = null) {
    const modal = document.getElementById('gameModal');
    const form = document.getElementById('gameForm');
    const modalTitle = document.getElementById('modalTitle');

    form.reset();
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('currentImageName').textContent = '-';
    clearSyncStatus();

    if (game) {
        modalTitle.textContent = 'Edit Game';
        currentEditingGameId = game.id;
        document.getElementById('gameId').value = game.id;
        document.getElementById('gameName').value = game.name || '';
        document.getElementById('gameSlug').value = game.slug || '';
        document.getElementById('gameCategory').value = game.category || 'general';
        document.getElementById('gameDescription').value = game.description || '';
        document.getElementById('gameShortDescription').value = game.short_description || '';
        document.getElementById('gameLongDescription').value = game.long_description || '';
        document.getElementById('gameFeatured').checked = !!game.featured;
        document.getElementById('gameActive').checked = game.active !== false;

        if (game.image) {
            document.getElementById('currentImageName').textContent = game.image;
            document.getElementById('imagePreview').innerHTML =
                `<img src="/assets/img/${game.image}" alt="Current" style="max-width:200px;max-height:150px;margin-top:10px;">`;
        }
    } else {
        modalTitle.textContent = 'Add New Game';
        currentEditingGameId = null;
        document.getElementById('gameFeatured').checked = false;
        document.getElementById('gameActive').checked = true;
    }

    modal.style.display = 'block';
}

function editGame(gameId) {
    const game = gamesData.games.find(g => g.id === gameId);
    if (game) openGameModal(game);
}

async function deleteGame(gameId) {
    if (!confirm('Are you sure you want to delete this game?')) return;

    try {
        setSyncPhase('Deleting game...');
        gamesData.games = gamesData.games.filter(g => g.id !== gameId);
        const result = await saveGames();
        renderGamesTable();
        showSyncSuccess('Game deleted', result);
    } catch (error) {
        console.error('Error deleting game:', error);
        showSyncFailure('Delete failed', error);
    }
}

async function handleGameSubmit(e) {
    e.preventDefault();

    const gameData = {
        name: document.getElementById('gameName').value.trim(),
        slug: document.getElementById('gameSlug').value.trim(),
        category: document.getElementById('gameCategory').value || 'general',
        description: document.getElementById('gameDescription').value.trim(),
        short_description: document.getElementById('gameShortDescription').value.trim(),
        long_description: document.getElementById('gameLongDescription').value.trim(),
        featured: document.getElementById('gameFeatured').checked,
        active: document.getElementById('gameActive').checked,
    };

    if (!gameData.name || !gameData.slug || !gameData.description) {
        showError('Name, Slug, and Description are required');
        return;
    }

    const imageFile = document.getElementById('gameImage').files[0];
    const saveBtn = document.querySelector('#gameForm button[type="submit"], #gameForm .btn-primary');
    if (saveBtn) saveBtn.disabled = true;

    try {
        // Phase: Upload image
        if (imageFile) {
            setSyncPhase('Uploading image...');
            const imageResult = await uploadImage(imageFile, gameData.slug);
            gameData.image = imageResult.image;
        } else if (currentEditingGameId) {
            const existing = gamesData.games.find(g => g.id === currentEditingGameId);
            if (existing && existing.image) gameData.image = existing.image;
        }

        if (currentEditingGameId) {
            const index = gamesData.games.findIndex(g => g.id === currentEditingGameId);
            if (index !== -1) {
                gameData.id = currentEditingGameId;
                gameData.created_at = gamesData.games[index].created_at;
                gameData.updated_at = new Date().toISOString();
                gameData.codes = gamesData.games[index].codes || [];
                gameData.redeem_instructions = gamesData.games[index].redeem_instructions || [];
                gamesData.games[index] = gameData;
            }
        } else {
            const newId = gamesData.games.length > 0
                ? Math.max(...gamesData.games.map(g => g.id)) + 1
                : 1;
            gameData.id = newId;
            gameData.created_at = new Date().toISOString();
            gameData.updated_at = new Date().toISOString();
            gameData.codes = [];
            gameData.redeem_instructions = [];
            gamesData.games.push(gameData);
        }

        // Phase: Push to GitHub
        setSyncPhase('Pushing to GitHub...');
        const result = await saveGames();

        renderGamesTable();
        document.getElementById('gameModal').style.display = 'none';
        showSyncSuccess(currentEditingGameId ? 'Game updated' : 'Game added', result);
        currentEditingGameId = null;
    } catch (error) {
        console.error('Error saving game:', error);
        showSyncFailure('Save failed', error);
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

async function uploadImage(file, slug) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('slug', slug);

    const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || body.detail || 'Image upload failed (' + response.status + ')');
    }

    return await response.json();
}

async function saveGames() {
    setSyncPhase('Pushing to GitHub...');

    const response = await fetch('/api/games', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-If-Version': lastSaveVersion || ''
        },
        body: JSON.stringify(gamesData)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(result.message || result.error || 'Save failed (' + response.status + ')');
        error.phase = result.phase || 'unknown';
        error.reason = result.reason || 'unknown';
        error.retryable = result.retryable !== false;
        error.phases = result.phases || [];
        throw error;
    }

    // Update local version for future conflict detection
    if (result.version) {
        lastSaveVersion = result.version;
        if (gamesData) gamesData._version = result.version;
    }

    return result;
}

// ── Sync status UI ──

function setSyncPhase(message) {
    const el = ensureSyncStatusEl();
    el.className = 'sync-status syncing';
    el.innerHTML = '<span class="sync-spinner"></span> ' + escapeHtml(message);
    el.style.display = 'block';
}

function showSyncSuccess(label, result) {
    const el = ensureSyncStatusEl();
    const verified = result && result.verified;
    const commitShort = result && result.commit ? result.commit.substring(0, 7) : '';
    const elapsed = result && result.elapsed_ms ? ' (' + result.elapsed_ms + 'ms)' : '';

    let details = escapeHtml(label);
    if (commitShort) details += ' \u00b7 commit ' + commitShort;
    if (verified) details += ' \u00b7 verified';
    details += elapsed;

    if (result && result.deployment && result.deployment.state) {
        details += ' \u00b7 deploy: ' + escapeHtml(result.deployment.state);
    }

    el.className = 'sync-status sync-success';
    el.innerHTML = details;
    el.style.display = 'block';

    setTimeout(() => {
        el.style.display = 'none';
    }, 8000);
}

function showSyncFailure(label, error) {
    const el = ensureSyncStatusEl();
    let msg = escapeHtml(label) + ': ' + escapeHtml(error.message || 'Unknown error');

    if (error.phase) msg += ' [phase: ' + escapeHtml(error.phase) + ']';
    if (error.reason && error.reason !== 'unknown') msg += ' [reason: ' + escapeHtml(error.reason) + ']';

    el.className = 'sync-status sync-error';
    el.innerHTML = msg;
    el.style.display = 'block';

    if (error.retryable !== false) {
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) retryBtn.style.display = 'inline-block';
    }
}

function clearSyncStatus() {
    const el = document.getElementById('syncStatus');
    if (el) {
        el.style.display = 'none';
        el.innerHTML = '';
    }
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) retryBtn.style.display = 'none';
}

function ensureSyncStatusEl() {
    let el = document.getElementById('syncStatus');
    if (!el) {
        el = document.createElement('div');
        el.id = 'syncStatus';
        el.className = 'sync-status';
        const header = document.querySelector('.admin-header') || document.body;
        header.parentNode.insertBefore(el, header.nextSibling);
    }
    return el;
}

async function checkSyncStatus() {
    try {
        const res = await fetch('/api/sync-status');
        if (!res.ok) return;
        const status = await res.json();

        const el = ensureSyncStatusEl();
        if (status.success && status.github?.connected) {
            el.className = 'sync-status sync-connected';
            el.textContent = 'GitHub connected \u00b7 ' + (status.github.game_count || 0) + ' games';
            if (status.deployment) {
                el.textContent += ' \u00b7 deploy: ' + status.deployment.state;
            }
            el.style.display = 'block';
            setTimeout(() => { el.style.display = 'none'; }, 5000);
        } else if (status.errors?.length) {
            el.className = 'sync-status sync-warning';
            el.textContent = 'Sync warning: ' + status.errors.map(e => e.error).join('; ');
            el.style.display = 'block';
        }
    } catch (e) {
        console.warn('Could not check sync status:', e.message);
    }
}

// ── Utility ──

function handleImagePreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('imagePreview').innerHTML =
                `<img src="${event.target.result}" alt="Preview" style="max-width:200px;max-height:150px;margin-top:10px;">`;
        };
        reader.readAsDataURL(file);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.classList.remove('success');
    setTimeout(() => { errorDiv.style.display = 'none'; }, 6000);
}

function showSuccess(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '\u2713 ' + message;
    errorDiv.style.display = 'block';
    errorDiv.classList.add('success');
    setTimeout(() => {
        errorDiv.style.display = 'none';
        errorDiv.classList.remove('success');
    }, 4000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
