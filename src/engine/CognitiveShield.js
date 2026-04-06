// src/engine/CognitiveShield.js

export class CognitiveShield {
    constructor() {
        // デフォルトでON。設定で切ることも可能
        this.isActive = localStorage.getItem('universe_cognitive_shield') !== 'false';
        
        this.stressLevel = 0;   // 0〜100 (焦り・連続操作)
        this.fatigueLevel = 0;  // 0〜100 (稼働時間による疲労)
        
        this.sessionStart = Date.now();
        this.lastActionTime = Date.now();
        
        this.isShieldDeployed = false;

        if (this.isActive) {
            this.initSensors();
            this.startMonitoring();
            console.log("🧠 [Cognitive Shield] 生体リンク監視を開始しました。");
        }
    }

    // ユーザーの「焦り」や「活動」を検知するセンサー
    initSensors() {
        const trackAction = () => {
            const now = Date.now();
            const timeDiff = now - this.lastActionTime;
            
            // 非常に短い間隔（200ms以内）での連続クリック・キー入力は「焦り・ストレス」と判定
            if (timeDiff < 200) {
                this.stressLevel = Math.min(100, this.stressLevel + 5);
            } else if (timeDiff > 2000) {
                // 落ち着いた操作ならストレス値を下げる
                this.stressLevel = Math.max(0, this.stressLevel - 2);
            }

            this.lastActionTime = now;
        };

        window.addEventListener('click', trackAction, { passive: true });
        window.addEventListener('keydown', trackAction, { passive: true });
        
        // マウス・スワイプ移動は「活動中」として記録
        window.addEventListener('mousemove', () => this.lastActionTime = Date.now(), { passive: true });
        window.addEventListener('touchmove', () => this.lastActionTime = Date.now(), { passive: true });
    }

    // 5秒に1回、脳負荷（Cognitive Load）を判定する
    startMonitoring() {
        setInterval(() => {
            if (!this.isActive) return;

            const now = Date.now();
            const sessionDurationMinutes = (now - this.sessionStart) / 1000 / 60;
            
            // 疲労度は稼働時間に比例して上昇（1分で約2%上昇）
            this.fatigueLevel = Math.min(100, sessionDurationMinutes * 2);
            
            // ストレス値は時間経過で自然減衰
            this.stressLevel = Math.max(0, this.stressLevel - 3);

            this.evaluateState();
        }, 5000);
    }

    // 状態を評価し、シールドを展開するか判断
    evaluateState() {
        // ストレス（瞬間的な焦り）と疲労（長期的な疲れ）をブレンドして「脳負荷」を算出
        const cognitiveLoad = (this.stressLevel * 0.6) + (this.fatigueLevel * 0.4);

        if (cognitiveLoad > 60 && !this.isShieldDeployed) {
            this.deployShield();
        } else if (cognitiveLoad < 40 && this.isShieldDeployed) {
            this.retractShield();
        }
    }

    // シールド展開（視覚刺激の抑制）
    deployShield() {
        this.isShieldDeployed = true;
        console.warn("🧠 [Cognitive Shield] 高い脳負荷を検知。視覚保護シールドを展開します。");
        
        // 画面全体にブルーライトカット＆輝度低下のフィルターをかける
        document.body.style.transition = 'filter 3s ease-in-out';
        document.body.style.filter = 'sepia(30%) brightness(0.7) contrast(0.9)';
        
        // ネオンの眩しさを強制的に消すためのスタイルを注入
        let styleEl = document.getElementById('cognitive-shield-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'cognitive-shield-style';
            document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = `
            * { text-shadow: none !important; box-shadow: none !important; }
            #universe-canvas { opacity: 0.6 !important; }
        `;

        // 音響も少しマイルドにするフラグを立てる
        if (window.universeAudio) window.universeAudio.isDampened = true;

        this.showNotification('🧠 生体負荷の上昇を検知。視覚・聴覚刺激を抑制します。');
    }

    // シールド解除（通常モードへ復帰）
    retractShield() {
        this.isShieldDeployed = false;
        console.log("🧠 [Cognitive Shield] 負荷の低下を確認。通常モードへ復帰します。");
        
        document.body.style.filter = 'none';
        
        const styleEl = document.getElementById('cognitive-shield-style');
        if (styleEl) styleEl.remove();

        if (window.universeAudio) window.universeAudio.isDampened = false;

        this.showNotification('🌐 生体数値の安定を確認。シールドを解除しました。');
    }

    // 画面上部にひっそりと通知を出す
    showNotification(message) {
        const notify = document.createElement('div');
        notify.innerText = message;
        notify.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,100,255,0.8); color:#fff; padding:10px 20px; border-radius:20px; font-size:12px; z-index:99999; backdrop-filter:blur(5px); opacity:0; transition:opacity 1s ease-in-out; pointer-events:none; box-shadow:0 0 20px rgba(0,100,255,0.5);';
        document.body.appendChild(notify);
        
        // ふわっと表示して、ふわっと消える
        setTimeout(() => notify.style.opacity = '1', 100);
        setTimeout(() => {
            notify.style.opacity = '0';
            setTimeout(() => notify.remove(), 1000);
        }, 4000);
    }
}