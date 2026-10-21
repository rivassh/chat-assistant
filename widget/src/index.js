import { Avatar } from './avatar.js';
import { BUG_ICON_DATA_URI } from './assets.js';
import { ChatPanel } from './chat.js';
import { ProactiveEngine } from './proactive.js';
import { createStyles } from './styles.js';
import { translator } from './i18n.js';

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
    const t = translator();
    const host = document.createElement('div');
    host.id = 'site-assistant-host';
    host.style.cssText = 'all:initial; position:fixed; z-index:2147483647; pointer-events:none; inset:0;';
    document.body.appendChild(host);

    this.shadow = host.attachShadow({ mode: 'open' });
    createStyles(this.shadow);

    const container = document.createElement('div');
    container.className = 'sa-container';
    container.dataset.position = this.widgetConfig.appearance?.position || 'bottom-right';
    // Mirror layout for RTL pages so left-edge/right-edge and bubble alignment flip correctly.
    container.dir = getComputedStyle(document.documentElement).direction;

    const primaryColor = this.widgetConfig.appearance?.primaryColor || '#6366f1';
    document.documentElement.style.setProperty('--sa-primary', primaryColor);

    const shape = this.widgetConfig.appearance?.shape || 'circle';
    const iconType = this.widgetConfig.appearance?.icon || 'initials';
    const useHalfCircle = shape === 'half-circle' && (iconType === 'bug' || iconType === 'worm');

    const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : (this.widgetConfig.appearance?.buildTime || new Date().toISOString());
    const versionLabel = 'v ' + new Date(buildTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Trigger holds the clickable shape; the version label lives in the chat header only.
    const trigger = document.createElement('div');
    trigger.className = 'sa-trigger';
    container.appendChild(trigger);

    if (useHalfCircle) {
      const halfCircleBtn = document.createElement('button');
      halfCircleBtn.className = 'sa-half-circle';
      halfCircleBtn.setAttribute('aria-label', t('openAssistant'));
      halfCircleBtn.innerHTML = `<img class="bug-icon" alt="" src="${BUG_ICON_DATA_URI}">`;

      halfCircleBtn.addEventListener('click', () => {
        this.chat.toggle();
        this.avatar?.setState(this.chat.isOpen ? 'attention' : 'idle');
        this.trackEvent(this.chat.isOpen ? 'chat_opened' : 'chat_closed');
      });

      trigger.appendChild(halfCircleBtn);
    } else {
      const avatarWrapper = document.createElement('div');
      avatarWrapper.style.cssText = 'pointer-events:auto; position:relative; display:inline-block;';
      trigger.appendChild(avatarWrapper);

      this.avatar = new Avatar(avatarWrapper, {
        primaryColor,
        animationsEnabled: this.widgetConfig.appearance?.animationsEnabled !== false,
      });

      // Transparent overlay button so clicking the avatar opens the chat.
      const avatarBtn = document.createElement('button');
      avatarBtn.className = 'sa-avatar-overlay';
      avatarBtn.setAttribute('aria-label', t('openAssistant'));
      avatarBtn.addEventListener('click', () => {
        this.chat.toggle();
        this.avatar?.setState(this.chat.isOpen ? 'attention' : 'idle');
        this.trackEvent(this.chat.isOpen ? 'chat_opened' : 'chat_closed');
      });
      avatarWrapper.appendChild(avatarBtn);
    }

    // Version badge is not rendered outside the trigger; it is shown in the chat header.

    this.shadow.appendChild(container);

this.chat = new ChatPanel(container, {
      personality: this.widgetConfig.personality,
      apiUrl: this.apiUrl,
      slug: this.slug,
      onStateChange: (state) => {
        this.avatar?.setState(state);
        if (state === 'open') {
          this.shadow.querySelector('.sa-proactive-bubble')?.remove();
        }
      },
      chatVersion: versionLabel
    });

this.proactive = new ProactiveEngine({
      behavior: this.widgetConfig.behavior,
      onProactiveMessage: (message, key) => this.showProactiveBubble(message, key),
    });
  }

  showProactiveBubble(message, triggerKey) {
    const container = this.shadow.querySelector('.sa-container');
    if (!container || this.chat?.isOpen) return;

    this.avatar?.setState('attention');

    const bubble = document.createElement('div');
    bubble.className = 'sa-proactive-bubble';
    bubble.innerHTML = `
      ${message}
      <button class="sa-proactive-dismiss" aria-label="${t('dismiss')}">&times;</button>
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

    const trigger = container.querySelector('.sa-trigger');
    if (trigger) {
      container.insertBefore(bubble, trigger);
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

  renderSideBugWidget(container, primaryColor) {
    const halfCircle = document.createElement('div');
    halfCircle.className = 'sa-half-circle';
    halfCircle.style.background = primaryColor;
    halfCircle.innerHTML = `
      <svg class="bug-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 15h-4v-2h4v2zm-5-10h4V7h-4v2z"/>
      </svg>
    `;
    container.appendChild(halfCircle);
    halfCircle.addEventListener('click', () => {
      this.chat?.toggle();
      this.avatar?.setState(this.chat?.isOpen ? 'attention' : 'idle');
      this.trackEvent(this.chat?.isOpen ? 'chat_opened' : 'chat_closed');
    });
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
    const t = translator();
    const host = document.createElement('div');
    host.id = 'site-assistant-host';
    host.style.cssText = 'all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483647;pointer-events:auto;';
    host.innerHTML = `
      <div style="width:56px;height:56px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.15);cursor:pointer;font-size:24px;color:white;" role="button" aria-label="${t('openAssistant')}">?</div>
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
