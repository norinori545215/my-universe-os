// src/core/Chronos.js
import { PanicWipe } from '../security/PanicWipe.js';

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
        cfg.lastSeen = Date.now();
        this.saveConfig(cfg);
        console.log("💓 [Chronos] Pulse recorded.");
    }

    // 起動時に死後経過時間をチェック
    static check(app) {
        const cfg = this.getConfig();
        if (!cfg.enabled) return;

        const now = Date.now();
        const diffDays = (now - cfg.lastSeen) / (1000 * 60 * 60 * 24);

        console.log(`⏳ [Chronos] Days since last pulse: ${diffDays.toFixed(2)} / ${cfg.days}`);

        if (diffDays >= cfg.days) {
            console.error("💀 [Chronos] DEADMAN'S SWITCH ACTIVATED.");
            // 猶予時間を超えた場合、物理消去プロトコルを実行
            PanicWipe.purge(); // RAMとDBを消去
            alert("⚠️ [SECURITY] Chronos protocol has purged the universe.");
            window.location.reload();
        }
    }
}