// Select DOM elements
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const themeToggleBtn = document.getElementById('theme-toggle');
const pinyinToggleBtn = document.getElementById('pinyin-toggle');
const pinyinCandidatesPanel = document.getElementById('pinyin-candidates');

// Maintain conversation history in the structure expected by the API:
// { role: "user" | "model", text: string }
let conversationHistory = [];

// ==========================================
// 1. Dark Mode / Theme Toggle Logic
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

themeToggleBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
});

// Initialize theme on load
initTheme();


// ==========================================
// 2. Pinyin Input Helper (Virtual IME)
// ==========================================
let pinyinActive = false;
let candidatesList = [];
let currentQuery = '';

// Toggle Pinyin Mode
pinyinToggleBtn.addEventListener('click', () => {
  pinyinActive = !pinyinActive;
  if (pinyinActive) {
    pinyinToggleBtn.classList.add('active');
    input.placeholder = "Type pinyin (e.g. 'nihao')...";
  } else {
    pinyinToggleBtn.classList.remove('active');
    input.placeholder = "Type your message here...";
    hideCandidates();
  }
  input.focus();
});

// Monitor keypresses inside the textarea
input.addEventListener('keydown', (e) => {
  // Handle Enter key combinations
  if (e.key === 'Enter') {
    // If Pinyin candidates are showing, Enter confirms the raw pinyin English text
    if (pinyinActive && candidatesList.length > 0) {
      e.preventDefault();
      selectCandidate(currentQuery);
      return;
    }
    // If Shift + Enter is pressed, do nothing (inserts a newline naturally)
    // If Enter is pressed WITHOUT Shift, submit the form
    else if (!e.shiftKey) {
      e.preventDefault(); // Prevents line break insertion
      if (input.value.trim() !== '') {
        form.requestSubmit(); // Triggers submit handler
      }
    }
  }
  
  // Handle selection shortcuts when candidates are showing
  if (pinyinActive && candidatesList.length > 0) {
    // 1-5 selection keys
    if (e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      if (candidatesList[index]) {
        selectCandidate(candidatesList[index]);
      }
    } 
    // Space selects the first (default) candidate
    else if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      selectCandidate(candidatesList[0]);
    } 
    // Escape hides candidate box
    else if (e.key === 'Escape') {
      e.preventDefault();
      hideCandidates();
    }
  }
});

// Monitor input text changes to search for pinyin sequences
input.addEventListener('input', async () => {
  // Auto-resize textarea height
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';

  if (!pinyinActive) {
    hideCandidates();
    return;
  }

  const cursorPosition = input.selectionStart;
  const textBeforeCursor = input.value.slice(0, cursorPosition);
  
  // Match alphabetical string at the end of input before cursor
  const matches = textBeforeCursor.match(/[a-zA-Z]+$/);

  if (matches) {
    currentQuery = matches[0];
    try {
      // Query Google Input Tools Pinyin API
      const response = await fetch(`https://inputtools.google.com/request?text=${currentQuery}&itc=zh-t-i0-pinyin&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`);
      if (!response.ok) throw new Error('API fetch failed');
      
      const data = await response.json();
      
      if (data[0] === 'SUCCESS') {
        candidatesList = data[1][0][1] || [];
        if (candidatesList.length > 0) {
          renderCandidates();
        } else {
          hideCandidates();
        }
      } else {
        hideCandidates();
      }
    } catch (error) {
      console.warn('Pinyin API Error:', error);
      hideCandidates();
    }
  } else {
    hideCandidates();
  }
});

// Render Candidates dropdown panel
function renderCandidates() {
  pinyinCandidatesPanel.innerHTML = '';
  candidatesList.forEach((candidate, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'candidate-item';
    btn.textContent = `${index + 1}. ${candidate}`;
    btn.addEventListener('click', () => selectCandidate(candidate));
    pinyinCandidatesPanel.appendChild(btn);
  });
  pinyinCandidatesPanel.style.display = 'flex';
}

// Select candidate & replace pinyin in input
function selectCandidate(selectedText) {
  const cursorPosition = input.selectionStart;
  const textVal = input.value;
  const textBeforeCursor = textVal.slice(0, cursorPosition);
  const textAfterCursor = textVal.slice(cursorPosition);

  // Find where the alphabetical query starts
  const queryStart = textBeforeCursor.lastIndexOf(currentQuery);

  if (queryStart !== -1) {
    const newTextBeforeCursor = textBeforeCursor.slice(0, queryStart) + selectedText;
    input.value = newTextBeforeCursor + textAfterCursor;

    // Reset cursor position to right after inserted Chinese characters
    const newCursor = newTextBeforeCursor.length;
    input.setSelectionRange(newCursor, newCursor);
  }

  // Trigger auto-resize after insertion
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';

  hideCandidates();
  input.focus();
}

// Hide candidates panel
function hideCandidates() {
  candidatesList = [];
  currentQuery = '';
  pinyinCandidatesPanel.style.display = 'none';
  pinyinCandidatesPanel.innerHTML = '';
}


// ==========================================
// 3. Chat Submit & API Interaction Logic
// ==========================================
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Clear input field, reset height, and hide candidate box immediately
  input.value = '';
  input.style.height = 'auto';
  hideCandidates();

  // Add the user's message to the UI & history
  appendMessage('user', userMessage);
  conversationHistory.push({ role: 'user', text: userMessage });

  // Show a temporary "Thinking..." bot message
  const thinkingElement = appendMessage('bot', 'Thinking...');

  // Disable form inputs during the request to prevent double submission
  const submitButton = form.querySelector('button[type="submit"]');
  input.disabled = true;
  if (submitButton) submitButton.disabled = true;

  try {
    // Send the user's message as a POST request to /api/chat
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conversation: conversationHistory })
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();

    // Replace "Thinking..." with the AI's reply rendered from Markdown to HTML
    if (data && data.result) {
      const aiReply = data.result;
      
      thinkingElement.classList.remove('thinking');
      
      // Translate Markdown to HTML using marked library, with textContent fallback
      if (typeof marked !== 'undefined') {
        thinkingElement.innerHTML = marked.parse(aiReply);
      } else {
        thinkingElement.textContent = aiReply;
      }
      
      // Add the model's reply to the conversation history
      conversationHistory.push({ role: 'model', text: aiReply });
    } else {
      throw new Error('No result property found in response');
    }
  } catch (error) {
    console.error('Failed to get chat response:', error);
    
    // Show error message to user
    thinkingElement.classList.remove('thinking');
    thinkingElement.textContent = 'Sorry, no response received.';
    thinkingElement.style.color = '#ff6b6b';

    // Remove the last user message from conversation history so that subsequent
    // messages don't fail due to two consecutive 'user' roles in Gemini API
    conversationHistory.pop();
  } finally {
    // Re-enable form inputs and focus on input field
    input.disabled = false;
    if (submitButton) submitButton.disabled = false;
    input.focus();

    // Auto scroll chat box to the latest message
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

/**
 * Appends a message to the chat box inside a clearing container wrapper
 * to prevent float alignment issues in style.css.
 * 
 * @param {string} sender - 'user' or 'bot'
 * @param {string} text - The message content
 * @returns {HTMLDivElement} The actual message content element
 */
function appendMessage(sender, text) {
  // Hide welcome container when the first message is sent
  const welcomeContainer = document.querySelector('.welcome-container');
  if (welcomeContainer) {
    welcomeContainer.style.display = 'none';
  }

  // Create wrapper to clear floats and structure each message on a new line
  const wrapper = document.createElement('div');
  wrapper.style.clear = 'both';
  wrapper.style.display = 'flow-root'; 
  wrapper.style.width = '100%';

  // Create message bubble
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  
  if (text === 'Thinking...') {
    msg.classList.add('thinking');
    msg.textContent = text;
  } else if (sender === 'bot' && typeof marked !== 'undefined') {
    msg.innerHTML = marked.parse(text);
  } else {
    msg.textContent = text;
  }

  wrapper.appendChild(msg);
  chatBox.appendChild(wrapper);
  
  // Auto scroll chat box to the latest message
  chatBox.scrollTop = chatBox.scrollHeight;

  return msg;
}
