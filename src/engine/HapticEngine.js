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

    // 軽いタップ（UI操作など）
    static playTap() { 
        this.vibrate(10); 
    }

    // 星の誕生・生成（トトッ）
    static playSpawn() { 
        this.vibrate([15, 30, 15]); 
    }

    // 消去・ブラックホールへの収納（ズンッ）
    static playDelete() { 
        this.vibrate([40, 40, 60]); 
    }

    // ワープ・階層移動（徐々に強くなるダダダダッ）
    static playWarp() { 
        this.vibrate([10, 20, 20, 30, 30, 40]); 
    }

    // エラー・解読失敗・警告（ビビビッ）
    static playError() { 
        this.vibrate([30, 50, 30, 50, 30]); 
    }

    // 153bpmの鼓動（トクン…トクン…）
    static playPulse() { 
        this.vibrate([15, 200, 15]); 
    }

    // 宇宙消滅・Wipe・自爆（ドゴォォォン）
    static playWipe() { 
        this.vibrate([200, 100, 200, 100, 500]); 
    }
}