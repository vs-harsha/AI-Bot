// ── State ──────────────────────────────────────────────────────
let conversationHistory = [];
let isLoading = false;
let systemPrompt = document.getElementById('systemPrompt').value.trim();

// ── DOM refs ────────────────────────────────────────────────────
const messagesEl   = document.getElementById('messages');
const userInput    = document.getElementById('userInput');
const sendBtn      = document.getElementById('sendBtn');
const welcomeScreen = document.getElementById('welcomeScreen');
const statusDot    = document.getElementById('statusDot');
const topbarTitle  = document.getElementById('topbarTitle');

// ── Marked config ───────────────────────────────────────────────
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

// ── Helpers ─────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function scrollToBottom(smooth = true) {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

function setLoading(val) {
  isLoading = val;
  sendBtn.disabled = val || userInput.value.trim() === '';
  statusDot.className = 'status-dot' + (val ? ' loading' : '');
  userInput.disabled = val;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderMarkdown(content) {
  try {
    return marked.parse(content);
  } catch {
    return escapeHtml(content).replace(/\n/g, '<br>');
  }
}

function addCopyButtons(bubbleEl) {
  bubbleEl.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-code-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.innerText || '';
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = 'Copy'), 2000);
      });
    });
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
}

function highlightCode(bubbleEl) {
  bubbleEl.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
  });
  addCopyButtons(bubbleEl);
}

// ── Create message row ──────────────────────────────────────────
function createMessageRow(role, content = '') {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === 'ai' ? '🤖' : '👤';

  const msgContent = document.createElement('div');
  msgContent.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;

  if (content) {
    bubble.innerHTML = role === 'ai' ? renderMarkdown(content) : escapeHtml(content).replace(/\n/g, '<br>');
    if (role === 'ai') highlightCode(bubble);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn';
  copyBtn.textContent = '📋 Copy';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(bubble.innerText).then(() => {
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => (copyBtn.textContent = '📋 Copy'), 2000);
    });
  });
  actions.appendChild(copyBtn);

  msgContent.appendChild(bubble);
  msgContent.appendChild(actions);

  if (role === 'user') {
    row.appendChild(msgContent);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(msgContent);
  }

  return { row, bubble };
}

// ── Typing indicator ────────────────────────────────────────────
function createTypingIndicator() {
  const row = document.createElement('div');
  row.className = 'message-row ai typing-indicator';
  row.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'avatar ai';
  avatar.textContent = '🤖';

  const msgContent = document.createElement('div');
  msgContent.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'bubble ai';
  [1, 2, 3].forEach(() => {
    const dot = document.createElement('div');
    dot.className = 'typing-dot';
    bubble.appendChild(dot);
  });

  msgContent.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(msgContent);
  return row;
}

// ── Send message ────────────────────────────────────────────────
async function sendMessage(text) {
  if (!text.trim() || isLoading) return;

  // Hide welcome screen
  if (welcomeScreen) welcomeScreen.remove();

  // Update title on first message
  if (conversationHistory.length === 0) {
    topbarTitle.textContent = text.length > 40 ? text.slice(0, 40) + '…' : text;
  }

  // Add user message to DOM
  const { row: userRow } = createMessageRow('user', text);
  messagesEl.appendChild(userRow);
  scrollToBottom();

  // Add to history
  conversationHistory.push({ role: 'user', content: text });

  // Show typing indicator
  const typingEl = createTypingIndicator();
  messagesEl.appendChild(typingEl);
  scrollToBottom();

  setLoading(true);

  // Create AI message row (will be filled as stream comes in)
  let aiText = '';
  let aiRow = null;
  let aiBubble = null;

  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory,
        system_prompt: systemPrompt,
      }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    // Remove typing indicator and create real AI bubble
    typingEl.remove();
    const created = createMessageRow('ai');
    aiRow = created.row;
    aiBubble = created.bubble;
    messagesEl.appendChild(aiRow);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;

        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) {
            aiBubble.innerHTML = `<span style="color:#f87171;">Error: ${escapeHtml(parsed.error)}</span>`;
            break;
          }
          if (parsed.content) {
            aiText += parsed.content;
            aiBubble.innerHTML = renderMarkdown(aiText);
            highlightCode(aiBubble);
            scrollToBottom(false);
          }
        } catch { /* ignore parse errors */ }
      }
    }

    // Save to history
    if (aiText) {
      conversationHistory.push({ role: 'assistant', content: aiText });
    }

  } catch (err) {
    typingEl.remove();
    if (!aiRow) {
      const created = createMessageRow('ai', '');
      aiRow = created.row;
      aiBubble = created.bubble;
      messagesEl.appendChild(aiRow);
    }
    aiBubble.innerHTML = `<span style="color:#f87171;">⚠️ ${escapeHtml(err.message)}</span>`;
  } finally {
    setLoading(false);
    scrollToBottom();
  }
}

// ── Event listeners ─────────────────────────────────────────────

// Input auto-resize & enable/disable send
userInput.addEventListener('input', () => {
  autoResize(userInput);
  sendBtn.disabled = userInput.value.trim() === '' || isLoading;
});

// Enter to send, Shift+Enter for newline
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = userInput.value.trim();
    if (text && !isLoading) {
      userInput.value = '';
      autoResize(userInput);
      sendBtn.disabled = true;
      sendMessage(text);
    }
  }
});

// Send button
sendBtn.addEventListener('click', () => {
  const text = userInput.value.trim();
  if (text && !isLoading) {
    userInput.value = '';
    autoResize(userInput);
    sendBtn.disabled = true;
    sendMessage(text);
  }
});

// Suggestion buttons
document.querySelectorAll('.suggestion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.q;
    sendMessage(q);
  });
});

// Clear chat
document.getElementById('clearChat').addEventListener('click', () => {
  conversationHistory = [];
  messagesEl.innerHTML = '';
  topbarTitle.textContent = 'New Chat';

  // Re-add welcome screen
  const ws = document.createElement('div');
  ws.id = 'welcomeScreen';
  ws.className = 'welcome-screen';
  ws.innerHTML = `
    <div class="welcome-icon">🤖</div>
    <h1 class="welcome-title">AI Chatbot</h1>
    <p class="welcome-sub">Powered by Groq · LLaMA 3.3 70B · Free</p>
    <div class="suggestions">
      <button class="suggestion-btn" data-q="What can you help me with?">What can you help me with?</button>
      <button class="suggestion-btn" data-q="Write a Python function to sort a list">Write a Python function to sort a list</button>
      <button class="suggestion-btn" data-q="Explain quantum computing in simple terms">Explain quantum computing simply</button>
      <button class="suggestion-btn" data-q="Give me 5 creative startup ideas">Give me 5 creative startup ideas</button>
    </div>`;
  messagesEl.appendChild(ws);

  ws.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.q));
  });
});

// Sidebar toggle
const sidebar = document.getElementById('sidebar');
document.getElementById('toggleSidebar').addEventListener('click', () => {
  sidebar.classList.toggle('hidden');
});
document.getElementById('closeSidebar').addEventListener('click', () => {
  sidebar.classList.add('hidden');
});

// New Chat button
document.getElementById('newChatBtn').addEventListener('click', () => {
  document.getElementById('clearChat').click();
});

// Apply system prompt
document.getElementById('applyPrompt').addEventListener('click', () => {
  systemPrompt = document.getElementById('systemPrompt').value.trim();
  const btn = document.getElementById('applyPrompt');
  btn.textContent = '✓ Applied';
  setTimeout(() => (btn.textContent = 'Apply'), 2000);
});

// Focus input on load
userInput.focus();
