import { getFileContent, createOrUpdateFile } from '../lib/github-api.js';

const DATA_PATH = 'data/games.json';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const content = await getFileContent(DATA_PATH);
      
      if (content) {
        res.json(JSON.parse(content));
      } else {
        res.json({ games: [], metadata: { version: '1.0', last_updated: '' } });
      }
    } catch (error) {
      console.error('Failed to read games data from GitHub:', error);
      res.status(500).json({ error: 'Failed to read games data' });
    }
  } else if (req.method === 'PUT') {
    try {
      const gamesData = req.body;
      
      // Update metadata
      if (!gamesData.metadata) {
        gamesData.metadata = { version: '1.0', last_updated: '' };
      }
      gamesData.metadata.last_updated = new Date().toISOString();
      
      // Convert to JSON string
      const content = JSON.stringify(gamesData, null, 2);
      
      // Create commit message
      const activeCount = (gamesData.games || []).filter(g => g.active !== false).length;
      const message = `Update games data (${activeCount} active games)`;
      
      // Update file in GitHub
      await createOrUpdateFile(DATA_PATH, content, message);
      
      // GitHub Pages will automatically redeploy
      res.json({
        success: true,
        synced: activeCount,
        files: ['data/games.json'],
        message: 'Committed to GitHub - GitHub Pages will deploy automatically'
      });
    } catch (error) {
      console.error('Failed to save games data to GitHub:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
