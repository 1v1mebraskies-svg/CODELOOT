/**
 * GitHub API Utility Module
 * Handles all GitHub repository operations via GitHub REST API
 * Includes retry logic with exponential backoff and deployment status tracking
 */

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = '1v1mebraskies-svg';
const REPO_NAME = 'CODELOOT';
const BRANCH = 'main';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Get GitHub API headers with authentication
 */
function getHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set. Add it in your Vercel project settings.');
  }

  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'CodeLoot-Admin'
  };
}

/**
 * Fetch with retry logic and exponential backoff.
 * Retries on 5xx, 429 (rate limit), and network errors.
 */
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok || response.status < 500) {
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
          if (attempt < retries) {
            await sleep(retryAfter * 1000);
            continue;
          }
        }
        return response;
      }

      const errorBody = await response.text().catch(() => '');
      lastError = new Error(
        `GitHub API ${response.status} ${response.statusText}: ${errorBody.slice(0, 200)}`
      );

      if (attempt < retries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    } catch (networkError) {
      lastError = new Error(`Network error calling GitHub API: ${networkError.message}`);
      if (attempt < retries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new Error('GitHub API request failed after retries');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the SHA of a file in the repository
 */
async function getFileSha(path) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to get file SHA for ${path}: ${response.status} ${response.statusText} — ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.sha;
}

/**
 * Get file content from GitHub
 */
async function getFileContent(path) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to get file content for ${path}: ${response.status} ${response.statusText} — ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return content;
}

/**
 * Create or update a file in the repository.
 * Returns detailed result including commit SHA for verification.
 */
async function createOrUpdateFile(path, content, message) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

  const sha = await getFileSha(path);
  const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

  const body = {
    message: message,
    content: contentBase64,
    branch: BRANCH
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetchWithRetry(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let parsed;
    try { parsed = JSON.parse(errorBody); } catch (_) { parsed = null; }
    const detail = parsed?.message || errorBody.slice(0, 300);
    throw new Error(`GitHub push failed for ${path}: ${response.status} ${response.statusText} — ${detail}`);
  }

  const data = await response.json();
  return {
    success: true,
    path: path,
    sha: data.content.sha,
    commit: data.commit.sha
  };
}

/**
 * Delete a file from the repository
 */
async function deleteFile(path, message) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

  const sha = await getFileSha(path);
  if (!sha) {
    throw new Error(`File not found: ${path}`);
  }

  const body = {
    message: message,
    sha: sha,
    branch: BRANCH
  };

  const response = await fetchWithRetry(url, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let parsed;
    try { parsed = JSON.parse(errorBody); } catch (_) { parsed = null; }
    const detail = parsed?.message || errorBody.slice(0, 300);
    throw new Error(`Failed to delete ${path}: ${response.status} ${response.statusText} — ${detail}`);
  }

  const respData = await response.json();
  return {
    success: true,
    path: path,
    commit: respData.commit?.sha
  };
}

/**
 * Get repository information
 */
async function getRepoInfo() {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to get repo info: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Create a commit with multiple file changes (sequential).
 */
async function createCommit(files, message) {
  const results = [];

  for (const file of files) {
    const result = await createOrUpdateFile(file.path, file.content, message);
    results.push(result);
  }

  return {
    success: true,
    files: results,
    message: message
  };
}

/**
 * Upload an image to GitHub repository
 */
async function uploadImage(slug, imageBuffer, filename, mimetype) {
  const path = `assets/img/${filename}`;
  const contentBase64 = imageBuffer.toString('base64');

  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const sha = await getFileSha(path);

  const body = {
    message: `Upload image: ${filename} for ${slug}`,
    content: contentBase64,
    branch: BRANCH
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetchWithRetry(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let parsed;
    try { parsed = JSON.parse(errorBody); } catch (_) { parsed = null; }
    const detail = parsed?.message || errorBody.slice(0, 300);
    throw new Error(`Failed to upload image ${filename}: ${response.status} ${response.statusText} — ${detail}`);
  }

  const data = await response.json();

  return {
    success: true,
    path: path,
    url: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${path}`,
    downloadUrl: data.content.download_url,
    sha: data.content.sha
  };
}

/**
 * Verify a commit exists on the remote branch (confirms push succeeded).
 */
async function verifyCommit(commitSha) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/commits/${commitSha}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    return { verified: false, error: `Commit ${commitSha} not found: ${response.status}` };
  }

  const data = await response.json();
  return {
    verified: true,
    sha: data.sha,
    message: data.commit?.message,
    date: data.commit?.author?.date
  };
}

/**
 * Get the latest GitHub Pages deployment status.
 * Returns the most recent deployment run for the Pages workflow.
 */
async function getDeploymentStatus() {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs?branch=${BRANCH}&per_page=1`;

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: getHeaders()
    }, 1);

    if (!response.ok) {
      return { status: 'unknown', error: `Could not fetch deployment status: ${response.status}` };
    }

    const data = await response.json();
    const runs = data.workflow_runs || [];

    if (runs.length === 0) {
      return { status: 'unknown', error: 'No deployment runs found' };
    }

    const latest = runs[0];
    return {
      status: latest.status,
      conclusion: latest.conclusion,
      run_id: latest.id,
      created_at: latest.created_at,
      updated_at: latest.updated_at,
      html_url: latest.html_url,
      head_sha: latest.head_sha
    };
  } catch (err) {
    return { status: 'unknown', error: err.message };
  }
}

module.exports = {
  getFileContent,
  createOrUpdateFile,
  deleteFile,
  getRepoInfo,
  createCommit,
  uploadImage,
  getFileSha,
  verifyCommit,
  getDeploymentStatus,
  REPO_OWNER,
  REPO_NAME,
  BRANCH
};
