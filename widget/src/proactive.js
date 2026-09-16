export class ProactiveEngine {
  constructor(options) {
    this.options = options;
    this.triggers = options.behavior?.proactiveTriggers || [];
    this.pageRules = options.behavior?.pageRules || [];
    this.firedTriggers = new Set();
    this.startTime = Date.now();
    this.scrollDepth = 0;
    this.hasDismissed = this.loadDismissed();
    this.onProactiveMessage = options.onProactiveMessage || (() => {});
    this.isActive = true;

    this.setupListeners();
    this.checkPageRules();
    this.scheduleTimeTrigger();
    this.scheduleScrollTrigger();
  }

  loadDismissed() {
    try {
      const data = JSON.parse(localStorage.getItem('sa_dismissed') || '{}');
      const now = Date.now();
      const fiveMin = 5 * 60 * 1000;
      const cleaned = {};
      for (const [key, time] of Object.entries(data)) {
        if (now - time < fiveMin * 6) cleaned[key] = time;
      }
      localStorage.setItem('sa_dismissed', JSON.stringify(cleaned));
      return cleaned;
    } catch {
      return {};
    }
  }

  saveDismissed(key) {
    this.hasDismissed[key] = Date.now();
    try {
      localStorage.setItem('sa_dismissed', JSON.stringify(this.hasDismissed));
    } catch {}
  }

  setupListeners() {
    window.addEventListener('scroll', () => {
      if (!this.isActive) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      this.scrollDepth = docHeight > 0 ? Math.round((window.scrollY / docHeight) * 100) : 0;
    }, { passive: true });
  }

  scheduleTimeTrigger() {
    const timeTriggers = this.triggers.filter(t => t.type === 'time_on_page');
    for (const trigger of timeTriggers) {
      const key = `time_${trigger.seconds}`;
      setTimeout(() => {
        if (this.isActive && !this.firedTriggers.has(key) && !this.hasDismissed[key]) {
          if (this.matchesCurrentPage(trigger.urlPattern)) {
            this.firedTriggers.add(key);
            this.onProactiveMessage(trigger.message, key);
          }
        }
      }, trigger.seconds * 1000);
    }
  }

  scheduleScrollTrigger() {
    const scrollTriggers = this.triggers.filter(t => t.type === 'scroll_depth');
    let checked = new Set();

    const check = () => {
      if (!this.isActive) return;
      for (const trigger of scrollTriggers) {
        const key = `scroll_${trigger.percent}`;
        if (!checked.has(key) && this.scrollDepth >= trigger.percent) {
          checked.add(key);
          if (!this.firedTriggers.has(key) && !this.hasDismissed[key]) {
            if (this.matchesCurrentPage(trigger.urlPattern)) {
              this.firedTriggers.add(key);
              this.onProactiveMessage(trigger.message, key);
            }
          }
        }
      }
    };

    window.addEventListener('scroll', check, { passive: true });
  }

  checkPageRules() {
    if (!this.isActive) return;
    const currentUrl = window.location.pathname;
    for (const rule of this.pageRules) {
      if (rule.urlPattern && currentUrl.includes(rule.urlPattern)) {
        const key = `rule_${rule.urlPattern}`;
        if (!this.firedTriggers.has(key) && !this.hasDismissed[key]) {
          setTimeout(() => {
            if (this.isActive && !this.hasDismissed[key]) {
              this.firedTriggers.add(key);
              this.onProactiveMessage(rule.message, key);
            }
          }, 3000);
        }
      }
    }
  }

  matchesCurrentPage(urlPattern) {
    if (!urlPattern) return true;
    return window.location.pathname.includes(urlPattern);
  }

  dismiss(key) {
    this.saveDismissed(key);
  }

  deactivate() {
    this.isActive = false;
  }

  activate() {
    this.isActive = true;
  }

  destroy() {
    this.isActive = false;
  }
}
