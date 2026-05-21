const { getFileContent, getFileSha } = require('../lib/github-api.js');

const DATA_PATH = 'data/games.json';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sha = await getFileSha(DATA_PATH);
    const content = await getFileContent(DATA_PATH);
    let lastUpdated = null;
    let version = '1.0';

    if (content) {
      try {
        const data = JSON.parse(content);
        lastUpdated = data.metadata?.last_updated || null;
        version = data.metadata?.version || '1.0';
      } catch (e) {
        /* ignore */
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      version: sha || 'unknown',
      last_updated: lastUpdated,
      metadata_version: version,
      timestamp: new Date().toISOString(),
      source: 'github',
    });
  } catch (error) {
    console.error('Failed to get sync status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
