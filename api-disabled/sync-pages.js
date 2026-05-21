import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'games.json');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      res.json({ 
        success: true, 
        synced: (data.games || []).length,
        note: 'Auto-sync disabled on Vercel - manual sync required'
      });
    } else {
      res.json({ success: true, synced: 0 });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
