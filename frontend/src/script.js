// ===== Configuration =====
const API_URL = 'http://localhost:8000/rag';

// ===== DOM Elements =====
const chatArea = document.getElementById('chatArea');
const messagesContainer = document.getElementById('messagesContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const themeToggle = document.getElementById('themeToggle');
const themeLabel = document.getElementById('themeLabel');
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const chatHistoryList = document.getElementById('chatHistoryList');
const conversationTitle = document.getElementById('conversationTitle');
const suggestions = document.getElementById('suggestions');

// ===== State =====
let conversations = JSON.parse(localStorage.getItem('medassist_conversations') || '[]');
let activeConversationId = null;
let isProcessing = false;

// ===== Theme Management =====
function initTheme() {
    const saved = localStorage.getItem('medassist_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    themeLabel.textContent = saved === 'light' ? 'Dark mode' : 'Light mode';
}

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('medassist_theme', next);
    themeLabel.textContent = next === 'light' ? 'Dark mode' : 'Light mode';
});

// ===== Sidebar Toggle (Mobile) =====
menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
sidebarOverlay.addEventListener('click', () => sidebar.classList.remove('open'));

// ===== Utility =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function saveConversations() {
    localStorage.setItem('medassist_conversations', JSON.stringify(conversations));
}

// ===== Textarea Auto-resize =====
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    sendBtn.disabled = !messageInput.value.trim();
});

// ===== Conversation Management =====
function createConversation() {
    const conv = {
        id: generateId(),
        title: 'New Conversation',
        messages: [],
        createdAt: Date.now()
    };
    conversations.unshift(conv);
    saveConversations();
    setActiveConversation(conv.id);
    renderHistory();
}

function setActiveConversation(id) {
    activeConversationId = id;
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    conversationTitle.textContent = conv.title;
    messagesContainer.innerHTML = '';

    if (conv.messages.length === 0) {
        welcomeScreen.style.display = 'flex';
        messagesContainer.style.display = 'none';
    } else {
        welcomeScreen.style.display = 'none';
        messagesContainer.style.display = 'block';
        conv.messages.forEach(msg => renderMessage(msg.role, msg.text, msg.timestamp, false));
        scrollToBottom();
    }

    renderHistory();
    sidebar.classList.remove('open');
}

function deleteConversation(id) {
    conversations = conversations.filter(c => c.id !== id);
    saveConversations();

    if (activeConversationId === id) {
        if (conversations.length > 0) {
            setActiveConversation(conversations[0].id);
        } else {
            createConversation();
        }
    }
    renderHistory();
}

function getActiveConversation() {
    return conversations.find(c => c.id === activeConversationId);
}

// ===== Render Chat History Sidebar =====
function renderHistory() {
    chatHistoryList.innerHTML = '';
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = `chat-history-item${conv.id === activeConversationId ? ' active' : ''}`;
        item.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span style="overflow:hidden;text-overflow:ellipsis;flex:1">${escapeHtml(conv.title)}</span>
            <button class="delete-btn" title="Delete conversation">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        item.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) {
                e.stopPropagation();
                deleteConversation(conv.id);
                return;
            }
            setActiveConversation(conv.id);
        });
        chatHistoryList.appendChild(item);
    });
}

// ===== Render Messages =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderMessage(role, text, timestamp, animate = true) {
    const isUser = role === 'user';
    const row = document.createElement('div');
    row.className = `message-row ${isUser ? 'user' : 'ai'}`;
    if (!animate) row.style.animation = 'none';

    row.innerHTML = `
        <div class="avatar ${isUser ? 'user-avatar' : 'ai-avatar'}">
            ${isUser
                ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
                : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L12 22M2 12L22 12" stroke-linecap="round"/><circle cx="12" cy="12" r="10"/></svg>'
            }
        </div>
        <div class="message-bubble">
            <div class="message-sender">${isUser ? 'You' : 'MedAssist AI'}</div>
            <div class="message-text">${escapeHtml(text)}</div>
            <div class="message-time">${formatTime(timestamp)}</div>
        </div>
    `;

    messagesContainer.appendChild(row);
}

function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row ai typing-indicator';
    row.id = 'typingRow';
    row.innerHTML = `
        <div class="avatar ai-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L12 22M2 12L22 12" stroke-linecap="round"/><circle cx="12" cy="12" r="10"/>
            </svg>
        </div>
        <div class="message-bubble">
            <div class="message-sender">MedAssist AI</div>
            <div class="message-text">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(row);
    scrollToBottom();
}

function removeTypingIndicator() {
    const row = document.getElementById('typingRow');
    if (row) row.remove();
}

function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
}

// ===== API Call =====
async function sendMessageToBackend(message) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: message })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.response || data.answer || "I couldn't process that request.";
    } catch (error) {
        console.error('Error:', error);
        return "Sorry, I'm having trouble connecting to the server. Please make sure the backend is running.";
    }
}

// ===== Handle Send =====
async function handleSend(text) {
    const message = (text || messageInput.value).trim();
    if (!message || isProcessing) return;

    isProcessing = true;
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Hide welcome screen, show messages
    welcomeScreen.style.display = 'none';
    messagesContainer.style.display = 'block';

    const conv = getActiveConversation();
    const ts = Date.now();

    // Save & render user message
    conv.messages.push({ role: 'user', text: message, timestamp: ts });

    // Update conversation title from first message
    if (conv.messages.length === 1) {
        conv.title = message.length > 40 ? message.slice(0, 40) + '...' : message;
        conversationTitle.textContent = conv.title;
        renderHistory();
    }
    saveConversations();
    renderMessage('user', message, ts);
    scrollToBottom();

    // Show typing + get response
    showTypingIndicator();
    const response = await sendMessageToBackend(message);
    removeTypingIndicator();

    const aiTs = Date.now();
    conv.messages.push({ role: 'ai', text: response, timestamp: aiTs });
    saveConversations();
    renderMessage('ai', response, aiTs);
    scrollToBottom();

    isProcessing = false;
    sendBtn.disabled = !messageInput.value.trim();
    messageInput.focus();
}

// ===== Event Listeners =====
sendBtn.addEventListener('click', () => handleSend());

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

newChatBtn.addEventListener('click', createConversation);

clearChatBtn.addEventListener('click', () => {
    const conv = getActiveConversation();
    if (!conv || conv.messages.length === 0) return;
    conv.messages = [];
    conv.title = 'New Conversation';
    conversationTitle.textContent = conv.title;
    saveConversations();
    setActiveConversation(conv.id);
});

// Suggestion chips
suggestions.addEventListener('click', (e) => {
    const chip = e.target.closest('.suggestion-chip');
    if (chip) {
        handleSend(chip.dataset.query);
    }
});

// ===== Init =====
function init() {
    initTheme();

    if (conversations.length === 0) {
        createConversation();
    } else {
        setActiveConversation(conversations[0].id);
    }
    renderHistory();
    messageInput.focus();
}

init();