import { Avatar } from './avatar.js';
import { ChatPanel } from './chat.js';
import { ProactiveEngine } from './proactive.js';
import { createStyles } from './styles.js';

class SiteAssistant {
  constructor(config) {
    this.config = config;
    this.slug = config.slug;
    this.apiUrl = config.apiUrl;
    this.widgetConfig = null;
    this.shadow = null;
    this.avatar = null;
    this.chat = null;
    this.proactive = null;
    this.isLoaded = false;
    this.init();
  }

  async init() {
    try {
      const resp = await fetch(`${this.apiUrl}/api/public/widgets/${this.slug}/config`);
      if (!resp.ok) throw new Error('Failed to load widget config');
      this.widgetConfig = await resp.json();
      this.render();
      this.isLoaded = true;
      this.trackEvent('widget_loaded');
    } catch (err) {
      console.error('[SiteAssistant] Failed to initialize:', err);
      this.renderFallback();
    }
  }

  render() {
    const host = document.createElement('div');
    host.id = 'site-assistant-host';
    host.style.cssText = 'all:initial; position:fixed; z-index:2147483647; pointer-events:none; inset:0;';
    document.body.appendChild(host);

    this.shadow = host.attachShadow({ mode: 'open' });
    createStyles(this.shadow);

    const container = document.createElement('div');
    container.className = 'sa-container';
    container.dataset.position = this.widgetConfig.appearance?.position || 'bottom-right';

    const primaryColor = this.widgetConfig.appearance?.primaryColor || '#6366f1';
    document.documentElement.style.setProperty('--sa-primary', primaryColor);

    const avatarWrapper = document.createElement('div');
    avatarWrapper.style.cssText = 'pointer-events:auto;';
    container.appendChild(avatarWrapper);

    this.avatar = new Avatar(avatarWrapper, {
      primaryColor,
      animationsEnabled: this.widgetConfig.appearance?.animationsEnabled !== false,
    });

    this.shadow.appendChild(container);

    const chatHost = document.createElement('div');
    chatHost.style.cssText = 'pointer-events:auto;';
    container.appendChild(chatHost);

    this.chat = new ChatPanel(this.shadow, {
      personality: this.widgetConfig.personality,
      apiUrl: this.apiUrl,
      slug: this.slug,
      onStateChange: (state) => this.avatar?.setState(state),
    });

    const avatarBtn = this.shadow.querySelector('.sa-avatar-btn') || this.createAvatarButton();
    if (avatarBtn) {
      avatarBtn.addEventListener('click', () => {
        this.chat.toggle();
        this.avatar.setState(this.chat.isOpen ? 'attention' : 'idle');
        this.trackEvent(this.chat.isOpen ? 'chat_opened' : 'chat_closed');
      });
    }

    this.proactive = new ProactiveEngine({
      behavior: this.widgetConfig.behavior,
      onProactiveMessage: (message, key) => this.showProactiveBubble(message, key),
    });
  }

  createAvatarButton() {
    const btn = document.createElement('button');
    btn.className = 'sa-avatar-btn';
    btn.setAttribute('aria-label', 'Open assistant');

    const primaryColor = this.widgetConfig.appearance?.primaryColor || '#6366f1';
    btn.style.background = primaryColor;

    const name = this.widgetConfig.personality?.name || 'Assistant';
    const initial = name.charAt(0).toUpperCase();
    btn.innerHTML = `<span style="color:white;font-weight:600;font-size:18px;">${initial}</span>`;

    const container = this.shadow.querySelector('.sa-container');
    if (container) {
      container.insertBefore(btn, container.firstChild);
    }

    return btn;
  }

  showProactiveBubble(message, triggerKey) {
    const container = this.shadow.querySelector('.sa-container');
    if (!container || this.chat?.isOpen) return;

    this.avatar?.setState('attention');

    const bubble = document.createElement('div');
    bubble.className = 'sa-proactive-bubble';
    bubble.innerHTML = `
      ${message}
      <button class="sa-proactive-dismiss" aria-label="Dismiss">&times;</button>
    `;

    const dismissBtn = bubble.querySelector('.sa-proactive-dismiss');
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.proactive?.dismiss(triggerKey);
      bubble.remove();
      this.avatar?.setState('idle');
    });

    bubble.addEventListener('click', () => {
      bubble.remove();
      this.chat?.open();
      this.avatar?.setState('attention');
      this.proactive?.dismiss(triggerKey);
      this.trackEvent('proactive_clicked', { triggerKey, message });
    });

    const avatarBtn = container.querySelector('.sa-avatar-btn');
    if (avatarBtn) {
      container.insertBefore(bubble, avatarBtn);
    } else {
      container.prepend(bubble);
    }

    setTimeout(() => {
      if (bubble.parentNode) {
        bubble.style.opacity = '0';
        bubble.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          bubble.remove();
          if (this.avatar && !this.chat?.isOpen) {
            this.avatar.setState('idle');
          }
        }, 300);
      }
    }, 8000);

    this.trackEvent('proactive_shown', { triggerKey, message });
  }

  async trackEvent(eventType, metadata = {}) {
    try {
      await fetch(`${this.apiUrl}/api/public/widgets/${this.slug}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          metadata,
          visitorId: this.chat?.visitorId,
          pageUrl: window.location.href,
        }),
      });
    } catch {}
  }

  renderFallback() {
    const host = document.createElement('div');
    host.id = 'site-assistant-host';
    host.style.cssText = 'all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483647;pointer-events:auto;';
    host.innerHTML = `
      <div style="width:56px;height:56px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.15);cursor:pointer;font-size:24px;color:white;" role="button" aria-label="Open assistant">?</div>
    `;
    document.body.appendChild(host);
  }

  destroy() {
    this.avatar?.destroy();
    this.chat?.destroy();
    this.proactive?.destroy();
    document.getElementById('site-assistant-host')?.remove();
  }
}

function initWidget() {
  const script = document.currentScript || document.querySelector('script[data-widget-id]');
  if (!script) return;

  const widgetId = script.dataset.widgetId;
  const apiUrl = script.dataset.apiUrl || 'https://api.siteassistant.io';

  if (!widgetId) {
    console.error('[SiteAssistant] data-widget-id is required');
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SiteAssistant({ slug: widgetId, apiUrl }));
  } else {
    new SiteAssistant({ slug: widgetId, apiUrl });
  }
}

initWidget();
