const { getDeploymentContext, getLatestGithubCommit } = require('../lib/deploy-log.js');

module.exports = async function handler(req, res) {
  const ctx = getDeploymentContext();
  let github = { ok: false };
  try {
    const latest = await getLatestGithubCommit();
    github = latest.error
      ? { ok: false, error: latest.error }
      : { ok: true, latest_commit: latest };
  } catch (e) {
    github = { ok: false, error: e.message };
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    cms: true,
    backend: 'GitHub API (Shared Data Source)',
    repo: '1v1mebraskies-svg/CODELOOT',
    branch: 'main',
    writes: ['data/games.json'],
    deployment: 'Vercel serverless + GitHub Contents API',
    autosync: true,
    api_runtime: 'nodejs',
    production: ctx.vercel_env === 'production',
    deployment_context: ctx,
    github,
  });
};
