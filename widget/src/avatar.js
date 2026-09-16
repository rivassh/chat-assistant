import lottie from 'lottie-web';

const STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  TYPING: 'typing',
  ATTENTION: 'attention',
  SUCCESS: 'success',
};

export class Avatar {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.currentState = STATES.IDLE;
    this.animation = null;
    this.svgFallback = null;
    this.animationsEnabled = options.animationsEnabled !== false;
    this.init();
  }

  init() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'sa-avatar-wrapper';
    this.wrapper.setAttribute('role', 'img');
    this.wrapper.setAttribute('aria-label', 'Site assistant avatar');

    this.lottieContainer = document.createElement('div');
    this.lottieContainer.className = 'sa-avatar-lottie';
    this.wrapper.appendChild(this.lottieContainer);

    if (this.animationsEnabled && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.animationsEnabled = false;
    }

    if (!this.animationsEnabled) {
      this.renderFallback();
    }

    this.container.appendChild(this.wrapper);
  }

  renderFallback() {
    this.lottieContainer.style.display = 'none';
    this.svgFallback = document.createElement('div');
    this.svgFallback.className = 'sa-avatar-fallback';
    this.svgFallback.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="24" fill="var(--sa-primary, #6366f1)"/>
        <circle cx="17" cy="20" r="3" fill="white"/>
        <circle cx="31" cy="20" r="3" fill="white"/>
        <path d="M16 30 Q24 38 32 30" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </svg>
    `;
    this.wrapper.appendChild(this.svgFallback);
  }

  setState(state) {
    if (this.currentState === state) return;
    this.currentState = state;

    if (this.animation) {
      this.animation.destroy();
      this.animation = null;
    }

    if (!this.animationsEnabled) {
      this.updateFallbackState(state);
      return;
    }

    const animationData = this.getAnimationData(state);
    if (animationData) {
      this.lottieContainer.style.display = 'block';
      if (this.svgFallback) this.svgFallback.style.display = 'none';

      this.animation = lottie.loadAnimation({
        container: this.lottieContainer,
        renderer: 'svg',
        loop: state === STATES.IDLE || state === STATES.THINKING,
        autoplay: true,
        animationData,
      });
    }
  }

  getAnimationData(state) {
    const colors = {
      primary: this.options.primaryColor || '#6366f1',
      white: '#ffffff',
    };

    const animations = {
      [STATES.IDLE]: this.createPulseAnimation(colors),
      [STATES.THINKING]: this.createThinkingAnimation(colors),
      [STATES.TYPING]: this.createTypingAnimation(colors),
      [STATES.ATTENTION]: this.createAttentionAnimation(colors),
      [STATES.SUCCESS]: this.createSuccessAnimation(colors),
    };

    return animations[state] || animations[STATES.IDLE];
  }

  createPulseAnimation(colors) {
    return {
      v: '5.7.4',
      fr: 30,
      ip: 0,
      op: 60,
      w: 48,
      h: 48,
      nm: 'idle',
      ddd: 0,
      assets: [],
      layers: [
        {
          ddd: 0, ind: 1, ty: 4, nm: 'face',
          sr: 1, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [24, 24, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [
            { i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] }, o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] }, t: 0, s: [100, 100, 100] },
            { i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] }, o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] }, t: 30, s: [105, 105, 100] },
            { t: 60, s: [100, 100, 100] },
          ]}},
          ao: 0, shapes: [
            { ty: 'el', d: 1, s: { a: 0, k: [48, 48] }, p: { a: 0, k: [0, 0] }, nm: 'circle' },
            { ty: 'fl', c: { a: 0, k: [0.388, 0.4, 0.945, 1] }, o: { a: 0, k: 100 }, r: 1, nm: 'fill' },
          ],
        },
      ],
    };
  }

  createThinkingAnimation(colors) {
    return {
      v: '5.7.4', fr: 30, ip: 0, op: 60, w: 48, h: 48, nm: 'thinking',
      layers: [
        {
          ddd: 0, ind: 1, ty: 4, nm: 'dot1',
          ks: { o: { a: 1, k: [
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 0, s: [30] },
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 15, s: [100] },
            { t: 30, s: [30] },
          ]}, r: { a: 0, k: 0 }, p: { a: 0, k: [16, 24, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }},
          shapes: [
            { ty: 'el', s: { a: 0, k: [8, 8] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: [0.388, 0.4, 0.945, 1] }, o: { a: 0, k: 100 } },
          ],
        },
        {
          ddd: 0, ind: 2, ty: 4, nm: 'dot2',
          ks: { o: { a: 1, k: [
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 10, s: [30] },
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 25, s: [100] },
            { t: 40, s: [30] },
          ]}, r: { a: 0, k: 0 }, p: { a: 0, k: [24, 24, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }},
          shapes: [
            { ty: 'el', s: { a: 0, k: [8, 8] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: [0.388, 0.4, 0.945, 1] }, o: { a: 0, k: 100 } },
          ],
        },
        {
          ddd: 0, ind: 3, ty: 4, nm: 'dot3',
          ks: { o: { a: 1, k: [
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 20, s: [30] },
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 35, s: [100] },
            { t: 50, s: [30] },
          ]}, r: { a: 0, k: 0 }, p: { a: 0, k: [32, 24, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }},
          shapes: [
            { ty: 'el', s: { a: 0, k: [8, 8] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: [0.388, 0.4, 0.945, 1] }, o: { a: 0, k: 100 } },
          ],
        },
      ],
    };
  }

  createTypingAnimation() { return this.createThinkingAnimation(); }
  createAttentionAnimation() { return this.createPulseAnimation(); }
  createSuccessAnimation() { return this.createPulseAnimation(); }

  updateFallbackState(state) {
    if (!this.svgFallback) return;
    const circle = this.svgFallback.querySelector('circle:first-child');
    if (circle) {
      if (state === STATES.THINKING || state === STATES.TYPING) {
        circle.style.animation = 'sa-pulse 1s ease-in-out infinite';
      } else if (state === STATES.SUCCESS) {
        circle.style.fill = '#22c55e';
      } else {
        circle.style.animation = 'sa-float 3s ease-in-out infinite';
      }
    }
  }

  destroy() {
    if (this.animation) {
      this.animation.destroy();
      this.animation = null;
    }
    this.wrapper?.remove();
  }
}
