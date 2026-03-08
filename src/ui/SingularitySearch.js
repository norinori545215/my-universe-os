// src/ui/SingularitySearch.js

export class SingularitySearch {
    static open() {
        if (document.getElementById('singularity-search-overlay')) return;

        // 1. 完全隔離用のオーバーレイ（背景）
        const overlay = document.createElement('div');
        overlay.id = 'singularity-search-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: radial-gradient(circle at center, rgba(30,0,40,0.95) 0%, rgba(0,0,0,0.98) 100%);
            z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center;
            backdrop-filter: blur(15px); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0; transform: scale(0.8) rotate(5deg); pointer-events: auto;
        `;

        // 2. ターミナル風のウインドウ
        const container = document.createElement('div');
        container.style.cssText = `
            width: 90%; max-width: 700px; padding: 40px;
            background: rgba(0,0,0,0.8); border: 1px solid #ff00ff;
            border-radius: 16px; display: flex; flex-direction: column; align-items: center;
            box-shadow: 0 0 50px rgba(255,0,255,0.3), inset 0 0 20px rgba(255,0,255,0.1);
        `;

        // タイトル
        const title = document.createElement('div');
        title.innerHTML = '<h2>👁️‍🗨️ SINGULARITY PORTAL</h2><p style="color:#888; font-size:12px;">Zero-Trace Quantum Catapult Ready.</p>';
        title.style.cssText = 'color:#ff00ff; text-align:center; text-shadow:0 0 10px #ff00ff; margin-bottom: 30px; font-family: monospace;';

        // 検索入力バー
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '> 検索ワード または URL を入力...';
        input.style.cssText = 'width: 100%; padding: 15px; background: rgba(255,0,255,0.05); border: 1px solid #ff00ff; color: #fff; font-size: 18px; outline: none; border-radius: 8px; text-shadow: 0 0 5px #ff00ff; font-family: monospace; letter-spacing: 1px; transition: 0.3s;';

        // 閉鎖ボタン
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '✖ 閉鎖 (Annihilate)';
        closeBtn.style.cssText = 'margin-top: 30px; background: transparent; border: 1px solid #ff4444; color: #ff4444; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px; transition: 0.2s; box-shadow: 0 0 10px rgba(255,68,68,0.2);';

        // 組み立て
        container.appendChild(title);
        container.appendChild(input);
        container.appendChild(closeBtn);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // --- イベントバインド ---
        
        // 検索実行（カタパルト発射）
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                let val = input.value.trim();
                if (!val) return;
                
                if (window.universeAudio) window.universeAudio.playSpawn(); // 打鍵音
                
                // 演出：ハッキング風の暗号化プロセス
                input.value = "ENCRYPTING AND LAUNCHING...";
                input.disabled = true;
                input.style.color = "#00ffcc";
                input.style.borderColor = "#00ffcc";
                input.style.textShadow = "0 0 10px #00ffcc";
                
                // 0.6秒後に別次元（ゴーストタブ）へ射出
                setTimeout(() => {
                    let targetUrl = val;
                    if (!val.match(/^https?:\/\//)) {
                        targetUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(val);
                    }
                    
                    // ★ 魔法の呪文「noopener, noreferrer」
                    // これにより、遷移先のサイトに「元のサイト(OS)の情報」が一切送られない完全な匿名通信になります
                    window.open(targetUrl, '_blank', 'noopener,noreferrer');
                    
                    // 射出と同時に、証拠隠滅のためにOS側の窓を閉鎖
                    SingularitySearch.close(overlay);
                }, 600);
            }
        });

        // 閉鎖（消滅）実行
        closeBtn.onclick = () => SingularitySearch.close(overlay);
        overlay.onclick = (e) => { if(e.target === overlay) SingularitySearch.close(overlay); };

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
        
        // 閉鎖アニメーション
        overlay.style.transition = 'all 0.4s cubic-bezier(0.5, 0, 0.2, 1)';
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0) rotate(-15deg)';
        overlay.style.filter = 'blur(20px)';
        
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        }, 400); 
    }
}