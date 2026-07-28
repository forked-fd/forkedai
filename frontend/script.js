// ═══════════════════════════════════════════════════════════════
// Forked AI — Client-Side Application Engine (Clean Source)
// ═══════════════════════════════════════════════════════════════

const API_BASE_URL = 'https://forkedai.vercel.app/api';
const MAX_RECORDING_MS = 60 * 1000; // 60 seconds max voice recording
const TYPE_SPEED = 26; // base ms delay PER TOKEN (word), not per character

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
        'composer.placeholder': 'Ask Forked AI anything...',
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
        'error.file.unsupported': 'Unsupported file type. Please upload code, images, PDFs, or ZIP files.',
        'error.file.tooLarge': 'File too large. Maximum size is 25MB.',
        'error.file.tooMany': 'Too many files. Maximum 5 files per request.',
        'status.online': 'Online & Ready',
        'status.offline': 'No internet connection.',
        'welcome.text': 'Hello! How can I assist you today?',
        'lang.switchTo': 'العربية',
        'clear.history': 'Clear Chat',
        'clear.confirm': 'Are you sure you want to clear conversation history?'
    },
    ar: {
        dir: 'rtl',
        'nav.home': 'الرئيسية',
        'hero.title': 'مرحباً بك في Forked AI',
        'hero.subtitleHtml': 'مساعدك الذكي لـ <span class="highlight-word">الذكاء الاصطناعي</span> · <span class="highlight-word">تعلم الآلة</span> · <span class="highlight-word">علوم البيانات</span> · <span class="highlight-word">البرمجة</span>',
        'composer.placeholder': 'اسأل Forked AI أي حاجة...',
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
        'error.file.unsupported': 'نوع الملف غير مدعوم. يرجى رفع ملفات برمجية، صور، PDF، أو ملفات مضغوطة ZIP.',
        'error.file.tooLarge': 'الملف كبير جداً. الحد الأقصى 25 ميجابايت.',
        'error.file.tooMany': 'عدد الملفات كبير جداً. الحد الأقصى 5 ملفات لكل طلب.',
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
        const isZip = file.name.toLowerCase().endsWith('.zip');
        const isCode = /\.(js|jsx|ts|tsx|vue|html|htm|css|scss|sass|less|py|rb|php|java|kt|kts|go|rs|c|h|cpp|cc|hpp|cs|swift|m|scala|sql|sh|bash|pl|lua|r|dart|xml|yaml|yml|toml|ini|env|conf|log|gitignore|dockerfile|tex|rst|json|json5|graphql|gql|proto|tf|tfvars|hcl|makefile|mk|cmake|gradle|nim|crystal|cr|zig|v|vv|gleam|res|resi|fs|fsx|fsi|ex|exs|erl|hrl|clj|cljs|cljc|edn|cob|cbl|for|f90|f95|asm|s|nasm|ps1|psm1|psd1|ahk|bat|cmd|awk|sed|r|rmd|jl|d|ada|adb|ads|vhd|vhdl|sv|svh|cuda|cu|cuh|opencl|cl|webidl|idl|wast|wat|fsharp|editorconfig|prettierrc|eslintrc|babelrc|stylelintrc|huskyrc|lintstagedrc|npmrc|yarnrc|pnp\.js|pnp\.cjs|ipynb)$/i.test(file.name);
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const isTxt = file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.md');
        
        let iconInner = fileIconSVG();
        
        if (isImage && file._previewUrl) {
            iconInner = `<img src="${file._previewUrl}" alt="${escapeHtml(file.name)}">`;
        } else if (isZip) {
            iconInner = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16v16H4z M8 8h8v8H8z M12 8v8 M8 12h8"/>
                <path d="M4 8h2M4 12h2M4 16h2M18 8h2M18 12h2M18 16h2"/>
            </svg>`;
        } else if (isCode) {
            iconInner = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
            </svg>`;
        } else if (isPdf) {
            iconInner = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M8 17v-4h1.5a1.5 1.5 0 010 3H8"/>
                <path d="M13 13v4h1a1.5 1.5 0 000-4h-1z"/>
            </svg>`;
        } else if (isTxt) {
            iconInner = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/>
                <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>`;
        }
        
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

// ═══════════════════════════════════════════════════════════════
// ⭐ TOKEN CLEANING & LIVE HIGHLIGHTING
// Every token is sanitized and (when relevant) highlighted BEFORE
// it's ever appended to the DOM — so what streams in is already
// clean, never a "flash of raw text" that gets fixed up later.
// ═══════════════════════════════════════════════════════════════

// STAGE 1 — Whitespace normalization: collapse duplicated spaces/tabs.
// (Line-break collapsing happens once at the markdown level, before
// tokens are cut, so this only needs to handle intra-token spacing.)
const WHITESPACE_RE = /[ \t]{2,}/g;

// STAGE 2 — Invisible / malformed Unicode: zero-width & bidi-control
// characters and the U+FFFD replacement character that sometimes leak
// out of model output and render as invisible junk or empty "boxes".
const ZERO_WIDTH_RE   = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const REPLACEMENT_RE  = /[\uFFFD]/g;

// STAGE 3 — Stray decorative/box-drawing glyphs that occasionally leak
// in as "weird symbols" (e.g. ▢ ◆ ▪ ➤ ✦ …) when not meant as real
// content. Deliberately narrow ranges so legitimate Markdown symbols
// (-, *, #, >, `, |, etc.) are never touched.
const STRAY_GLYPH_RE  = /[\u25A0-\u25FF\u2B00-\u2BFF\u2700-\u27BF]/g;

// STAGE 4 — Punctuation normalization: anything hammered more than
// twice in a row ("!!!!", "......", "؟؟؟؟") gets capped at two —
// keeps emphasis readable without looking broken or spammy.
const REPEATED_PUNCT_RE = /([!?.,؛،:])\1{2,}/g;

/**
 * Runs a single streamed token through stages 1–4 before it is ever
 * appended to the DOM: normalize whitespace, strip invisible/malformed
 * Unicode, remove stray decorative glyphs, and normalize punctuation.
 * No raw token is ever rendered before passing through here.
 */
function cleanStreamToken(raw) {
    if (!raw) return raw;
    return raw
        .replace(ZERO_WIDTH_RE, '')
        .replace(REPLACEMENT_RE, '')
        .replace(STRAY_GLYPH_RE, '')
        .replace(REPEATED_PUNCT_RE, '$1$1')
        .replace(WHITESPACE_RE, ' ');
}

// STAGE 5 — Important-token detection. Each pattern below targets one
// category the response might contain; a token only needs to match one
// to be considered "important" and get the elegant inline highlight.
const IMPORTANT_TOKEN_PATTERNS = [
    /^[+-]?\$?\d[\d,]*\.?\d*[%°]?$/,                       // numbers, percentages, degrees
    /^[+-]?[€£¥₹]\s?\d[\d,]*\.?\d*$/,                       // currencies
    /^\$\d[\d,]*\.?\d*[kKmMbB]?$/,                          // $ amounts incl. shorthand (e.g. $4.2M)
    /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/,                  // dates (10/26/2026, 2026-07-27)
    /^(19|20)\d{2}$/,                                        // bare years
    /^[A-Z]{2,8}(-\d+)?$/,                                  // acronyms / model-ish names (API, GPT-5)
    /^v?\d+\.\d+(\.\d+)?$/i,                                // version numbers (v2.1, 4.6.0)
    /^https?:\/\/\S+$/i,                                     // URLs
    /^[\w.-]+\.(js|ts|tsx|jsx|py|go|rs|css|html|json|md|yml|yaml|sql|java|cpp|c|h|rb|php|sh)$/i, // filenames
    /^@?[\w-]+\/[\w.-]+$/,                                  // package names (react/dom, @scope/pkg)
    /^[A-Z][a-zA-Z0-9]*(\.[A-Z][a-zA-Z0-9]*)+$/,            // Namespaced/class refs (React.Component)
    /^[a-z][a-zA-Z0-9]*\(\)$/,                              // function calls (useEffect())
    /^`?(Ctrl|Cmd|Alt|Shift|⌘|⌥|⌃)[+-]/i,                   // keyboard shortcuts
    /^(Python|JavaScript|TypeScript|React|Vue|Angular|Node\.js|Rust|Go|Swift|Kotlin|Java|C\+\+|C#|Docker|Kubernetes|GraphQL|SQL)$/i, // languages/frameworks
];

/**
 * Turns a cleaned token into the DOM node that actually gets appended
 * (Stage 6 — render) — plain text normally, or a highlighted <span>
 * the moment it matches one of the important-token patterns above.
 * The highlight is a restrained inline treatment, not a flashy one.
 */
function styleStreamToken(cleanText) {
    const trimmed = cleanText.trim().replace(/^[([{"']+|[)\]}"',.;:!?]+$/g, '');
    if (trimmed && IMPORTANT_TOKEN_PATTERNS.some(re => re.test(trimmed))) {
        const span = document.createElement('span');
        span.className = 'stream-highlight';
        span.textContent = cleanText;
        return span;
    }
    return document.createTextNode(cleanText);
}

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

            // For code blocks: type the code itself out character by character
            // (plain text, no highlighting yet) so it appears progressively
            // like the rest of the answer, then syntax-highlight once done.
            if (isCodeBlock) {
                const clone = node.cloneNode(true);
                parentTarget.appendChild(clone);

                const codeEl = clone.querySelector('code');
                const fullCodeText = codeEl ? codeEl.textContent : '';

                if (!codeEl || !fullCodeText) {
                    if (this.onChar) this.onChar();
                    setTimeout(resolve, 30);
                    return;
                }

                codeEl.textContent = '';
                // Code streams a bit faster than prose — long blocks
                // shouldn't take forever to "write out".
                const codeCharDelay = Math.max(2, this.speed * 0.3);
                let ci = 0;

                const typeCodeChar = () => {
                    if (!this.isRunning) { resolve(); return; }
                    if (ci >= fullCodeText.length) {
                        if (window.hljs) {
                            try { window.hljs.highlightElement(codeEl); } catch (e) {}
                        }
                        wireCodeBlockCopyButton(clone);
                        resolve();
                        return;
                    }
                    codeEl.appendChild(document.createTextNode(fullCodeText[ci++]));
                    if (this.onChar) this.onChar();
                    this.timer = setTimeout(typeCodeChar, codeCharDelay);
                };
                typeCodeChar();
                return;
            }

            // HRs: render immediately, no character delay
            if (tagName === 'hr') {
                const clone = node.cloneNode(true);
                parentTarget.appendChild(clone);
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

    // Streams TEXT ONE TOKEN AT A TIME (word-by-word, not char-by-char).
    // Each raw token is run through cleanStreamToken() to strip stray
    // whitespace / invisible junk / weird symbols, then through
    // styleStreamToken() to highlight it if it looks important —
    // both BEFORE it's ever appended to the DOM.
    typeTextNode(text, target, onDone) {
        // Tokenize into runs of whitespace and runs of non-whitespace.
        const rawTokens = text.match(/\s+|\S+/g) || [];
        let index = 0;

        const step = () => {
            if (!this.isRunning || index >= rawTokens.length) {
                if (onDone) onDone();
                return;
            }

            const rawToken = rawTokens[index++];
            const isWhitespace = /^\s+$/.test(rawToken);
            const cleanToken = isWhitespace ? ' ' : cleanStreamToken(rawToken);

            if (cleanToken) {
                target.appendChild(isWhitespace
                    ? document.createTextNode(cleanToken)
                    : styleStreamToken(cleanToken));
            }

            if (this.onChar) this.onChar();

            // Pacing: whitespace is near-instant, punctuation-ending
            // tokens get a beat to breathe, longer words take a hair
            // longer than short ones — but it's all per-TOKEN, not per
            // character, so the reveal reads like real model streaming.
            let delay = this.speed;
            if (isWhitespace) {
                delay = this.speed * 0.25;
            } else if (/[،.؛:!?]$/.test(cleanToken.trim())) {
                delay = this.speed * 2.2;
            } else {
                const len = cleanToken.trim().length;
                delay = this.speed * (0.55 + Math.min(len, 10) * 0.06);
            }

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
            const toolbar = createMessageToolbar(this.fullHTML, this.container);
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

// Folds the hero away the moment the first message is sent, so the chat
// visibly takes over the workspace instead of just appearing below it.
function collapseHero() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.classList.contains('hero-hidden')) return;
    const currentHeight = hero.getBoundingClientRect().height;
    hero.style.maxHeight = currentHeight + 'px';
    // Force a reflow so the browser registers the explicit max-height
    // before we flip it to 0 — otherwise there's nothing to transition from.
    void hero.offsetHeight;
    hero.classList.add('hero-hidden');
}

async function handleSendMessage() {
    const message = chatInput.value.trim();
    const hasFiles = selectedFiles.length > 0;
    if ((!message && !hasFiles) || isProcessing) return;

    collapseHero();

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

    // التحقق من الحد الأقصى للملفات
    const remaining = 5 - selectedFiles.length;
    if (remaining <= 0) {
        alert(t('error.file.tooMany'));
        fileInput.value = '';
        return;
    }

    const validFiles = [];
    const invalidFiles = [];

    for (const file of files) {
        // التحقق من حجم الملف (25MB كحد أقصى)
        if (file.size > 25 * 1024 * 1024) {
            invalidFiles.push(`${file.name} (${formatFileSize(file.size)})`);
            continue;
        }
        validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
        alert(`⚠️ ${t('error.file.tooLarge')}\n${invalidFiles.join('\n')}`);
    }

    const newFiles = validFiles.slice(0, remaining);
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
            const isCode = /\.(js|jsx|ts|tsx|vue|html|htm|css|scss|sass|less|py|rb|php|java|kt|kts|go|rs|c|h|cpp|cc|hpp|cs|swift|m|scala|sql|sh|bash|pl|lua|r|dart|xml|yaml|yml|toml|ini|env|conf|log|gitignore|dockerfile|tex|rst|json|json5|graphql|gql|proto|tf|tfvars|hcl|makefile|mk|cmake|gradle|nim|crystal|cr|zig|v|vv|gleam|res|resi|fs|fsx|fsi|ex|exs|erl|hrl|clj|cljs|cljc|edn|cob|cbl|for|f90|f95|asm|s|nasm|ps1|psm1|psd1|ahk|bat|cmd|awk|sed|r|rmd|jl|d|ada|adb|ads|vhd|vhdl|sv|svh|cuda|cu|cuh|opencl|cl|webidl|idl|wast|wat|fsharp|editorconfig|prettierrc|eslintrc|babelrc|stylelintrc|huskyrc|lintstagedrc|npmrc|yarnrc|pnp\.js|pnp\.cjs|ipynb)$/i.test(file.name);
            const isZip = file.name.toLowerCase().endsWith('.zip');
            const isPdf = file.name.toLowerCase().endsWith('.pdf');
            
            let icon = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
            `;
            
            if (isCode) {
                icon = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                    </svg>
                `;
            } else if (isZip) {
                icon = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 4h16v16H4z M8 8h8v8H8z M12 8v8 M8 12h8"/>
                        <path d="M4 8h2M4 12h2M4 16h2M18 8h2M18 12h2M18 16h2"/>
                    </svg>
                `;
            } else if (isPdf) {
                icon = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <path d="M8 17v-4h1.5a1.5 1.5 0 010 3H8"/>
                        <path d="M13 13v4h1a1.5 1.5 0 000-4h-1z"/>
                    </svg>
                `;
            }
            
            item.innerHTML = `
                <div class="file-preview-doc">
                    ${icon}
                    <span class="file-ext">${escapeHtml(ext.toUpperCase())}</span>
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
        messageDiv.className = 'message message-ai message-streaming reveal-on-scroll';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.dir = detectDirection(markdown);
        messageDiv.appendChild(contentDiv);

        chatMessages.appendChild(messageDiv);
        revealOnScroll(messageDiv);
        document.body.classList.add('is-typing');

        if (!userScrolledUp) {
            scrollToBottom(true);
        } else {
            hasNewMessage = true;
            if (scrollBottomBtn) scrollBottomBtn.classList.add('has-new');
        }

        const writer = new HTMLTypewriter({
            speed: TYPE_SPEED,
            onComplete: () => {
                document.body.classList.remove('is-typing');
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
    document.body.classList.add('is-thinking');
    return messageDiv;
}

function dismissThinkingState(thinkingDiv) {
    document.body.classList.remove('is-thinking');
    if (!thinkingDiv || !thinkingDiv.isConnected) return;
    thinkingDiv.classList.add('is-leaving');
    thinkingDiv.addEventListener('animationend', () => thinkingDiv.remove(), { once: true });
    setTimeout(() => thinkingDiv.remove(), 350);
}

// ── Add Message (Static) ────────────────────────────────────

function addMessage(content, sender, options = {}) {
    const { isError = false, attachments = [] } = options;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${sender} reveal-on-scroll`;
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
        if (!isError) messageDiv.appendChild(createMessageToolbar(content, contentDiv));
    } else {
        if (content) {
            contentDiv.textContent = content;
            messageDiv.appendChild(contentDiv);
        }
    }

    chatMessages.appendChild(messageDiv);
    revealOnScroll(messageDiv);
    if (!userScrolledUp) {
        scrollToBottom(true);
    } else if (sender === 'ai') {
        hasNewMessage = true;
        if (scrollBottomBtn) scrollBottomBtn.classList.add('has-new');
    }
    return messageDiv;
}

// ── Toolbar: Copy / Download TXT / Download PDF / Share ─────────

/**
 * Walks a rendered message DOM and produces clean plain text:
 * no HTML tags, no markdown symbols, correct line breaks preserved.
 */
function elementToPlainText(el) {
    if (!el) return '';
    const BLOCK_TAGS = new Set(['P','DIV','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','PRE','TR','TABLE','UL','OL','HR']);
    let out = '';

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            out += node.textContent;
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName;
        if (tag === 'BR') { out += '\n'; return; }
        if (node.classList && node.classList.contains('code-block-header')) return; // skip lang/copy chrome
        if (node.classList && node.classList.contains('code-block-footer')) return;

        if (tag === 'LI') out += '• ';

        node.childNodes.forEach(walk);

        if (tag === 'PRE' || tag === 'CODE') {
            if (tag === 'PRE') out += '\n';
        } else if (BLOCK_TAGS.has(tag)) {
            out += '\n';
            if (tag === 'P' || tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'BLOCKQUOTE' || tag === 'TABLE') out += '\n';
        }
    }

    el.childNodes.forEach(walk);

    return out
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

function getTimestampFilename(ext) {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
    return `ForkedAI-${stamp}.${ext}`;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadAsTXT(plainText) {
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, getTimestampFilename('txt'));
}

const PDF_PRINT_CSS = `
  @page { margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body {
    background: #0c0f1a;
    color: #e2e6f3;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    font-size: 13.5px;
    line-height: 1.7;
    padding: 0;
    margin: 0;
  }
  .pdf-header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 22px; padding-bottom: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.14);
  }
  .pdf-brand { font-weight: 700; font-size: 15px; color: #fff; letter-spacing: -0.2px; }
  .pdf-date { margin-left: auto; font-size: 11px; color: #8892aa; }
  .pdf-body h1, .pdf-body h2, .pdf-body h3 { color: #fff; margin: 18px 0 8px; line-height: 1.3; }
  .pdf-body h1 { font-size: 21px; } .pdf-body h2 { font-size: 18px; } .pdf-body h3 { font-size: 15px; }
  .pdf-body p { margin: 0 0 10px; }
  .pdf-body ul, .pdf-body ol { margin: 0 0 12px; padding-left: 22px; }
  .pdf-body li { margin-bottom: 4px; }
  .pdf-body blockquote {
    margin: 12px 0; padding: 8px 14px; border-left: 3px solid #4D94FF;
    color: #b7bfd6; background: rgba(255,255,255,0.03); break-inside: avoid;
  }
  .pdf-body table { border-collapse: collapse; width: 100%; margin: 12px 0; break-inside: avoid; }
  .pdf-body th, .pdf-body td { border: 1px solid rgba(255,255,255,0.15); padding: 6px 10px; text-align: left; font-size: 12.5px; }
  .pdf-body th { background: rgba(255,255,255,0.06); color: #fff; }
  .pdf-body .code-block { break-inside: avoid; margin: 12px 0; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); background: #0d1117; }
  .pdf-body .code-block-header { display: flex; justify-content: space-between; padding: 6px 12px; background: rgba(255,255,255,0.05); font-size: 10.5px; color: #8892aa; }
  .pdf-body .code-block-copy { display: none; }
  .pdf-body .code-block-footer { display: none; }
  .pdf-body .code-block pre { margin: 0; padding: 12px 14px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .pdf-body .inline-code { font-family: "JetBrains Mono", ui-monospace, monospace; background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .pdf-body hr { border: none; border-top: 1px solid rgba(255,255,255,0.15); margin: 16px 0; }
  .pdf-body a { color: #4D94FF; }
`;

function downloadAsPDF(contentEl) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const dateStr = new Date().toLocaleString();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Forked AI Export</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
        <style>${PDF_PRINT_CSS}</style>
        </head><body>
        <div class="pdf-header"><span class="pdf-brand">Forked AI</span><span class="pdf-date">${dateStr}</span></div>
        <div class="pdf-body">${contentEl.innerHTML}</div>
        </body></html>`;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (err) {
            console.warn('PDF export print failed:', err);
        }
        setTimeout(() => iframe.remove(), 2000);
    };

    // Give the highlight.js stylesheet a moment to load before printing
    setTimeout(triggerPrint, 400);
}

function shareMessage(plainText) {
    if (navigator.share) {
        navigator.share({ text: plainText, title: 'Forked AI' }).catch(() => {});
        return Promise.resolve('native');
    }
    return copyToClipboard(plainText).then(() => 'copied');
}

function flashToolbarFeedback(btn, text) {
    let tip = btn.querySelector('.toolbar-feedback');
    if (!tip) {
        tip = document.createElement('span');
        tip.className = 'toolbar-feedback';
        btn.appendChild(tip);
    }
    tip.textContent = text;
    requestAnimationFrame(() => tip.classList.add('show'));
    btn.classList.add('success');
    clearTimeout(btn._feedbackTimer);
    btn._feedbackTimer = setTimeout(() => {
        tip.classList.remove('show');
        btn.classList.remove('success');
    }, 1600);
}

const TOOLBAR_ICONS = {
    copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    txt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`,
    pdf: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 17v-4h1.5a1.5 1.5 0 0 1 0 3H8"/><path d="M13 13v4h1a1.5 1.5 0 0 0 0-4h-1z"/></svg>`,
    share: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>`
};

function createMessageToolbar(rawMarkdown, contentEl) {
    const toolbar = document.createElement('div');
    toolbar.className = 'message-toolbar';

    const buttons = [
        { key: 'copy',  label: 'Copy response' },
        { key: 'txt',   label: 'Download as TXT' },
        { key: 'pdf',   label: 'Download as PDF' },
        { key: 'share', label: 'Share' }
    ];

    buttons.forEach(({ key, label }) => {
        const btn = document.createElement('button');
        btn.className = 'message-toolbar-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', label);
        btn.title = label;
        btn.innerHTML = TOOLBAR_ICONS[key];
        toolbar.appendChild(btn);

        btn.addEventListener('click', () => {
            const plainText = contentEl ? elementToPlainText(contentEl) : rawMarkdown;

            if (key === 'copy') {
                copyToClipboard(plainText).then(() => flashToolbarFeedback(btn, 'Copied!'));
            } else if (key === 'txt') {
                downloadAsTXT(plainText);
                flashToolbarFeedback(btn, 'Saved!');
            } else if (key === 'pdf') {
                downloadAsPDF(contentEl);
                flashToolbarFeedback(btn, 'Exporting…');
            } else if (key === 'share') {
                shareMessage(plainText).then((mode) => {
                    flashToolbarFeedback(btn, mode === 'copied' ? 'Copied!' : 'Shared!');
                });
            }
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

function wireCodeBlockCopyButton(block) {
    const copyBtn = block.querySelector('.code-block-copy');
    const codeEl = block.querySelector('code');
    if (copyBtn && codeEl && !copyBtn.dataset.wired) {
        copyBtn.dataset.wired = '1';
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
}

function addCopyButtonsToCodeBlocks(container) {
    container.querySelectorAll('.code-block').forEach(wireCodeBlockCopyButton);
}

// ─── DOM Ready Setup ────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    applyLanguage(currentLang);
    setupEventListeners();
    autoResizeTextarea();
    chatInput.focus();
    setupScrollObserver();
    setupScrollBottomBtn();
    setupRevealObserver();
    setupMouseGlow();
    setupCustomCursor();
    setupParticleNetwork();
    ensureEmptyState();

    // Do NOT auto-add a welcome message here — the empty state above
    // covers first-load; a welcome message only re-appears after Clear.
});

// ── Scroll Reveal (fade + blur + translate, IntersectionObserver) ──

let revealObserver = null;

function setupRevealObserver() {
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-visible'));
        return;
    }
    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal-on-scroll').forEach(el => revealOnScroll(el));
}

function revealOnScroll(el) {
    if (!el) return;
    if (!revealObserver) {
        el.classList.add('is-visible');
        return;
    }
    revealObserver.observe(el);
}

// ── Mouse Glow (radial glow that follows the cursor) ────────────

function setupMouseGlow() {
    const glow = document.getElementById('mouseGlow');
    if (!glow || !window.matchMedia('(any-pointer: fine)').matches) return;

    let raf = null;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let curX = targetX;
    let curY = targetY;

    function animate() {
        curX += (targetX - curX) * 0.15;
        curY += (targetY - curY) * 0.15;
        glow.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
        raf = requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
        glow.classList.add('active');
    }, { passive: true });

    document.addEventListener('mouseleave', () => glow.classList.remove('active'));

    raf = requestAnimationFrame(animate);
}

// ── Custom Cursor (outer ring + inner dot + glow) ───────────────

function setupCustomCursor() {
    const cursor = document.getElementById('customCursor');
    if (!cursor || !window.matchMedia('(any-pointer: fine)').matches) return;

    window.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        cursor.classList.add('active');

        const hovered = e.target.closest('a, button, .composer-input, input, textarea, [role="button"]');
        cursor.classList.toggle('pointer', !!hovered);
    }, { passive: true });

    document.addEventListener('mouseleave', () => cursor.classList.remove('active'));
    document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
    document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
}

// ── Premium Particle Network ─────────────────────────────────────
// Nodes drift organically on 2D simplex noise, thin glowing lines
// connect nearby nodes, and small energy pulses travel along those
// lines like electricity through cable. Inspired by the reference
// network-grid look, tuned to feel calm, dark, and professional.

// Compact 2D simplex-noise implementation (deterministic, no deps)
function createSimplexNoise2D(seed = 1) {
    // Small xorshift PRNG so the field is repeatable per session
    let s = seed >>> 0 || 1;
    function rand() {
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
        return ((s >>> 0) / 4294967296);
    }
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

    const grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    const F2 = 0.3660254037844386, G2 = 0.21132486540518713;

    return function noise2D(xin, yin) {
        let n0, n1, n2;
        const s2 = (xin + yin) * F2;
        const i = Math.floor(xin + s2), j = Math.floor(yin + s2);
        const t = (i + j) * G2;
        const X0 = i - t, Y0 = j - t;
        const x0 = xin - X0, y0 = yin - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
        const ii = i & 255, jj = j & 255;

        const g0 = grad2[perm[ii + perm[jj]] % 8];
        const g1 = grad2[perm[ii + i1 + perm[jj + j1]] % 8];
        const g2 = grad2[perm[ii + 1 + perm[jj + 1]] % 8];

        let t0 = 0.5 - x0*x0 - y0*y0;
        n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * (g0[0]*x0 + g0[1]*y0));
        let t1 = 0.5 - x1*x1 - y1*y1;
        n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * (g1[0]*x1 + g1[1]*y1));
        let t2 = 0.5 - x2*x2 - y2*y2;
        n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * (g2[0]*x2 + g2[1]*y2));

        return 70 * (n0 + n1 + n2);
    };
}

function setupParticleNetwork() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const noise = createSimplexNoise2D(1337);

    let width, height, dpr, nodes, pulses;
    let animId = null;
    let mouseX = null, mouseY = null;
    const isMobile = window.innerWidth < 640;
    const MAX_DIST = isMobile ? 150 : 200;
    const NODE_COLORS = [
        { r: 77,  g: 148, b: 255 },  // accent blue
        { r: 255, g: 255, b: 255 },  // white
        { r: 143, g: 212, b: 255 }   // soft cyan
    ];

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = canvas.offsetWidth;
        height = canvas.offsetHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function nodeCount() {
        const area = width * height;
        const base = Math.round(area / (isMobile ? 10700 : 7900));
        return Math.max(30, Math.min(isMobile ? 70 : 140, base));
    }

    function makeNodes() {
        const count = nodeCount();
        nodes = Array.from({ length: count }, () => ({
            baseX: Math.random() * width,
            baseY: Math.random() * height,
            x: 0, y: 0,
            nOffX: Math.random() * 1000,
            nOffY: Math.random() * 1000,
            r: Math.random() < 0.1 ? (5 + Math.random() * 1.5) : (2.4 + Math.random() * 1.3),
            color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
            glow: Math.random(),
            glowSpeed: 0.0024 + Math.random() * 0.0036,
            glowPhase: Math.random() * Math.PI * 2,
            mx: 0, my: 0 // soft mouse-attraction offset
        }));
        pulses = [];
    }

    function maybeSpawnPulse() {
        if (nodes.length < 2) return;
        if (Math.random() > (isMobile ? 0.035 : 0.06)) return;
        const from = nodes[Math.floor(Math.random() * nodes.length)];
        // Find a neighbor within range to travel toward
        let candidates = [];
        for (const n of nodes) {
            if (n === from) continue;
            const dx = n.x - from.x, dy = n.y - from.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < MAX_DIST) candidates.push(n);
        }
        if (!candidates.length) return;
        const to = candidates[Math.floor(Math.random() * candidates.length)];
        pulses.push({
            from, to,
            t: 0,
            speed: 0.006 + Math.random() * 0.012
        });
    }

    let time = 0;

    function step() {
        time += 1;
        ctx.clearRect(0, 0, width, height);

        // Update node organic drift positions via simplex noise (a few px, slow & smooth)
        for (const n of nodes) {
            const nx = noise(n.nOffX, time * 0.0015);
            const ny = noise(n.nOffY, time * 0.0015 + 500);
            n.x = n.baseX + nx * 14 + n.mx;
            n.y = n.baseY + ny * 14 + n.my;

            // Soft magnetic attraction toward the mouse, clamped to 15px
            if (mouseX !== null) {
                const dx = mouseX - n.baseX, dy = mouseY - n.baseY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const influence = Math.max(0, 1 - dist / 220);
                const targetMx = influence * dx * 0.06;
                const targetMy = influence * dy * 0.06;
                const clampedMx = Math.max(-15, Math.min(15, targetMx));
                const clampedMy = Math.max(-15, Math.min(15, targetMy));
                n.mx += (clampedMx - n.mx) * 0.06;
                n.my += (clampedMy - n.my) * 0.06;
            } else {
                n.mx *= 0.94;
                n.my *= 0.94;
            }

            n.glowPhase += n.glowSpeed;
        }

        // Draw connecting lines first (so nodes/pulses sit on top)
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < MAX_DIST) {
                    const alpha = 0.19 * (1 - dist / MAX_DIST);
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(77,148,255,${alpha})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }

        // Energy pulses traveling along active connections
        maybeSpawnPulse();
        for (let i = pulses.length - 1; i >= 0; i--) {
            const pu = pulses[i];
            pu.t += pu.speed;
            if (pu.t >= 1) { pulses.splice(i, 1); continue; }

            const px = pu.from.x + (pu.to.x - pu.from.x) * pu.t;
            const py = pu.from.y + (pu.to.y - pu.from.y) * pu.t;
            // Fade in for the first 15%, fade out for the last 25%
            let fade = 1;
            if (pu.t < 0.15) fade = pu.t / 0.15;
            else if (pu.t > 0.75) fade = (1 - pu.t) / 0.25;

            ctx.beginPath();
            ctx.arc(px, py, 2.1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(190,225,255,${0.85 * fade})`;
            ctx.shadowColor = 'rgba(120,190,255,0.9)';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Nodes on top, with occasional soft glow pulses
        for (const n of nodes) {
            const pulse = 0.5 + 0.5 * Math.sin(n.glowPhase);
            const baseAlpha = 0.55 + pulse * 0.35;
            const radius = n.r + pulse * 0.6;
            const { r, g, b } = n.color;

            if (pulse > 0.75) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, radius * 2.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r},${g},${b},${(pulse - 0.75) * 0.35})`;
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${baseAlpha})`;
            ctx.fill();
        }

        animId = requestAnimationFrame(step);
    }

    resize();
    makeNodes();
    // Seed initial positions before first draw so pulse-spawn has real coords
    for (const n of nodes) { n.x = n.baseX; n.y = n.baseY; }
    animId = requestAnimationFrame(step);

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            resize();
            makeNodes();
            for (const n of nodes) { n.x = n.baseX; n.y = n.baseY; }
        }, 200);
    });

    if (window.matchMedia('(any-pointer: fine)').matches) {
        window.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        }, { passive: true });
        document.addEventListener('mouseleave', () => { mouseX = null; mouseY = null; });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (animId) cancelAnimationFrame(animId);
            animId = null;
        } else if (!animId) {
            animId = requestAnimationFrame(step);
        }
    });
}

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

    // Safety net: also recompute whenever the chat content itself changes
    // size (new message added, typing effect growing a bubble, a code
    // block expanding, etc). This covers cases where the layout shifts
    // without a native scroll event ever firing, so the button/dot never
    // gets stuck showing (or hidden) in a stale state.
    const contentObserver = new MutationObserver(onScroll);
    contentObserver.observe(chatMessages, { childList: true, subtree: true, characterData: true });

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
