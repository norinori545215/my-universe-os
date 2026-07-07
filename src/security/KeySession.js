// src/security/KeySession.js
// P0/P1: RAM上の暗号鍵を一箇所で管理し、Panic時に破棄できるようにする。

export class KeySession {
  static universeKey = null;
  static createdAt = null;
  static locked = true;

  static setUniverseKey(key) {
    this.universeKey = key;
    this.createdAt = Date.now();
    this.locked = false;

    // 既存コード互換。将来は window 直置きを減らす。
    window.universeCryptoKey = key;
  }

  static getUniverseKey() {
    if (this.locked || !this.universeKey) {
      throw new Error('宇宙鍵がロックされています。再認証してください。');
    }
    return this.universeKey;
  }

  static hasKey() {
    return !!this.universeKey && !this.locked;
  }

  static lock() {
    this.locked = true;
    this.universeKey = null;
    this.createdAt = null;

    try {
      delete window.universeCryptoKey;
    } catch (_) {
      window.universeCryptoKey = null;
    }
  }
}