// src/ai/WanderingEntities.js

export class WanderingEntities {
    static start() {
        console.log("🤖 [WanderingEntities] 神託AI（Knowledge Weaver）待機中...");
    }

    static spawn(app) {
        const id = 'ai-entity-' + Date.now();
        
        // 🔮 より未来的なホログラム・アイ（目）のデザイン
        const entity = document.createElement('div');
        entity.id = id;
        entity.style.cssText = `
            position: fixed;
            width: 60px; height: 60px;
            background: radial-gradient(circle, rgba(0,255,204,0.8) 10%, rgba(0,50,40,0.4) 60%, transparent 100%);
            border: 2px dashed rgba(0, 255, 204, 0.6);
            border-radius: 50%;
            display: flex; justify-content: center; align-items: center;
            font-size: 20px;
            box-shadow: 0 0 30px rgba(0, 255, 204, 0.5), inset 0 0 20px rgba(0, 255, 204, 0.5);
            backdrop-filter: blur(5px);
            z-index: 100000;
            pointer-events: auto;
            cursor: pointer;
            user-select: none;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            animation: ai-float 3s ease-in-out infinite alternate;
        `;
        
        // 回転する内側のコア
        const core = document.createElement('div');
        core.style.cssText = `
            position: absolute; width: 40px; height: 40px;
            border: 2px solid transparent; border-top-color: #fff; border-bottom-color: #fff;
            border-radius: 50%; animation: ai-spin 2s linear infinite;
        `;
        entity.appendChild(core);

        // スタイル定義の追加
        if (!document.getElementById('ai-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-styles';
            style.innerHTML = `
                @keyframes ai-float { 0% { transform: translateY(0px) scale(1); } 100% { transform: translateY(-15px) scale(1.05); } }
                @keyframes ai-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes ai-pulse { 0% { box-shadow: 0 0 30px #ff00ff, inset 0 0 20px #ff00ff; } 100% { box-shadow: 0 0 80px #ff00ff, inset 0 0 50px #ff00ff; } }
            `;
            document.head.appendChild(style);
        }
        
        const speech = document.createElement('div');
        speech.style.cssText = `
            position: absolute; top: -50px; left: 50%; transform: translateX(-50%);
            background: rgba(0, 15, 20, 0.95); color: #00ffcc;
            border: 1px solid #00ffcc; padding: 10px 15px; border-radius: 8px;
            font-size: 13px; font-weight: bold; white-space: nowrap;
            opacity: 0; transition: opacity 0.3s; pointer-events: none;
            box-shadow: 0 0 20px rgba(0, 255, 204, 0.4); letter-spacing: 1px;
        `;
        entity.appendChild(speech);
        document.body.appendChild(entity);

        let isCommandMode = false;

        const talk = (text, duration = 3000) => {
            speech.innerText = text;
            speech.style.opacity = '1';
            if (duration > 0) {
                setTimeout(() => { if (!isCommandMode) speech.style.opacity = '0'; }, duration);
            }
        };

        talk("「グローバル・ネットワーク、接続完了。」");

        entity.onclick = () => {
            if (isCommandMode) return;
            isCommandMode = true;
            
            // 思考モードのUI変化
            entity.style.animation = 'ai-pulse 0.5s infinite alternate';
            entity.style.borderColor = '#ff00ff';
            core.style.borderTopColor = '#ff00ff';
            core.style.borderBottomColor = '#ff00ff';
            core.style.animationDuration = '0.5s'; // 超高速回転
            
            talk("「対象の概念を入力してください。」", 0);

            const cmdInput = document.createElement('input');
            cmdInput.type = 'text';
            cmdInput.placeholder = '例: 量子力学, ブラックホール, 織田信長...';
            cmdInput.style.cssText = `
                position: absolute; top: 80px; left: 50%; transform: translateX(-50%);
                width: 220px; padding: 10px; background: rgba(0,0,0,0.9);
                border: 1px solid #ff00ff; color: #ff00ff; outline: none;
                font-size: 12px; border-radius: 6px; pointer-events: auto;
                box-shadow: 0 0 15px rgba(255,0,255,0.4); text-align: center;
            `;
            entity.appendChild(cmdInput);
            cmdInput.focus();

            cmdInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const command = cmdInput.value.trim();
                    cmdInput.remove();
                    
                    // UIを通常に戻す
                    entity.style.animation = 'ai-float 3s ease-in-out infinite alternate';
                    entity.style.borderColor = 'rgba(0, 255, 204, 0.6)';
                    core.style.borderTopColor = '#fff';
                    core.style.borderBottomColor = '#fff';
                    core.style.animationDuration = '2s';
                    isCommandMode = false;
                    
                    if (command) executeKnowledgeWeaver(command);
                    else talk("「アクセスを中断しました。」");
                }
            };
        };

        // 🌐 グローバルネット(Wikipedia API)から概念を抽出し、星の星座として具現化する関数
        const executeKnowledgeWeaver = async (query) => {
            // システムコマンドの処理（掃除、整列など）
            if (query.includes('掃除') || query.includes('消して')) {
                app.blackHole.push(...app.currentUniverse.nodes);
                app.currentUniverse.nodes = []; app.currentUniverse.links = [];
                talk("「空間の初期化を完了しました。」");
                if(window.universeAudio) window.universeAudio.playDelete();
                app.autoSave(); return;
            }
            if (query.includes('整列')) {
                Gravity.applyFormation(app.currentUniverse.nodes, 'circle');
                talk("「データを円環に整列させました。」");
                app.autoSave(); return;
            }

            // 🔍 通常の言葉なら、Wikipediaから情報を抽出して「ナレッジグラフ」を構築
            talk(`「『${query}』を検索中... グローバルネットにダイブします。」`, 0);
            if (window.universeAudio) window.universeAudio.playWarp();
            
            // 「〜について教えて」などの余分な言葉をカットして純粋なキーワードにする
            const keyword = query.replace(/(について教えて|とは|を調べて|を検索|教えて).*/, '').trim();

            try {
                // WikipediaのREST API (認証不要) にアクセス
                const res = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keyword)}`);
                
                if (!res.ok) {
                    talk("「該当するデータが見つかりませんでした。別の概念を指定してください。」");
                    if (window.HapticEngine) window.HapticEngine.playError();
                    return;
                }

                const data = await res.json();
                const cx = app.camera ? -app.camera.x : 0;
                const cy = app.camera ? -app.camera.y : 0;

                // 1. 中心の「親星」を生成
                app.currentUniverse.addNode(data.title, cx, cy, 60, '#ff00ff', 'star');
                const centerNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                
                // サムネイル画像があれば親星のアイコンに設定
                if (data.thumbnail && data.thumbnail.source) {
                    centerNode.iconUrl = data.thumbnail.source;
                }
                
                // 本文をノートに記録
                centerNode.note = `【${data.title}】\n${data.extract}\n\n[Source: Wikipedia Global Network]`;
                
                // 2. 本文を「。」で分割し、意味の断片（子星）を生成してリンクする
                const sentences = data.extract.split('。').filter(s => s.length > 10).slice(0, 5); // 最大5つの子星
                
                sentences.forEach((text, i) => {
                    const angle = (i / sentences.length) * Math.PI * 2;
                    const dist = 180; // 親星からの距離
                    const nx = cx + Math.cos(angle) * dist;
                    const ny = cy + Math.sin(angle) * dist;
                    
                    app.currentUniverse.addNode(`断片 ${i+1}`, nx, ny, 20, '#00ffcc', 'star');
                    const childNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                    childNode.note = text + "。"; // 断片ごとにノートを持たせる
                    
                    // 親星と子星をリンクで繋ぐ
                    app.currentUniverse.links.push({ source: centerNode, target: childNode });
                });

                talk(`「構築完了。『${data.title}』のナレッジグラフを展開しました。」`);
                if (window.universeAudio) window.universeAudio.playSystemSound(600, 'square', 0.2);
                
                app.autoSave();
                // 物理エンジンを再起動して、リンクされた星を綺麗に広げる
                if (app.simulation) app.simulation.alpha(1).restart();

            } catch (error) {
                talk("「通信エラー。グローバルネットへの接続が遮断されました。」");
                console.error(error);
            }
        };

        // 初期配置のランダム化
        entity.style.left = `${window.innerWidth - 100}px`;
        entity.style.top = `100px`;
        
        if (window.universeAudio) window.universeAudio.playSystemSound(800, 'sine', 0.2);
    }
}