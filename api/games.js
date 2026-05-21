import { getFileContent, createOrUpdateFile, getFileSha, verifyFileContent, getLatestDeploymentStatus } from '../lib/github-api.js';

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
      console.error('[api/games GET] Failed:', error);
      const detail = classifyError(error);
      res.status(500).json({
        error: 'Failed to read games data',
        detail: detail.message,
        phase: 'github_read',
        reason: detail.reason
      });
    }
  } else if (req.method === 'PUT') {
    const startTime = Date.now();
    const phases = [];

    try {
      const gamesData = req.body;
      const clientVersion = req.headers['x-if-version'] || req.body._version;

      // Phase 1: Check for conflicts
      phases.push({ phase: 'conflict_check', status: 'started', ts: Date.now() });
      const currentVersion = await getFileSha(DATA_PATH);

      if (clientVersion && currentVersion && clientVersion !== currentVersion) {
        const currentContent = await getFileContent(DATA_PATH);
        const currentData = currentContent ? JSON.parse(currentContent) : null;

        phases.push({ phase: 'conflict_check', status: 'conflict', ts: Date.now() });
        return res.status(409).json({
          success: false,
          error: 'CONFLICT',
          message: 'The data was modified by another user or session. Please refresh and try again.',
          clientVersion,
          serverVersion: currentVersion,
          currentData,
          phases
        });
      }
      phases.push({ phase: 'conflict_check', status: 'passed', ts: Date.now() });

      // Phase 2: Push to GitHub
      phases.push({ phase: 'github_push', status: 'started', ts: Date.now() });

      if (!gamesData.metadata) {
        gamesData.metadata = { version: '1.0', last_updated: '' };
      }
      gamesData.metadata.last_updated = new Date().toISOString();

      const { _version, _timestamp, ...dataToSave } = gamesData;
      const content = JSON.stringify(dataToSave, null, 2);

      const activeCount = (gamesData.games || []).filter(g => g.active !== false).length;
      const message = `Update games data (${activeCount} active games)`;

      const result = await createOrUpdateFile(DATA_PATH, content, message);
      phases.push({ phase: 'github_push', status: 'success', sha: result.sha, commit: result.commit, ts: Date.now() });

      // Phase 3: Verify the push landed
      phases.push({ phase: 'verify_push', status: 'started', ts: Date.now() });
      const verified = await verifyFileContent(DATA_PATH, result.sha);
      if (!verified) {
        console.warn('[api/games PUT] Push verification failed — SHA mismatch after push');
        phases.push({ phase: 'verify_push', status: 'warning', message: 'SHA mismatch after push', ts: Date.now() });
      } else {
        phases.push({ phase: 'verify_push', status: 'verified', ts: Date.now() });
      }

      // Phase 4: Check deployment status (non-blocking)
      let deployment = null;
      try {
        deployment = await getLatestDeploymentStatus();
        phases.push({ phase: 'deployment_check', status: deployment ? deployment.state : 'unknown', ts: Date.now() });
      } catch (e) {
        phases.push({ phase: 'deployment_check', status: 'skipped', message: e.message, ts: Date.now() });
      }

      const elapsed = Date.now() - startTime;
      res.json({
        success: true,
        synced: activeCount,
        files: ['data/games.json'],
        version: result.sha,
        commit: result.commit,
        verified,
        deployment: deployment ? { state: deployment.state, url: deployment.target_url } : null,
        elapsed_ms: elapsed,
        phases,
        message: verified
          ? 'Saved and verified on GitHub. Live site will update within seconds.'
          : 'Saved to GitHub (verification pending). Live site should update shortly.'
      });
    } catch (error) {
      console.error('[api/games PUT] Failed:', error);
      const detail = classifyError(error);
      const elapsed = Date.now() - startTime;
      phases.push({ phase: detail.phase, status: 'failed', message: error.message, ts: Date.now() });

      res.status(detail.httpStatus).json({
        success: false,
        error: error.message,
        phase: detail.phase,
        reason: detail.reason,
        phases,
        elapsed_ms: elapsed,
        retryable: detail.retryable
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Classify an error to provide actionable feedback to the admin UI.
 */
function classifyError(error) {
  const msg = error.message || '';

  if (msg.includes('GITHUB_TOKEN')) {
    return {
      phase: 'auth',
      reason: 'missing_token',
      message: 'GitHub token is not configured. Add GITHUB_TOKEN to Vercel environment variables.',
      httpStatus: 500,
      retryable: false
    };
  }

  if (msg.includes('401') || msg.includes('Bad credentials')) {
    return {
      phase: 'auth',
      reason: 'bad_credentials',
      message: 'GitHub token is invalid or expired. Generate a new token at github.com/settings/tokens.',
      httpStatus: 401,
      retryable: false
    };
  }

  if (msg.includes('403') || msg.includes('rate limit')) {
    return {
      phase: 'github_push',
      reason: 'rate_limited',
      message: 'GitHub API rate limit exceeded. Wait a minute and try again.',
      httpStatus: 429,
      retryable: true
    };
  }

  if (msg.includes('409') || msg.includes('SHA conflict') || msg.includes('422')) {
    return {
      phase: 'github_push',
      reason: 'sha_conflict',
      message: 'File was modified by another process. The save was retried automatically but still failed. Refresh and try again.',
      httpStatus: 409,
      retryable: true
    };
  }

  if (msg.includes('Network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
    return {
      phase: 'github_push',
      reason: 'network_error',
      message: 'Could not reach GitHub API. Check your internet connection and try again.',
      httpStatus: 502,
      retryable: true
    };
  }

  return {
    phase: 'github_push',
    reason: 'unknown',
    message: msg,
    httpStatus: 500,
    retryable: true
  };
}
