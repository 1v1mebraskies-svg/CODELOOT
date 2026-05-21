/**
 * Production deployment logging and optional Vercel redeploy hook.
 */
const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = '1v1mebraskies-svg';
const REPO_NAME = 'CODELOOT';
const BRANCH = 'main';

function getDeploymentContext() {
  return {
    vercel_env: process.env.VERCEL_ENV || null,
    vercel_url: process.env.VERCEL_URL || null,
    vercel_git_branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    vercel_git_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    vercel_git_repo: process.env.VERCEL_GIT_REPO_SLUG || null,
    node_env: process.env.NODE_ENV || null,
    github_token_set: !!process.env.GITHUB_TOKEN,
    deploy_hook_set: !!process.env.VERCEL_DEPLOY_HOOK_URL,
    timestamp: new Date().toISOString(),
  };
}

async function getLatestGithubCommit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { error: 'GITHUB_TOKEN not set' };
  }

  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/commits?sha=${BRANCH}&per_page=1`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CodeLoot-Admin',
    },
  });

  if (!response.ok) {
    return { error: `GitHub commits API: ${response.status} ${response.statusText}` };
  }

  const commits = await response.json();
  const latest = commits[0];
  if (!latest) {
    return { error: 'No commits on branch ' + BRANCH };
  }

  return {
    sha: latest.sha,
    message: latest.commit?.message,
    author: latest.commit?.author?.name,
    date: latest.commit?.author?.date,
    html_url: latest.html_url,
    branch: BRANCH,
    repo: `${REPO_OWNER}/${REPO_NAME}`,
  };
}

async function triggerVercelDeployHook(source) {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return { triggered: false, reason: 'VERCEL_DEPLOY_HOOK_URL not configured' };
  }

  try {
    const response = await fetch(hookUrl, { method: 'POST' });
    const body = await response.text().catch(() => '');
    return {
      triggered: response.ok,
      status: response.status,
      source: source || 'autosave',
      body: body.slice(0, 200),
    };
  } catch (error) {
    console.error('[deploy-log] Deploy hook failed:', error.message);
    return { triggered: false, error: error.message };
  }
}

function logDeploymentEvent(event, details) {
  const payload = {
    event,
    ...getDeploymentContext(),
    ...(details || {}),
  };
  console.log('[codeloot-deploy]', JSON.stringify(payload));
  return payload;
}

module.exports = {
  getDeploymentContext,
  getLatestGithubCommit,
  triggerVercelDeployHook,
  logDeploymentEvent,
};
