import fs from 'fs';
import path from 'path';
import { getFileContent, createOrUpdateFile, getFileSha } from '../lib/github-api.js';
import { syncGamePagesToGithub, removeGamePagesFromGithub } from '../lib/site-sync-github.js';

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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      let data = null;
      let sha = null;

      try {
        const content = await getFileContent(DATA_PATH);
        if (content) {
          data = JSON.parse(content);
          sha = await getFileSha(DATA_PATH);
        }
      } catch (githubError) {
        console.warn('GitHub read failed, using local fallback:', githubError.message);
      }

      if (!data) {
        data = readLocalGames();
        if (data) {
          console.log('Serving games from bundled data/games.json');
        }
      }

      if (!data) {
        return res.json({
          games: [],
          metadata: { version: '1.0', last_updated: '' },
          _version: null,
          _timestamp: new Date().toISOString(),
        });
      }

      data = normalizeGamesData(data);
      data._version = sha;
      data._timestamp = new Date().toISOString();
      res.json(data);
    } catch (error) {
      console.error('Failed to read games data:', error);
      res.status(500).json({ error: 'Failed to read games data' });
    }
  } else if (req.method === 'PUT') {
    try {
      const gamesData = req.body;
      const clientVersion = req.headers['x-if-version'] || req.body._version;

      const currentVersion = await getFileSha(DATA_PATH);

      if (clientVersion && currentVersion && clientVersion !== currentVersion) {
        const currentContent = await getFileContent(DATA_PATH);
        const currentData = currentContent ? JSON.parse(currentContent) : null;

        return res.status(409).json({
          success: false,
          error: 'CONFLICT',
          message: 'The data was modified by another user. Please refresh and try again.',
          clientVersion: clientVersion,
          serverVersion: currentVersion,
          currentData: currentData,
        });
      }

      if (!gamesData.metadata) {
        gamesData.metadata = { version: '1.0', last_updated: '' };
      }
      gamesData.metadata.last_updated = new Date().toISOString();

      const { _version, _timestamp, ...dataToSave } = gamesData;
      const content = JSON.stringify(dataToSave, null, 2);

      const activeCount = (gamesData.games || []).filter((g) => g.active !== false).length;
      const message = `Update games data (${activeCount} active games)`;

      let previousSlugs = [];
      try {
        const prevContent = await getFileContent(DATA_PATH);
        if (prevContent) {
          const prev = JSON.parse(prevContent);
          previousSlugs = (prev.games || []).map((g) => g.slug).filter(Boolean);
        }
      } catch (e) {
        /* ignore */
      }

      const result = await createOrUpdateFile(DATA_PATH, content, message);

      const newSlugs = new Set((dataToSave.games || []).map((g) => g.slug).filter(Boolean));
      const deletedSlugs = previousSlugs.filter((s) => !newSlugs.has(s));

      let pageSync = { files: ['data/games.json'], removed: [] };
      try {
        pageSync = await syncGamePagesToGithub(dataToSave);
        if (deletedSlugs.length) {
          const removedPages = await removeGamePagesFromGithub(deletedSlugs);
          pageSync.removed = (pageSync.removed || []).concat(removedPages);
        }
      } catch (syncError) {
        console.error('Page sync failed (games.json saved):', syncError.message);
        pageSync.error = syncError.message;
      }

      res.json({
        success: true,
        synced: activeCount,
        files: pageSync.files || ['data/games.json'],
        removed: pageSync.removed || [],
        version: result.sha,
        message: 'Saved to GitHub — live site updated',
      });
    } catch (error) {
      console.error('Failed to save games data to GitHub:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
