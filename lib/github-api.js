/**
 * GitHub API Utility Module
 * Handles all GitHub repository operations via GitHub REST API
 * Includes retry logic with exponential backoff and structured error reporting.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = '1v1mebraskies-svg';
const REPO_NAME = 'CODELOOT';
const BRANCH = 'main';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry and exponential backoff.
 * Retries on 5xx, 429 (rate limit), and network errors.
 * Does NOT retry 4xx client errors (except 429).
 */
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) return response;

      // Don't retry client errors (except rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Rate limited — honour Retry-After header when present
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
        const delay = Math.max(retryAfter * 1000, BASE_DELAY_MS);
        console.warn(`[github-api] Rate limited (429). Retry-After ${retryAfter}s. Attempt ${attempt + 1}/${retries + 1}`);
        if (attempt < retries) {
          await sleep(delay);
          continue;
        }
        return response;
      }

      // Server error — retry with backoff
      console.warn(`[github-api] Server error ${response.status} on ${options.method || 'GET'} ${url}. Attempt ${attempt + 1}/${retries + 1}`);
      if (attempt < retries) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      console.error(`[github-api] Network error on attempt ${attempt + 1}/${retries + 1}: ${err.message}`);
      if (attempt < retries) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw new Error(`GitHub API request failed after ${retries + 1} attempts: ${lastError?.message || 'unknown error'}`);
}

async function getFileSha(path) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const body = await response.text();
    throw new Error(`Failed to get file SHA for "${path}": ${response.status} ${response.statusText} — ${body}`);
  }

  const data = await response.json();
  return data.sha;
}

async function getFileContent(path) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const body = await response.text();
    throw new Error(`Failed to get file content for "${path}": ${response.status} — ${body}`);
  }

  const data = await response.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return content;
}

/**
 * Create or update a file in the repository.
 * Automatically retries on SHA conflict (409/422) by re-fetching the SHA.
 */
async function createOrUpdateFile(path, content, message) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const sha = await getFileSha(path);

    const body = {
      message,
      content: contentBase64,
      branch: BRANCH
    };
    if (sha) body.sha = sha;

    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    }, 0); // no inner retry — we handle conflict retry here

    if (response.ok) {
      const data = await response.json();
      console.log(`[github-api] Updated "${path}" — commit ${data.commit.sha}`);
      return {
        success: true,
        path,
        sha: data.content.sha,
        commit: data.commit.sha
      };
    }

    const errorBody = await response.json().catch(() => ({}));

    // SHA conflict — re-fetch SHA and retry
    if (response.status === 409 || response.status === 422) {
      console.warn(`[github-api] SHA conflict on "${path}" (${response.status}). Re-fetching SHA. Attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
    }

    throw new Error(
      `GitHub push failed for "${path}": ${response.status} ${response.statusText} — ${errorBody.message || JSON.stringify(errorBody)}`
    );
  }
}

async function deleteFile(path, message) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

  const sha = await getFileSha(path);
  if (!sha) {
    throw new Error(`File not found on GitHub: ${path}`);
  }

  const body = {
    message,
    sha,
    branch: BRANCH
  };

  const response = await fetchWithRetry(url, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(`Failed to delete "${path}": ${response.status} — ${errorBody.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    success: true,
    path,
    commit: data.commit?.sha
  };
}

async function getRepoInfo() {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to get repo info: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Create a commit with multiple file changes (sequential pushes).
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
    message
  };
}

async function uploadImage(slug, imageBuffer, filename, mimetype) {
  const path = `assets/img/${filename}`;
  const contentBase64 = imageBuffer.toString('base64');
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const sha = await getFileSha(path);

    const body = {
      message: `Upload image: ${filename} for ${slug}`,
      content: contentBase64,
      branch: BRANCH
    };
    if (sha) body.sha = sha;

    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    }, 0);

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        path,
        url: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${path}`,
        downloadUrl: data.content.download_url,
        sha: data.content.sha
      };
    }

    const errorBody = await response.json().catch(() => ({}));

    if ((response.status === 409 || response.status === 422) && attempt < MAX_RETRIES) {
      console.warn(`[github-api] SHA conflict uploading image "${path}". Retrying...`);
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
      continue;
    }

    throw new Error(`Failed to upload image "${filename}": ${response.status} — ${errorBody.message || response.statusText}`);
  }
}

/**
 * Verify a file was actually written to GitHub by re-reading it.
 */
async function verifyFileContent(path, expectedSha) {
  const sha = await getFileSha(path);
  return sha === expectedSha;
}

/**
 * Get the latest Vercel deployment status via GitHub deployments API.
 */
async function getLatestDeploymentStatus() {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/deployments?per_page=1`;

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) return null;

    const deployments = await response.json();
    if (!deployments.length) return null;

    const deployment = deployments[0];
    const statusUrl = deployment.statuses_url;
    const statusRes = await fetchWithRetry(statusUrl, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!statusRes.ok) return null;

    const statuses = await statusRes.json();
    const latest = statuses[0];

    return {
      id: deployment.id,
      sha: deployment.sha,
      environment: deployment.environment,
      state: latest?.state || 'unknown',
      description: latest?.description || '',
      created_at: deployment.created_at,
      target_url: latest?.target_url || null
    };
  } catch (e) {
    console.warn('[github-api] Could not fetch deployment status:', e.message);
    return null;
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
  verifyFileContent,
  getLatestDeploymentStatus
};
