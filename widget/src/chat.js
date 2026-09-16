export class ChatPanel {
  constructor(shadowRoot, options) {
    this.shadowRoot = shadowRoot;
    this.options = options;
    this.messages = [];
    this.isOpen = false;
    this.isLoading = false;
    this.conversationId = null;
    this.visitorId = this.getVisitorId();
    this.onStateChange = options.onStateChange || (() => {});

    this.container = document.createElement('div');
    this.container.className = 'sa-chat-panel';
    this.container.style.display = 'none';
    this.shadowRoot.appendChild(this.container);

    this.render();
  }

  getVisitorId() {
    let id = localStorage.getItem('sa_visitor_id');
    if (!id) {
      id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('sa_visitor_id', id);
    }
    return id;
  }

  render() {
    const name = this.options.personality?.name || 'Assistant';
    const initial = name.charAt(0).toUpperCase();

    this.container.innerHTML = `
      <div class="sa-chat-header">
        <div class="sa-chat-header-avatar">${initial}</div>
        <div class="sa-chat-header-info">
          <div class="sa-chat-header-name">${name}</div>
          <div class="sa-chat-header-status">Online</div>
        </div>
        <button class="sa-chat-close" aria-label="Close chat">&times;</button>
      </div>
      <div class="sa-chat-messages"></div>
      <div class="sa-chat-input">
        <textarea placeholder="Type a message..." rows="1"></textarea>
        <button class="sa-chat-send" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    `;

    this.messagesEl = this.container.querySelector('.sa-chat-messages');
    this.textarea = this.container.querySelector('textarea');
    this.sendBtn = this.container.querySelector('.sa-chat-send');
    this.closeBtn = this.container.querySelector('.sa-chat-close');

    this.closeBtn.addEventListener('click', () => this.close());
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.textarea.addEventListener('input', () => {
      this.textarea.style.height = 'auto';
      this.textarea.style.height = Math.min(this.textarea.scrollHeight, 80) + 'px';
    });

    const welcome = this.options.personality?.welcomeMessage;
    if (welcome) {
      this.addMessage('assistant', welcome);
    }
  }

  open() {
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.textarea?.focus();
    this.onStateChange('open');
  }

  close() {
    this.isOpen = false;
    this.container.style.display = 'none';
    this.onStateChange('closed');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  addMessage(role, content) {
    this.messages.push({ role, content, timestamp: Date.now() });

    const el = document.createElement('div');
    el.className = `sa-msg sa-msg-${role}`;
    el.textContent = content;
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  showTyping() {
    this.isLoading = true;
    this.onStateChange('thinking');
    const el = document.createElement('div');
    el.className = 'sa-msg sa-msg-assistant sa-msg-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    el.dataset.typing = 'true';
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  hideTyping() {
    this.isLoading = false;
    this.onStateChange('idle');
    const el = this.messagesEl.querySelector('[data-typing]');
    if (el) el.remove();
  }

  async sendMessage() {
    const text = this.textarea.value.trim();
    if (!text || this.isLoading) return;

    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    this.addMessage('user', text);
    this.showTyping();

    try {
      const context = {
        pageUrl: window.location.href,
        pageTitle: document.title,
        conversationId: this.conversationId,
      };

      const response = await fetch(`${this.options.apiUrl}/api/public/widgets/${this.options.slug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          visitorId: this.visitorId,
          context,
          history: this.messages.slice(-10),
        }),
      });

      const data = await response.json();
      this.hideTyping();

      if (data.response) {
        this.addMessage('assistant', data.response);
        this.conversationId = data.conversationId;
      } else {
        this.addMessage('assistant', 'Sorry, something went wrong. Please try again.');
      }
    } catch (err) {
      this.hideTyping();
      this.addMessage('assistant', 'Unable to connect. Please check your connection and try again.');
    }
  }

  destroy() {
    this.container?.remove();
  }
}
