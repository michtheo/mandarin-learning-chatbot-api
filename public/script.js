// Select DOM elements
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const themeToggleBtn = document.getElementById('theme-toggle');

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
// 2. Chat Submit & API Interaction Logic
// ==========================================
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Clear input field immediately
  input.value = '';

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
        // Set HTML content from parsed markdown
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
