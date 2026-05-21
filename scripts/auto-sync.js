#!/usr/bin/env node

/**
 * Safe Auto-Sync Watcher for GitHub Pages
 * 
 * Features:
 * - Debounce protection (waits 5 seconds after last change)
 * - Only commits when changes exist
 * - Only pushes when commits exist
 * - No infinite loops
 * - Safe git handling
 * - Mac compatible
 */

const { execSync } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');

// Configuration
const DEBOUNCE_MS = 5000; // Wait 5 seconds after last change
const COMMIT_MESSAGE = 'Auto-sync: Update website content';
const WATCH_PATH = path.resolve(__dirname, '..');
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.DS_Store',
  '**/*.swp',
  '**/*.swo',
  '**/.*',
  '**/auto-sync.log'
];

let debounceTimer = null;
let isProcessing = false;
let lastCommitHash = '';

/**
 * Execute git command and return output
 */
function gitExec(command) {
  try {
    return execSync(command, { 
      cwd: WATCH_PATH,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
  } catch (error) {
    console.error(`Git command failed: ${command}`);
    console.error(error.message);
    return null;
  }
}

/**
 * Check if there are uncommitted changes
 */
function hasChanges() {
  const status = gitExec('git status --porcelain');
  return status && status.length > 0;
}

/**
 * Check if there are commits to push
 */
function hasCommitsToPush() {
  const localHash = gitExec('git rev-parse HEAD');
  const remoteHash = gitExec('git rev-parse origin/main');
  
  if (!localHash || !remoteHash) return false;
  
  return localHash !== remoteHash;
}

/**
 * Stage all changes
 */
function stageChanges() {
  console.log('📝 Staging changes...');
  gitExec('git add -A');
}

/**
 * Commit changes
 */
function commitChanges() {
  console.log('💾 Committing changes...');
  const result = gitExec(`git commit -m "${COMMIT_MESSAGE}"`);
  
  if (result) {
    console.log('✅ Commit successful');
    lastCommitHash = gitExec('git rev-parse HEAD');
    return true;
  }
  
  console.log('ℹ️  Nothing to commit');
  return false;
}

/**
 * Push changes to GitHub
 */
function pushChanges() {
  console.log('🚀 Pushing to GitHub...');
  
  try {
    gitExec('git push origin main');
    console.log('✅ Push successful - GitHub Pages will deploy shortly');
    return true;
  } catch (error) {
    console.error('❌ Push failed:', error.message);
    return false;
  }
}

/**
 * Main sync function with debounce protection
 */
async function syncToGitHub() {
  if (isProcessing) {
    console.log('⏳ Sync already in progress, skipping...');
    return;
  }

  isProcessing = true;
  console.log('\n🔄 Starting sync process...');
  console.log(`📅 ${new Date().toLocaleString()}`);

  try {
    // Check if there are changes
    if (!hasChanges()) {
      console.log('ℹ️  No changes detected');
      isProcessing = false;
      return;
    }

    // Stage and commit
    stageChanges();
    const committed = commitChanges();

    if (committed) {
      // Push if commit was successful
      await pushChanges();
    }
  } catch (error) {
    console.error('❌ Sync error:', error.message);
  } finally {
    isProcessing = false;
    console.log('✨ Sync process complete\n');
  }
}

/**
 * Debounced sync function
 */
function debouncedSync() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  console.log('⏱️  Change detected, waiting for more changes...');
  
  debounceTimer = setTimeout(() => {
    console.log('⏰ Debounce timer elapsed, starting sync...');
    syncToGitHub();
  }, DEBOUNCE_MS);
}

/**
 * Initialize watcher
 */
function initWatcher() {
  console.log('👀 Starting auto-sync watcher...');
  console.log(`📁 Watching: ${WATCH_PATH}`);
  console.log(`⏱️  Debounce delay: ${DEBOUNCE_MS}ms`);
  console.log('Press Ctrl+C to stop\n');

  const watcher = chokidar.watch(WATCH_PATH, {
    ignored: IGNORE_PATTERNS,
    persistent: true,
    ignoreInitial: true
  });

  watcher
    .on('change', debouncedSync)
    .on('add', debouncedSync)
    .on('unlink', debouncedSync)
    .on('error', (error) => {
      console.error('❌ Watcher error:', error);
    });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping watcher...');
    watcher.close();
    process.exit(0);
  });

  // Get initial commit state
  lastCommitHash = gitExec('git rev-parse HEAD') || '';
}

// Start the watcher
initWatcher();
