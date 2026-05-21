// CODELOOT Admin Panel — Reliable sync pipeline
let gamesData = null;
let currentEditingGameId = null;

const DEPLOY_POLL_INTERVAL = 4000;
const DEPLOY_POLL_MAX = 15;

document.addEventListener('DOMContentLoaded', async () => {
    await loadGames();
    setupEventListeners();
});

async function loadGames() {
    try {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';

        const response = await fetch('/api/games');
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error('Failed to fetch games: ' + response.status + ' ' + body.slice(0, 200));
        }

        gamesData = await response.json();
        console.log('Loaded games:', gamesData);

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
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function openGameModal(game = null) {
    const modal = document.getElementById('gameModal');
    const form = document.getElementById('gameForm');
    const modalTitle = document.getElementById('modalTitle');

    form.reset();
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('currentImageName').textContent = '-';

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
    if (game) {
        openGameModal(game);
    }
}

async function deleteGame(gameId) {
    if (!confirm('Are you sure you want to delete this game?')) {
        return;
    }

    try {
        gamesData.games = gamesData.games.filter(g => g.id !== gameId);
        await saveGamesWithSync('Game deleted');
        renderGamesTable();
    } catch (error) {
        console.error('Error deleting game:', error);
        showError('Failed to delete game: ' + error.message);
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

    try {
        if (imageFile) {
            const imageResult = await uploadImage(imageFile, gameData.slug);
            gameData.image = imageResult.image;
        } else if (currentEditingGameId) {
            const existing = gamesData.games.find(g => g.id === currentEditingGameId);
            if (existing && existing.image) {
                gameData.image = existing.image;
            }
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

        const action = currentEditingGameId ? 'Game updated' : 'Game added';
        await saveGamesWithSync(action);
        renderGamesTable();
        document.getElementById('gameModal').style.display = 'none';
        currentEditingGameId = null;
    } catch (error) {
        console.error('Error saving game:', error);
        showError('Failed to save game: ' + error.message);
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
        const body = await response.text().catch(() => '');
        throw new Error('Image upload failed: ' + response.status + ' ' + body.slice(0, 200));
    }

    return await response.json();
}

// ─── Sync pipeline ───────────────────────────────────────────────────────────

function setSyncStep(stepId, status, detail) {
    const el = document.getElementById('sync-step-' + stepId);
    if (!el) return;

    el.className = 'sync-step sync-' + status;

    const icon = el.querySelector('.sync-step-icon');
    const label = el.querySelector('.sync-step-label');

    if (icon) {
        const icons = { pending: '\u25CB', in_progress: '\u21BB', success: '\u25CF', failed: '\u2717', warning: '\u26A0' };
        icon.textContent = icons[status] || '\u25CB';
    }
    if (detail && label) {
        label.textContent = detail;
    }
}

function resetSyncStatus() {
    const panel = document.getElementById('syncStatusPanel');
    if (!panel) return;
    panel.style.display = 'none';
    setSyncStep('push', 'pending', 'Push to GitHub');
    setSyncStep('verify', 'pending', 'Verify commit');
    setSyncStep('deploy', 'pending', 'Deploy to live site');
    const retryBtn = document.getElementById('syncRetryBtn');
    if (retryBtn) retryBtn.style.display = 'none';
    const errorBox = document.getElementById('syncErrorDetail');
    if (errorBox) {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
    }
}

function showSyncPanel() {
    const panel = document.getElementById('syncStatusPanel');
    if (panel) panel.style.display = 'block';
}

function showSyncError(message) {
    const errorBox = document.getElementById('syncErrorDetail');
    if (errorBox) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
    }
}

let lastSavePayload = null;

async function saveGamesWithSync(actionLabel) {
    resetSyncStatus();
    showSyncPanel();

    setSyncStep('push', 'in_progress', 'Pushing to GitHub...');

    const payload = JSON.parse(JSON.stringify(gamesData));
    lastSavePayload = payload;

    let result;
    try {
        result = await saveGamesToApi(payload);
    } catch (err) {
        setSyncStep('push', 'failed', 'Push failed');
        showSyncError('GitHub push error: ' + err.message);
        showRetryButton();
        throw err;
    }

    if (!result.success) {
        setSyncStep('push', 'failed', 'Push failed');
        showSyncError(result.error || 'Unknown error');
        showRetryButton();
        throw new Error(result.error || 'Save failed');
    }

    // Update version from server response
    if (result.version) {
        gamesData._version = result.version;
    }

    const steps = result.steps || {};

    // GitHub push status
    if (steps.github_push) {
        setSyncStep('push', steps.github_push.status === 'success' ? 'success' : 'failed',
            steps.github_push.status === 'success' ? 'Pushed to GitHub' : 'Push failed');
        if (steps.github_push.error) {
            showSyncError('GitHub push: ' + steps.github_push.error);
            showRetryButton();
            return;
        }
    } else {
        setSyncStep('push', 'success', 'Pushed to GitHub');
    }

    // Commit verification
    if (steps.commit_verified) {
        setSyncStep('verify', steps.commit_verified.status === 'success' ? 'success' : 'warning',
            steps.commit_verified.status === 'success' ? 'Commit verified' : 'Verification uncertain');
    } else {
        setSyncStep('verify', 'success', 'Commit verified');
    }

    // Deployment status — poll until complete or timeout
    setSyncStep('deploy', 'in_progress', 'Deploying to live site...');
    await pollDeploymentStatus(result.commit);

    showSuccess(actionLabel + ' — synced to live site');
}

async function saveGamesToApi(data) {
    const response = await fetch('/api/games', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-If-Version': data._version || '',
        },
        body: JSON.stringify(data)
    });

    const body = await response.json().catch(() => null);

    if (response.status === 409) {
        throw new Error('Conflict: ' + (body?.message || 'Data was modified by another user. Refresh and try again.'));
    }

    if (!response.ok) {
        const detail = body?.error || body?.detail || ('HTTP ' + response.status);
        throw new Error(detail);
    }

    return body;
}

async function pollDeploymentStatus(commitSha) {
    for (let i = 0; i < DEPLOY_POLL_MAX; i++) {
        try {
            const res = await fetch('/api/sync-status');
            if (res.ok) {
                const data = await res.json();
                const deploy = data.deployment || {};

                if (deploy.status === 'completed') {
                    if (deploy.conclusion === 'success') {
                        setSyncStep('deploy', 'success', 'Live on codeloot.codes');
                        return;
                    } else {
                        setSyncStep('deploy', 'failed', 'Deploy failed: ' + (deploy.conclusion || 'unknown'));
                        if (deploy.html_url) {
                            showSyncError('Deployment failed. Details: ' + deploy.html_url);
                        }
                        return;
                    }
                }

                setSyncStep('deploy', 'in_progress', 'Deploying... (' + (deploy.status || 'queued') + ')');
            }
        } catch (err) {
            console.warn('Deploy poll error:', err);
        }

        await sleep(DEPLOY_POLL_INTERVAL);
    }

    setSyncStep('deploy', 'warning', 'Deploy status unknown (timed out polling)');
}

function showRetryButton() {
    const retryBtn = document.getElementById('syncRetryBtn');
    if (retryBtn) retryBtn.style.display = 'inline-block';
}

async function retrySave() {
    if (!lastSavePayload) {
        showError('Nothing to retry');
        return;
    }
    try {
        await saveGamesWithSync('Retry save');
        renderGamesTable();
    } catch (err) {
        console.error('Retry failed:', err);
    }
}

// Expose globally for onclick
window.retrySave = retrySave;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Legacy save (replaced by saveGamesWithSync) ─────────────────────────────

async function saveGames() {
    return saveGamesWithSync('Saved');
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

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
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 8000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('successBanner');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 6000);
    } else {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.classList.add('success');
        setTimeout(() => {
            errorDiv.style.display = 'none';
            errorDiv.classList.remove('success');
        }, 6000);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
