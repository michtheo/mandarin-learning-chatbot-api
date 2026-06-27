// Select DOM elements
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const themeToggleBtn = document.getElementById('theme-toggle');
const pinyinToggleBtn = document.getElementById('pinyin-toggle');
const pinyinCandidatesPanel = document.getElementById('pinyin-candidates');
const micBtn = document.getElementById('mic-btn');

// Maintain conversation history in the structure expected by the API:
// { role: "user" | "model", text?: string, audio?: { mimeType: string, data: string } }
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
// 3. Voice Recording (MediaRecorder API)
// ==========================================
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioStream = null;

// Start recording audio
async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Microphone recording is not supported in this browser.");
    return;
  }

  audioChunks = [];
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Choose appropriate mime type supported by the browser
    let options = {};
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      options = { mimeType: 'audio/webm' };
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      options = { mimeType: 'audio/ogg' };
    }

    mediaRecorder = new MediaRecorder(audioStream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Convert audio blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        const mimeType = audioBlob.type || 'audio/webm';
        
        // Send the audio file to the API
        await sendVoiceMessage(base64Data, mimeType, audioUrl);
      };
    };

    mediaRecorder.start();
    isRecording = true;
    micBtn.classList.add('recording');
    input.placeholder = "Recording voice... Click mic to stop & send.";
    input.disabled = true;
  } catch (error) {
    console.error('Error accessing microphone:', error);
    alert('Could not access microphone. Please check your browser permissions.');
    stopRecordingState();
  }
}

// Stop recording audio
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  stopRecordingState();
}

function stopRecordingState() {
  isRecording = false;
  micBtn.classList.remove('recording');
  input.placeholder = pinyinActive ? "Type pinyin (e.g. 'nihao')..." : "Type your message here...";
  input.disabled = false;
  
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
}

// Toggle recording click handler
micBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});


// ==========================================
// 4. API Communication Logic
// ==========================================

// Handle text form submission
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Clear input field, reset height, and hide candidate box immediately
  input.value = '';
  input.style.height = 'auto';
  hideCandidates();

  // Add user message to UI and history
  appendMessage('user', userMessage);
  conversationHistory.push({ role: 'user', text: userMessage });

  await fetchChatResponse();
});

// Handle sending recorded audio message
async function sendVoiceMessage(base64Data, mimeType, audioUrl) {
  // Add audio message to UI (bubble with audio controls)
  appendMessage('user', '', audioUrl);

  // Add audio message to conversation history
  conversationHistory.push({
    role: 'user',
    text: '',
    audio: {
      mimeType: mimeType,
      data: base64Data
    }
  });

  await fetchChatResponse();
}

// Fetch generated content response from backend
async function fetchChatResponse() {
  // Show a temporary "Thinking..." bot message
  const thinkingElement = appendMessage('bot', 'Thinking...');

  // Disable form inputs during the request
  const submitButton = form.querySelector('button[type="submit"]');
  input.disabled = true;
  if (submitButton) submitButton.disabled = true;
  micBtn.disabled = true;

  try {
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

    if (data && data.result) {
      const aiReply = data.result;
      
      thinkingElement.classList.remove('thinking');
      
      // Render Markdown to HTML
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
    
    thinkingElement.classList.remove('thinking');
    thinkingElement.textContent = 'Sorry, no response received.';
    thinkingElement.style.color = '#ff6b6b';

    // Remove the last user message to keep conversation alternating
    conversationHistory.pop();
  } finally {
    // Re-enable form inputs
    input.disabled = false;
    if (submitButton) submitButton.disabled = false;
    micBtn.disabled = false;
    input.focus();

    // Auto scroll chat box to bottom
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

/**
 * Appends a message bubble (optionally with an audio player) to the chat box.
 * 
 * @param {string} sender - 'user' or 'bot'
 * @param {string} text - The message content text
 * @param {string} [audioUrl] - Optional local audio player source URL
 * @returns {HTMLDivElement} The actual message content element
 */
function appendMessage(sender, text, audioUrl = null) {
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
  } else if (text) {
    if (sender === 'bot' && typeof marked !== 'undefined') {
      msg.innerHTML = marked.parse(text);
    } else {
      msg.textContent = text;
    }
  }

  // Render audio player if voice recording URL is provided
  if (audioUrl) {
    const audioPlayer = document.createElement('audio');
    audioPlayer.src = audioUrl;
    audioPlayer.controls = true;
    audioPlayer.style.display = 'block';
    audioPlayer.style.marginTop = '6px';
    audioPlayer.style.maxWidth = '240px';
    msg.appendChild(audioPlayer);
  }

  wrapper.appendChild(msg);
  chatBox.appendChild(wrapper);
  
  // Auto scroll chat box to the latest message
  chatBox.scrollTop = chatBox.scrollHeight;

  return msg;
}
