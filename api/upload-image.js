import multer from 'multer';
import { put } from '@vercel/blob';

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

function extensionForUpload(filename, mimetype) {
  const MIME_TO_EXT = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  
  if (mimetype && MIME_TO_EXT[mimetype]) {
    return MIME_TO_EXT[mimetype];
  }
  let ext = (filename || '').split('.').pop().toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (['png', 'jpg', 'webp', 'gif'].includes(ext)) return '.' + ext;
  return '.png';
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await runMiddleware(req, res, upload.single('image'));
    
    const slug = (req.body.slug || '').trim();
    
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Missing slug' });
    }
    
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ success: false, error: 'Missing image file' });
    }

    const ext = extensionForUpload(file.originalname, file.mimetype);
    const filename = slug + ext;

    // Upload to Vercel Blob
    const blob = await put(filename, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });

    res.json({
      success: true,
      image: filename,
      url: blob.url,
      path: blob.url,
      files: [blob.url],
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
