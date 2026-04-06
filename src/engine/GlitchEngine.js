// src/engine/GlitchEngine.js

export class GlitchEngine {
    static init() {
        if (document.getElementById('glitch-style')) return;
        const style = document.createElement('style');
        style.id = 'glitch-style';
        style.innerHTML = `
            @keyframes glitch-anim {
                0% { clip-path: inset(10% 0 80% 0); transform: translate(-2px, 2px); filter: hue-rotate(90deg); }
                20% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); filter: invert(1); }
                40% { clip-path: inset(40% 0 40% 0); transform: translate(-2px, 2px); filter: none; }
                60% { clip-path: inset(10% 0 60% 0); transform: translate(2px, -2px); }
                80% { clip-path: inset(60% 0 10% 0); transform: translate(-2px, 2px); filter: invert(1); }
                100% { clip-path: inset(30% 0 50% 0); transform: translate(0); filter: none; }
            }
            .glitch-overlay {
                animation: glitch-anim 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite;
                pointer-events: none;
                z-index: 999999;
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 255, 204, 0.1);
                mix-blend-mode: difference;
            }
            .glitch-crt {
                pointer-events: none;
                z-index: 999998;
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
                background-size: 100% 3px, 3px 100%;
                opacity: 0.6;
            }
        `;
        document.head.appendChild(style);
    }

    // 📺 常時発動するブラウン管（CRT）モニター風の走査線
    static toggleCRT(isActive) {
        this.init();
        let crt = document.getElementById('crt-overlay');
        if (isActive) {
            if (!crt) {
                crt = document.createElement('div');
                crt.id = 'crt-overlay';
                crt.className = 'glitch-crt';
                document.body.appendChild(crt);
            }
        } else {
            if (crt) crt.remove();
        }
    }

    // 💥 瞬間的な画面のバグ（パスワードエラーや消滅時）
    static trigger(duration = 300, isHeavy = false) {
        this.init();
        
        // 画面全体へのオーバーレイ・バグ
        const glitch = document.createElement('div');
        glitch.className = 'glitch-overlay';
        if (isHeavy) {
            glitch.style.background = 'rgba(255, 0, 0, 0.15)'; // エラー時は赤く光る
            glitch.style.animationDuration = '0.05s';
        }
        document.body.appendChild(glitch);

        // キャンバス自体も一瞬歪ませる
        const canvas = document.getElementById('universe-canvas');
        let originalTransform = '';
        if (canvas) {
            originalTransform = canvas.style.transform;
            canvas.style.transition = 'none';
            canvas.style.transform = `translate(${Math.random()*20-10}px, ${Math.random()*20-10}px) skewX(${Math.random()*4-2}deg)`;
            canvas.style.filter = `saturate(200%) hue-rotate(${Math.random()*90}deg)`;
        }

        // 指定時間後に元に戻す
        setTimeout(() => {
            glitch.remove();
            if (canvas) {
                canvas.style.transform = originalTransform;
                canvas.style.filter = 'none';
                canvas.style.transition = '0.2s';
            }
        }, duration);

        // 触覚エンジン(スマホのバイブ)との連動
        if (window.HapticEngine) {
            if (isHeavy) window.HapticEngine.vibrate([50, 50, 50]);
            else window.HapticEngine.vibrate([20, 20]);
        }
    }
}