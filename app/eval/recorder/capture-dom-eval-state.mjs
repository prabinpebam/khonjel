/**
 * captureDomEvalState — the injected, self-contained DOM/state capture function.
 *
 * Runs INSIDE the page via Playwright `page.evaluate(captureDomEvalState)`. It must be
 * self-contained (no closure references, no imports) because Playwright serializes its source.
 * It is side-effect free: it only READS the running app, never mutates it.
 *
 * Khonjel-aware: it reads the dev debug handle `window.__KHONJEL_EVAL__` (see
 * src/app/devtools/EvalBridge.tsx) and the `data-eval-*` selector contract
 * (docs/frameworks/eval-driven-development/03-khonjel-edd-interpretation.md §4).
 */
export function captureDomEvalState() {
  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }
  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }
  function hashString(value) {
    var text = String(value == null ? "" : value);
    var hash = 0;
    for (var i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return hash;
  }
  function textOf(el) {
    return el ? String(el.textContent || "").trim() : "";
  }
  function boundsOf(el) {
    if (!el || !el.getBoundingClientRect) return { x: 0, y: 0, width: 0, height: 0 };
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }
  function isVisible(el) {
    if (!el) return false;
    if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;
    var style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    return true;
  }
  function nameOf(el) {
    if (!el) return "";
    return el.getAttribute("aria-label") || el.getAttribute("title") || textOf(el).slice(0, 80);
  }

  var bridge = window.__KHONJEL_EVAL__ || null;
  var bodyText = textOf(document.body);
  var anomalies = [];

  // ---- generic inline anomalies (cheap; the post-processing detectors do the rest) ----
  if (bodyText.indexOf("[object Object]") !== -1) {
    anomalies.push({ code: "OBJECT_OBJECT_VISIBLE", severity: "critical", category: "rendering", message: "[object Object] is visible in the page body", trigger: "capture" });
  }
  if (/\b(at\s+\w+.*\(.*:\d+:\d+\))/.test(bodyText) || bodyText.indexOf("\n    at ") !== -1) {
    anomalies.push({ code: "RAW_ERROR_STACK_VISIBLE", severity: "critical", category: "error-handling", message: "A raw error stack appears in user-facing text", trigger: "capture" });
  }
  if (/\b(sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]\s*\S{8,}|Bearer\s+[A-Za-z0-9._-]{16,})/.test(bodyText)) {
    anomalies.push({ code: "SECRET_TEXT_VISIBLE", severity: "critical", category: "privacy", message: "Text resembling a secret/API key is visible", trigger: "capture" });
  }

  // ---- Khonjel shell ----
  var shellEl = qs('[data-eval="app-shell"]');
  var contentEl = qs('[data-eval="content"]');
  var paletteEl = qs('[data-eval="command-palette"]');
  var settingsEl = qs('[data-eval="settings-modal"]');

  var navItems = qsa('[data-eval="nav-item"]').map(function (el, i) {
    return {
      type: "nav-item",
      id: el.getAttribute("data-eval-nav") || "nav-" + i,
      state: el.getAttribute("aria-current") === "page" ? "selected" : "idle",
      visible: isVisible(el),
      position: i,
      bounds: boundsOf(el),
      contentHash: hashString(nameOf(el)),
      accessibleName: nameOf(el),
      role: el.getAttribute("role") || el.tagName.toLowerCase(),
      children: [],
      properties: {},
    };
  });

  var interactive = qsa('button, a, input, select, textarea, [role="button"], [role="menuitem"], [tabindex]').map(function (el, i) {
    var vis = isVisible(el);
    if (vis && !nameOf(el) && el.tagName.toLowerCase() !== "input" && el.tagName.toLowerCase() !== "textarea") {
      anomalies.push({ code: "MISSING_ACCESSIBLE_NAME", severity: "warning", category: "accessibility", message: "Visible interactive control has no accessible name", trigger: "capture" });
    }
    return {
      type: "control",
      id: el.getAttribute("data-eval") || el.getAttribute("data-testid") || el.id || "control-" + i,
      state: el.disabled || el.getAttribute("aria-disabled") === "true" ? "disabled" : "enabled",
      visible: vis,
      position: i,
      bounds: boundsOf(el),
      contentHash: hashString(textOf(el)),
      accessibleName: nameOf(el),
      role: el.getAttribute("role") || el.tagName.toLowerCase(),
      children: [],
      properties: {
        pressed: el.getAttribute("aria-pressed") || "",
        expanded: el.getAttribute("aria-expanded") || "",
        current: el.getAttribute("aria-current") || "",
      },
    };
  });

  var activeView = shellEl ? shellEl.getAttribute("data-eval-view") : null;
  var shellReady = !!(shellEl && shellEl.getAttribute("data-eval-ready") === "true");
  var contentText = textOf(contentEl);

  var product = bridge && bridge.product ? safe(bridge.product) : { ui: {}, theme: null, settings: {} };
  var execution = bridge && bridge.execution ? safe(bridge.execution) : { active: false, paused: false, queueLength: 0, jobs: [] };
  function safe(fn) {
    try {
      return fn();
    } catch {
      return null;
    }
  }

  return {
    frameId: 0,
    timestamp: Date.now(),
    elapsedMs: 0,
    trigger: "capture",
    product: {
      route: location.pathname + location.search,
      activeView: activeView,
      selectedIds: activeView ? [activeView] : [],
      entityCounts: {},
      stateHash: hashString(JSON.stringify(product)),
      safeStateSummary: product,
    },
    execution: execution,
    visual: {
      viewportState: !shellEl ? "loading" : shellReady ? (contentText ? "has-content" : "empty") : "loading",
      route: location.pathname + location.search,
      shell: {
        present: !!shellEl,
        ready: shellReady,
        activeView: activeView,
        bounds: boundsOf(shellEl),
        contentRegion: {
          present: !!contentEl,
          activeView: contentEl ? contentEl.getAttribute("data-eval-view") : null,
          visible: isVisible(contentEl),
          bounds: boundsOf(contentEl),
          textHash: hashString(contentText),
          nonBlank: contentText.length > 0,
        },
      },
      overlays: {
        commandPalette: { present: !!paletteEl, visible: isVisible(paletteEl) },
        settingsModal: { present: !!settingsEl, visible: isVisible(settingsEl) },
      },
      navItems: navItems,
      controls: interactive,
      focus: {
        activeElementRole: document.activeElement ? document.activeElement.getAttribute("role") || document.activeElement.tagName.toLowerCase() : "",
        activeElementName: nameOf(document.activeElement),
      },
      viewport: { width: window.innerWidth, height: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY },
      bodyTextHash: hashString(bodyText),
      visibleTextSample: bodyText.slice(0, 300),
    },
    integration: { network: [], events: [], embedded: [] },
    artifacts: { outputs: [] },
    anomalies: anomalies,
  };
}
