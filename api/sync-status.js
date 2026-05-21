import { getFileContent, getFileSha, getDeploymentStatus } from '../lib/github-api.js';

const DATA_PATH = 'data/games.json';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [sha, content, deployment] = await Promise.all([
      getFileSha(DATA_PATH).catch(() => null),
      getFileContent(DATA_PATH).catch(() => null),
      getDeploymentStatus().catch(() => ({ status: 'unknown', error: 'Could not fetch deployment status' }))
    ]);

    let lastUpdated = null;
    let version = '1.0';

    if (content) {
      try {
        const data = JSON.parse(content);
        lastUpdated = data.metadata?.last_updated || null;
        version = data.metadata?.version || '1.0';
      } catch (_) {
        // parsing error, use defaults
      }
    }

    res.json({
      success: true,
      version: sha || 'unknown',
      last_updated: lastUpdated,
      metadata_version: version,
      timestamp: new Date().toISOString(),
      deployment: {
        status: deployment.status || 'unknown',
        conclusion: deployment.conclusion || null,
        html_url: deployment.html_url || null,
        head_sha: deployment.head_sha || null,
        error: deployment.error || null
      }
    });
  } catch (error) {
    console.error('Failed to get sync status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
