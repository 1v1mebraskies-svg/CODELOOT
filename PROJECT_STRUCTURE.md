# CodeLoot Project Structure

**Generated:** May 21, 2026  
**Status:** CURRENT ARCHITECTURE DOCUMENTATION

---

## CURRENT ARCHITECTURE

### High-Level Overview

CodeLoot is a **static website with a headless CMS** that:
1. Serves a public Roblox codes website
2. Provides an admin dashboard for content management
3. Uses GitHub as the database and deployment trigger
4. Deploys to Vercel via Git integration

### Deployment Model

```
GitHub Repository → Vercel → Static Website
                      ↓
                 Vercel API Routes (Serverless)
                      ↓
                 GitHub API (Database)
```

---

## DIRECTORY STRUCTURE (CURRENT - BEFORE CLEANUP)

```
CODELOOT/
├── Public Website
│   ├── index.html                    # Homepage
│   ├── style.css                     # Public site styles
│   ├── app.js                        # Frontend JavaScript
│   ├── games/                        # Game pages (19 files)
│   │   ├── anime-defenders.html
│   │   ├── blox-fruits.html
│   │   └── ...
│   ├── about.html                    # About page
│   ├── contact.html                  # Contact page
│   ├── privacy-policy.html           # Privacy policy
│   └── terms-of-service.html         # Terms of service
│
├── Admin Panel (ROOT LEVEL - ACTIVE)
│   ├── admin-index.html              # Admin dashboard entry
│   ├── admin-style.css               # Admin styles
│   ├── admin.js                      # Admin logic
│   ├── cms-api.js                    # CMS API client
│   ├── codeloot-data.js              # Data utilities
│   └── login.html                    # Admin login
│
├── Admin Panel (DUPLICATE - SHOULD DELETE)
│   └── admin/                        # ENTIRE DIRECTORY IS DUPLICATE
│       ├── index.html                # Duplicate of admin-index.html
│       ├── login.html                # Duplicate of login.html
│       ├── admin.js                  # Duplicate of root admin.js
│       ├── cms-api.js                # Duplicate of root cms-api.js
│       ├── codeloot-data.js          # Duplicate of root codeloot-data.js
│       ├── style.css                 # Duplicate of admin-style.css
│       ├── migrate.html             # Unused migration page
│       ├── api/                      # Duplicate API endpoints
│       ├── package.json              # Conflicting package.json
│       ├── vercel.json               # Conflicting routing config
│       └── README.md                 # Duplicate documentation
│
├── API Routes (Vercel Serverless)
│   └── api/
│       ├── games.js                  # Games CRUD operations
│       ├── upload-image.js           # Image upload to GitHub
│       ├── sync-pages.js             # Page sync endpoint
│       └── cms-health.js             # Health check
│
├── Data Layer
│   ├── data/
│   │   └── games.json                # Game data (database)
│   └── lib/
│       └── github-api.js             # GitHub API client
│
├── Assets
│   └── assets/
│       └── img/                      # Game images (24 files)
│
├── Scripts (Local Development)
│   └── scripts/
│       ├── site_generator.py         # Generate HTML from games.json
│       ├── html_importer.py          # Import HTML to games.json
│       ├── image_utils.py            # Image utilities
│       ├── auto-sync.js              # Git auto-sync watcher
│       ├── migrate-games.js          # One-time migration (unused)
│       ├── run_sync.py               # Sync runner
│       └── verify-cms.js             # CMS verification (unused)
│
├── Local Development Server
│   └── server.py                     # Python HTTP server with CMS
│
├── Configuration
│   ├── vercel.json                   # Vercel routing config
│   ├── package.json                  # Node.js dependencies
│   ├── .env.example                  # Environment variables template
│   └── .gitignore                    # Git ignore rules
│
├── Duplicate/Unused Files (SHOULD DELETE)
│   ├── js/                           # Duplicate JS files
│   │   ├── cms-api.js                # Duplicate
│   │   └── codeloot-data.js          # Duplicate
│   ├── archived-public-site/         # Old public site
│   ├── app.js.backup                 # Corrupted backup
│   ├── index.html 11-30-27-748.html  # Corrupted backup
│   └── autosync.sh                   # Redundant shell script
│
└── Documentation (SHOULD CONSOLIDATE)
    ├── ADMIN_CMS_GUIDE.md
    ├── ADMIN_CMS_README.md
    ├── ADMIN_CMS_STATUS.md
    ├── ADMIN_DEPLOYMENT_GUIDE.md
    ├── ADMIN_SUBDOMAIN_SETUP.md
    ├── AUTO_SYNC_SETUP.md
    ├── DNS_TROUBLESHOOTING.md
    ├── GITHUB_API_SETUP.md
    ├── IMAGE_UPLOAD_SETUP.md
    ├── IMPLEMENTATION_COMPLETE.md
    ├── SEARCH_SYSTEM_DOCS.md
    ├── STANDALONE_ADMIN_DEPLOYMENT.md
    └── SEARCH_REBUILD_SUMMARY.txt
```

---

## DATA FLOW ARCHITECTURE

### Public Website Flow

```
User Browser → index.html → app.js → data/games.json
                                    ↓
                              Render game cards
                                    ↓
                              User clicks game
                                    ↓
                              games/{slug}.html
                                    ↓
                              app.js loads game data
                                    ↓
                              Display codes
```

### Admin Panel Flow

```
Admin Browser → admin-index.html → admin.js → cms-api.js
                                          ↓
                                    Check auth
                                          ↓
                                    Load games from:
                                    1. CMS API (/api/games)
                                    2. Fallback to data/games.json
                                          ↓
                                    Admin edits game
                                          ↓
                                    Save via CMS API
                                          ↓
                                    api/games.js (Vercel)
                                          ↓
                                    lib/github-api.js
                                          ↓
                                    GitHub API
                                          ↓
                                    Update data/games.json
                                          ↓
                                    GitHub triggers Vercel deploy
                                          ↓
                                    Public site updates
```

### Image Upload Flow

```
Admin uploads image → admin.js → api/upload-image.js
                                          ↓
                                    lib/github-api.js
                                          ↓
                                    GitHub API
                                          ↓
                                    Upload to assets/img/
                                          ↓
                                    Return GitHub URL
                                          ↓
                                    Update games.json
```

---

## COMPONENT ARCHITECTURE

### Frontend Components

#### Public Website
- **index.html**: Static homepage with game cards
- **app.js**: 
  - Game page hydration (loads codes from games.json)
  - Search functionality
  - Copy-to-clipboard
- **style.css**: Responsive design system

#### Admin Panel
- **admin-index.html**: Dashboard UI
- **admin.js**:
  - Authentication (session-based, 8-hour expiry)
  - Game CRUD operations
  - Image upload handling
  - Bulk code import
  - Sensitive action confirmation (password: jeff@)
- **cms-api.js**: API client with auto-discovery
- **codeloot-data.js**: Data validation and utilities
- **login.html**: Simple password login (AdminPass)

### Backend Components

#### Vercel API Routes (Serverless)
- **api/games.js**:
  - GET: Fetch games from GitHub
  - PUT: Update games in GitHub
- **api/upload-image.js**:
  - POST: Upload image to GitHub via multer
- **api/sync-pages.js**:
  - POST: Trigger page regeneration (disabled on Vercel)
- **api/cms-health.js**:
  - GET: Health check endpoint

#### GitHub Integration
- **lib/github-api.js**:
  - File operations (get, create, update, delete)
  - Image upload
  - Commit management
  - Uses GitHub REST API with personal access token

#### Local Development
- **server.py**:
  - Python HTTP server
  - Serves static files
  - Provides API endpoints for local CMS
  - Auto-generates HTML from games.json
- **scripts/site_generator.py**:
  - Generates game pages from games.json
  - Updates homepage cards
  - Syncs all HTML files
- **scripts/html_importer.py**:
  - Imports game data from HTML files
  - Parses HTML to extract codes
- **scripts/image_utils.py**:
  - Image filename resolution
  - Extension handling
  - Old image cleanup

---

## DEPLOYMENT ARCHITECTURE

### Vercel Deployment

**Current Configuration:**
- **Framework:** None (static site)
- **Build Command:** None (static files)
- **Output Directory:** Root
- **Environment Variables:** GITHUB_TOKEN
- **Git Integration:** Automatic on push to main branch

**Routing (CURRENT - BROKEN):**
```json
{
  "rewrites": [
    { "source": "/", "destination": "/admin-index.html" },
    { "source": "/login", "destination": "/login.html" },
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/(.*)", "destination": "/admin-index.html" }
  ]
}
```

**Problem:** Routes everything to admin-index.html, breaking public site.

**Routing (CORRECT):**
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/admin", "destination": "/admin-index.html" },
    { "source": "/login", "destination": "/login.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### GitHub as Database

**Why GitHub?**
- Free hosting
- Built-in version control
- Automatic Vercel deployment on commit
- No database server needed
- Easy content editing via admin panel

**Data Storage:**
- `data/games.json` - Single source of truth
- `assets/img/*` - Binary assets
- All content stored in Git repository

**Commit Flow:**
1. Admin saves game via admin panel
2. API route updates games.json in GitHub
3. GitHub creates commit
4. Vercel detects commit
5. Vercel rebuilds and deploys
6. Public site updates automatically

---

## AUTHENTICATION ARCHITECTURE

### Admin Authentication

**Method:** Session-based client-side auth

**Flow:**
1. User accesses admin-index.html
2. Checks sessionStorage for `codeloot_admin_auth`
3. If not found, redirects to login.html
4. User enters password (AdminPass)
5. On success, sets sessionStorage:
   - `codeloot_admin_auth = 'true'`
   - `codeloot_auth_time = timestamp`
6. Session expires after 8 hours
7. Sensitive actions (delete, edit) require additional password (jeff@)

**Security Notes:**
- Passwords hardcoded in admin.js (NOT SECURE)
- No server-side validation
- Session storage only (cleared on browser close)
- Should be replaced with proper auth for production

---

## WHY ADMIN DEPLOYMENT BROKE

### Root Cause Analysis

**The Problem:**
The project has TWO admin systems that conflict:

1. **Root-level admin** (intended to be used):
   - `admin-index.html` in root
   - `admin.js`, `cms-api.js`, `codeloot-data.js` in root
   - API routes in `api/`
   - Single vercel.json in root

2. **Subdirectory admin** (abandoned duplicate):
   - `admin/index.html` in admin/ subdirectory
   - Duplicate admin files in admin/
   - Duplicate API routes in admin/api/
   - Separate vercel.json in admin/
   - Separate package.json in admin/

**How It Broke:**
1. The admin/ subdirectory was created for standalone admin deployment
2. It was never properly separated into its own repo
3. Root vercel.json was configured to route everything to admin-index.html
4. This broke public website routing
5. Confusion about which admin system to use
6. Duplicate files caused maintenance issues

**Current State:**
- Root admin is functional but routing is broken
- Subdirectory admin is completely unused
- Public website routes don't work due to vercel.json
- Deployment is unstable

---

## ARCHITECTURAL ISSUES

### 1. Mixed Deployment Targets
- Root configured for Vercel
- Subdirectory admin also configured for Vercel
- Conflicting routing configurations
- Unclear which should be deployed

### 2. Duplicate Code
- Admin files in 3 locations (root, admin/, js/)
- API endpoints in 2 locations (api/, admin/api/)
- Maintenance nightmare
- Which version is correct?

### 3. Broken Routing
- Root vercel.json routes everything to admin
- Public website inaccessible
- Game pages can't be reached
- Static assets may be misrouted

### 4. Authentication Issues
- Hardcoded passwords
- No server-side validation
- Session storage only
- Not production-ready

### 5. Database Choice
- GitHub as database is unconventional
- Good for simple sites, bad for scale
- No query capabilities
- Slow for large datasets
- Rate limiting concerns

### 6. Local vs Production
- Python server for local dev
- Vercel for production
- Different API implementations
- Inconsistent behavior

---

## RECOMMENDED ARCHITECTURE (AFTER CLEANUP)

### Simplified Structure

```
CODELOOT/
├── Public Website
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── games/ (19 files)
│   ├── about.html
│   ├── contact.html
│   ├── privacy-policy.html
│   └── terms-of-service.html
│
├── Admin Panel
│   ├── admin-index.html
│   ├── admin-style.css
│   ├── admin.js
│   ├── cms-api.js
│   ├── codeloot-data.js
│   └── login.html
│
├── API Routes
│   └── api/
│       ├── games.js
│       ├── upload-image.js
│       ├── sync-pages.js
│       └── cms-health.js
│
├── Data Layer
│   ├── data/games.json
│   └── lib/github-api.js
│
├── Assets
│   └── assets/img/
│
├── Scripts (Optional - Local Dev Only)
│   └── scripts/
│       ├── site_generator.py
│       ├── html_importer.py
│       └── image_utils.py
│
├── Configuration
│   ├── vercel.json (FIXED)
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
└── Documentation
    ├── README.md
    └── DEPLOYMENT.md
```

### Key Changes
1. Delete entire `admin/` subdirectory
2. Delete `js/` directory
3. Delete all backup files
4. Delete `archived-public-site/`
5. Consolidate documentation
6. Fix vercel.json routing
7. Keep only essential scripts

---

## LONG-TERM ARCHITECTURE RECOMMENDATIONS

### Option 1: Keep Current (Simplest)
**Pros:**
- Minimal changes
- GitHub as database works for current scale
- Vercel deployment is free
- Admin panel is functional

**Cons:**
- Not scalable
- Authentication insecure
- GitHub rate limits
- No query capabilities

**Best For:** Small personal project, low traffic

### Option 2: Separate Admin (Recommended)
**Structure:**
- Separate repository for admin panel
- Deploy admin to admin.codeloot.codes
- Keep public site at codeloot.codes
- Shared GitHub repository for data

**Pros:**
- Clear separation of concerns
- Independent deployments
- Can use different tech stacks
- Better security isolation

**Cons:**
- More complex setup
- Need to manage CORS
- Shared data repository complexity

**Best For:** Growing project, multiple admins

### Option 3: Proper Database (Scalable)
**Changes:**
- Replace GitHub with real database (PostgreSQL/SQLite)
- Use Vercel Postgres or Supabase
- Implement proper authentication (NextAuth.js)
- Add API rate limiting
- Implement caching

**Pros:**
- Scalable to millions of users
- Proper authentication
- Query capabilities
- Better performance

**Cons:**
- Database costs
- More complex architecture
- Need backend framework (Next.js)

**Best For:** Production-ready, high-traffic site

---

## DEPENDENCY ANALYSIS

### Current Dependencies (package.json)
```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1"
  }
}
```

**multer:** Used for image upload in api/upload-image.js

**Dev Dependencies (from scripts):**
- chokidar (file watching in auto-sync.js)
- async-retry (retry logic)

**Unused Dependencies:**
- @vercel/blob (installed but not used)

---

## ENVIRONMENT VARIABLES

### Required
- `GITHUB_TOKEN` - GitHub personal access token with repo scope

### Optional
- None currently

---

## GIT STRATEGY

### Current Branch Strategy
- Single branch: main
- Vercel deploys on push to main

### Recommended
- Add development branch
- Use pull requests for changes
- Deploy dev branch to preview URL
- Merge to main for production

---

## MONITORING & LOGGING

### Current
- None (Vercel default logs only)

### Recommended
- Add Vercel Analytics
- Add error tracking (Sentry)
- Add uptime monitoring
- Log GitHub API calls

---

**END OF DOCUMENTATION**
