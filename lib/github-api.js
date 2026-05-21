/**
 * GitHub API Utility Module
 * Handles all GitHub repository operations via GitHub REST API
 */

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = '1v1mebraskies-svg';
const REPO_NAME = 'CODELOOT';
const BRANCH = 'main';

/**
 * Get GitHub API headers with authentication
 */
function getHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }
  
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'CodeLoot-Admin'
  };
}

/**
 * Get the SHA of a file in the repository
 */
async function getFileSha(path) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // File doesn't exist
    }
    throw new Error(`Failed to get file SHA: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.sha;
}

/**
 * Get file content from GitHub
 */
async function getFileContent(path) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // File doesn't exist
    }
    throw new Error(`Failed to get file content: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Decode base64 content
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return content;
}

/**
 * Create or update a file in the repository
 */
async function createOrUpdateFile(path, content, message) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  
  // Get current SHA if file exists
  const sha = await getFileSha(path);
  
  // Encode content to base64
  const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');
  
  const body = {
    message: message,
    content: contentBase64,
    branch: BRANCH
  };
  
  if (sha) {
    body.sha = sha;
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create/update file: ${error.message || response.statusText}`);
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
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to delete file: ${error.message || response.statusText}`);
  }
  
  return {
    success: true,
    path: path,
    commit: response.commit?.sha
  };
}

/**
 * Get repository information
 */
async function getRepoInfo() {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get repo info: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Create a commit with multiple file changes
 */
async function createCommit(files, message) {
  // For simplicity, we'll update files one by one
  // GitHub API doesn't support batch updates in a single call easily
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
  
  // Convert buffer to base64
  const contentBase64 = imageBuffer.toString('base64');
  
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  
  // Get current SHA if file exists
  const sha = await getFileSha(path);
  
  const body = {
    message: `Upload image: ${filename} for ${slug}`,
    content: contentBase64,
    branch: BRANCH
  };
  
  if (sha) {
    body.sha = sha;
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to upload image: ${error.message || response.statusText}`);
  }
  
  const data = await response.json();
  
  // Return the raw GitHub URL
  return {
    success: true,
    path: path,
    url: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${path}`,
    downloadUrl: data.content.download_url,
    sha: data.content.sha
  };
}

module.exports = {
  getFileContent,
  createOrUpdateFile,
  deleteFile,
  getRepoInfo,
  createCommit,
  uploadImage,
  getFileSha
};
