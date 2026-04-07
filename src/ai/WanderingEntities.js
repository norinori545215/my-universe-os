// src/ai/WanderingEntities.js

export class WanderingEntities {
    static start() {
        console.log("👁️ [Neural Oracle] システムに常駐しました");
    }

    static spawn(app) {
        // 既に存在していれば消す（重複防止）
        if (document.getElementById('oracle-core')) document.getElementById('oracle-core').remove();

        // 1. 画面右上に常駐する洗練された「AIコア（HUD）」
        const core = document.createElement('div');
        core.id = 'oracle-core';
        core.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            width: 50px; height: 50px;
            border-radius: 50%;
            display: flex; justify-content: center; align-items: center;
            background: rgba(0, 20, 30, 0.8);
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.4), inset 0 0 20px rgba(0, 255, 204, 0.2);
            border: 1px solid rgba(0, 255, 204, 0.5);
            backdrop-filter: blur(10px);
            z-index: 100000;
            cursor: crosshair;
            transition: all 0.3s ease;
        `;

        // コア内部の回転リング
        const ring1 = document.createElement('div');
        ring1.style.cssText = `position: absolute; width: 80%; height: 80%; border: 2px solid transparent; border-top-color: #00ffcc; border-bottom-color: #00ffcc; border-radius: 50%; animation: oracle-spin 4s linear infinite;`;
        const ring2 = document.createElement('div');
        ring2.style.cssText = `position: absolute; width: 50%; height: 50%; border: 2px solid transparent; border-left-color: #ff00ff; border-right-color: #ff00ff; border-radius: 50%; animation: oracle-spin-rev 2s linear infinite;`;
        
        core.appendChild(ring1); core.appendChild(ring2);
        
        // コア下部のラベル
        const label = document.createElement('div');
        label.innerText = 'ORACLE AI';
        label.style.cssText = `position: absolute; bottom: -15px; font-size: 9px; color: #00ffcc; font-family: monospace; letter-spacing: 2px; text-shadow: 0 0 5px #00ffcc;`;
        core.appendChild(label);
        document.body.appendChild(core);

        if (!document.getElementById('oracle-styles')) {
            const style = document.createElement('style');
            style.id = 'oracle-styles';
            style.innerHTML = `
                @keyframes oracle-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes oracle-spin-rev { 0% { transform: rotate(360deg); } 100% { transform: rotate(0deg); } }
                @keyframes oracle-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
            `;
            document.head.appendChild(style);
        }

        // 2. コアをクリックした時に開く「フルスクリーン・ニューラルターミナル」
        const terminal = document.createElement('div');
        terminal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: radial-gradient(circle, rgba(0,20,30,0.95) 0%, rgba(0,0,0,0.98) 100%);
            z-index: 100001; display: none; flex-direction: column; justify-content: center; align-items: center;
            backdrop-filter: blur(15px); font-family: monospace;
        `;
        document.body.appendChild(terminal);

        const promptText = document.createElement('div');
        promptText.innerText = '>>> ENTER NEURAL QUERY <<<';
        promptText.style.cssText = `color: #00ffcc; font-size: 14px; letter-spacing: 4px; margin-bottom: 20px; text-shadow: 0 0 10px #00ffcc; animation: oracle-blink 1.5s infinite;`;
        terminal.appendChild(promptText);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search Concept...';
        input.style.cssText = `
            width: 300px; padding: 15px; background: rgba(0,0,0,0.5);
            border: 1px solid #00ffcc; border-radius: 4px; color: #fff;
            font-size: 16px; text-align: center; outline: none;
            box-shadow: 0 0 20px rgba(0,255,204,0.2); font-family: monospace;
        `;
        terminal.appendChild(input);

        const logArea = document.createElement('div');
        logArea.style.cssText = `margin-top: 20px; width: 300px; height: 100px; color: #00ffcc; font-size: 11px; overflow: hidden; text-align: left; opacity: 0.7;`;
        terminal.appendChild(logArea);

        // HUDホバー＆クリック制御
        core.onmouseenter = () => { core.style.transform = 'scale(1.1)'; core.style.boxShadow = '0 0 25px rgba(0, 255, 204, 0.8)'; };
        core.onmouseleave = () => { core.style.transform = 'scale(1)'; core.style.boxShadow = '0 0 15px rgba(0, 255, 204, 0.4)'; };
        
        core.onclick = () => {
            terminal.style.display = 'flex';
            setTimeout(() => input.focus(), 100);
            if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.2);
        };

        const closeTerminal = () => {
            terminal.style.display = 'none';
            input.value = '';
            logArea.innerHTML = '';
        };

        terminal.onclick = (e) => { if(e.target === terminal) closeTerminal(); };

        // ログ出力用関数
        const log = (msg, color = '#00ffcc') => {
            logArea.innerHTML += `<div style="color:${color}; margin-bottom:4px;">> ${msg}</div>`;
            logArea.scrollTop = logArea.scrollHeight;
        };

        // 3. 圧倒的な未来を創る「ナレッジグラフ自動構築エンジン」
        input.onkeydown = async (e) => {
            if (e.isComposing || e.keyCode === 229) return; // 日本語入力中のEnterを無視
            if (e.key === 'Escape') return closeTerminal();
            if (e.key !== 'Enter') return;

            const query = input.value.trim();
            if (!query) return;

            input.style.display = 'none'; // 入力を隠す
            log(`INITIATING NEURAL DIVE: [${query}]...`);
            if(window.universeAudio) window.universeAudio.playWarp();

            try {
                // STEP 1: 曖昧な検索ワードから「Wikipediaの正確な記事タイトル」を検索（空っぽ防止）
                log('ACCESSING WIKIPEDIA DATABANKS...');
                const searchRes = await fetch(`https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`);
                const searchData = await searchRes.json();
                
                if (!searchData.query.search || searchData.query.search.length === 0) {
                    log('ERROR: CONCEPT NOT FOUND IN GLOBAL NET.', '#ff4444');
                    setTimeout(closeTerminal, 2000);
                    return;
                }
                const exactTitle = searchData.query.search[0].title;
                log(`TARGET ACQUIRED: ${exactTitle}`);

                // STEP 2: 対象の「概要」と「画像」を取得
                log('DOWNLOADING CORE DATA...');
                const sumRes = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(exactTitle)}`);
                const sumData = await sumRes.json();

                // STEP 3: 本物の関連用語（リンク）を取得（関係ないデータ・空っぽデータを撲滅）
                log('EXTRACTING SEMANTIC LINKS...');
                const linkRes = await fetch(`https://ja.wikipedia.org/w/api.php?action=query&prop=links&titles=${encodeURIComponent(exactTitle)}&pllimit=8&plnamespace=0&format=json&origin=*`);
                const linkData = await linkRes.json();
                const pages = linkData.query.pages;
                const pageId = Object.keys(pages)[0];
                const links = pages[pageId].links ? pages[pageId].links.map(l => l.title) : [];

                log('DATA COMPILED. CONSTRUCTING CONSTELLATION...', '#ff00ff');

                // STEP 4: カメラを中央にリセットし、OSに星を物理召喚する
                setTimeout(() => {
                    closeTerminal();
                    input.style.display = 'block';

                    // カメラ移動
                    if(app.camera) app.camera.zoomTo(0, 0, 1);
                    
                    const cx = app.camera ? -app.camera.x : 0;
                    const cy = app.camera ? -app.camera.y : 0;

                    // 親星（コア概念）の生成
                    app.currentUniverse.addNode(sumData.title, cx, cy, 60, '#ff00ff', 'galaxy');
                    const centerNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                    if (sumData.thumbnail && sumData.thumbnail.source) centerNode.iconUrl = sumData.thumbnail.source;
                    centerNode.note = `【${sumData.title}】\n${sumData.extract}\n\n[Data from Global Net]`;

                    // 子星（関連用語）の生成とリンク結成
                    const validLinks = links.filter(l => !l.includes('一覧') && !l.includes('曖昧さ回避')).slice(0, 6);
                    
                    validLinks.forEach((linkTitle, i) => {
                        const angle = (i / validLinks.length) * Math.PI * 2;
                        const dist = 180;
                        const nx = cx + Math.cos(angle) * dist;
                        const ny = cy + Math.sin(angle) * dist;
                        
                        app.currentUniverse.addNode(linkTitle, nx, ny, 25, '#00ffcc', 'star');
                        const childNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                        childNode.note = `[Semantic Link to: ${sumData.title}]`;
                        
                        // 光の線（リンク）で結ぶ
                        app.currentUniverse.links.push({ source: centerNode, target: childNode });
                    });

                    // システムへの強制反映
                    app.autoSave();
                    if(app.simulation) {
                        app.simulation.nodes(app.currentUniverse.nodes);
                        app.simulation.force("link").links(app.currentUniverse.links);
                        app.simulation.alpha(1).restart();
                    }
                    if(window.universeAudio) window.universeAudio.playSpawn();
                    
                }, 1000);

            } catch (error) {
                log('CRITICAL ERROR: CONNECTION FAILED', '#ff4444');
                console.error(error);
                setTimeout(closeTerminal, 2000);
            }
        };

        if (window.universeAudio) window.universeAudio.playSystemSound(400, 'square', 0.1);
    }
}