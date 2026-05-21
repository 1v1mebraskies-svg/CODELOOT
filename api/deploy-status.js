const { getFileSha } = require('../lib/github-api.js');
const {
  getDeploymentContext,
  getLatestGithubCommit,
  logDeploymentEvent,
} = require('../lib/deploy-log.js');

const DATA_PATH = 'data/games.json';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ctx = getDeploymentContext();
    let gamesSha = null;
    let gamesShaError = null;

    try {
      gamesSha = await getFileSha(DATA_PATH);
    } catch (e) {
      gamesShaError = e.message;
    }

    const github = await getLatestGithubCommit();
    const status = {
      success: true,
      live_data_source: 'GitHub API via /api/games',
      static_fallback: '/data/games.json (redeploy to refresh)',
      games_json_sha: gamesSha,
      games_json_sha_error: gamesShaError,
      deployment_context: ctx,
      github,
      checks: {
        github_token: ctx.github_token_set,
        correct_branch: ctx.vercel_git_branch === 'main' || !ctx.vercel_git_branch,
        api_should_work: ctx.github_token_set,
      },
      timestamp: new Date().toISOString(),
    };

    logDeploymentEvent('deploy-status', status);
    res.setHeader('Cache-Control', 'no-store');
    res.json(status);
  } catch (error) {
    console.error('[deploy-status]', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
