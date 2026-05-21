import { getFileContent, getFileSha, getLatestDeploymentStatus } from '../lib/github-api.js';

const DATA_PATH = 'data/games.json';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const errors = [];

  try {
    // GitHub file status
    let sha = null;
    let lastUpdated = null;
    let version = '1.0';
    let gameCount = 0;

    try {
      sha = await getFileSha(DATA_PATH);
      const content = await getFileContent(DATA_PATH);
      if (content) {
        const data = JSON.parse(content);
        lastUpdated = data.metadata?.last_updated || null;
        version = data.metadata?.version || '1.0';
        gameCount = (data.games || []).length;
      }
    } catch (e) {
      errors.push({ component: 'github', error: e.message });
    }

    // Deployment status
    let deployment = null;
    try {
      deployment = await getLatestDeploymentStatus();
    } catch (e) {
      errors.push({ component: 'deployment', error: e.message });
    }

    res.json({
      success: errors.length === 0,
      github: {
        version: sha || 'unknown',
        last_updated: lastUpdated,
        metadata_version: version,
        game_count: gameCount,
        connected: !!sha
      },
      deployment: deployment ? {
        state: deployment.state,
        sha: deployment.sha,
        environment: deployment.environment,
        url: deployment.target_url,
        created_at: deployment.created_at,
        in_sync: deployment.sha && sha ? deployment.sha.startsWith(sha.substring(0, 7)) : null
      } : null,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[api/sync-status] Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      errors: [...errors, { component: 'api', error: error.message }]
    });
  }
}
