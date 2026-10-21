import { translator } from './i18n.js';

export class ChatPanel {
  constructor(mount, options) {
    this.mount = mount;
    this.options = options;
    // Re-resolve the language on every lookup: the widget mounts before the
    // host SPA renders, so a translator captured here would freeze the
    // (empty, English) detection result for the whole session.
    this.t = (key) => translator()(key);
    this.messages = [];
    this.isOpen = false;
    this.isLoading = false;
    this.conversationId = null;
    this.visitorId = this.getVisitorId();
    this.onStateChange = options.onStateChange || (() => {});
    this.handoff = { active: false, pending: false, handoffId: null };
    this.handoffStream = null;

    this.container = document.createElement('div');
    this.container.className = 'sa-chat-panel';
    this.container.style.display = 'none';
    this.mount.appendChild(this.container);

    this.render();

    // Update version if provided
    if (options.chatVersion) {
      this.versionEl.textContent = options.chatVersion;
    }
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
          <div class="sa-chat-header-status">${this.t('online')}</div>
        </div>
        <button class="sa-chat-close" aria-label="${this.t('closeChat')}">&times;</button>
        <div class="sa-chat-header-version">v 00:00:00</div>
      </div>
      <div class="sa-chat-messages"></div>
      <div class="sa-chat-input">
        <textarea placeholder="${this.t('placeholder')}" rows="1"></textarea>
        <button class="sa-chat-send" aria-label="${this.t('sendMessage')}">
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
    this.versionEl = this.container.querySelector('.sa-chat-header-version');

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
    this.refreshStrings();
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

  // The page language can only be trusted once the host page has rendered, so
  // the visible strings are refreshed every time the panel is opened.
  refreshStrings() {
    if (this.textarea) this.textarea.placeholder = this.t('placeholder');
    if (this.closeBtn) this.closeBtn.setAttribute('aria-label', this.t('closeChat'));
    if (this.sendBtn) this.sendBtn.setAttribute('aria-label', this.t('sendMessage'));
    const status = this.container.querySelector('.sa-chat-header-status');
    if (status) status.textContent = this.t('online');
  }

  addMessage(role, content, label) {
    this.messages.push({ role, content, timestamp: Date.now() });

    const el = document.createElement('div');
    el.className = `sa-msg sa-msg-${role}`;
    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'sa-msg-label';
      labelEl.textContent = label;
      el.appendChild(labelEl);
    }
    const textEl = document.createElement('div');
    textEl.className = 'sa-msg-text';
    textEl.textContent = content;
    el.appendChild(textEl);
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return el;
  }

  // Offers the visitor the choice to be answered by a person, right below
  // the assistant's reply.
  addEscalationAction() {
    const btn = document.createElement('button');
    btn.className = 'sa-msg-action';
    btn.type = 'button';
    btn.textContent = this.t('talkToHuman');
    btn.addEventListener('click', () => {
      btn.disabled = true;
      this.sendMessage(this.t('talkToHuman'), { escalate: true });
    });
    this.messagesEl.appendChild(btn);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  // Live channel to the operator: the human's answers arrive here in real
  // time, without the visitor having to ask again.
  openHandoffStream() {
    if (this.handoffStream) return;
    try {
      const url = `${this.options.apiUrl}/api/public/widgets/${this.options.slug}/handoffs/stream`
        + `?visitorId=${encodeURIComponent(this.visitorId)}`;
      const stream = new EventSource(url);
      this.handoffStream = stream;

      stream.addEventListener('operator_message', (e) => {
        let payload = {};
        try { payload = JSON.parse(e.data); } catch {}
        const text = payload.message?.content || '';
        if (!text) return;
        this.handoff.active = true;
        this.addMessage('operator', text, this.t('operatorReply'));
      });

      stream.addEventListener('handoff_ended', () => {
        this.closeHandoffStream();
        this.handoff = { active: false, pending: false, handoffId: null };
        this.addMessage('assistant', this.t('handoffEnded'));
      });

      stream.onerror = () => {
        // EventSource reconnects on its own; nothing to do here.
      };
    } catch (err) {
      console.error('[SiteAssistant] Failed to open handoff stream:', err);
    }
  }

  closeHandoffStream() {
    try { this.handoffStream?.close(); } catch {}
    this.handoffStream = null;
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

  async sendMessage(presetText, opts = {}) {
    const text = (presetText ?? this.textarea.value).trim();
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
          escalate: !!opts.escalate,
          handoff: this.handoff.active,
        }),
      });

      const data = await response.json().catch(() => ({}));
      this.hideTyping();

      if (data.conversationId) this.conversationId = data.conversationId;

      if (data.handoff?.handoffId) {
        this.handoff = {
          active: !!data.handoff.active,
          pending: !!data.handoff.pending,
          handoffId: data.handoff.handoffId,
        };
        this.openHandoffStream();
      }

      if (data.response) {
        this.addMessage('assistant', data.response);
        if (data.escalation?.available) {
          this.addEscalationAction();
        }
      } else if (data.handoff?.active) {
        // Handed to a human: the answer arrives over the live channel.
      } else {
        this.addMessage('assistant', data.message || this.t('error'));
      }
    } catch (err) {
      this.hideTyping();
      this.addMessage('assistant', this.t('offline'));
    }
  }

  destroy() {
    this.closeHandoffStream();
    this.container?.remove();
  }
}
