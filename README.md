# CodeLoot

A static Roblox codes website with a headless CMS, deployed on Vercel with GitHub as the database.

## Quick Start

### Local Development

```bash
# Start Python dev server (optional - for local CMS testing)
python3 server.py
```

Then open:
- Public site: http://localhost:3000
- Admin panel: http://localhost:3000/admin-index.html

### Deployment

```bash
# Deploy to Vercel
vercel deploy
```

## Architecture

- **Frontend**: Static HTML/CSS/JS
- **Admin Panel**: Browser-based CMS
- **Database**: GitHub repository (data/games.json)
- **Deployment**: Vercel (auto-deploys on Git push)
- **API**: Vercel serverless functions

## Project Structure

```
CODELOOT/
├── Public Website
│   ├── index.html              # Homepage
│   ├── style.css               # Styles
│   ├── app.js                  # Frontend logic
│   ├── games/                  # Game pages (19 files)
│   └── assets/img/             # Game images
│
├── Admin Panel
│   ├── admin-index.html        # Admin dashboard
│   ├── admin-style.css         # Admin styles
│   ├── admin.js                # Admin logic
│   ├── cms-api.js              # CMS API client
│   ├── codeloot-data.js        # Data utilities
│   └── login.html              # Admin login
│
├── API Routes (Vercel)
│   └── api/
│       ├── games.js            # Games CRUD
│       ├── upload-image.js     # Image upload
│       ├── sync-pages.js       # Page sync
│       └── cms-health.js       # Health check
│
├── Data Layer
│   ├── data/games.json         # Game data
│   └── lib/github-api.js      # GitHub API client
│
└── Scripts (Local Dev)
    └── scripts/
        ├── site_generator.py   # Generate HTML from JSON
        ├── html_importer.py    # Import HTML to JSON
        └── image_utils.py     # Image utilities
```

## Admin Panel

### Access
- **URL**: `/admin` or `/admin-index.html`
- **Login Password**: `AdminPass`
- **Session**: 8 hours
- **Sensitive Actions**: Requires additional password (`jeff@`)

### Features
- Add/edit/delete games
- Manage codes with bulk import
- Upload game images
- Auto-publish to GitHub
- Search and filter games

## GitHub API Setup

### Required Environment Variable
```bash
GITHUB_TOKEN=your_github_personal_access_token
```

### Create GitHub Token
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo` (full control)
4. Add to Vercel environment variables

### How It Works
1. Admin saves changes via CMS
2. API route commits to GitHub
3. GitHub triggers Vercel deploy
4. Site updates automatically

## Vercel Configuration

### Environment Variables
- `GITHUB_TOKEN`: GitHub personal access token

### Routing
- `/api/*` → API routes
- `/admin` → Admin panel
- `/login` → Login page
- `/*` → Public site (index.html)

## Data Flow

### Public Site
```
User → index.html → app.js → data/games.json → Render game cards
```

### Admin Panel
```
Admin → admin-index.html → admin.js → API route → GitHub API → data/games.json → Vercel deploy
```

## Scripts

### Local Development
```bash
# Generate HTML from games.json
python3 scripts/site_generator.py

# Import games from HTML files
python3 scripts/html_importer.py

# Start dev server
python3 server.py
```

### Auto-Sync (Optional)
```bash
# Watch files and auto-commit to GitHub
node scripts/auto-sync.js
```

## Security Notes

**Current Authentication:**
- Passwords hardcoded in admin.js (NOT production-ready)
- Session-based auth (browser storage only)
- No server-side validation

**Recommendations for Production:**
- Implement proper authentication (NextAuth.js)
- Use environment variables for passwords
- Add rate limiting
- Implement CSRF protection

## Troubleshooting

### Admin Panel Not Loading
- Check GITHUB_TOKEN is set in Vercel
- Verify GitHub token has `repo` scope
- Check API health: `/api/cms-health`

### Images Not Uploading
- Verify GITHUB_TOKEN permissions
- Check file size limit (15MB)
- Verify image format (PNG/JPG/WebP/GIF)

### Deployment Issues
- Check vercel.json routing
- Verify all required files are committed
- Check Vercel deployment logs

## License

Private project - All rights reserved
