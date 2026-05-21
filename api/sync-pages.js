const fs = require('fs');
const path = require('path');
const { getFileContent } = require('../lib/github-api.js');
const { syncGamePagesToGithub } = require('../lib/site-sync-github.js');

const DATA_PATH = 'data/games.json';
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'games.json');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let data = null;
    try {
      const content = await getFileContent(DATA_PATH);
      if (content) data = JSON.parse(content);
    } catch (e) {
      console.warn('GitHub read failed for sync-pages:', e.message);
    }

    if (!data && fs.existsSync(LOCAL_DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf8'));
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'No games data found' });
    }

    const pageSync = await syncGamePagesToGithub(data);
    res.json({
      success: true,
      synced: (data.games || []).filter((g) => g.active !== false).length,
      files: pageSync.files,
      removed: pageSync.removed || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
