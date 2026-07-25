// ═══════════════════════════════════════════════════════════════
// Forked AI — Upload Middleware (Audio + Images + Files)
// ═══════════════════════════════════════════════════════════════
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ──────────────────────────────────────────

const UPLOAD_CONFIG = {
  maxFileSize: 25 * 1024 * 1024, // 25MB
  maxImageSize: 10 * 1024 * 1024, // 10MB for images
  maxFilesPerRequest: 5,
  uploadDir: path.join(__dirname, 'uploads'),
};

// ─── MIME Type Maps ─────────────────────────────────────────

const MIME_TYPES = {
  // Audio
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/webm': '.webm',
  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  // Documents
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/markdown': '.md',
  'application/json': '.json',
  'application/x-ipynb+json': '.ipynb',
};

const FILE_CATEGORIES = {
  audio: [
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/webm',
  ],
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
  ],
  document: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/json',
    'application/x-ipynb+json',
  ],
  notebook: [
    'application/x-ipynb+json',
  ],
};

// ─── Helpers ────────────────────────────────────────────────

const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_CONFIG.uploadDir)) {
    fs.mkdirSync(UPLOAD_CONFIG.uploadDir, { recursive: true });
  }
};

const normalizeMimeType = (mimeType) => (mimeType || '').split(';')[0].trim();

const generateUniqueFilename = (originalName, mimeType) => {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  
  // Check if it's a .ipynb file by extension or mime type
  const isIpynb = originalName.toLowerCase().endsWith('.ipynb') || 
                  normalizeMimeType(mimeType) === 'application/x-ipynb+json';
  
  let extension = '.bin';
  if (isIpynb) {
    extension = '.ipynb';
  } else {
    extension = MIME_TYPES[normalizeMimeType(mimeType)] || path.extname(originalName) || '.bin';
  }
  
  const baseName = path.basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') || 'upload';

  return `${baseName}-${timestamp}-${randomId}${extension}`;
};

/**
 * Convert an uploaded file buffer to base64 data URL.
 * Used for sending images to AI models.
 */
export function fileToBase64DataUrl(buffer, mimeType) {
  const cleanMime = normalizeMimeType(mimeType);
  const base64 = buffer.toString('base64');
  return `data:${cleanMime};base64,${base64}`;
}

/**
 * Check if a MIME type is an image type.
 */
export function isImageMimeType(mimeType) {
  return FILE_CATEGORIES.image.includes(normalizeMimeType(mimeType));
}

/**
 * Check if a file is a Jupyter Notebook (.ipynb)
 */
export function isNotebookFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = normalizeMimeType(file.mimetype);
  return ext === '.ipynb' || mimeType === 'application/x-ipynb+json';
}

/**
 * Extract text content from a Jupyter Notebook file
 */
export function extractNotebookContent(buffer) {
  try {
    const content = buffer.toString('utf-8');
    const notebook = JSON.parse(content);
    
    let extractedText = '';
    let codeCells = [];
    let markdownCells = [];
    
    if (notebook.cells && Array.isArray(notebook.cells)) {
      for (const cell of notebook.cells) {
        if (cell.cell_type === 'markdown') {
          const text = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
          if (text && text.trim()) {
            markdownCells.push(text.trim());
            extractedText += text + '\n\n';
          }
        } else if (cell.cell_type === 'code') {
          const code = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
          if (code && code.trim()) {
            codeCells.push(code.trim());
            extractedText += '```python\n' + code + '\n```\n\n';
          }
        }
      }
    }
    
    return {
      text: extractedText,
      codeCells: codeCells,
      markdownCells: markdownCells,
      cellCount: notebook.cells?.length || 0,
      isNotebook: true,
    };
  } catch (error) {
    console.error('Error parsing notebook:', error);
    return {
      text: '',
      codeCells: [],
      markdownCells: [],
      cellCount: 0,
      isNotebook: false,
      error: 'Failed to parse notebook file',
    };
  }
}

// ─── Multer Storage ─────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_CONFIG.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = generateUniqueFilename(file.originalname, file.mimetype);
    cb(null, uniqueName);
  },
});

// Memory storage for files (we need buffer for processing)
const memoryStorage = multer.memoryStorage();

// ─── File Filters ───────────────────────────────────────────

const fileFilter = (allowedTypes, { skipExtensionCheck = false } = {}) => (req, file, cb) => {
  const mimeType = normalizeMimeType(file.mimetype);
  const ext = path.extname(file.originalname).toLowerCase();

  // Special handling for .ipynb files
  if (ext === '.ipynb') {
    // Allow .ipynb files even if mime type is not recognized
    if (allowedTypes.includes('application/x-ipynb+json') || 
        allowedTypes.includes('application/json') ||
        allowedTypes.includes('text/plain')) {
      cb(null, true);
      return;
    }
  }

  if (allowedTypes.includes(mimeType)) {
    if (!skipExtensionCheck) {
      const expectedExt = MIME_TYPES[mimeType];

      // Skip extension check for .ipynb files
      if (ext === '.ipynb' && (mimeType === 'application/json' || mimeType === 'application/x-ipynb+json')) {
        cb(null, true);
        return;
      }

      if (expectedExt && ext !== expectedExt) {
        return cb(new Error(`File extension mismatch. Expected ${expectedExt}, got ${ext}`));
      }
    }
    cb(null, true);
  } else {
    // If it's a .ipynb file but mime type is not recognized, still allow it
    if (ext === '.ipynb') {
      cb(null, true);
      return;
    }
    cb(new Error(`Unsupported file type: ${file.mimetype}. Supported: ${allowedTypes.join(', ')}`));
  }
};

// ─── Multer Instances ───────────────────────────────────────

const createMulterInstance = (
  allowedTypes,
  {
    maxSize = UPLOAD_CONFIG.maxFileSize,
    skipExtensionCheck = false,
    useMemory = false,
    maxFiles = UPLOAD_CONFIG.maxFilesPerRequest,
  } = {}
) => {
  return multer({
    storage: useMemory ? memoryStorage : storage,
    fileFilter: fileFilter(allowedTypes, { skipExtensionCheck }),
    limits: {
      fileSize: maxSize,
      files: maxFiles,
    },
  });
};

// ─── Error Handler ──────────────────────────────────────────

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: `File too large. Maximum size is ${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB`,
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: `Maximum ${UPLOAD_CONFIG.maxFilesPerRequest} file(s) allowed per request`,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name for file upload',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  if (err.message && (err.message.includes('unsupported') || err.message.includes('mismatch') || err.message.includes('Unsupported'))) {
    return res.status(415).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
};

// ─── Export Middleware ───────────────────────────────────────

/**
 * Middleware for audio file uploads (saved to disk for Deepgram).
 */
export const uploadAudio = (req, res, next) => {
  const upload = createMulterInstance(FILE_CATEGORIES.audio, {
    maxSize: 25 * 1024 * 1024,
    skipExtensionCheck: true,
  }).single('audio');

  upload(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
};

/**
 * Middleware for image/file uploads with chat messages.
 * Uses memory storage to convert to base64 for AI models.
 * Supports .ipynb files.
 */
export const uploadChatFiles = (req, res, next) => {
  // Allow all document types plus images
  const allowedTypes = [
    ...FILE_CATEGORIES.image,
    ...FILE_CATEGORIES.document,
    'application/x-ipynb+json',
  ];
  
  const upload = createMulterInstance(allowedTypes, {
    maxSize: UPLOAD_CONFIG.maxImageSize,
    skipExtensionCheck: true,
    useMemory: true,
    maxFiles: 5,
  }).array('files', 5);

  upload(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
};

// ─── Exports ────────────────────────────────────────────────

export const SUPPORTED_TYPES = {
  audio: FILE_CATEGORIES.audio,
  image: FILE_CATEGORIES.image,
  document: FILE_CATEGORIES.document,
  notebook: FILE_CATEGORIES.notebook,
};

export default {
  uploadAudio,
  uploadChatFiles,
  fileToBase64DataUrl,
  isImageMimeType,
  isNotebookFile,
  extractNotebookContent,
  SUPPORTED_TYPES,
};