import { getFileContent } from '../lib/github-api.js';

const DATA_PATH = 'data/games.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const content = await getFileContent(DATA_PATH);
    if (!content) {
      return res.json({ success: true, synced: 0, message: 'No games data found on GitHub' });
    }

    const data = JSON.parse(content);
    const gameCount = (data.games || []).length;
    const activeCount = (data.games || []).filter(g => g.active !== false).length;

    res.json({
      success: true,
      synced: gameCount,
      active: activeCount,
      message: 'Games data verified on GitHub. Live site reads from /api/games at runtime.'
    });
  } catch (error) {
    console.error('[api/sync-pages] Failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
