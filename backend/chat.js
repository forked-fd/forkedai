// ═══════════════════════════════════════════════════════════════
// Forked AI — Chat Routes (with Multimodal Support)
// ═══════════════════════════════════════════════════════════════
import express from 'express';
import fs from 'fs';
import { uploadAudio, uploadChatFiles, fileToBase64DataUrl, isImageMimeType } from './uploads.js';
import aiService from './aiService.js';

const router = express.Router();

// ─── Session History (In-Memory) ────────────────────────────

const conversationHistory = new Map();
const HISTORY_TTL = 3600000; // 1 hour
const MAX_HISTORY_LENGTH = 50;

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of conversationHistory) {
    if (data.lastAccess && now - data.lastAccess > HISTORY_TTL) {
      conversationHistory.delete(sessionId);
    }
  }
}, 300000);

function getHistory(sessionId) {
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, { messages: [], lastAccess: Date.now() });
  }
  const data = conversationHistory.get(sessionId);
  data.lastAccess = Date.now();
  return data.messages;
}

function addToHistory(sessionId, role, content) {
  const history = getHistory(sessionId);
  // Store only text in history (not images, to save memory)
  const textContent = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.filter(p => p.type === 'text').map(p => p.text).join('\n')
      : String(content);

  history.push({ role, content: textContent });

  if (history.length > MAX_HISTORY_LENGTH) {
    conversationHistory.set(sessionId, {
      messages: history.slice(-MAX_HISTORY_LENGTH),
      lastAccess: Date.now(),
    });
  }
}

function clearHistory(sessionId) {
  conversationHistory.delete(sessionId);
}

// ─── POST /chat — Main Chat Endpoint ────────────────────────

router.post('/chat', uploadChatFiles, async (req, res, next) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if ((!message || typeof message !== 'string' || message.trim().length === 0) && (!req.files || req.files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Message or files are required',
      });
    }

    const history = getHistory(sessionId);

    // Build the message content (text + optional images)
    let messageContent;
    let hasImages = false;

    if (req.files && req.files.length > 0) {
      // Multimodal message (text + files)
      const contentParts = [];

      // Add text part
      if (message && message.trim()) {
        contentParts.push({ type: 'text', text: message.trim() });
      }

      // Add image parts
      for (const file of req.files) {
        if (isImageMimeType(file.mimetype)) {
          hasImages = true;
          const dataUrl = fileToBase64DataUrl(file.buffer, file.mimetype);
          contentParts.push({
            type: 'image_url',
            image_url: { url: dataUrl },
          });
        } else {
          // For non-image files (text, CSV, etc.), read as text
          try {
            const textContent = file.buffer.toString('utf-8');
            contentParts.push({
              type: 'text',
              text: `\n--- File: ${file.originalname} ---\n${textContent}\n--- End of File ---\n`,
            });
          } catch {
            contentParts.push({
              type: 'text',
              text: `[Uploaded file: ${file.originalname} (${file.mimetype})]`,
            });
          }
        }
      }

      // If no text was provided, add a default prompt
      if (!contentParts.some(p => p.type === 'text')) {
        contentParts.unshift({ type: 'text', text: 'Describe this image.' });
      }

      messageContent = contentParts;
    } else {
      // Text-only message
      messageContent = message.trim();
    }

    const result = await aiService.processChat({
      message: messageContent,
      history: history,
      hasImages: hasImages,
    });

    // Add to history
    const userText = typeof messageContent === 'string' ? messageContent : message?.trim() || 'Image analysis';
    addToHistory(sessionId, 'user', userText);
    addToHistory(sessionId, 'assistant', result.data.response);

    res.status(200).json({
      success: true,
      data: result.data,
      sessionId: sessionId,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /chat/clear — Clear History ───────────────────────

router.post('/chat/clear', async (req, res, next) => {
  try {
    const { sessionId = 'default' } = req.body;
    clearHistory(sessionId);
    res.status(200).json({
      success: true,
      message: 'Conversation history cleared',
      sessionId: sessionId,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /chat/history — Get History ────────────────────────

router.get('/chat/history/:sessionId?', async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId || req.query.sessionId || 'default';
    const history = getHistory(sessionId);
    res.status(200).json({
      success: true,
      data: history,
      sessionId: sessionId,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /upload/audio — Voice Transcription ───────────────

router.post('/upload/audio', uploadAudio, async (req, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Audio recording is required',
      });
    }

    const result = await aiService.transcribeAudio({
      buffer: file.buffer,
      mimeType: file.mimetype,
      path: file.path,
    });

    res.status(200).json({
      success: true,
      transcript: result.data?.transcript || '',
      data: result.data,
    });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
});

export default router;