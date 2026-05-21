# Auto-Sync Workflow for GitHub Pages

A safe, production-ready auto-sync system that automatically commits and pushes your local changes to GitHub when you save files.

## Features

- **Debounce Protection**: Waits 5 seconds after your last file save before syncing (prevents spam commits)
- **Smart Git Handling**: Only commits when changes exist, only pushes when commits exist
- **No Infinite Loops**: Built-in protection against recursive triggers
- **Mac Compatible**: Works perfectly on macOS
- **Easy Control**: Simple start/stop commands
- **Safe Operations**: Validates git state before every operation

## File Locations

```
/Users/jeff/Desktop/CODELOOT/
├── scripts/
│   └── auto-sync.js          # Main watcher script (created)
├── package.json              # Updated with dependencies and scripts
└── AUTO_SYNC_SETUP.md        # This documentation file
```

## Setup Instructions

### Step 1: Install Dependencies

Open your terminal in the project directory and run:

```bash
cd /Users/jeff/Desktop/CODELOOT
npm install
```

This will install `chokidar` (the file watcher library).

### Step 2: Verify Git Configuration

Make sure your git is properly configured:

```bash
git config user.name
git config user.email
```

If not configured, set them:

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### Step 3: Ensure You're on Main Branch

```bash
git branch
```

If not on `main`, switch to it:

```bash
git checkout main
```

### Step 4: Pull Latest Changes

```bash
git pull origin main
```

## Usage

### Start Auto-Sync Watcher

```bash
npm run sync:start
```

You'll see output like:

```
👀 Starting auto-sync watcher...
📁 Watching: /Users/jeff/Desktop/CODELOOT
⏱️  Debounce delay: 5000ms
Press Ctrl+C to stop
```

### Stop Auto-Sync Watcher

Press `Ctrl+C` in the terminal where it's running, OR run:

```bash
npm run sync:stop
```

## How It Works

1. **File Save**: When you save a file in Windsurf, the watcher detects the change
2. **Debounce Timer**: It waits 5 seconds to see if you make more changes
3. **Sync Process**: After 5 seconds of no changes, it:
   - Checks if there are uncommitted changes
   - Stages all changes (`git add -A`)
   - Commits with message: "Auto-sync: Update website content"
   - Pushes to GitHub (`git push origin main`)
4. **GitHub Pages**: Automatically deploys your changes

## Safety Features

### Debounce Protection
- Waits 5 seconds after last change before syncing
- Prevents spam commits during rapid editing
- Timer resets on every new change

### Smart Git Handling
- Only runs `git commit` if changes exist
- Only runs `git push` if commits exist
- Checks git status before every operation

### No Infinite Loops
- Ignores `.git/` directory (won't detect its own commits)
- Ignores `node_modules/` and other common patterns
- Built-in processing lock prevents concurrent syncs

### Error Handling
- Gracefully handles git failures
- Continues watching even if one sync fails
- Clear error messages in terminal

## What Gets Watched

The watcher monitors your entire project directory except:
- `node_modules/`
- `.git/`
- `.DS_Store` files
- Vim swap files (`.swp`, `.swo`)
- Hidden files/directories starting with `.`

## Typical Workflow

1. **Start the watcher**: `npm run sync:start`
2. **Edit files in Windsurf**: Make changes to HTML, CSS, JS, etc.
3. **Save files**: Command+S in Windsurf
4. **Wait 5 seconds**: The watcher automatically syncs
5. **Check GitHub**: Changes appear in your repo
6. **GitHub Pages deploys**: Your site updates automatically

## Troubleshooting

### Watcher Won't Start

```bash
# Check if node_modules exists
ls node_modules

# Reinstall dependencies
npm install
```

### Sync Fails with Git Error

```bash
# Check git status
git status

# Pull latest changes first
git pull origin main

# Resolve any conflicts manually
```

### Permission Denied on Script

```bash
# Make script executable
chmod +x scripts/auto-sync.js
```

### Multiple Watcher Instances Running

```bash
# Stop all instances
npm run sync:stop

# Or kill manually
pkill -f 'node scripts/auto-sync.js'
```

## Advanced Configuration

You can modify `scripts/auto-sync.js` to customize:

- **Debounce delay**: Change `DEBOUNCE_MS` (default: 5000ms = 5 seconds)
- **Commit message**: Change `COMMIT_MESSAGE`
- **Watch path**: Change `WATCH_PATH`
- **Ignore patterns**: Modify `IGNORE_PATTERNS` array

## Best Practices

1. **Keep watcher running**: Start it when you begin work, stop when done
2. **Monitor terminal**: Watch the output to confirm syncs succeed
3. **Test first**: Make a small change and verify it syncs correctly
4. **Check GitHub**: Confirm commits appear in your repo
5. **Stop before major changes**: Disable watcher for large refactors

## Production Safety

This workflow is production-safe because:
- ✅ No automatic deployments (only git commits)
- ✅ GitHub Pages has its own build process
- ✅ Changes are visible in git history before deployment
- ✅ Can be stopped instantly with Ctrl+C
- ✅ No background services that persist after logout
- ✅ Clear visibility of all operations in terminal

## Support

If you encounter issues:
1. Check the terminal output for error messages
2. Verify git is working: `git status`
3. Ensure you have internet connection
4. Confirm GitHub repo is accessible
