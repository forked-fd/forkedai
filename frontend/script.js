// ═══════════════════════════════════════════════════════════════
// Forked AI — Client-Side Application Engine v4.0
// ═══════════════════════════════════════════════════════════════

const API_BASE_URL = window.location.origin + '/api';
const TYPE_SPEED = 16;
const MAX_RECORDING_MS = 60000;

// ─── DOM Refs ──────────────────────────────────────────────────
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const fileBtn = document.getElementById('fileBtn');
const fileInput = document.getElementById('fileInput');
const composerFiles = document.getElementById('composerFiles');
const fileBadge = document.getElementById('fileBadge');
const langToggle = document.getElementById('langToggle');
const langToggleLabel = document.getElementById('langToggleLabel');
const clearBtn = document.getElementById('clearBtn');
const scrollBottomBtn = document.getElementById('scrollBottomBtn');
const dropOverlay = document.getElementById('dropOverlay');
const themeToggle = document.getElementById('themeToggle');
const heroSection = document.querySelector('.hero');

// ─── State ──────────────────────────────────────────────────────
let isProcessing = false;
let isRecording = false;
let speechRecognition = null;
let recordingTimeout = null;
let abortController = null;
let userScrolledUp = false;
let hasNewMessage = false;
let selectedFiles = [];
let sessionId = localStorage.getItem('forkedai:sessionId') || generateSessionId();
let currentLang = localStorage.getItem('forkedai:lang') || 'en';
let currentWriter = null;
let conversationStarted = false;

// ─── Theme ──────────────────────────────────────────────────────
function getPreferredTheme() {
    const saved = localStorage.getItem('forkedai:theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
    const resolved = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('forkedai:theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#F7F8FA' : '#0B0D12');
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
}

// Save session
localStorage.setItem('forkedai:sessionId', sessionId);

function generateSessionId() {
    return 'session_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// ─── I18N ──────────────────────────────────────────────────────
const I18N = {
    en: {
        dir: 'ltr',
        'nav.home': 'Home',
        'hero.title': 'Welcome to Forked AI',
        'hero.subtitle': 'Your AI Assistant for <span class="highlight-word">Artificial Intelligence</span> · <span class="highlight-word">Machine Learning</span> · <span class="highlight-word">Data Science</span> · <span class="highlight-word">Coding</span>',
        'composer.placeholder': 'Ask Forked AI anything…',
        'mic.record': 'Voice input',
        'mic.stop': 'Stop recording',
        'send.label': 'Send message',
        'thinking.text': 'Forked AI is thinking',
        'error.generic': 'An error occurred. Please try again.',
        'error.mic.unsupported': 'Voice recording is not supported in your browser.',
        'error.mic.permission': 'Microphone access denied. Please allow microphone access.',
        'error.mic.noSpeech': 'No speech detected. Please try again.',
        'empty.title': 'Where should we start?',
        'empty.subtitle': 'Ask about AI, review code, or paste a dataset — Forked AI picks up from there.',
        'lang.switchTo': 'العربية',
        'clear.history': 'Clear',
        'clear.confirm': 'Are you sure you want to clear conversation history?',
        'copy': 'Copy',
        'copied': 'Copied!',
        'model': 'GPT-OSS-20B',
        'now': 'Now',
        'generated': 'Generated',
        'drop.title': 'Drop files here',
        'drop.subtitle': 'Images · PDFs · Code · Documents'
    },
    ar: {
        dir: 'rtl',
        'nav.home': 'الرئيسية',
        'hero.title': 'مرحباً بك في Forked AI',
        'hero.subtitle': 'مساعدك الذكي لـ <span class="highlight-word">الذكاء الاصطناعي</span> · <span class="highlight-word">تعلم الآلة</span> · <span class="highlight-word">علوم البيانات</span> · <span class="highlight-word">البرمجة</span>',
        'composer.placeholder': 'اسأل Forked AI أي شيء…',
        'mic.record': 'إدخال صوتي',
        'mic.stop': 'إيقاف التسجيل',
        'send.label': 'إرسال',
        'thinking.text': 'Forked AI بيفكر',
        'error.generic': 'حدث خطأ. حاول مرة أخرى.',
        'error.mic.unsupported': 'المتصفح لا يدعم التسجيل الصوتي.',
        'error.mic.permission': 'تم رفض الوصول للمايكروفون.',
        'error.mic.noSpeech': 'لم يتم التقاط صوت. حاول مرة أخرى.',
        'empty.title': 'بماذا تحب أن نبدأ؟',
        'empty.subtitle': 'اسأل عن الذكاء الاصطناعي، راجع كودك، أو أرفق بياناتك.',
        'lang.switchTo': 'English',
        'clear.history': 'مسح',
        'clear.confirm': 'مسح تاريخ المحادثة؟',
        'copy': 'نسخ',
        'copied': 'تم النسخ!',
        'model': 'GPT-OSS-20B',
        'now': 'الآن',
        'generated': 'تم التوليد',
        'drop.title': 'أفلت الملفات هنا',
        'drop.subtitle': 'صور · PDF · كود · مستندات'
    }
};

function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N['en'][key] || key;
}

function applyLanguage(lang) {
    currentLang = I18N[lang] ? lang : 'en';
    localStorage.setItem('forkedai:lang', currentLang);
    document.documentElement.lang = currentLang;
    document.documentElement.dir = I18N[currentLang].dir || 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(el => {
        if (!el.closest('[data-i18n-html]')) {
            el.textContent = t(el.dataset.i18n);
        }
    });

    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.dataset.i18nHtml);
    });

    chatInput.placeholder = t('composer.placeholder');
    chatInput.setAttribute('aria-label', t('composer.placeholder'));

    if (langToggleLabel) langToggleLabel.textContent = t('lang.switchTo');

    if (!isRecording) {
        micBtn.setAttribute('aria-label', t('mic.record'));
        micBtn.title = t('mic.record');
    }

    sendBtn.setAttribute('aria-label', t('send.label'));
}

// ─── Utilities ──────────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIconSVG(ext) {
    const icons = {
        py: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7v10l10 5 10-5V7l-10-5z"/><path d="M2 7l10 5 10-5M12 22V12"/></svg>',
        js: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2"/><path d="M9 9v6M15 9v6"/></svg>',
        ts: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2"/><path d="M9 9h6M12 9v6"/></svg>',
        pdf: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>',
    };
    return icons[ext] || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function getFileExt(name) {
    return name.split('.').pop()?.toLowerCase() || '';
}

function getLangDisplay(ext) {
    const map = {
        py: 'Python', js: 'JavaScript', ts: 'TypeScript',
        jsx: 'React', tsx: 'React', java: 'Java',
        c: 'C', cpp: 'C++', cs: 'C#', go: 'Go',
        rs: 'Rust', php: 'PHP', swift: 'Swift',
        kt: 'Kotlin', dart: 'Dart', sql: 'SQL',
        sh: 'Shell', html: 'HTML', css: 'CSS',
        json: 'JSON', yaml: 'YAML', yml: 'YAML',
        toml: 'TOML', env: 'Env', ipynb: 'Jupyter',
        xml: 'XML'
    };
    return map[ext] || ext.toUpperCase();
}

function detectDirection(text) {
    const rtl = (text.match(/[\u0600-\u06FF\u0590-\u05FF]/g) || []).length;
    const total = text.replace(/\s/g, '').length || 1;
    return (rtl / total > 0.3) ? 'rtl' : 'ltr';
}

function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
}

function fallbackCopy(text) {
    return new Promise(resolve => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
    });
}

function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printAsPdf(bodyEl) {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Forked AI</title>
        <style>
            body { font-family: -apple-system, "Inter", sans-serif; color: #111827; padding: 32px; line-height: 1.6; max-width: 720px; margin: 0 auto; }
            pre { background: #F1F4F9; padding: 12px; border-radius: 8px; overflow-x: auto; }
            code { font-family: "JetBrains Mono", monospace; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        </style></head><body>${bodyEl.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
}

function scrollToBottom(smooth = true, force = false) {
    if (userScrolledUp && !force) return;
    const behavior = smooth ? 'smooth' : 'auto';
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
    if (chatMessages.scrollHeight > chatMessages.clientHeight) {
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior });
    }
}

function isNearBottom() {
    const scrollable = chatMessages.scrollHeight > chatMessages.clientHeight + 4;
    if (scrollable) {
        return (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight) < 120;
    }
    const doc = document.documentElement;
    return (doc.scrollHeight - window.scrollY - window.innerHeight) < 120;
}

function updateScrollState() {
    const atBottom = isNearBottom();
    userScrolledUp = !atBottom;
    scrollBottomBtn.classList.toggle('visible', !atBottom);
    if (atBottom) {
        hasNewMessage = false;
        scrollBottomBtn.classList.remove('has-new');
    }
}

function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
}

// ─── Render Markdown ────────────────────────────────────────────
function renderMarkdown(markdown) {
    if (!markdown) return '';

    let html = markdown;
    const codeBlocks = [];

    // Extract code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push({ lang: lang.trim() || 'plaintext', code: code.replace(/\n$/, '') });
        return `\u0000CODE${idx}\u0000`;
    });

    // Extract tables
    const tables = [];
    html = html.replace(/^\|(.+)\|\s*\n\|[\s:|-]+\|\s*\n((?:\|.*\|\s*\n?)*)/gm, (m, headerRow, bodyRows) => {
        const idx = tables.length;
        const headers = headerRow.split('|').map(c => c.trim()).filter(c => c);
        const rows = bodyRows.trim().split('\n').filter(r => r.trim()).map(r =>
            r.split('|').map(c => c.trim()).filter((c, i, arr) =>
                !(i === 0 && c === '') && !(i === arr.length - 1 && c === '')
            )
        );
        tables.push({ headers, rows });
        return `\u0000TABLE${idx}\u0000`;
    });

    // Extract callouts
    const callouts = [];
    html = html.replace(/^> \*\*(Note|Tip|Warning|Important|Success)\*\*:?\s*(.+)$/gim, (m, type, text) => {
        const idx = callouts.length;
        callouts.push({ type: type.toLowerCase(), text });
        return `\u0000CALLOUT${idx}\u0000`;
    });

    // Escape
    html = escapeHtml(html);

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>');

    // Bold/italic
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Lists
    html = html.replace(/^[ \t]*[-*+] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul class="markdown-list">$1</ul>');

    html = html.replace(/^[ \t]*(\d+)\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ol class="markdown-list">$1</ol>');

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // HR
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\*\*\*$/gm, '<hr>');

    // Paragraphs
    html = html.replace(/\n\n+/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    if (!html.startsWith('<p') && !html.startsWith('<h') && !html.startsWith('<ul') &&
        !html.startsWith('<ol') && !html.startsWith('<blockquote')) {
        html = '<p>' + html + '</p>';
    }

    // Clean up
    html = html.replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br>');
    html = html.replace(/<(h[1-6]|ul|ol|li|blockquote|p|hr)[^>]*>\s*<br\s*\/?>/gi, '<$1>');
    html = html.replace(/<br\s*\/?>\s*<\/(h[1-6]|ul|ol|li|blockquote|p)>/gi, '</$1>');

    // Re-insert code blocks
    html = html.replace(/\u0000CODE(\d+)\u0000/g, (m, idx) => {
        const { lang, code } = codeBlocks[Number(idx)];
        return renderCodeBlock(lang, code);
    });

    // Re-insert tables
    html = html.replace(/\u0000TABLE(\d+)\u0000/g, (m, idx) => {
        const { headers, rows } = tables[Number(idx)];
        return renderTable(headers, rows);
    });

    // Re-insert callouts
    html = html.replace(/\u0000CALLOUT(\d+)\u0000/g, (m, idx) => {
        const { type, text } = callouts[Number(idx)];
        return renderCallout(type, text);
    });

    return html;
}

function renderCodeBlock(lang, code) {
    const escaped = escapeHtml(code);
    const langDisplay = getLangDisplay(lang);
    const iconSVG = getFileIconSVG(lang);
    const lines = code.split('\n').length;
    const chars = code.length;

    return `
        <div class="code-block-wrap" dir="ltr">
            <div class="code-header">
                <span class="lang-badge">
                    ${iconSVG}
                    ${escapeHtml(langDisplay)}
                </span>
                <button class="code-copy-btn" type="button">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>${t('copy')}</span>
                </button>
            </div>
            <pre><code class="language-${escapeHtml(lang)}">${escaped}</code></pre>
            <div class="code-footer">
                <span>${lines} lines</span>
                <span>${chars} chars</span>
            </div>
        </div>
    `;
}

function renderTable(headers, rows) {
    const th = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const tr = rows.map(r =>
        `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
    ).join('');
    return `
        <div class="table-wrap">
            <table>
                <thead><tr>${th}</tr></thead>
                <tbody>${tr}</tbody>
            </table>
        </div>
    `;
}

function renderCallout(type, text) {
    const icons = {
        note: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        tip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-4 10.5c.6.5 1 1.3 1 2.1V16h6v-1.4c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 2z"/></svg>',
        warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        important: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    };
    const icon = icons[type] || icons.note;
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    return `
        <div class="callout callout-${type}">
            <span class="callout-icon">${icon}</span>
            <div class="callout-body"><strong>${label}:</strong> ${escapeHtml(text)}</div>
        </div>
    `;
}

function renderAttachments(files) {
    if (!files || !files.length) return '';
    const chips = files.map(f => {
        const ext = getFileExt(f.name);
        const iconSVG = getFileIconSVG(ext);
        const size = formatFileSize(f.size);
        return `
            <div class="attachment-chip">
                <span class="icon">${iconSVG}</span>
                <div class="info">
                    <div class="name">${escapeHtml(f.name)}</div>
                    <div class="meta">${escapeHtml(ext.toUpperCase())}${size ? ' · ' + size : ''}</div>
                </div>
            </div>
        `;
    }).join('');
    return `<div class="message-attachments">${chips}</div>`;
}

// ─── Typewriter Engine ─────────────────────────────────────────
class Typewriter {
    constructor(options = {}) {
        this.speed = options.speed || TYPE_SPEED;
        this.onComplete = options.onComplete || null;
        this.onChar = options.onChar || null;
        this.container = null;
        this.fullHTML = '';
        this.running = false;
        this.timer = null;
        this.startTime = Date.now();
    }

    render(markdown, container) {
        this.container = container;
        this.fullHTML = renderMarkdown(markdown);
        this.container.innerHTML = '';
        this.running = true;
        this.startTime = Date.now();

        const temp = document.createElement('div');
        temp.innerHTML = this.fullHTML;
        const blocks = Array.from(temp.childNodes);

        this.typeBlocks(blocks, this.container);
    }

    typeBlocks(blocks, target) {
        let idx = 0;
        const next = () => {
            if (!this.running || idx >= blocks.length) {
                this.finish();
                return;
            }
            const node = blocks[idx++];
            this.typeNode(node, target, next);
        };
        next();
    }

    typeNode(node, target, onDone) {
        if (node.nodeType === Node.TEXT_NODE) {
            this.typeText(node.textContent, target, onDone);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) { onDone(); return; }

        const tag = node.tagName.toLowerCase();
        const isCode = node.classList.contains('code-block-wrap') || tag === 'pre';

        if (isCode || tag === 'hr' || tag === 'table' || (tag === 'div' && node.classList.contains('table-wrap')) ||
            (tag === 'div' && node.classList.contains('callout'))) {
            const clone = node.cloneNode(true);
            target.appendChild(clone);
            this.highlightCode(clone);
            this.setupCodeCopy(clone);
            if (this.onChar) this.onChar();
            setTimeout(onDone, 20);
            return;
        }

        if (tag === 'ul' || tag === 'ol') {
            const el = document.createElement(tag);
            el.className = node.className;
            target.appendChild(el);
            const items = Array.from(node.children);
            let i = 0;
            const nextItem = () => {
                if (i >= items.length || !this.running) { onDone(); return; }
                this.typeNode(items[i++], el, nextItem);
            };
            nextItem();
            return;
        }

        const el = document.createElement(tag);
        el.className = node.className;
        for (const attr of node.attributes) {
            if (attr.name !== 'class') el.setAttribute(attr.name, attr.value);
        }
        target.appendChild(el);

        const children = Array.from(node.childNodes);
        let ci = 0;
        const nextChild = () => {
            if (ci >= children.length || !this.running) { onDone(); return; }
            this.typeInline(children[ci++], el, nextChild);
        };
        nextChild();
    }

    typeInline(node, target, onDone) {
        if (node.nodeType === Node.TEXT_NODE) {
            this.typeText(node.textContent, target, onDone);
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = document.createElement(node.tagName.toLowerCase());
            el.className = node.className;
            for (const attr of node.attributes) {
                if (attr.name !== 'class') el.setAttribute(attr.name, attr.value);
            }
            target.appendChild(el);
            this.typeText(node.textContent, el, onDone);
            return;
        }
        onDone();
    }

    typeText(text, target, onDone) {
        let idx = 0;
        const step = () => {
            if (!this.running || idx >= text.length) {
                if (onDone) onDone();
                return;
            }
            const char = text[idx++];
            target.appendChild(document.createTextNode(char));
            if (this.onChar) this.onChar();

            let delay = this.speed;
            if (char.match(/[\s\n]/)) delay = this.speed * 0.3;
            else if (char.match(/[،.؛:!?]/)) delay = this.speed * 2;
            else if (char.match(/[a-zA-Z0-9]/)) delay = this.speed * 0.7;

            this.timer = setTimeout(step, delay);
        };
        step();
    }

    highlightCode(container) {
        container.querySelectorAll('.code-block-wrap code').forEach(el => {
            if (window.hljs) {
                try { window.hljs.highlightElement(el); } catch (e) {}
            }
        });
    }

    setupCodeCopy(container) {
        container.querySelectorAll('.code-copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.closest('.code-block-wrap')?.querySelector('code')?.textContent || '';
                copyToClipboard(code).then(() => {
                    const label = btn.querySelector('span');
                    const orig = label.textContent;
                    label.textContent = t('copied');
                    btn.classList.add('copied');
                    setTimeout(() => {
                        label.textContent = orig;
                        btn.classList.remove('copied');
                    }, 1800);
                });
            });
        });
    }

    finish() {
        this.running = false;
        if (this.timer) { clearTimeout(this.timer);
            this.timer = null; }

        const elapsed = (Date.now() - this.startTime) / 1000;
        const card = this.container.closest('.message-card');
        if (card) {
            const timeEl = card.querySelector('.thinking-time');
            if (timeEl) timeEl.textContent = elapsed.toFixed(1);
            const meta = card.querySelector('.message-meta');
            if (meta) {
                const genText = t('generated') + ' ' + elapsed.toFixed(1) + 's';
                const nowText = t('now');
                meta.innerHTML = `<span>${genText}</span><span class="divider">·</span><span>${nowText}</span>`;
            }
            card.closest('.message')?.classList.remove('message-streaming');
            this.setupActions(card);
        }

        if (this.onComplete) this.onComplete();
        scrollToBottom(true);
    }

    setupActions(card) {
        const bodyEl = this.container;

        // Copy: uses the current text selection inside this message if present,
        // otherwise falls back to the whole message. Per spec §4.2.
        const copyBtn = card.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const sel = window.getSelection();
                let text = bodyEl.textContent;
                if (sel && !sel.isCollapsed && sel.toString().trim() &&
                    bodyEl.contains(sel.anchorNode) && bodyEl.contains(sel.focusNode)) {
                    text = sel.toString();
                }
                copyToClipboard(text).then(() => {
                    const label = copyBtn.querySelector('.label');
                    const orig = label.textContent;
                    label.textContent = t('copied');
                    copyBtn.classList.add('active');
                    setTimeout(() => {
                        label.textContent = orig;
                        copyBtn.classList.remove('active');
                    }, 1800);
                });
            });
        }

        const likeBtn = card.querySelector('.like-btn');
        const dislikeBtn = card.querySelector('.dislike-btn');
        if (likeBtn) {
            likeBtn.addEventListener('click', () => {
                likeBtn.classList.toggle('liked');
                if (dislikeBtn) dislikeBtn.classList.remove('disliked');
            });
        }
        if (dislikeBtn) {
            dislikeBtn.addEventListener('click', () => {
                dislikeBtn.classList.toggle('disliked');
                if (likeBtn) likeBtn.classList.remove('liked');
            });
        }

        const regenBtn = card.querySelector('.regenerate-btn');
        if (regenBtn) {
            regenBtn.addEventListener('click', () => {
                const msg = card.closest('.message');
                if (msg) {
                    const prevUser = msg.previousElementSibling;
                    if (prevUser && prevUser.classList.contains('message-user')) {
                        const text = prevUser.querySelector('.message-body')?.textContent || '';
                        msg.remove();
                        handleSendMessage(text);
                    }
                }
            });
        }

        // Speak (Text-to-Speech)
        const speakBtn = card.querySelector('.speak-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                if (!window.speechSynthesis) return;
                if (speakBtn.classList.contains('speaking')) {
                    window.speechSynthesis.cancel();
                    speakBtn.classList.remove('speaking');
                    return;
                }
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(bodyEl.textContent);
                utter.lang = getSpeechLang();
                utter.onend = () => speakBtn.classList.remove('speaking');
                utter.onerror = () => speakBtn.classList.remove('speaking');
                speakBtn.classList.add('speaking');
                window.speechSynthesis.speak(utter);
            });
        }

        // Share (Web Share API with clipboard fallback)
        const shareBtn = card.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', async () => {
                const text = bodyEl.textContent;
                if (navigator.share) {
                    try { await navigator.share({ text, title: 'Forked AI' }); return; } catch (e) { /* fall through */ }
                }
                copyToClipboard(text).then(() => {
                    shareBtn.classList.add('active');
                    setTimeout(() => shareBtn.classList.remove('active'), 1200);
                });
            });
        }

        // Export as PDF / Markdown
        const exportBtn = card.querySelector('.export-btn');
        const exportMenu = card.querySelector('.action-menu');
        if (exportBtn && exportMenu) {
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.action-menu.open').forEach(m => {
                    if (m !== exportMenu) m.classList.remove('open');
                });
                exportMenu.classList.toggle('open');
            });
            document.addEventListener('click', () => exportMenu.classList.remove('open'));

            const mdBtn = exportMenu.querySelector('.export-md');
            if (mdBtn) {
                mdBtn.addEventListener('click', () => {
                    downloadFile(bodyEl.textContent, 'forked-ai-response.md', 'text/markdown');
                    exportMenu.classList.remove('open');
                });
            }
            const pdfBtn = exportMenu.querySelector('.export-pdf');
            if (pdfBtn) {
                pdfBtn.addEventListener('click', () => {
                    exportMenu.classList.remove('open');
                    printAsPdf(bodyEl);
                });
            }
        }
    }

    stop() {
        this.running = false;
        if (this.timer) { clearTimeout(this.timer);
            this.timer = null; }
    }
}

// ─── Message Creation ──────────────────────────────────────────
function createUserMessage(text, files) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'message message-user';
    div.innerHTML = `
        <div class="message-card">
            <div class="message-header">
                <span class="avatar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </span>
                <span>You</span>
            </div>
            ${files ? renderAttachments(files) : ''}
            <div class="message-body">${escapeHtml(text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    return div;
}

function createAIMessage() {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'message message-ai message-streaming';
    div.innerHTML = `
        <div class="message-card">
            <div class="message-header">
                <div class="message-header-left">
                    <span class="avatar">F</span>
                    <span class="model-badge">
                        <span class="dot"></span>
                        ${t('model')}
                    </span>
                </div>
                <div class="message-meta">
                    <span>${t('thinking.text')} <span class="thinking-time">0.0</span>s</span>
                    <span class="divider">·</span>
                    <span>${t('now')}</span>
                </div>
            </div>
            <div class="message-body" dir="ltr"></div>
            <div class="message-footer">
                <div class="message-footer-actions">
                    <button class="action-btn copy-btn" type="button" title="${t('copy')}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span class="label">${t('copy')}</span>
                    </button>
                    <button class="action-btn like-btn" type="button" title="Like">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                        </svg>
                    </button>
                    <button class="action-btn dislike-btn" type="button" title="Dislike">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>
                        </svg>
                    </button>
                    <button class="action-btn regenerate-btn" type="button" title="Regenerate">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10"/>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                        </svg>
                    </button>
                    <button class="action-btn speak-btn" type="button" title="Read aloud">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        </svg>
                    </button>
                    <button class="action-btn share-btn" type="button" title="Share">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                    </button>
                    <div class="action-menu-wrap">
                        <button class="action-btn export-btn" type="button" title="Export">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </button>
                        <div class="action-menu">
                            <button class="export-pdf">Export as PDF</button>
                            <button class="export-md">Export as Markdown</button>
                        </div>
                    </div>
                </div>
                <span class="message-time">${time}</span>
            </div>
        </div>
    `;
    return div;
}

function createThinkingMessage() {
    const div = document.createElement('div');
    div.className = 'message message-ai message-thinking';
    div.id = 'thinking-' + Date.now();
    div.innerHTML = `
        <div class="message-card">
            <div class="message-header">
                <div class="message-header-left">
                    <span class="avatar">F</span>
                    <span class="model-badge">
                        <span class="dot"></span>
                        ${t('model')}
                    </span>
                </div>
            </div>
            <div class="message-body">
                <div class="thinking-indicator">
                    <div class="thinking-spinner"></div>
                    <span class="thinking-text">${t('thinking.text')}</span>
                    <span class="thinking-dots">
                        <span></span><span></span><span></span>
                    </span>
                </div>
            </div>
        </div>
    `;
    return div;
}

function createErrorMessage(text) {
    const div = document.createElement('div');
    div.className = 'message message-ai message-error';
    div.innerHTML = `
        <div class="message-card">
            <div class="message-body">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:-2px;margin-right:6px;">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                ${escapeHtml(text)}
            </div>
        </div>
    `;
    return div;
}

// ─── Core Logic ──────────────────────────────────────────────────
async function handleSendMessage(inputText) {
    const text = (inputText || chatInput.value).trim();
    const hasFiles = selectedFiles.length > 0;
    if ((!text && !hasFiles) || isProcessing) return;

    if (abortController) {
        abortController.abort();
        abortController = null;
    }

    if (currentWriter) {
        currentWriter.stop();
        currentWriter = null;
    }

    isProcessing = true;
    sendBtn.disabled = true;
    sendBtn.classList.add('processing');
    chatInput.disabled = true;

    hideHero();

    const userFiles = [...selectedFiles];

    const userMsg = createUserMessage(text, userFiles);
    chatMessages.appendChild(userMsg);
    scrollToBottom(true);

    chatInput.value = '';
    autoResizeTextarea();
    clearSelectedFiles();

    const thinkingDiv = createThinkingMessage();
    chatMessages.appendChild(thinkingDiv);
    scrollToBottom(true);

    try {
        abortController = new AbortController();

        let response;
        const formData = new FormData();
        formData.append('message', text || '');
        formData.append('sessionId', sessionId);

        if (hasFiles) {
            for (const file of userFiles) {
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
                body: JSON.stringify({ message: text, sessionId }),
                signal: abortController.signal
            });
        }

        if (thinkingDiv.isConnected) {
            thinkingDiv.classList.add('is-leaving');
            setTimeout(() => thinkingDiv.remove(), 350);
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || t('error.generic'));
        }

        const fullResponse = result.data?.response || '';
        if (!fullResponse) throw new Error(t('error.generic'));

        const aiMsg = createAIMessage();
        chatMessages.appendChild(aiMsg);
        scrollToBottom(true);

        const body = aiMsg.querySelector('.message-body');
        const writer = new Typewriter({
            speed: TYPE_SPEED,
            onComplete: () => {
                isProcessing = false;
                sendBtn.disabled = false;
                sendBtn.classList.remove('processing');
                chatInput.disabled = false;
                chatInput.focus();
                if (!isNearBottom()) {
                    hasNewMessage = true;
                    scrollBottomBtn.classList.add('has-new');
                }
                currentWriter = null;
            },
            onChar: () => {
                if (!isNearBottom()) {
                    scrollToBottom(false);
                }
            }
        });

        currentWriter = writer;
        writer.render(fullResponse, body);

    } catch (error) {
        if (thinkingDiv.isConnected) {
            thinkingDiv.classList.add('is-leaving');
            setTimeout(() => thinkingDiv.remove(), 350);
        }

        let msg = t('error.generic');
        if (error.name === 'AbortError') {
            msg = 'Request cancelled.';
        } else if (error.message) {
            msg = error.message;
        }

        const errMsg = createErrorMessage(msg);
        chatMessages.appendChild(errMsg);
        scrollToBottom(true);

        isProcessing = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove('processing');
        chatInput.disabled = false;
        chatInput.focus();
        currentWriter = null;
    }

    abortController = null;
}

// ─── File Handling ──────────────────────────────────────────────
function handleFiles(files) {
    const remaining = 5 - selectedFiles.length;
    const newFiles = Array.from(files).slice(0, remaining);
    selectedFiles.push(...newFiles);
    updateFileUI();
}

function updateFileUI() {
    composerFiles.innerHTML = '';
    if (selectedFiles.length === 0) {
        fileBadge.style.display = 'none';
        fileBtn.classList.remove('has-files');
        return;
    }

    fileBadge.style.display = 'flex';
    fileBadge.textContent = selectedFiles.length;
    fileBtn.classList.add('has-files');

    selectedFiles.forEach((file, idx) => {
        const ext = getFileExt(file.name);
        const iconSVG = getFileIconSVG(ext);
        const chip = document.createElement('span');
        chip.className = 'composer-file-chip';
        chip.innerHTML = `
            ${iconSVG}
            <span>${escapeHtml(file.name)}</span>
            <span class="ext-badge">${escapeHtml(ext || 'file')}</span>
            <button class="remove" type="button" data-idx="${idx}" aria-label="Remove file">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        chip.querySelector('.remove').addEventListener('click', () => {
            selectedFiles.splice(idx, 1);
            updateFileUI();
        });
        composerFiles.appendChild(chip);
    });
}

function clearSelectedFiles() {
    selectedFiles = [];
    updateFileUI();
    fileInput.value = '';
}

// ─── Voice Recording ────────────────────────────────────────────
function getSpeechLang() {
    return currentLang === 'ar' ? 'ar-EG' : 'en-US';
}

async function toggleRecording() {
    if (isRecording) { stopRecording(); return; }
    startRecording();
}

function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        const err = createErrorMessage(t('error.mic.unsupported'));
        chatMessages.appendChild(err);
        scrollToBottom(true);
        return;
    }

    try {
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = getSpeechLang();

        rec.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
            micBtn.setAttribute('aria-label', t('mic.stop'));
            micBtn.title = t('mic.stop');
        };

        rec.onresult = (e) => {
            const transcript = Array.from(e.results).map(r => r[0]?.transcript || '').join(' ').trim();
            if (transcript) {
                chatInput.value = transcript;
                autoResizeTextarea();
                handleSendMessage();
            } else {
                const err = createErrorMessage(t('error.mic.noSpeech'));
                chatMessages.appendChild(err);
                scrollToBottom(true);
            }
        };

        rec.onerror = (e) => {
            let msg = t('error.mic.unsupported');
            if (e.error === 'not-allowed') msg = t('error.mic.permission');
            else if (e.error === 'no-speech') msg = t('error.mic.noSpeech');
            const err = createErrorMessage(msg);
            chatMessages.appendChild(err);
            scrollToBottom(true);
            isRecording = false;
            micBtn.classList.remove('recording');
            micBtn.setAttribute('aria-label', t('mic.record'));
            micBtn.title = t('mic.record');
        };

        rec.onend = () => {
            isRecording = false;
            micBtn.classList.remove('recording');
            micBtn.setAttribute('aria-label', t('mic.record'));
            micBtn.title = t('mic.record');
            speechRecognition = null;
        };

        speechRecognition = rec;
        rec.start();

        recordingTimeout = setTimeout(() => {
            if (isRecording) stopRecording();
        }, MAX_RECORDING_MS);
    } catch (err) {
        const errMsg = createErrorMessage(t('error.mic.permission'));
        chatMessages.appendChild(errMsg);
        scrollToBottom(true);
    }
}

function stopRecording() {
    if (!isRecording || !speechRecognition) return;
    isRecording = false;
    micBtn.classList.remove('recording');
    micBtn.setAttribute('aria-label', t('mic.record'));
    micBtn.title = t('mic.record');
    if (recordingTimeout) clearTimeout(recordingTimeout);
    try { speechRecognition.stop(); } catch (e) {}
}

// ─── Drop & Paste ───────────────────────────────────────────────
function setupDropAndPaste() {
    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        if (dragCounter === 1) dropOverlay.classList.add('active');
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) dropOverlay.classList.remove('active');
    });

    document.addEventListener('dragover', (e) => e.preventDefault());

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropOverlay.classList.remove('active');
        const items = e.dataTransfer?.files;
        if (items && items.length) {
            handleFiles(items);
        }
    });

    document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const files = [];

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) files.push(file);
            } else if (item.type === 'text/plain') {
                const text = e.clipboardData.getData('text/plain');
                if (text && text.trim()) {
                    if (text.includes('\n') || text.includes('{') || text.includes('function') ||
                        text.includes('class') || text.includes('import') || text.includes('def ')) {
                        const blob = new Blob([text], { type: 'text/plain' });
                        const codeFile = new File([blob], 'pasted-code.txt', { type: 'text/plain' });
                        files.push(codeFile);
                    } else if (text.length > 200) {
                        const blob = new Blob([text], { type: 'text/plain' });
                        const txtFile = new File([blob], 'pasted-text.txt', { type: 'text/plain' });
                        files.push(txtFile);
                    }
                }
            } else if (item.type === 'application/pdf') {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }

        if (files.length) {
            e.preventDefault();
            handleFiles(files);
        }
    });
}

// ─── Event Listeners ────────────────────────────────────────────
function setupEventListeners() {
    sendBtn.addEventListener('click', () => handleSendMessage());

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    chatInput.addEventListener('input', autoResizeTextarea);

    micBtn.addEventListener('click', toggleRecording);

    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files) handleFiles(e.target.files);
        fileInput.value = '';
    });

    langToggle.addEventListener('click', () => {
        applyLanguage(currentLang === 'en' ? 'ar' : 'en');
    });

    clearBtn.addEventListener('click', clearConversation);

    scrollBottomBtn.addEventListener('click', () => {
        userScrolledUp = false;
        hasNewMessage = false;
        scrollBottomBtn.classList.remove('has-new');
        scrollToBottom(true, true);
    });

    let ticking = false;
    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            updateScrollState();
            ticking = false;
        });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    chatMessages.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            chatInput.focus();
        }
    });

    setupDropAndPaste();

    themeToggle.addEventListener('click', toggleTheme);
    applyTheme(getPreferredTheme());

    updateScrollState();
    applyLanguage(currentLang);
    chatInput.focus();
}

// ─── Hero visibility ─────────────────────────────────────────────
function hideHero() {
    if (!heroSection || conversationStarted) return;
    conversationStarted = true;
    heroSection.classList.add('is-hidden');
}

function showHero() {
    if (!heroSection) return;
    conversationStarted = false;
    heroSection.classList.remove('is-hidden');
}

async function clearConversation() {
    if (!confirm(t('clear.confirm'))) return;
    try {
        await fetch(`${API_BASE_URL}/chat/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
    } catch (e) {}

    chatMessages.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.id = 'emptyState';
    empty.innerHTML = `
        <div class="empty-state-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="6" r="2.6"/>
                <circle cx="6" cy="18" r="2.6"/>
                <circle cx="18" cy="12" r="2.6"/>
                <path d="M6 8.6V15.4"/>
                <path d="M8.4 7.2L15.6 10.8"/>
                <path d="M8.4 16.8L15.6 13.2"/>
            </svg>
        </div>
        <h2 class="empty-state-title" data-i18n="empty.title">${t('empty.title')}</h2>
        <p class="empty-state-subtitle" data-i18n="empty.subtitle">${t('empty.subtitle')}</p>
    `;
    chatMessages.appendChild(empty);
    scrollToBottom(true, true);
    showHero();
}

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', setupEventListeners);

window.__forked = {
    handleSendMessage,
    clearSelectedFiles,
    selectedFiles,
    I18N,
    currentLang,
    applyLanguage
};
