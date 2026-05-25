const fs = require('fs');
const path = require('path');

const DATA_PATH = 'data/games.json';
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'games.json');

function readLocalGames() {
  if (!fs.existsSync(LOCAL_DATA_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf8'));
}

function normalizeGamesData(data) {
  if (!data || !Array.isArray(data.games)) {
    return { games: [], metadata: { version: '1.0', last_updated: '' } };
  }
  if (!data.metadata) {
    data.metadata = { version: '1.0', last_updated: '' };
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      let data = readLocalGames();
      
      if (!data) {
        return res.json({
          games: [],
          metadata: { version: '1.0', last_updated: '' },
          _timestamp: new Date().toISOString(),
          _source: 'local',
        });
      }

      data = normalizeGamesData(data);
      data._timestamp = new Date().toISOString();
      data._source = 'local';
      res.json(data);
    } catch (error) {
      console.error('Failed to read games data:', error);
      res.status(500).json({ error: 'Failed to read games data' });
    }
  } else if (req.method === 'PUT') {
    try {
      const gamesData = req.body;

      if (!gamesData.metadata) {
        gamesData.metadata = { version: '1.0', last_updated: '' };
      }
      gamesData.metadata.last_updated = new Date().toISOString();

      const { _version, _timestamp, _source, ...dataToSave } = gamesData;
      const content = JSON.stringify(dataToSave, null, 2);

      // Safely write to local file
      fs.writeFileSync(LOCAL_DATA_FILE, content, 'utf8');

      const activeCount = (gamesData.games || []).filter((g) => g.active !== false).length;

      res.json({
        success: true,
        synced: activeCount,
        files: ['data/games.json'],
        removed: [],
        message: 'Saved to data/games.json',
      });
    } catch (error) {
      console.error('Failed to save games data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
