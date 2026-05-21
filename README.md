# CodeLoot Admin Dashboard

Production-ready admin dashboard for managing CodeLoot games data.

## Deployment

This admin panel is designed to be deployed as a separate Vercel project at `admin.codeloot.codes`.

### Setup Instructions

1. **Create a new Vercel project**
   - Connect your GitHub repository
   - Set root directory to `./` (root of CODELOOT)
   - Framework preset: "Other"

2. **Environment Variables**
   - Add `GITHUB_TOKEN` environment variable
   - Get token from: https://github.com/settings/tokens
   - Required scope: `repo` (full control of private repositories)

3. **Deploy**
   - Vercel will automatically deploy
   - The admin will be available at your Vercel domain

## Features

- **Multi-source data loading**: CMS API → localStorage → remote JSON → local file
- **Automatic localStorage backup**: All changes saved to localStorage for offline editing
- **Cross-device sync**: Changes sync via GitHub API to update the main site
- **Mobile responsive**: Works on all screen sizes
- **Error handling**: Clear error messages and save status indicators
- **Multi-user safe**: Session-based authentication with 8-hour expiry

## File Structure

```
CODELOOT/
├── admin-index.html    # Main admin dashboard
├── admin.js            # Admin logic with localStorage fallback
├── admin-style.css     # Admin styling
├── login.html          # Login page
├── codeloot-data.js    # Shared data utilities
├── cms-api.js          # CMS API client
├── vercel.json         # Vercel routing configuration
├── package.json        # Dependencies
├── .env.example        # Environment variables template
├── api/                # Vercel API routes
│   ├── games.js        # Games CRUD operations
│   ├── upload-image.js # Image upload handler
│   ├── sync-pages.js   # Page sync endpoint
│   ├── sync-status.js  # Sync status endpoint
│   └── cms-health.js   # Health check endpoint
├── lib/
│   └── github-api.js   # GitHub API utilities
├── data/
│   └── games.json      # Shared data source (single source of truth)
├── index.html          # Public site homepage
├── app.js              # Public site JavaScript
├── style.css           # Public site styling
├── games/              # Public game pages (20 HTML files)
└── assets/img/         # Game images (24 files)
```

## Authentication

- Default password: `AdminPass` (change in `admin.js` and `login.html`)
- Session expires after 8 hours
- Sensitive actions (edit/delete) require additional password: `jeff@`

## API Routes

- `GET /api/games` - Load games data
- `PUT /api/games` - Save games data
- `POST /api/upload-image` - Upload game images
- `GET /api/cms-health` - Health check

## Data Sync Flow

1. Admin loads data from multiple sources (CMS API, localStorage, remote JSON)
2. Changes are saved to localStorage immediately
3. If CMS is connected, changes are pushed to GitHub
4. GitHub Pages automatically deploys changes to main site
5. Cross-device users see updates after GitHub Pages deployment

## Local Development

1. Copy `.env.example` to `.env` and add your GitHub token
2. Run `vercel dev` to test locally
3. Or deploy directly to Vercel

## Troubleshooting

**White screen issue**: Check browser console for errors. Ensure all files are present and paths are correct.

**CMS offline**: Admin will show "CMS offline" banner and save to localStorage only. Changes will sync when CMS reconnects.

**Authentication errors**: Check sessionStorage and ensure password is correct.
