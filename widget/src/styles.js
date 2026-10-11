const STYLES = `
  :host {
    all: initial;
    font-family: var(--sa-font, system-ui, -apple-system, sans-serif);
    position: fixed;
    z-index: 2147483647;
    pointer-events: none;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .sa-container {
    pointer-events: auto;
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
  }

  .sa-container[data-position="bottom-left"] {
    right: auto;
    left: 20px;
    align-items: flex-start;
  }

  .sa-container[data-position="top-right"] {
    bottom: auto;
    top: 20px;
  }

  .sa-container[data-position="top-left"] {
    bottom: auto;
    top: 20px;
    right: auto;
    left: 20px;
    align-items: flex-start;
    flex-direction: row;
  }

  .sa-container[data-position="left-edge"] {
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    padding-left: 16px;
  }

  .sa-container[data-position="left-edge"] .sa-chat-panel {
    left: 56px;
    right: auto;
  }

  .sa-half-circle {
    width: 56px;
    height: 28px;
    border-radius: 0 28px 28px 0;
    background: var(--sa-primary, #ef4444);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    pointer-events: auto;
  }

  .sa-half-circle:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 28px rgba(0,0,0,0.2);
  }

  .sa-half-circle:active {
    transform: scale(0.95);
  }

  .sa-half-circle .bug-icon {
    width: 20px;
    height: 20px;
    fill: white;
  }

  .sa-half-circle .bug-icon path,
  .sa-half-circle .bug-icon circle,
  .sa-half-circle .bug-icon polyline,
  .sa-half-circle .bug-icon polygon {
    fill: white;
  }

  .sa-avatar-btn {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    padding: 0;
    background: transparent;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
  }

  .sa-avatar-btn:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 28px rgba(0,0,0,0.2);
  }

  .sa-avatar-btn:active {
    transform: scale(0.95);
  }

  .sa-proactive-bubble {
    max-width: 260px;
    padding: 12px 16px;
    background: white;
    border-radius: 16px;
    border-bottom-right-radius: 4px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    font-size: 13px;
    line-height: 1.5;
    color: #374151;
    position: relative;
    animation: sa-slide-up 0.3s ease-out;
    cursor: pointer;
  }

  .sa-container[data-position="bottom-left"] .sa-proactive-bubble {
    border-radius: 16px;
    border-bottom-left-radius: 4px;
  }

  .sa-proactive-dismiss {
    position: absolute;
    top: 4px;
    right: 8px;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 2px;
  }

  .sa-proactive-dismiss:hover {
    color: #6b7280;
  }

  .sa-chat-panel {
    width: 360px;
    max-width: calc(100vw - 40px);
    height: 480px;
    max-height: calc(100vh - 120px);
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: sa-panel-in 0.25s ease-out;
  }

  .sa-chat-header {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid #f3f4f6;
  }

  .sa-chat-header-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--sa-primary, #6366f1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 14px;
  }

  .sa-chat-header-info {
    flex: 1;
  }

  .sa-chat-header-name {
    font-weight: 600;
    font-size: 14px;
    color: #111827;
  }

  .sa-chat-header-status {
    font-size: 11px;
    color: #10b981;
  }

  .sa-chat-close {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    font-size: 18px;
    line-height: 1;
    border-radius: 4px;
  }

  .sa-chat-close:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .sa-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sa-msg {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 14px;
    font-size: 13px;
    line-height: 1.5;
    animation: sa-msg-in 0.2s ease-out;
  }

  .sa-msg-user {
    align-self: flex-end;
    background: var(--sa-primary, #6366f1);
    color: white;
    border-bottom-right-radius: 4px;
  }

  .sa-msg-assistant {
    align-self: flex-start;
    background: #f3f4f6;
    color: #374151;
    border-bottom-left-radius: 4px;
  }

  .sa-msg-typing {
    display: flex;
    gap: 4px;
    padding: 12px 18px;
  }

  .sa-msg-typing span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #9ca3af;
    animation: sa-bounce 1.4s ease-in-out infinite;
  }

  .sa-msg-typing span:nth-child(2) { animation-delay: 0.2s; }
  .sa-msg-typing span:nth-child(3) { animation-delay: 0.4s; }

  .sa-chat-input {
    padding: 12px 16px;
    border-top: 1px solid #f3f4f6;
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .sa-chat-input textarea {
    flex: 1;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 13px;
    font-family: inherit;
    resize: none;
    outline: none;
    max-height: 80px;
    min-height: 40px;
    line-height: 1.4;
    transition: border-color 0.15s;
  }

  .sa-chat-input textarea:focus {
    border-color: var(--sa-primary, #6366f1);
  }

  .sa-chat-send {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: var(--sa-primary, #6366f1);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }

  .sa-chat-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sa-chat-send svg {
    width: 18px;
    height: 18px;
  }

  @keyframes sa-panel-in {
    from { opacity: 0; transform: translateY(12px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes sa-slide-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes sa-msg-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes sa-bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
  }

  @keyframes sa-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  @keyframes sa-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  @media (max-width: 480px) {
    .sa-chat-panel {
      width: calc(100vw - 20px);
      height: calc(100vh - 100px);
      position: fixed;
      bottom: 10px;
      right: 10px;
    }
  }

  .sa-widget-version {
    position: absolute;
    bottom: 8px;
    left: 8px;
    font-size: 10px;
    color: #6b7280;
    background: rgba(0,0,0,0.5);
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }
`;

export function createStyles(shadowRoot) {
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadowRoot.appendChild(style);
}
