// ═══════════════════════════════════════════════════════════════
// Forked AI — Client-Side Application Engine (Clean Source)
// ═══════════════════════════════════════════════════════════════

const API_BASE_URL = window.location.origin + '/api';
const MAX_RECORDING_MS = 60 * 1000; // 60 seconds max voice recording
const TYPE_SPEED = 18; // Default typing speed in ms per character

// ── DOM Element References ──────────────────────────────────
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const langToggle = document.getElementById('langToggle');
const langToggleLabel = document.getElementById('langToggleLabel');
const fileInput = document.getElementById('fileInput');
const fileBtn = document.getElementById('fileBtn');
const filePreviewContainer = document.getElementById('filePreviewContainer');
const scrollBottomBtn = document.getElementById('scrollBottomBtn');

// ── State Variables ─────────────────────────────────────────
let isProcessing = false;
let recordingTimeout = null;
let isRecording = false;
let sessionId = localStorage.getItem('forkedai:sessionId') || generateSessionId();
let abortController = null;
let userScrolledUp = false;
let scrollTimeout = null;
let selectedFiles = [];
let hasNewMessage = false;

// Save session ID
localStorage.setItem('forkedai:sessionId', sessionId);

function generateSessionId() {
    return 'session_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// ── Internationalization (I18N) ─────────────────────────────
const I18N = {
    en: {
        dir: 'ltr',
        'nav.home': 'Home',
        'hero.title': 'Welcome to Forked AI',
        'hero.subtitleHtml': 'Your AI Assistant for <span class="highlight-word">Artificial Intelligence</span> · <span class="highlight-word">Machine Learning</span> · <span class="highlight-word">Data Science</span> · <span class="highlight-word">Coding</span>',
        'composer.placeholder': 'Ask Forked AI anything... (Type or use voice)',
        'composer.inputLabel': 'Message input',
        'mic.record': 'Start voice recording',
        'mic.stop': 'Stop recording and send',
        'send.label': 'Send Message',
        'thinking.text': 'Forked AI is thinking',
        'error.generic': 'An error occurred. Please try again.',
        'error.mic.unsupported': 'Voice recording is not supported in your browser.',
        'error.mic.permission': 'Microphone permission denied. Please allow microphone access.',
        'error.mic.short': 'Recording was too short — try again.',
        'error.mic.noSpeech': 'No speech detected in recording. Please try again.',
        'error.mic.failed': 'Failed to transcribe recording into text.',
        'status.online': 'Online & Ready',
        'status.offline': 'No internet connection.',
        'welcome.text': 'Hello! How can I assist you today?',
        'empty.title': 'Where should we start?',
        'empty.subtitle': 'Ask about ML, review some code, or paste a dataset — Forked AI picks up from there.',
        'lang.switchTo': 'العربية',
        'clear.history': 'Clear Chat',
        'clear.confirm': 'Are you sure you want to clear conversation history?'
    },
    ar: {
        dir: 'rtl',
        'nav.home': 'الرئيسية',
        'hero.title': 'مرحباً بك في Forked AI',
        'hero.subtitleHtml': 'مساعدك الذكي لـ <span class="highlight-word">الذكاء الاصطناعي</span> · <span class="highlight-word">تعلم الآلة</span> · <span class="highlight-word">علوم البيانات</span> · <span class="highlight-word">البرمجة</span>',
        'composer.placeholder': 'اسأل Forked AI أي شيء... (اكتب أو سجل صوتك)',
        'composer.inputLabel': 'مربع كتابة الرسالة',
        'mic.record': 'بدء تسجيل صوتي',
        'mic.stop': 'إيقاف وإرسال التسجيل',
        'send.label': 'إرسال الرسالة',
        'thinking.text': 'Forked AI بيفكر',
        'error.generic': 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
        'error.mic.unsupported': 'المتصفح لا يدعم تسجيل الصوت.',
        'error.mic.permission': 'تم رفض الإذن لاستخدام المايكروفون.',
        'error.mic.short': 'التسجيل كان قصيراً جداً — حاول مرة أخرى.',
        'error.mic.noSpeech': 'لم يتم التقاط صوت في التسجيل. حاول مرة أخرى.',
        'error.mic.failed': 'فشل تحويل التسجيل لنص.',
        'status.online': 'متصل وجاهز',
        'status.offline': 'لا يوجد اتصال بالإنترنت.',
        'welcome.text': 'أهلاً بك! كيف يمكنني مساعدتك اليوم؟',
        'empty.title': 'بماذا تحب أن نبدأ اليوم؟',
        'empty.subtitle': 'اسأل عن الذكاء الاصطناعي، راجع كودك البرمجي، أو أرفق بياناتك ليتولى Forked AI الباقي.',
        'lang.switchTo': 'English',
        'clear.history': 'مسح المحادثة',
        'clear.confirm': 'هل أنت تأكد من مسح تاريخ المحادثة؟'
    }
};

let currentLang = localStorage.getItem('forkedai:lang') || 'en';

function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N['en'][key] || key;
}

function applyLanguage(lang) {
    currentLang = I18N[lang] ? lang : 'en';
    localStorage.setItem('forkedai:lang', currentLang);
    document.documentElement.lang = currentLang;
    document.documentElement.dir = I18N[currentLang].dir || 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (!el.closest('[data-i18n-html]')) {
            el.textContent = t(key);
        }
    });

    const heroSubtitle = document.querySelector('[data-i18n-html="hero.subtitle"]');
    if (heroSubtitle) {
        heroSubtitle.innerHTML = t('hero.subtitleHtml');
    }

    if (chatInput) {
        chatInput.placeholder = t('composer.placeholder');
        chatInput.setAttribute('aria-label', t('composer.inputLabel'));
    }

    if (micBtn && !isRecording) {
        micBtn.setAttribute('aria-label', t('mic.record'));
        micBtn.title = t('mic.record');
    }

    if (sendBtn) {
        sendBtn.setAttribute('aria-label', t('send.label'));
    }

    if (langToggleLabel) {
        langToggleLabel.textContent = t('lang.switchTo');
    }
}

function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIconSVG() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
    </svg>`;
}

function renderAttachmentCards(files) {
    if (!files || files.length === 0) return '';
    const cards = files.map(file => {
        const ext = (file.name.split('.').pop() || 'file').toUpperCase();
        const size = formatFileSize(file.size);
        const isImage = file.type && file.type.startsWith('image/');
        const iconInner = isImage && file._previewUrl
            ? `<img src="${file._previewUrl}" alt="${escapeHtml(file.name)}">`
            : fileIconSVG();
        return `
            <div class="attachment-card">
                <div class="attachment-icon">${iconInner}</div>
                <div class="attachment-info">
                    <span class="attachment-name">${escapeHtml(file.name)}</span>
                    <span class="attachment-meta">${escapeHtml(ext)}${size ? ' · ' + size : ''}</span>
                </div>
            </div>
        `;
    }).join('');
    return `<div class="message-attachments">${cards}</div>`;
}

function warningIconSVG() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-right:6px;vertical-align:-3px;">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function detectDirection(text) {
    const rtlChars = (text.match(/[\u0600-\u06FF\u0590-\u05FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length || 1;
    return (rtlChars / totalChars > 0.3) ? 'rtl' : 'ltr';
}

function scrollToBottom(smooth = true, force = false) {
    if (userScrolledUp && !force) return;

    const behavior = smooth ? 'smooth' : 'auto';

    // This layout can scroll at either level depending on content height:
    // the document/window (hero + chat share normal page flow) OR the
    // inner .chat-messages container (once it has its own overflow).
    // Move both so the button/auto-scroll works regardless of which one
    // ends up being the active scroller.
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });

    if (chatMessages.scrollHeight > chatMessages.clientHeight) {
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior });
    }
}

function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 168) + 'px';
}

function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
}

function fallbackCopy(text) {
    return new Promise(resolve => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        resolve();
    });
}

// ─── Voice Recording (Web Speech API, free in browser) ──────

let speechRecognition = null;

function getSpeechRecognitionLang() {
    return currentLang === 'ar' ? 'ar-EG' : 'en-US';
}

async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    if (isRecording) return;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
        alert(t('error.mic.unsupported'));
        return;
    }

    try {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = getSpeechRecognitionLang();
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
            micBtn.setAttribute('aria-label', t('mic.stop'));
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0]?.transcript || '')
                .join(' ')
                .trim();

            if (transcript) {
                chatInput.value = transcript;
                autoResizeTextarea();
                handleSendMessage();
            } else {
                addMessage(`⚠️ ${t('error.mic.noSpeech')}`, 'ai', { isError: true });
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            let message = t('error.mic.failed');
            if (event.error === 'not-allowed') {
                message = t('error.mic.permission');
            } else if (event.error === 'no-speech') {
                message = t('error.mic.noSpeech');
            }

            addMessage(`⚠️ ${message}`, 'ai', { isError: true });
            isRecording = false;
            micBtn.classList.remove('recording');
            micBtn.setAttribute('aria-label', t('mic.record'));
        };

        recognition.onend = () => {
            isRecording = false;
            micBtn.classList.remove('recording');
            micBtn.setAttribute('aria-label', t('mic.record'));
            speechRecognition = null;
        };

        speechRecognition = recognition;
        recognition.start();

        recordingTimeout = setTimeout(() => {
            if (isRecording) stopRecording();
        }, MAX_RECORDING_MS);
    } catch (err) {
        console.error('Microphone error:', err);
        alert(t('error.mic.permission'));
    }
}

function stopRecording() {
    if (!isRecording || !speechRecognition) return;
    isRecording = false;
    micBtn.classList.remove('recording');
    micBtn.setAttribute('aria-label', t('mic.record'));
    if (recordingTimeout) clearTimeout(recordingTimeout);
    try {
        speechRecognition.stop();
    } catch (err) {
        console.warn('Speech recognition stop warning:', err);
    }
}

// ═══════════════════════════════════════════════════════════════
// ⭐ CORE: Sequential Block-by-Block HTML Typewriter Engine
// ═══════════════════════════════════════════════════════════════

class HTMLTypewriter {
    constructor(options = {}) {
        this.speed = options.speed || TYPE_SPEED;
        this.onComplete = options.onComplete || null;
        this.onChar = options.onChar || null;
        this.container = null;
        this.fullHTML = '';
        this.isRunning = false;
        this.timer = null;
    }

    async render(markdown, container) {
        this.container = container;
        this.fullHTML = renderMarkdown(markdown);
        this.container.innerHTML = '';
        this.isRunning = true;

        const temp = document.createElement('div');
        temp.innerHTML = this.fullHTML;

        // Process top-level block elements sequentially (h1-h6, p, ul, ol, blockquote, code-block, hr)
        const blocks = Array.from(temp.childNodes);

        for (const blockNode of blocks) {
            if (!this.isRunning) break;
            await this.typeBlockNode(blockNode, this.container);
        }

        this.finish();
    }

    typeBlockNode(node, parentTarget) {
        return new Promise((resolve) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (!text.trim()) {
                    resolve();
                    return;
                }
                this.typeTextNode(text, parentTarget, resolve);
                return;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) {
                resolve();
                return;
            }

            const tagName = node.tagName.toLowerCase();
            const isCodeBlock = node.classList.contains('code-block') || tagName === 'pre';

            // For code blocks and HRs: render immediately full shell, no character delay
            if (isCodeBlock || tagName === 'hr') {
                const clone = node.cloneNode(true);
                parentTarget.appendChild(clone);
                if (isCodeBlock) {
                    highlightCodeBlocks(parentTarget);
                    addCopyButtonsToCodeBlocks(parentTarget);
                }
                if (this.onChar) this.onChar();
                setTimeout(resolve, 30);
                return;
            }

            // For List Containers (<ul> / <ol>): create list shell, then process <li> children sequentially!
            if (tagName === 'ul' || tagName === 'ol') {
                const listEl = document.createElement(tagName);
                listEl.className = node.className;
                parentTarget.appendChild(listEl);

                const items = Array.from(node.children);
                let idx = 0;

                const processNextItem = async () => {
                    if (idx >= items.length || !this.isRunning) {
                        resolve();
                        return;
                    }
                    const itemNode = items[idx++];
                    await this.typeBlockNode(itemNode, listEl);
                    processNextItem();
                };

                processNextItem();
                return;
            }

            // For Block Containers (p, h1-h3, li, blockquote): create element shell empty, then type inline children!
            const elementEl = document.createElement(tagName);
            elementEl.className = node.className;

            // Copy attributes (href, target, etc.)
            for (let i = 0; i < node.attributes.length; i++) {
                const attr = node.attributes[i];
                if (attr.name !== 'class') elementEl.setAttribute(attr.name, attr.value);
            }

            parentTarget.appendChild(elementEl);

            // Stream inline contents (text, strong, em, code, a) inside this element
            const children = Array.from(node.childNodes);
            let childIdx = 0;

            const processNextInlineChild = async () => {
                if (childIdx >= children.length || !this.isRunning) {
                    resolve();
                    return;
                }
                const childNode = children[childIdx++];
                await this.typeInlineNode(childNode, elementEl);
                processNextInlineChild();
            };

            processNextInlineChild();
        });
    }

    typeInlineNode(node, parentTarget) {
        return new Promise((resolve) => {
            if (node.nodeType === Node.TEXT_NODE) {
                this.typeTextNode(node.textContent, parentTarget, resolve);
                return;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                const inlineEl = document.createElement(tag);
                inlineEl.className = node.className;
                for (let i = 0; i < node.attributes.length; i++) {
                    const attr = node.attributes[i];
                    if (attr.name !== 'class') inlineEl.setAttribute(attr.name, attr.value);
                }
                parentTarget.appendChild(inlineEl);

                const text = node.textContent;
                this.typeTextNode(text, inlineEl, resolve);
                return;
            }

            resolve();
        });
    }

    typeTextNode(text, target, onDone) {
        let index = 0;

        const step = () => {
            if (!this.isRunning || index >= text.length) {
                if (onDone) onDone();
                return;
            }

            const char = text[index++];
            target.appendChild(document.createTextNode(char));

            if (this.onChar) this.onChar();

            let delay = this.speed;
            if (char.match(/[\s\n]/)) delay = this.speed * 0.3;
            else if (char.match(/[،.؛:!?]/)) delay = this.speed * 2;
            else if (char.match(/[a-zA-Z]/)) delay = this.speed * 0.8;

            this.timer = setTimeout(step, delay);
        };

        step();
    }

    finish() {
        this.isRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        // Render clean final HTML to ensure exact formatting, links & code highlighting
        this.container.innerHTML = this.fullHTML;

        highlightCodeBlocks(this.container);
        addCopyButtonsToCodeBlocks(this.container);

        const messageDiv = this.container.closest('.message');
        if (messageDiv && !messageDiv.querySelector('.message-toolbar')) {
            const toolbar = createMessageToolbar(this.fullHTML);
            messageDiv.appendChild(toolbar);
        }

        if (this.onComplete) this.onComplete();
        scrollToBottom(true);
    }

    stop() {
        this.isRunning = false;
        if (this.timer) clearTimeout(this.timer);
    }
}

// ═══════════════════════════════════════════════════════════════
// ⭐ MESSAGE HANDLING & STREAMING
// ═══════════════════════════════════════════════════════════════

async function handleSendMessage() {
    const message = chatInput.value.trim();
    const hasFiles = selectedFiles.length > 0;
    if ((!message && !hasFiles) || isProcessing) return;

    if (abortController) {
        abortController.abort();
        abortController = null;
    }

    setProcessingState(true);
    let thinkingDiv = null;

    try {
        const attachmentsForDisplay = hasFiles ? [...selectedFiles] : [];

        addMessage(message, 'user', { attachments: attachmentsForDisplay });
        chatInput.value = '';
        autoResizeTextarea();

        thinkingDiv = createThinkingMessage();
        abortController = new AbortController();

        let response;
        if (hasFiles) {
            const formData = new FormData();
            formData.append('message', message || '');
            formData.append('sessionId', sessionId);
            for (const file of selectedFiles) {
                formData.append('files', file);
            }
            response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                body: formData,
                signal: abortController.signal
            });
        } else {
            response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, sessionId }),
                signal: abortController.signal
            });
        }

        clearSelectedFiles();

        const result = await response.json();

        if (thinkingDiv && thinkingDiv.isConnected) {
            dismissThinkingState(thinkingDiv);
        }

        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || t('error.generic'));
        }

        const fullResponse = result.data?.response || '';
        if (!fullResponse) {
            throw new Error(t('error.generic'));
        }

        await typeHTML(fullResponse);

    } catch (error) {
        console.error('Error sending message:', error);
        if (thinkingDiv && thinkingDiv.isConnected) {
            dismissThinkingState(thinkingDiv);
        }

        let errorMsg = t('error.generic');
        if (error.name === 'AbortError') {
            errorMsg = 'Request was cancelled.';
        } else if (error.message?.includes('ResourceExhausted')) {
            errorMsg = 'The AI model is currently busy. Please try again in a moment.';
        } else if (error.message) {
            errorMsg = error.message;
        }

        addMessage(errorMsg, 'ai', { isError: true });
    } finally {
        abortController = null;
        setProcessingState(false);
        chatInput.focus();
    }
}

// ── File Upload Handling ────────────────────────────────────

function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 5 - selectedFiles.length;
    const newFiles = files.slice(0, remaining);

    selectedFiles.push(...newFiles);
    updateFilePreview();
    fileInput.value = '';
}

function updateFilePreview() {
    filePreviewContainer.innerHTML = '';

    if (selectedFiles.length === 0) {
        filePreviewContainer.style.display = 'none';
        fileBtn.classList.remove('has-files');
        fileBtn.removeAttribute('data-count');
        return;
    }

    filePreviewContainer.style.display = 'flex';
    fileBtn.classList.add('has-files');
    fileBtn.setAttribute('data-count', selectedFiles.length);

    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-preview-item';

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.className = 'file-preview-thumb';
            img.alt = file.name;
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
                file._previewUrl = e.target.result;
            };
            reader.readAsDataURL(file);
            item.appendChild(img);
        } else {
            const ext = file.name.split('.').pop() || 'file';
            item.innerHTML = `
                <div class="file-preview-doc">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span class="file-ext">${escapeHtml(ext)}</span>
                </div>
            `;
        }

        const badge = document.createElement('div');
        badge.className = 'file-badge';
        badge.textContent = file.name;
        item.appendChild(badge);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-preview-remove';
        removeBtn.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', 'Remove file');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedFiles.splice(index, 1);
            updateFilePreview();
        });
        item.appendChild(removeBtn);

        filePreviewContainer.appendChild(item);
    });
}

function clearSelectedFiles() {
    selectedFiles = [];
    updateFilePreview();
    fileInput.value = '';
}

function setProcessingState(processing) {
    isProcessing = processing;
    sendBtn.disabled = processing;
    chatInput.disabled = processing;
    if (processing) {
        sendBtn.classList.add('processing');
    } else {
        sendBtn.classList.remove('processing');
    }
}

function typeHTML(markdown) {
    return new Promise((resolve) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-ai message-streaming';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.dir = detectDirection(markdown);
        messageDiv.appendChild(contentDiv);

        chatMessages.appendChild(messageDiv);
        if (!userScrolledUp) {
            scrollToBottom(true);
        } else {
            hasNewMessage = true;
            if (scrollBottomBtn) scrollBottomBtn.classList.add('has-new');
        }

        const writer = new HTMLTypewriter({
            speed: TYPE_SPEED,
            onComplete: () => {
                resolve();
            },
            onChar: () => {
                if (!userScrolledUp) {
                    scrollToBottom(false);
                }
            }
        });

        writer.render(markdown, contentDiv);
    });
}

// ── Thinking State ──────────────────────────────────────────

function createThinkingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-ai message-thinking';
    messageDiv.id = 'thinking-message-' + Date.now();

    const thinkingWrap = document.createElement('div');
    thinkingWrap.className = 'thinking-indicator';
    thinkingWrap.innerHTML = `
        <span class="thinking-orb">
            <span class="thinking-orb-core"></span>
            <span class="thinking-orb-ring"></span>
            <span class="thinking-orb-ring thinking-orb-ring-delay"></span>
        </span>
        <span class="thinking-text">${escapeHtml(t('thinking.text'))}</span>
        <span class="thinking-dots">
            <span></span>
            <span></span>
            <span></span>
        </span>
    `;
    messageDiv.appendChild(thinkingWrap);
    chatMessages.appendChild(messageDiv);
    scrollToBottom(true);
    return messageDiv;
}

function dismissThinkingState(thinkingDiv) {
    if (!thinkingDiv || !thinkingDiv.isConnected) return;
    thinkingDiv.classList.add('is-leaving');
    thinkingDiv.addEventListener('animationend', () => thinkingDiv.remove(), { once: true });
    setTimeout(() => thinkingDiv.remove(), 350);
}

// ── Add Message (Static) ────────────────────────────────────

function addMessage(content, sender, options = {}) {
    const { isError = false, attachments = [] } = options;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${sender}`;
    if (isError) messageDiv.classList.add('message-error');

    if (attachments.length > 0) {
        messageDiv.insertAdjacentHTML('beforeend', renderAttachmentCards(attachments));
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.dir = detectDirection(content);

    if (sender === 'ai') {
        if (isError) {
            contentDiv.innerHTML = warningIconSVG() + renderMarkdown(content);
        } else {
            contentDiv.innerHTML = renderMarkdown(content);
        }
        messageDiv.appendChild(contentDiv);
        highlightCodeBlocks(contentDiv);
        addCopyButtonsToCodeBlocks(contentDiv);
        if (!isError) messageDiv.appendChild(createMessageToolbar(content));
    } else {
        if (content) {
            contentDiv.textContent = content;
            messageDiv.appendChild(contentDiv);
        }
    }

    chatMessages.appendChild(messageDiv);
    if (!userScrolledUp) {
        scrollToBottom(true);
    } else if (sender === 'ai') {
        hasNewMessage = true;
        if (scrollBottomBtn) scrollBottomBtn.classList.add('has-new');
    }
    return messageDiv;
}

// ── Toolbar & Copy ──────────────────────────────────────────

function createMessageToolbar(rawText) {
    const toolbar = document.createElement('div');
    toolbar.className = 'message-toolbar';
    toolbar.innerHTML = `
        <button class="message-copy-btn" aria-label="Copy response" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy</span>
        </button>
    `;

    toolbar.querySelector('.message-copy-btn').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        copyToClipboard(rawText).then(() => {
            const label = btn.querySelector('span');
            const original = label.textContent;
            label.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                label.textContent = original;
                btn.classList.remove('copied');
            }, 1800);
        });
    });

    return toolbar;
}

// ═══════════════════════════════════════════════════════════════
// ⭐ MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════

function renderInline(text) {
    let out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="markdown-link">$1</a>');
    return out;
}

const CALLOUT_ICONS = {
    note: `<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    tip: `<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-4 10.5c.6.5 1 1.3 1 2.1V16h6v-1.4c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 2z"/></svg>`,
    warning: warningIconSVG().replace('style="flex-shrink:0;margin-right:6px;vertical-align:-3px;"', 'class="callout-icon"'),
    important: `<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`
};

function renderCallout(type, text) {
    const icon = CALLOUT_ICONS[type] || CALLOUT_ICONS.note;
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    return `<div class="callout callout-${type}">${icon}<div class="callout-body"><p><strong>${label}:</strong> ${renderInline(text)}</p></div></div>`;
}

function renderTable(headers, rows) {
    const thead = `<thead><tr>${headers.map(h => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<div class="markdown-table-wrap"><table class="markdown-table">${thead}${tbody}</table></div>`;
}

function renderMarkdown(markdown) {
    if (!markdown) return '';

    let html = markdown;
    const codeBlocks = [];

    // Extract Fenced Code Blocks (```lang ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const index = codeBlocks.length;
        codeBlocks.push({
            lang: lang.trim() || 'plaintext',
            code: code.replace(/\n$/, '')
        });
        return `\u0000CODEBLOCK${index}\u0000`;
    });

    // Extract Tables (GFM pipe tables) before escaping
    const tables = [];
    html = html.replace(/^\|(.+)\|\s*\n\|[\s:|-]+\|\s*\n((?:\|.*\|\s*\n?)*)/gm, (match, headerRow, bodyRows) => {
        const index = tables.length;
        const headers = headerRow.split('|').map(c => c.trim()).filter(c => c.length);
        const rows = bodyRows.trim().split('\n').filter(r => r.trim()).map(r =>
            r.split('|').map(c => c.trim()).filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''))
        );
        tables.push({ headers, rows });
        return `\u0000TABLE${index}\u0000`;
    });

    // Extract callouts: > **Note:** ... / **Tip:** / **Warning:** / **Important:**
    const callouts = [];
    html = html.replace(/^> \*\*(Note|Tip|Warning|Important)\*\*:?\s*(.+)$/gim, (match, type, text) => {
        const index = callouts.length;
        callouts.push({ type: type.toLowerCase(), text });
        return `\u0000CALLOUT${index}\u0000`;
    });

    html = escapeHtml(html);

    // Inline Code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bold & Italics
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3 class="markdown-h3">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="markdown-h2">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="markdown-h1">$1</h1>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="markdown-link">$1</a>'
    );

    // Unordered Lists
    html = html.replace(/^[ \t]*[-*+] (.+)$/gm, '<li class="ul-item">$1</li>');
    html = html.replace(/((?:<li class="ul-item">.*<\/li>\s*)+)/g, '<ul class="markdown-list">$1</ul>');
    html = html.replace(/\s*class="ul-item"/g, '');

    // Ordered Lists
    html = html.replace(/^[ \t]*(\d+)\. (.+)$/gm, '<li class="ol-item">$1</li>');
    html = html.replace(/((?:<li class="ol-item">.*<\/li>\s*)+)/g, '<ol class="markdown-list">$1</ol>');
    html = html.replace(/\s*class="ol-item"/g, '');

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="markdown-blockquote">$1</blockquote>');

    // Horizontal Rules
    html = html.replace(/^---$/gm, '<hr class="markdown-hr">');
    html = html.replace(/^\*\*\*$/gm, '<hr class="markdown-hr">');
    html = html.replace(/^___$/gm, '<hr class="markdown-hr">');

    // Paragraphs & Line Breaks
    html = html.replace(/\n\n+/g, '</p><p class="markdown-paragraph">');
    html = html.replace(/\n/g, '<br>');

    if (!html.startsWith('<p') && !html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<blockquote')) {
        html = `<p class="markdown-paragraph">${html}</p>`;
    }

    // Clean up excessive <br> tags around block elements
    html = html.replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br>');
    html = html.replace(/<(h[1-6]|ul|ol|li|blockquote|div|p|hr)[^>]*>\s*<br\s*\/?>/gi, '<$1>');
    html = html.replace(/<br\s*\/?>\s*<\/(h[1-6]|ul|ol|li|blockquote|div|p)>/gi, '</$1>');
    html = html.replace(/<\/(h[1-6]|ul|ol|blockquote|div|hr)>\s*<br\s*\/?>/gi, '</$1>');

    // Re-insert Code Blocks
    html = html.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (match, idx) => {
        const { lang, code } = codeBlocks[Number(idx)];
        return renderCodeBlock(lang, code);
    });

    // Re-insert Tables
    html = html.replace(/(?:<p class="markdown-paragraph">)?\u0000TABLE(\d+)\u0000(?:<\/p>)?/g, (match, idx) => {
        const { headers, rows } = tables[Number(idx)];
        return renderTable(headers, rows);
    });

    // Re-insert Callouts
    html = html.replace(/(?:<p class="markdown-paragraph">)?\u0000CALLOUT(\d+)\u0000(?:<\/p>)?/g, (match, idx) => {
        const { type, text } = callouts[Number(idx)];
        return renderCallout(type, text);
    });

    return html;
}

function renderCodeBlock(lang, code) {
    const escapedCode = escapeHtml(code);
    const langDisplay = lang === 'plaintext' ? 'Text' : lang.toUpperCase();
    const lines = code.split('\n').length;
    const chars = code.length;

    return `
        <div class="code-block" dir="ltr">
            <div class="code-block-header">
                <div class="code-block-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span class="code-block-lang">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                    </svg>
                    ${escapeHtml(langDisplay)}
                </span>
                <button class="code-block-copy" type="button">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Copy</span>
                </button>
            </div>
            <pre><code class="language-${escapeHtml(lang)}">${escapedCode}</code></pre>
            <div class="code-block-footer">
                <span>${lines} lines</span>
                <span>${chars} characters</span>
            </div>
        </div>
    `;
}

function highlightCodeBlocks(container) {
    container.querySelectorAll('.code-block code').forEach(codeEl => {
        if (window.hljs) {
            try {
                window.hljs.highlightElement(codeEl);
            } catch (e) {}
        }
    });
}

function addCopyButtonsToCodeBlocks(container) {
    container.querySelectorAll('.code-block').forEach(block => {
        const copyBtn = block.querySelector('.code-block-copy');
        const codeEl = block.querySelector('code');
        if (copyBtn && codeEl) {
            copyBtn.addEventListener('click', () => {
                const text = codeEl.textContent;
                copyToClipboard(text).then(() => {
                    const label = copyBtn.querySelector('span');
                    const original = label.textContent;
                    label.textContent = 'Copied!';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        label.textContent = original;
                        copyBtn.classList.remove('copied');
                    }, 1800);
                });
            });
        }
    });
}

// ─── DOM Ready Setup ────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    applyLanguage(currentLang);
    setupEventListeners();
    autoResizeTextarea();
    chatInput.focus();
    setupScrollObserver();
    setupScrollBottomBtn();

    // Show empty state — do NOT auto-add welcome message here;
    // welcome message appears only when user clears chat.
});

function ensureEmptyState() {
    if (!document.getElementById('emptyState')) {
        const div = document.createElement('div');
        div.className = 'empty-state';
        div.id = 'emptyState';
        div.innerHTML = `
            <div class="empty-state-glyph" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="6" cy="6" r="2.6"/>
                    <circle cx="6" cy="18" r="2.6"/>
                    <circle cx="18" cy="12" r="2.6"/>
                    <path d="M6 8.6V15.4"/>
                    <path d="M8.4 7.2L15.6 10.8"/>
                    <path d="M8.4 16.8L15.6 13.2"/>
                </svg>
            </div>
            <h2 class="empty-state-title">${escapeHtml(t('empty.title'))}</h2>
            <p class="empty-state-subtitle">${escapeHtml(t('empty.subtitle'))}</p>
        `;
        chatMessages.appendChild(div);
    }
}

function setupScrollBottomBtn() {
    if (!scrollBottomBtn) return;
    scrollBottomBtn.addEventListener('click', () => {
        userScrolledUp = false;
        hasNewMessage = false;
        scrollBottomBtn.classList.remove('has-new');
        scrollToBottom(true, true);
    });
}

// Are we (close enough to) the bottom, checking whichever element is the
// real scroller: the window, or the inner .chat-messages container.
function isNearBottom() {
    const containerScrollable = chatMessages.scrollHeight > chatMessages.clientHeight + 4;

    if (containerScrollable) {
        return (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight) < 120;
    }

    const doc = document.documentElement;
    return (doc.scrollHeight - window.scrollY - window.innerHeight) < 120;
}

function updateScrollState() {
    const atBottom = isNearBottom();
    userScrolledUp = !atBottom;

    if (scrollBottomBtn) {
        scrollBottomBtn.classList.toggle('visible', !atBottom);
    }

    if (atBottom) {
        hasNewMessage = false;
        if (scrollBottomBtn) scrollBottomBtn.classList.remove('has-new');
    }
}

function setupScrollObserver() {
    let ticking = false;
    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            updateScrollState();
            ticking = false;
        });
    };

    // Listen on both — only one of them will actually fire depending on
    // which element ends up scrollable, but that's fine either way.
    window.addEventListener('scroll', onScroll, { passive: true });
    chatMessages.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // Initial state
    updateScrollState();
}

function setupEventListeners() {
    sendBtn.addEventListener('click', handleSendMessage);

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    micBtn.addEventListener('click', toggleRecording);
    chatInput.addEventListener('input', autoResizeTextarea);
    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    if (langToggle) {
        langToggle.addEventListener('click', () => {
            applyLanguage(currentLang === 'en' ? 'ar' : 'en');
        });
    }

    // Wire navbar clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearConversationHistory);
    }

    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled rejection:', e.reason);
    });
}

async function clearConversationHistory() {
    if (!confirm(t('clear.confirm'))) return;
    try {
        await fetch(`${API_BASE_URL}/chat/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        chatMessages.innerHTML = '';
        ensureEmptyState();
    } catch (error) {
        console.error('Failed to clear history:', error);
    }
}