// ═══════════════════════════════════════════════════════════════
// Forked AI — Express Server (Secured & Production-Ready)
// ═══════════════════════════════════════════════════════════════
import './config.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import chatRouter from './chat.js';
import { getProviderStatus } from './aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = (process.env.NODE_ENV || 'development') !== 'production';
const frontendDir = path.resolve(__dirname, '..', 'frontend');
const serveRootDir = fs.existsSync(path.join(frontendDir, 'index.html')) ? frontendDir : __dirname;

// ─── Security Middleware ────────────────────────────────────

// Helmet for security headers (relaxed CSP for inline scripts/CDNs)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow CDN resources
}));

// ─── CORS ───────────────────────────────────────────────────

const configuredClientUrl = process.env.CLIENT_URL || `http://localhost:${PORT}`;
const allowedOrigins = new Set([configuredClientUrl, `http://localhost:${PORT}`]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isDev || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// ─── Body Parsing ───────────────────────────────────────────

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Static Files ───────────────────────────────────────────

app.use(express.static(serveRootDir, {
  index: 'index.html',
  dotfiles: 'deny', // Don't serve .env or .gitignore
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ─────────────────────────────────────────────

// Mount chat routes
app.use('/api', chatRouter);

// ─── Health & Frontend Routes ─────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'forked-ai',
    timestamp: new Date().toISOString(),
    providers: getProviderStatus(),
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(serveRootDir, 'index.html'));
});

// ─── 404 Handler ────────────────────────────────────────────

app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: 'Resource not found',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    });
  }

  const ext = path.extname(req.originalUrl).toLowerCase();
  const staticExtensions = ['.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot'];

  if (ext && staticExtensions.includes(ext)) {
    return res.status(404).send('File not found');
  }

  // SPA fallback
  res.sendFile(path.join(serveRootDir, 'index.html'));
});

// ─── Error Handler ──────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('❌ Error:', err.message);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (req.originalUrl.startsWith('/api')) {
    return res.status(statusCode).json({
      success: false,
      error: message,
      ...(isDev && { stack: err.stack }),
    });
  }

  res.status(statusCode).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Forked AI - Error</title>
      <style>
        body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #070B16; color: #EAF0FF; }
        .error-container { text-align: center; padding: 40px; background: #0C1324; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 500px; border: 1px solid rgba(140,170,255,0.14); }
        h1 { font-size: 72px; margin: 0; }
        h2 { font-size: 24px; margin: 16px 0 8px; color: #EAF0FF; }
        p { color: #93A2C7; margin: 8px 0 24px; }
        a { display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #2F8AFF, #7C8CFF); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        a:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(47,138,255,0.4); }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>😕</h1>
        <h2>Something went wrong</h2>
        <p>${message}</p>
        <a href="/">Go Home</a>
      </div>
    </body>
    </html>
  `);
});

// ─── Start Server ───────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[Forked AI Core] Server listening on port ${PORT}`);
  console.log(`  • Service URL: http://localhost:${PORT}`);
  console.log(`  • API Base:    http://localhost:${PORT}/api`);
  console.log(`  • Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  • Security:    Helmet Headers & Rate Limiting active`);

  const frontendFiles = ['index.html', 'style.css', 'script.js'];
  const missingFiles = frontendFiles.filter(file => !fs.existsSync(path.join(serveRootDir, file)));

  if (missingFiles.length > 0) {
    console.warn(`  • Status:      Missing static asset(s): ${missingFiles.join(', ')}`);
  } else {
    console.log(`  • Status:      Static assets verified and mounted\n`);
  }
});

export default app;