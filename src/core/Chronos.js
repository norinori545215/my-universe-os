// src/core/Chronos.js

export class Chronos {
    static storageKey = 'universe_chronos_config';

    static getConfig() {
        const defaultCfg = { enabled: false, days: 30, lastSeen: Date.now() };
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : defaultCfg;
        } catch (e) { return defaultCfg; }
    }

    static saveConfig(cfg) {
        localStorage.setItem(this.storageKey, JSON.stringify(cfg));
    }

    // ログイン時や操作時に「生存」を記録する（パルスを打つ）
    static updatePulse() {
        const cfg = this.getConfig();
        // 有効化されていなくても、最終アクセス日は常に更新しておく
        cfg.lastSeen = Date.now();
        this.saveConfig(cfg);
        console.log("💓 [Chronos] 生存パルスを受信しました。");
    }

    // 起動時に死後経過時間をチェック
    static check() {
        const cfg = this.getConfig();
        if (!cfg.enabled) return false;

        const now = Date.now();
        const diffDays = (now - cfg.lastSeen) / (1000 * 60 * 60 * 24);

        console.log(`⏳ [Chronos] 最終パルスからの経過時間: ${diffDays.toFixed(2)}日 / 設定: ${cfg.days}日`);

        if (diffDays >= cfg.days) {
            console.error("💀 [Chronos] DEADMAN'S SWITCH ACTIVATED.");
            return true; // 爆破トリガーON
        }
        return false;
    }
}