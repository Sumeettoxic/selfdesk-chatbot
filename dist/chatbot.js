/**
 * Self Desk Assistant - v1.0.0
 * A comprehensive chatbot solution with voice capabilities and media support
 */
(function(window, document) {
  'use strict';
  
  // Configuration constants
  const CONFIG = {
    VERSION: '1.0.0',
    CSS_URL: 'https://cdn.jsdelivr.net/gh/imtoxiii/selfdesk-chatbot@latest/dist/chatbot.css',
    TRANSCRIPT_API: 'https://n8n.prayogeek.in/webhook/fbfb5fd8-ac96-41b8-a246-ff5e94fa77d6',
    CHAT_API: 'https://n8n.prayogeek.in/webhook/2fac5cf2-f190-4cff-a47e-dff1ae1bfb98',
    TRANSLATION_API: 'https://n8n.prayogeek.in/webhook/72a57608-fa58-4d19-9e55-8f36608345d7',
    VALIDATE_API: 'https://your-api-endpoint.com/validate-key'
  };
  
  // Create global SelfDeskAssistant object
  const SelfDeskAssistant = (function() {
    // Private variables
    let elements = {};
    let state = {
      initialized: false,
      isExpanded: false,
      isRecording: false,
      micStream: null,
      mediaRecorder: null,
      audioContext: null,
      audioChunks: [],
      youtubePlayer: null,
      lang_code: "en-IN",
      videoAudioEnabled: false,
      hasShownChatbot: false,
      defaultVideoUrl: ''
    };
    let options = {};
    
    // Validate API key
    async function _validateApiKey(apiKey) {
      if (!apiKey) return true; // Skip validation if no API key provided
      
      try {
        const response = await fetch(CONFIG.VALIDATE_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: apiKey,
            domain: window.location.hostname
          })
        });
        
        if (!response.ok) return false;
        
        const data = await response.json();
        return data.valid === true;
      } catch (error) {
        console.error('API key validation failed:', error);
        return false;
      }
    }
    
    // Load CSS resource
    function _loadCSS() {
      if (document.getElementById('sd-styles')) return;
      
      const link = document.createElement('link');
      link.id = 'sd-styles';
      link.rel = 'stylesheet';
      link.href = CONFIG.CSS_URL;
      document.head.appendChild(link);
    }
    
    // Create DOM structure for the chatbot
    function _createChatbotDOM() {
      // Create root container
      const container = document.createElement('div');
      container.className = 'sd-chatbot';
      container.id = 'sd-chatbot';
      
      // Create toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'sd-chatbot-toggle';
      toggleBtn.id = 'sd-chatbotToggle';
      toggleBtn.innerHTML = '<i data-lucide="message-square"></i>';
      
      // Create chatbot window
      const chatWindow = document.createElement('div');
      chatWindow.className = 'sd-chatbot-window';
      chatWindow.id = 'sd-chatbotWindow';
      
      // Build header
      const header = document.createElement('div');
      header.className = 'sd-chatbot-header';
      header.innerHTML = `
        <div class="sd-chatbot-title">
          <i data-lucide="mic" id="sd-voiceStatus"></i>
          <span>Self Desk Assistant</span>
        </div>
        <button class="sd-close-btn" id="sd-closeChat">
          <i data-lucide="x"></i>
        </button>
      `;
      
      // Build content
      const content = document.createElement('div');
      content.className = 'sd-chatbot-content';
      
      // Media panel
      const mediaPanel = document.createElement('div');
      mediaPanel.className = 'sd-media-panel';
      mediaPanel.innerHTML = `
        <div class="sd-media-content">
          <div class="sd-media-header">
            <i data-lucide="image"></i>
            <h3>Media Content</h3>
          </div>
          <div class="sd-media-body">
            <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80" 
                 alt="Default Image" 
                 class="sd-featured-image"
                 id="sd-default-image">
            <div class="sd-video-container">
              <!-- Video will be added dynamically -->
            </div>
          </div>
        </div>
      `;
      
      // Chat panel
      const chatPanel = document.createElement('div');
      chatPanel.className = 'sd-chat-panel';
      chatPanel.innerHTML = `
        <div class="sd-messages" id="sd-messages">
          <!-- Messages will be added dynamically -->
        </div>
        <div class="sd-chat-input">
          <input type="text" 
                 id="sd-messageInput" 
                 placeholder="Type your message..."
                 class="sd-message-input">
          <button class="sd-voice-btn" id="sd-voiceBtn">
            <i data-lucide="mic"></i>
          </button>
          <button class="sd-send-btn" id="sd-sendBtn">
            <i data-lucide="send"></i>
          </button>
        </div>
      `;
      
      // Assemble the DOM structure
      content.appendChild(mediaPanel);
      content.appendChild(chatPanel);
      chatWindow.appendChild(header);
      chatWindow.appendChild(content);
      container.appendChild(toggleBtn);
      container.appendChild(chatWindow);
      
      // Add to page
      const targetElement = document.getElementById('self-desk-assistant');
      if (targetElement) {
        targetElement.appendChild(container);
      } else {
        document.body.appendChild(container);
      }
      
      // Store element references
      elements = {
        container: container,
        toggle: toggleBtn,
        window: chatWindow,
        closeBtn: document.getElementById('sd-closeChat'),
        messages: document.getElementById('sd-messages'),
        messageInput: document.getElementById('sd-messageInput'),
        sendBtn: document.getElementById('sd-sendBtn'),
        voiceBtn: document.getElementById('sd-voiceBtn'),
        voiceStatus: document.getElementById('sd-voiceStatus'),
        defaultImage: document.getElementById('sd-default-image'),
        videoContainer: document.querySelector('.sd-video-container')
      };
    }
    
    // Load dependencies
    function _loadDependencies() {
      // Load Lucide icons
      if (!window.lucide) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/lucide@latest';
        script.onload = function() {
          if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
          }
        };
        document.head.appendChild(script);
      } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
      
      // Load YouTube API
      if (!window.YT) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }
    
    // Toggle chatbot visibility
    function _toggleChatbot(show = true) {
      state.isExpanded = show;
      if (show) {
        elements.window.style.display = 'flex';
        setTimeout(() => elements.window.classList.add('active'), 10);
        elements.toggle.style.display = 'none';
        _updateDefaultVideo();
      } else {
        elements.window.classList.remove('active');
        setTimeout(() => {
          elements.window.style.display = 'none';
          elements.toggle.style.display = 'flex';
        }, 500);
      }
    }
    
    // Add message to chat
    function _addMessage(content, isUser = false) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `sd-message ${isUser ? 'user' : 'bot'}`;
      messageDiv.innerHTML = `
        <div class="sd-message-content">${content}</div>
      `;
      elements.messages.appendChild(messageDiv);
      elements.messages.scrollTop = elements.messages.scrollHeight;
    }
    
    // Show default image
    function _showDefaultImage() {
      if (state.youtubePlayer) {
        try {
          state.youtubePlayer.destroy();
          state.youtubePlayer = null;
        } catch (error) {
          console.error('Error destroying YouTube player:', error);
        }
      }
      
      if (elements.videoContainer) elements.videoContainer.style.display = 'none';
      if (elements.defaultImage) {
        elements.defaultImage.style.display = 'block';
        elements.defaultImage.src = 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80';
      }
    }
    
    // Extract YouTube video ID from URL
    function _extractYouTubeId(url) {
      if (!url) return null;
      
      try {
        url = url.trim();
        
        if (url.includes('youtu.be/')) {
          return url.split('youtu.be/')[1].split(/[?&#]/)[0];
        }
        
        if (url.includes('/embed/')) {
          return url.split('/embed/')[1].split(/[?&#]/)[0];
        }
        
        if (url.includes('/shorts/')) {
          return url.split('/shorts/')[1].split(/[?&#]/)[0];
        }
        
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
          const videoId = urlObj.searchParams.get('v');
          if (videoId) return videoId;
          
          if (urlObj.pathname.includes('/shorts/')) {
            return urlObj.pathname.split('/shorts/')[1].split(/[?&#]/)[0];
          }
          
          if (urlObj.pathname.includes('/embed/')) {
            return urlObj.pathname.split('/embed/')[1].split(/[?&#]/)[0];
          }
        }
        
        return null;
      } catch (error) {
        console.error('Error extracting YouTube ID:', error);
        return null;
      }
    }
    
    // Update YouTube video
    function _updateYouTubeVideo(url) {
      if (!url) return;
      
      const videoId = _extractYouTubeId(url);
      if (!videoId) {
        console.error('Invalid YouTube URL:', url);
        _showDefaultImage();
        return;
      }
      
      if (elements.defaultImage) elements.defaultImage.style.display = 'none';
      if (elements.videoContainer) elements.videoContainer.style.display = 'block';
      
      if (state.youtubePlayer) {
        try {
          state.youtubePlayer.destroy();
        } catch (error) {
          console.error('Error destroying YouTube player:', error);
        }
      }
      
      let playerDiv = document.getElementById('sd-player');
      if (!playerDiv) {
        playerDiv = document.createElement('div');
        playerDiv.id = 'sd-player';
        elements.videoContainer.appendChild(playerDiv);
      }
      
      state.youtubePlayer = new YT.Player('sd-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          mute: state.videoAudioEnabled ? 0 : 1,
          playsinline: 1,
          modestbranding: 1,
          controls: 1,
          rel: 0,
          fs: 1,
          loop: 1,
          playlist: videoId
        },
        events: {
          onReady: _onPlayerReady,
          onStateChange: _onPlayerStateChange
        }
      });
    }
    
    // YouTube player event handlers
    function _onPlayerReady(event) {
      event.target.playVideo();
      
      if (state.videoAudioEnabled) {
        event.target.unMute();
        event.target.setVolume(100);
      } else {
        event.target.mute();
      }
    }
    
    function _onPlayerStateChange(event) {
      if (event.data === YT.PlayerState.ENDED) {
        event.target.playVideo();
      }
    }
    
    // Start recording
    async function _startRecording() {
      try {
        if (!state.micStream) {
          state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        state.mediaRecorder = new MediaRecorder(state.micStream);
        state.audioContext = new AudioContext();
        const analyser = state.audioContext.createAnalyser();
        const microphone = state.audioContext.createMediaStreamSource(state.micStream);
        microphone.connect(analyser);
        analyser.fftSize = 2048;
        
        state.audioChunks = [];
        
        let silenceStart = 0;
        const SILENCE_THRESHOLD = 0.1;
        const SILENCE_DURATION = 2000;
        
        const checkAudioLevel = () => {
          if (!state.isRecording) return;
          
          const buffer = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(buffer);
          const rms = Math.sqrt(buffer.reduce((sum, x) => sum + x * x, 0) / buffer.length);
          
          // Update microphone animation based on audio level
          const intensity = Math.min(rms * 5, 1);
          elements.voiceBtn.style.transform = `scale(${1 + intensity * 0.2})`;
          elements.voiceBtn.style.backgroundColor = `rgba(239, 68, 68, ${0.8 + intensity * 0.2})`;
          
          if (rms < SILENCE_THRESHOLD) {
            if (!silenceStart) silenceStart = Date.now();
            if (Date.now() - silenceStart > SILENCE_DURATION) {
              _stopRecording();
              return;
            }
          } else {
            silenceStart = 0;
          }
          
          if (state.isRecording) requestAnimationFrame(checkAudioLevel);
        };
        
        state.mediaRecorder.ondataavailable = event => {
          if (event.data.size > 0) {
            state.audioChunks.push(event.data);
          }
        };
        
        state.mediaRecorder.onstop = async () => {
          if (state.audioContext && state.audioContext.state !== 'closed') {
            await state.audioContext.close();
          }
          
          const audioBlob = new Blob(state.audioChunks, { type: 'audio/mpeg' });
          const transcriptionResult = await _sendAudioToTranscriptionAPI(audioBlob);
          
          if (transcriptionResult && transcriptionResult.transcript) {
            if (transcriptionResult.language_code) {
              state.lang_code = transcriptionResult.language_code;
            }
            _addMessage(transcriptionResult.transcript, true);
            _sendTextToChatAPI(transcriptionResult.transcript);
          }
          
          elements.voiceBtn.style.transform = '';
          elements.voiceBtn.style.backgroundColor = '';
          elements.voiceBtn.classList.remove('listening');
        };
        
        state.mediaRecorder.start();
        state.isRecording = true;
        elements.voiceBtn.classList.add('listening');
        checkAudioLevel();
        
      } catch (error) {
        console.error('Error starting recording:', error);
        elements.voiceBtn.classList.remove('listening');
        state.isRecording = false;
      }
    }
    
    // Stop recording
    function _stopRecording() {
      if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.isRecording = false;
        elements.voiceBtn.classList.remove('listening');
      }
    }
    
    // Send audio to transcription API
    async function _sendAudioToTranscriptionAPI(audioBlob) {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.mp3');
      
      try {
        const response = await fetch(CONFIG.TRANSCRIPT_API, {
          method: 'POST',
          headers: {
            'X-API-Key': options.apiKey
          },
          body: formData
        });
        
        const result = await response.json();
        return {
          transcript: result.transcript,
          language_code: result.language_code || 'en-IN'
        };
      } catch (error) {
        console.error('Transcription error:', error);
        return null;
      }
    }
    
    // Send text to chat API
    async function _sendTextToChatAPI(text, skipSpeech = false) {
      if (!text.trim()) return;
      
      try {
        const response = await fetch(CONFIG.CHAT_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-Key': options.apiKey
          },
          body: JSON.stringify({ 
            message: text,
            language_code: state.lang_code
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        if (result.response?.text) {
          const cleanText = await _processResponseAndUrls(result.response.text);
          
          if (!skipSpeech) {
            _addMessage(cleanText);
            await _speakText(cleanText);
          }
          
          return result;
        }
        
      } catch (error) {
        console.error('API error:', error);
        _addMessage('Sorry, I encountered an error. Please try again.');
      }
    }
    
    // Process response and handle media URLs
    async function _processResponseAndUrls(text) {
      text = text.replace(/^Original response:\s*/i, '')
                 .replace(/^response:\s*/i, '');
      
      state.videoAudioEnabled = false;
      
      const audioMatch = text.match(/audio\s*:\s*(\w+)/i);
      if (audioMatch) {
        state.videoAudioEnabled = (audioMatch[1].trim().toLowerCase() === 'unmute');
        text = text.replace(/audio\s*:\s*\w+/i, '').trim();
      }
      
      const urlMatch = text.match(/url\s*:\s*(https?:\/\/[^\s\n]+|no url)/i);
      const typeMatch = text.match(/type\s*:\s*(\w+)/i);
      
      let cleanText = text;
      
      if (urlMatch && typeMatch) {
        const url = urlMatch[1] !== 'no url' ? urlMatch[1] : null;
        const type = typeMatch[1].toLowerCase();
        
        cleanText = text
          .replace(/url\s*:\s*.*?(?:\n|$)/i, '')
          .replace(/type\s*:\s*.*?(?:\n|$)/i, '')
          .trim();
        
        if (url && type) {
          if (type === 'video') {
            _updateYouTubeVideo(url);
          } else {
            _showDefaultImage();
          }
        }
      }
      
      return cleanText;
    }
    
    // Update default video
    async function _updateDefaultVideo() {
      try {
        const result = await _sendTextToChatAPI('Home Page Youtube Link', true);
        if (result?.response?.text) {
          const urlMatch = result.response.text.match(/url\s*:\s*(https?:\/\/[^\s\n]+)/i);
          if (urlMatch && urlMatch[1] && (urlMatch[1].includes('youtube.com') || urlMatch[1].includes('youtu.be'))) {
            state.defaultVideoUrl = urlMatch[1];
            state.videoAudioEnabled = false;
            _updateYouTubeVideo(urlMatch[1]);
          }
        }
      } catch (error) {
        console.error('Error updating default video:', error);
      }
    }
    
    // Translate text
    async function _translateText(text, targetLang) {
      if (!text) throw new Error('Input text is required');
      
      const formData = new FormData();
      formData.append("input", text);
      formData.append("target_language_code", targetLang);
            
      const response = await fetch(CONFIG.TRANSLATION_API, {
        method: 'POST',
        headers: {
          'X-API-Key': options.apiKey
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.translated_text;
    }
    
    // Speak text
    async function _speakText(text) {
      try {
        // Wait for voices to be loaded
        if (speechSynthesis.getVoices().length === 0) {
          await new Promise(resolve => {
            speechSynthesis.addEventListener('voiceschanged', resolve, { once: true });
          });
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const speech = new SpeechSynthesisUtterance();
        const voices = speechSynthesis.getVoices();
        
        // Translate text if not in English
        if (state.lang_code !== "en-IN" && options.enableTranslation) {
          try {
            const translatedText = await _translateText(text, state.lang_code);
            speech.text = translatedText;
          } catch (error) {
            console.error('Translation error:', error);
            speech.text = text;
          }
        } else {
          speech.text = text;
        }

        // Voice mapping for different languages
        const voiceMap = {
          'hi-IN': voices.find(v => v.lang === 'hi-IN') || voices.find(v => v.lang.startsWith('hi')),
          'kn-IN': voices.find(v => v.lang === 'kn-IN') || voices.find(v => v.lang.startsWith('kn')),
          'en-IN': voices.find(v => v.lang === 'en-IN') || voices.find(v => v.lang.startsWith('en'))
        };

        // Select appropriate voice
        speech.voice = voiceMap[state.lang_code] || voices[0];
        speech.lang = state.lang_code;
        speech.rate = 1;
        speech.pitch = 1;
        speech.volume = 1;

        // Speak the text
        window.speechSynthesis.speak(speech);

        // Return a promise that resolves when speech is complete
        return new Promise((resolve, reject) => {
          speech.onend = resolve;
          speech.onerror = reject;
        });
      } catch (error) {
        console.error('Speech synthesis error:', error);
      }
    }
    
    // Setup event listeners
    function _setupEventListeners() {
      // Toggle chatbot
      elements.toggle.addEventListener('click', () => _toggleChatbot(true));
      elements.closeBtn.addEventListener('click', () => _toggleChatbot(false));
      
      // Voice input
      elements.voiceBtn.addEventListener('click', () => {
        if (!state.isRecording) {
          _startRecording();
        } else {
          _stopRecording();
        }
      });
      
      // Text input
      elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const text = elements.messageInput.value.trim();
          if (text) {
            _addMessage(text, true);
            _sendTextToChatAPI(text);
            elements.messageInput.value = '';
          }
        }
      });
      
      elements.sendBtn.addEventListener('click', () => {
        const text = elements.messageInput.value.trim();
        if (text) {
          _addMessage(text, true);
          _sendTextToChatAPI(text);
          elements.messageInput.value = '';
        }
      });
      
      // Space bar shortcut for voice
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && 
            document.activeElement.tagName !== 'INPUT' && 
            document.activeElement.tagName !== 'TEXTAREA' &&
            options.enableShortcuts) {
          e.preventDefault();
          elements.voiceBtn.click();
        }
      });
      
      // Auto display chatbot on scroll
      if (options.showOnScroll) {
        window.addEventListener('scroll', () => {
          if (!state.hasShownChatbot) {
            const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            if (scrollPercentage >= options.scrollThreshold) {
              state.hasShownChatbot = true;
              _toggleChatbot(true);
            }
          }
        });
      }
    }
    
    // Public API
    return {
      init: async function(config) {
        if (state.initialized) {
          console.warn('Self Desk Assistant already initialized');
          return;
        }
        
        // Get API key from element if available
        const container = document.getElementById('self-desk-assistant');
        const dataApiKey = container ? container.getAttribute('data-api-key') : null;
        
        // Set default options
        options = {
          apiKey: config.apiKey || dataApiKey || '',
          language: config.language || 'en-IN',
          autoOpen: config.autoOpen || false,
          showOnScroll: config.showOnScroll !== false,
          scrollThreshold: config.scrollThreshold || 20,
          enableTranslation: config.enableTranslation !== false,
          enableShortcuts: config.enableShortcuts !== false,
          welcomeMessage: config.welcomeMessage || '👋 Hi! I\'m your assistant. How can I help you today?'
        };
        
        // Validate API key
        const isValid = await _validateApiKey(options.apiKey);
        if (!isValid && options.apiKey) {
          console.error('Invalid API key. Chatbot disabled.');
          return;
        }
        
        // Set initial language
        state.lang_code = options.language;
        
        // Load CSS
        _loadCSS();
        
        // Create DOM elements
        _createChatbotDOM();
        
        // Load dependencies
        _loadDependencies();
        
        // Setup event listeners
        _setupEventListeners();
        
        // Initialize microphone
        try {
          state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (elements.voiceStatus) elements.voiceStatus.style.color = 'white';
        } catch (error) {
          console.error('Error accessing microphone:', error);
          if (elements.voiceBtn) elements.voiceBtn.disabled = true;
        }
        
        // Add welcome message
        _addMessage(options.welcomeMessage);
        
        // Auto-open if configured
        if (options.autoOpen) {
          _toggleChatbot(true);
        }
        
        state.initialized = true;
      },
      
      open: function() {
        if (state.initialized) {
          _toggleChatbot(true);
        }
      },
      
      close: function() {
        if (state.initialized) {
          _toggleChatbot(false);
        }
      },
      
      sendMessage: function(text) {
        if (state.initialized && text) {
          _addMessage(text, true);
          _sendTextToChatAPI(text);
        }
      }
    };
  })();
  
  // Expose to global scope
  window.SelfDeskAssistant = SelfDeskAssistant;
  
})(window, document);
