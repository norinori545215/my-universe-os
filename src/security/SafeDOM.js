// src/security/SafeDOM.js
// P0: チャット、ノード名、ノート、QR読取文字列など「ユーザー由来の文字」を安全に表示するヘルパー。
// 原則: ユーザー入力は innerHTML に入れない。textContent で表示する。

export class SafeDOM {
  static text(tagName, text = '', options = {}) {
    const el = document.createElement(tagName);
    el.textContent = String(text ?? '');

    if (options.id) el.id = options.id;
    if (options.className) el.className = options.className;
    if (options.styleText) el.style.cssText = options.styleText;
    if (options.title) el.title = String(options.title);

    return el;
  }

  static button(text = '', options = {}) {
    const el = this.text('button', text, options);
    if (typeof options.onClick === 'function') {
      el.addEventListener('click', options.onClick);
    }
    return el;
  }

  static clear(parent) {
    if (!parent) return;
    while (parent.firstChild) parent.removeChild(parent.firstChild);
  }

  static setText(el, text = '') {
    if (!el) return;
    el.textContent = String(text ?? '');
  }

  static appendText(parent, tagName, text = '', options = {}) {
    const child = this.text(tagName, text, options);
    parent.appendChild(child);
    return child;
  }

  static safeUrl(url, allowedProtocols = ['https:', 'http:', 'mailto:']) {
    try {
      const parsed = new URL(String(url), window.location.origin);
      if (!allowedProtocols.includes(parsed.protocol)) return null;
      return parsed.href;
    } catch (_) {
      return null;
    }
  }

  static image(src, options = {}) {
    const img = document.createElement('img');
    const safe = this.safeUrl(src, ['https:', 'http:', 'blob:', 'data:']);
    if (!safe) throw new Error('安全ではない画像URLです。');
    img.src = safe;
    if (options.alt) img.alt = String(options.alt);
    if (options.className) img.className = options.className;
    if (options.styleText) img.style.cssText = options.styleText;
    return img;
  }
}