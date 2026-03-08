// src/ui/SingularitySearch.js

export class SingularitySearch {
    static open() {
        // すでに開いている場合は無視
        if (document.getElementById('singularity-search-overlay')) return;

        // 1. 完全隔離用のオーバーレイ（背景）
        const overlay = document.createElement('div');
        overlay.id = 'singularity-search-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: radial-gradient(circle at center, rgba(30,0,40,0.85) 0%, rgba(0,0,0,0.98) 100%);
            z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center;
            backdrop-filter: blur(15px); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0; transform: scale(0.8) rotate(5deg); pointer-events: auto;
        `;

        // 2. ブラウザのウインドウ枠
        const container = document.createElement('div');
        container.style.cssText = `
            width: 90%; max-width: 1100px; height: 85%;
            background: rgba(0,0,0,0.8); border: 1px solid #ff00ff;
            border-radius: 16px; display: flex; flex-direction: column;
            box-shadow: 0 0 50px rgba(255,0,255,0.3), inset 0 0 20px rgba(255,0,255,0.1);
            overflow: hidden;
        `;

        // 3. ヘッダー（検索バーと閉じるボタン）
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; padding:15px; background:rgba(255,0,255,0.1); border-bottom:1px solid #ff00ff; align-items:center; gap:10px;';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '特異点へアクセス... (検索ワード または URLを入力してEnter)';
        input.style.cssText = 'flex:1; background:transparent; border:none; color:#fff; font-size:16px; outline:none; text-shadow:0 0 5px #ff00ff; letter-spacing:1px;';

        const closeBtn = document.createElement('button');
        closeBtn.innerText = '✖ 閉鎖 (Annihilate)';
        closeBtn.style.cssText = 'background:transparent; border:1px solid #ff4444; color:#ff4444; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s; box-shadow:0 0 10px rgba(255,68,68,0.2);';

        // 4. サンドボックス化されたiframe（心臓部）
        const iframe = document.createElement('iframe');
        // ★ sandbox属性により、親OSへのアクセスやCookieの漏洩を物理的に遮断します
        iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups');
        iframe.style.cssText = 'flex:1; width:100%; border:none; background:#fff;';
        
        // 初期画面はサイバーなスタンバイ画面
        iframe.src = 'data:text/html;charset=utf-8,<html><body style="background:%2305050a;color:%23ff00ff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;text-shadow:0 0 15px %23ff00ff;"><h1>SINGULARITY STANDBY</h1><p style="color:%23888;">Zero-Trace Anonymous Connection Ready.</p></body></html>';

        // 組み立て
        header.appendChild(input);
        header.appendChild(closeBtn);
        container.appendChild(header);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // --- イベントバインド ---
        
        // 検索実行
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                let val = input.value.trim();
                if (!val) return;
                
                if (window.universeAudio) window.universeAudio.playSpawn(); // 検索時の打鍵音
                
                if (val.match(/^https?:\/\//)) {
                    iframe.src = val; // URLなら直接開く
                } else {
                    // ★ 検索なら、iframe表示を許可しており、トラッキングを一切しないDuckDuckGoのHTML版へ強制ルーティング
                    iframe.src = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(val);
                }
            }
        });

        // 閉鎖（消滅）実行
        closeBtn.onclick = () => SingularitySearch.close(overlay);

        // 背景クリックでも閉鎖
        overlay.onclick = (e) => {
            if(e.target === overlay) SingularitySearch.close(overlay);
        };

        // --- 開く際のアニメーション ---
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            overlay.style.transform = 'scale(1) rotate(0deg)';
            input.focus();
            if (window.universeAudio) window.universeAudio.playWarp(); // 展開音
        });
    }

    static close(overlay) {
        if (!overlay) return;
        if (window.universeAudio) window.universeAudio.playDelete(); // 消滅音
        
        // 閉鎖アニメーション（ブラックホールに吸い込まれるように縮小・回転）
        overlay.style.transition = 'all 0.4s cubic-bezier(0.5, 0, 0.2, 1)';
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0) rotate(-15deg)';
        overlay.style.filter = 'blur(20px)';
        
        // アニメーション完了後にDOMツリーから完全に実体を削除（揮発）
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        }, 400); 
    }
}