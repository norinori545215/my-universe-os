// src/engine/HapticEngine.js

export class HapticEngine {
    // デフォルトはON（設定でOFFにした場合のみfalse）
    static get isEnabled() {
        return localStorage.getItem('universe_haptic') !== 'false';
    }

    // ON/OFFの切り替えと保存
    static toggle(state) {
        localStorage.setItem('universe_haptic', state);
    }

    // コア振動メソッド
    static vibrate(pattern) {
        // PCなどバイブレーション機能がない端末、または設定OFFの場合はスキップ
        if (!this.isEnabled || !navigator.vibrate) return;
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            console.warn("[HapticEngine] Vibration API blocked or unsupported.");
        }
    }

    // ==========================================
    // 💓 各種アクション用の振動パターン（ミリ秒）
    // ==========================================

    static playTap() { 
        this.vibrate(10); 
    }

    static playSpawn() { 
        this.vibrate([15, 30, 15]); // トトッ
    }

    static playDelete() { 
        this.vibrate([40, 40, 60]); // ズンッ
    }

    static playWarp() { 
        this.vibrate([10, 20, 20, 30, 30, 40]); // ダダダダッ
    }

    static playError() { 
        this.vibrate([30, 50, 30, 50, 30]); // ビビビッ
    }

    static playPulse() { 
        this.vibrate([15, 200, 15]); // トクン…トクン…
    }

    static playWipe() { 
        this.vibrate([200, 100, 200, 100, 500]); // ドゴォォォン
    }
}