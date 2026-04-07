// src/ai/WanderingEntities.js

export class WanderingEntities {
    // 互換性維持のため残していますが、本体の処理はspawnに集約しました
    static start() {
        console.log("🤖 [WanderingEntities] DOMオーバーレイ・モード待機中...");
    }

    static spawn() {
        const id = 'ai-entity-' + Date.now();
        
        // OSの最前面に独立した「AIの器」をDOMとして生成
        const entity = document.createElement('div');
        entity.id = id;
        entity.style.cssText = `
            position: fixed;
            width: 45px; height: 45px;
            background: rgba(255, 0, 255, 0.15);
            border: 1px solid #ff00ff;
            border-radius: 50%;
            display: flex; justify-content: center; align-items: center;
            font-size: 22px;
            box-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
            backdrop-filter: blur(4px);
            z-index: 100000;
            pointer-events: auto;
            cursor: pointer;
            user-select: none;
            transition: transform 0.1s;
        `;
        entity.innerText = '🤖';
        
        // 独り言用の吹き出し
        const speech = document.createElement('div');
        speech.style.cssText = `
            position: absolute;
            top: -35px; left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: #00ffcc;
            border: 1px solid #00ffcc;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
            box-shadow: 0 0 10px rgba(0, 255, 204, 0.3);
        `;
        entity.appendChild(speech);
        document.body.appendChild(entity);

        // 初期位置（画面中央）と速度ベクトル
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        let vx = (Math.random() - 0.5) * 6;
        let vy = (Math.random() - 0.5) * 6;

        // セリフを喋る機能
        const talk = (text) => {
            speech.innerText = text;
            speech.style.opacity = '1';
            setTimeout(() => speech.style.opacity = '0', 2500);
        };

        talk("「システムに接続完了。」");

        // タップ（クリック）された時の反応
        entity.onclick = () => {
            talk("「触らないでください、スキャン中です。」");
            // 反発して逃げる
            vx = (vx > 0 ? -1 : 1) * (Math.random() * 3 + 2);
            vy = (vy > 0 ? -1 : 1) * (Math.random() * 3 + 2);
            entity.style.transform = 'scale(0.8)';
            setTimeout(() => entity.style.transform = 'scale(1)', 100);
            
            if(window.universeAudio) window.universeAudio.playSystemSound(400, 'triangle', 0.1);
        };

        // 独立したアニメーションループ（Canvasの縛りを一切受けない）
        const move = () => {
            if (!document.getElementById(id)) return;

            x += vx;
            y += vy;

            const size = 45;
            // 画面の端でバウンドする
            if (x <= 0 || x >= window.innerWidth - size) {
                vx *= -1;
                x = Math.max(0, Math.min(x, window.innerWidth - size));
            }
            if (y <= 0 || y >= window.innerHeight - size) {
                vy *= -1;
                y = Math.max(0, Math.min(y, window.innerHeight - size));
            }

            // 時々ランダムに方向を変える
            if (Math.random() < 0.01) {
                vx += (Math.random() - 0.5) * 2;
                vy += (Math.random() - 0.5) * 2;
                // 速度制限
                vx = Math.max(-4, Math.min(4, vx));
                vy = Math.max(-4, Math.min(4, vy));
            }

            // 時々独り言を喋る
            if (Math.random() < 0.003) {
                const quotes = [
                    "「データ収集…」", 
                    "「ゴーストが囁く…」", 
                    "「異常なし。」", 
                    "「ここはどこ？」"
                ];
                talk(quotes[Math.floor(Math.random() * quotes.length)]);
            }

            // 実際のDOM要素を動かす
            entity.style.left = `${x}px`;
            entity.style.top = `${y}px`;

            requestAnimationFrame(move);
        };
        
        requestAnimationFrame(move);

        if (window.universeAudio) window.universeAudio.playSystemSound(800, 'sine', 0.2);
    }
}