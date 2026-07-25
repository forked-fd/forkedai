// ═══════════════════════════════════════════════════════════════
// Forked AI — Express Server (API-Only Mode)
// ═══════════════════════════════════════════════════════════════
import './config.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import chatRouter from './chat.js';
import { getProviderStatus } from './aiService.js';

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = (process.env.NODE_ENV || 'development') !== 'production';

// ─── CORS Configuration ────────────────────────────────────

// قائمة العناوين المسموح بها (أضف عنوان الفرونت اند الخاص بك)
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'https://your-frontend-domain.vercel.app', // استبدل هذا بعنوانك الفعلي
  'https://your-frontend-domain.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173', // Vite
  'http://localhost:8080',
];

app.use(cors({
  origin: (origin, callback) => {
    // السماح للطلبات بدون origin (مثل Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || isDev) {
      return callback(null, true);
    }
    
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ─── Security Middleware ────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", ...allowedOrigins],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ─── Body Parsing ───────────────────────────────────────────

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── API Routes ─────────────────────────────────────────────

// Mount chat routes
app.use('/api', chatRouter);

// ─── Health Check ──────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'forked-ai-api',
    timestamp: new Date().toISOString(),
    providers: getProviderStatus(),
    cors: {
      allowedOrigins: allowedOrigins,
      currentOrigin: req.headers.origin || 'none',
    },
  });
});

// ─── Root (API Info) ──────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    name: 'Forked AI API',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      chat: {
        method: 'POST',
        path: '/api/chat',
        description: 'Send a message to the AI',
        body: {
          message: 'string (required)',
          sessionId: 'string (optional, default: "default")',
        },
      },
      'chat/clear': {
        method: 'POST',
        path: '/api/chat/clear',
        description: 'Clear conversation history',
        body: {
          sessionId: 'string (optional, default: "default")',
        },
      },
      'chat/history': {
        method: 'GET',
        path: '/api/chat/history/:sessionId',
        description: 'Get conversation history',
      },
      'upload/audio': {
        method: 'POST',
        path: '/api/upload/audio',
        description: 'Upload audio for transcription',
        body: 'multipart/form-data with "audio" field',
      },
      health: {
        method: 'GET',
        path: '/api/health',
        description: 'Check API health',
      },
    },
    docs: 'https://github.com/your-username/forked-ai-backend',
  });
});

// ─── 404 Handler ────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET  /',
      'GET  /api/health',
      'POST /api/chat',
      'POST /api/chat/clear',
      'GET  /api/chat/history/:sessionId',
      'POST /api/upload/audio',
    ],
  });
});

// ─── Error Handler ──────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(isDev && { stack: err.stack }),
  });
});

// ─── Start Server ───────────────────────────────────────────

const startServer = () => {
  app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  🚀 Forked AI API Server (API-Only Mode)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  • Port:        ${PORT}`);
    console.log(`  • Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  • CORS:        ${allowedOrigins.join(', ')}`);
    console.log(`  • API URL:     http://localhost:${PORT}`);
    console.log(`  • Health:      http://localhost:${PORT}/api/health`);
    console.log('═══════════════════════════════════════════════════════════\n');
  });
};

// للتوافق مع Vercel
if (process.env.NODE_ENV !== 'production') {
  startServer();
}

export default app;
