import {
  getFileContent,
  createOrUpdateFile,
  getFileSha,
  verifyCommit,
  getDeploymentStatus
} from '../lib/github-api.js';

const DATA_PATH = 'data/games.json';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const content = await getFileContent(DATA_PATH);

      if (content) {
        const data = JSON.parse(content);
        const sha = await getFileSha(DATA_PATH);
        data._version = sha;
        data._timestamp = new Date().toISOString();
        res.json(data);
      } else {
        res.json({
          games: [],
          metadata: { version: '1.0', last_updated: '' },
          _version: null,
          _timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to read games data from GitHub:', error);
      res.status(500).json({
        error: 'Failed to read games data',
        detail: error.message
      });
    }
  } else if (req.method === 'PUT') {
    const steps = {
      github_push: { status: 'pending', error: null, sha: null, commit: null },
      commit_verified: { status: 'pending', error: null },
      deployment: { status: 'pending', error: null, url: null }
    };

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
          steps: steps
        });
      }

      if (!gamesData.metadata) {
        gamesData.metadata = { version: '1.0', last_updated: '' };
      }
      gamesData.metadata.last_updated = new Date().toISOString();

      const { _version, _timestamp, ...dataToSave } = gamesData;
      const content = JSON.stringify(dataToSave, null, 2);

      const activeCount = (gamesData.games || []).filter(g => g.active !== false).length;
      const message = `Update games data (${activeCount} active games)`;

      // Step 1: Push to GitHub
      steps.github_push.status = 'in_progress';
      const result = await createOrUpdateFile(DATA_PATH, content, message);
      steps.github_push.status = 'success';
      steps.github_push.sha = result.sha;
      steps.github_push.commit = result.commit;

      // Step 2: Verify commit exists on remote
      steps.commit_verified.status = 'in_progress';
      const verification = await verifyCommit(result.commit);
      if (verification.verified) {
        steps.commit_verified.status = 'success';
      } else {
        steps.commit_verified.status = 'warning';
        steps.commit_verified.error = verification.error;
      }

      // Step 3: Check deployment status
      steps.deployment.status = 'in_progress';
      const deploy = await getDeploymentStatus();
      steps.deployment.status = deploy.status === 'completed' ? 'success' : deploy.status || 'queued';
      steps.deployment.conclusion = deploy.conclusion;
      steps.deployment.url = deploy.html_url;
      if (deploy.error) {
        steps.deployment.error = deploy.error;
      }

      res.json({
        success: true,
        synced: activeCount,
        files: ['data/games.json'],
        version: result.sha,
        commit: result.commit,
        steps: steps,
        message: 'Pushed to GitHub successfully'
      });
    } catch (error) {
      console.error('Failed to save games data to GitHub:', error);

      if (steps.github_push.status === 'in_progress') {
        steps.github_push.status = 'failed';
        steps.github_push.error = error.message;
      }

      res.status(500).json({
        success: false,
        error: error.message,
        steps: steps
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
