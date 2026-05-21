# Image Upload System - Vercel Blob Storage

## Overview

The CodeLoot admin CMS now uses Vercel Blob Storage for image uploads, which provides:
- **Permanent storage** - Images persist across deployments
- **CDN delivery** - Fast global distribution
- **Production-safe** - Works on Vercel's read-only filesystem
- **Backward compatible** - Existing local images still work

## Setup Instructions

### 1. Create Vercel Blob Storage

1. Go to your Vercel project dashboard
2. Navigate to **Storage** > **Create Database**
3. Select **Blob** and create a new store
4. Copy the **BLOB_READ_WRITE_TOKEN** from the store settings

### 2. Configure Environment Variable

Add the environment variable to your Vercel project:

**Via Vercel Dashboard:**
- Go to Project Settings > Environment Variables
- Add: `BLOB_READ_WRITE_TOKEN` = (your token from step 1)
- Select **Production**, **Preview**, and **Development** environments

**Via CLI:**
```bash
vercel env add BLOB_READ_WRITE_TOKEN
```

### 3. Local Development

For local development, create a `.env.local` file:

```bash
cp .env.example .env.local
```

Then add your `BLOB_READ_WRITE_TOKEN` to `.env.local`.

## How It Works

### Upload Flow

1. Admin uploads image via CMS
2. Image is sent to `/api/upload-image` endpoint
3. Image is uploaded to Vercel Blob Storage
4. Full URL is returned (e.g., `https://blob.vercel-storage.com/codeloot/anime-defenders.png`)
5. URL is saved in `data/games.json` under the game's `image` field

### Image Rendering

The system automatically handles both:
- **Cloud URLs** (new uploads): Full HTTPS URLs from Vercel Blob
- **Local paths** (existing images): Relative paths like `assets/img/filename.png`

The `gameImageSrc()` function in `js/codeloot-data.js` detects the format and renders accordingly.

### Data Structure

**New format (cloud URLs):**
```json
{
  "image": "https://blob.vercel-storage.com/codeloot/anime-defenders-banner.png"
}
```

**Legacy format (local paths):**
```json
{
  "image": "anime-defenders-banner.png"
}
```

Both formats work seamlessly.

## Migration

Existing games with local images will continue to work. To migrate them to cloud storage:

1. Edit each game in the admin CMS
2. Re-upload the image
3. Save and publish

The new image URL will be saved to the database.

## API Endpoint

### POST /api/upload-image

Uploads an image to Vercel Blob Storage.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Fields:
  - `slug`: Game slug (used for filename)
  - `image`: Image file (max 15MB)

**Response:**
```json
{
  "success": true,
  "image": "anime-defenders.png",
  "url": "https://blob.vercel-storage.com/codeloot/anime-defenders.png",
  "path": "https://blob.vercel-storage.com/codeloot/anime-defenders.png",
  "files": ["https://blob.vercel-storage.com/codeloot/anime-defenders.png"]
}
```

## Troubleshooting

### Upload fails with "BLOB_READ_WRITE_TOKEN not found"

Ensure the environment variable is set:
- Check Vercel project settings
- Restart your development server after adding `.env.local`
- Verify the token is valid in Vercel Blob dashboard

### Images not displaying

- Check that the URL in `data/games.json` is accessible
- Verify the Blob store is not deleted
- Check browser console for CORS errors

### Local development issues

- Ensure `.env.local` exists in the project root
- Restart the dev server after adding the token
- Verify the token has read/write permissions

## Cost Considerations

Vercel Blob Storage pricing:
- Free tier: 500GB storage, 1TB bandwidth/month
- Pay-as-you-go: $0.15/GB storage, $0.15/GB bandwidth

For typical game image usage (100-500KB per image), the free tier is sufficient for thousands of images.

## Security

- Images are stored with `access: 'public'` for web serving
- Uploads are limited to 15MB file size
- Only authenticated admin users can upload
- Token should be kept secret and never committed to git
