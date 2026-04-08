// src/ai/WanderingEntities.js

export class WanderingEntities {
    static start() {
        console.log("👁️ [Neural Oracle] システムに常駐しました");
    }

    static spawn(app) {
        if (document.getElementById('oracle-core')) document.getElementById('oracle-core').remove();

        // 1. HUD（AIコア）の生成
        const core = document.createElement('div');
        core.id = 'oracle-core';
        core.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            width: 45px; height: 45px; border-radius: 50%;
            display: flex; justify-content: center; align-items: center;
            background: rgba(0, 10, 20, 0.9);
            box-shadow: 0 0 20px rgba(0, 255, 204, 0.6), inset 0 0 15px rgba(0, 255, 204, 0.4);
            border: 1px solid #00ffcc; backdrop-filter: blur(5px);
            z-index: 100000; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        const ring = document.createElement('div');
        ring.style.cssText = `position: absolute; width: 140%; height: 140%; border: 1px dashed rgba(0, 255, 204, 0.8); border-radius: 50%; animation: oracle-spin 8s linear infinite;`;
        const innerNode = document.createElement('div');
        innerNode.style.cssText = `width: 12px; height: 12px; background: #00ffcc; border-radius: 50%; box-shadow: 0 0 15px #00ffcc; animation: oracle-pulse 1.5s infinite alternate;`;
        
        core.appendChild(ring); core.appendChild(innerNode);
        document.body.appendChild(core);

        if (!document.getElementById('oracle-styles')) {
            const style = document.createElement('style');
            style.id = 'oracle-styles';
            style.innerHTML = `
                @keyframes oracle-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes oracle-pulse { 0% { transform: scale(0.7); opacity: 0.6; } 100% { transform: scale(1.3); opacity: 1; } }
            `;
            document.head.appendChild(style);
        }

        // 2. フルスクリーン・ニューラルターミナルの生成
        const terminal = document.createElement('div');
        terminal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 5, 10, 0.95); z-index: 100001;
            display: none; flex-direction: column; justify-content: center; align-items: center;
            backdrop-filter: blur(20px); font-family: monospace;
        `;
        document.body.appendChild(terminal);

        const promptText = document.createElement('div');
        promptText.innerText = 'NEURAL KNOWLEDGE EXTRACTOR';
        promptText.style.cssText = `color: #00ffcc; font-size: 16px; letter-spacing: 5px; margin-bottom: 30px; text-shadow: 0 0 15px #00ffcc;`;
        terminal.appendChild(promptText);

        const form = document.createElement('form');
        form.style.cssText = 'position: relative; z-index: 100002; display: flex; flex-direction: column; align-items: center;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search Concept (e.g. ブラックホール)';
        input.style.cssText = `
            width: 350px; padding: 15px; background: rgba(0,255,204,0.05);
            border: 1px solid #00ffcc; border-radius: 4px; color: #fff;
            font-size: 16px; text-align: center; outline: none;
            box-shadow: 0 0 20px rgba(0,255,204,0.2); transition: 0.3s;
        `;
        
        form.appendChild(input);
        terminal.appendChild(form);

        const logArea = document.createElement('div');
        logArea.style.cssText = `margin-top: 30px; width: 350px; height: 120px; color: #00ffcc; font-size: 12px; overflow-y: hidden; text-align: left; opacity: 0.8; line-height: 1.6;`;
        terminal.appendChild(logArea);

        // UI制御
        core.onmouseenter = () => { core.style.transform = 'scale(1.1)'; core.style.borderColor = '#ff00ff'; innerNode.style.background = '#ff00ff'; innerNode.style.boxShadow = '0 0 15px #ff00ff'; ring.style.borderColor = 'rgba(255, 0, 255, 0.8)'; };
        core.onmouseleave = () => { core.style.transform = 'scale(1)'; core.style.borderColor = '#00ffcc'; innerNode.style.background = '#00ffcc'; innerNode.style.boxShadow = '0 0 15px #00ffcc'; ring.style.borderColor = 'rgba(0, 255, 204, 0.8)'; };
        
        core.onclick = () => {
            terminal.style.display = 'flex';
            setTimeout(() => input.focus(), 100);
            if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.2);
        };

        const closeTerminal = () => {
            terminal.style.display = 'none';
            input.value = '';
            logArea.innerHTML = '';
            input.style.display = 'block';
        };

        terminal.onclick = (e) => { if(e.target === terminal) closeTerminal(); };

        const typeLog = async (msg, color = '#00ffcc') => {
            return new Promise(resolve => {
                const line = document.createElement('div');
                line.style.color = color;
                logArea.appendChild(line);
                let i = 0;
                const type = setInterval(() => {
                    line.innerText = '> ' + msg.substring(0, i);
                    i++;
                    if (i > msg.length) { clearInterval(type); logArea.scrollTop = logArea.scrollHeight; resolve(); }
                }, 10);
            });
        };

        // 3. ゴミデータを排除した真のナレッジエンジン
        form.onsubmit = async (e) => {
            e.preventDefault();
            const query = input.value.trim();
            if (!query) return;

            input.style.display = 'none';
            await typeLog(`INITIATING NEURAL DIVE: [${query}]...`);
            if(window.universeAudio) window.universeAudio.playWarp();

            try {
                // STEP 1: 完全一致または最も関連性の高いメイン記事を取得
                await typeLog('ACCESSING GLOBAL DATABANKS...');
                const mainRes = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
                let mainData;
                
                if (mainRes.ok) {
                    mainData = await mainRes.json();
                } else {
                    // 見つからない場合は検索APIで最も近いものを探す
                    const fallbackSearch = await fetch(`https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`);
                    const fallbackData = await fallbackSearch.json();
                    if (!fallbackData.query.search || fallbackData.query.search.length === 0) {
                        await typeLog('ERROR: CONCEPT NOT FOUND.', '#ff4444');
                        setTimeout(closeTerminal, 2000);
                        return;
                    }
                    const fallbackRes = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(fallbackData.query.search[0].title)}`);
                    mainData = await fallbackRes.json();
                }

                if (mainData.type === 'disambiguation') {
                    await typeLog('ERROR: AMBIGUOUS QUERY.', '#ffaa00');
                    setTimeout(closeTerminal, 2000);
                    return;
                }

                await typeLog(`CORE ACQUIRED: ${mainData.title}`);

                // STEP 2: ゴミデータを排除するため、「関連リンク」ではなく「検索ランキング上位」を取得
                await typeLog('EXTRACTING SEMANTIC CONSTELLATION...');
                // mainData.title を検索ワードとして使い、関連性が高いページをランキング順で取得する
                const searchRes = await fetch(`https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(mainData.title)}&utf8=&format=json&origin=*`);
                const searchData = await searchRes.json();

                // 検索結果から「年号」「一覧」「曖昧さ回避」「自分自身」を完全に除外
                const validResults = searchData.query.search.filter(item => {
                    const t = item.title;
                    if (t === mainData.title) return false; // 自分自身を弾く
                    if (/^\d+年$/.test(t)) return false; // 「1930年」などを弾く
                    if (/\d+月\d+日/.test(t)) return false; // 日付を弾く
                    if (t.includes('一覧') || t.includes('曖昧さ回避') || t.includes('作品') || t.includes('登場')) return false;
                    return true;
                }).slice(0, 5); // 上位5つを厳選

                await typeLog('CONSTELLATION MAPPED. MATERIALIZING...', '#ff00ff');

                // STEP 3: 空間へのカスケード召喚（劇的なアニメーション）
                setTimeout(() => {
                    closeTerminal();

                    if(app.camera) app.camera.zoomTo(0, 0, 1);
                    const cx = app.camera ? -app.camera.x : 0;
                    const cy = app.camera ? -app.camera.y : 0;

                    // 親星の召喚
                    app.currentUniverse.addNode(mainData.title, cx, cy, 65, '#ff00ff', 'galaxy');
                    const centerNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                    if (mainData.thumbnail && mainData.thumbnail.source) {
                        centerNode.iconUrl = mainData.thumbnail.source;
                    }
                    centerNode.note = `【${mainData.title}】\n${mainData.extract}\n\n[Data from Global Net]`;
                    
                    app.autoSave();
                    if(app.spawnRipple) app.spawnRipple(cx, cy, '#ff00ff');
                    if(window.universeAudio) window.universeAudio.playSpawn();

                    // 子星の時間差召喚
                    validResults.forEach((result, i) => {
                        setTimeout(() => {
                            const angle = (i / validResults.length) * Math.PI * 2;
                            const dist = 240;
                            // 最初は中心から少しずれた位置に生成し、物理エンジンで弾き飛ばす
                            const spawnX = cx + Math.cos(angle) * 50;
                            const spawnY = cy + Math.sin(angle) * 50;
                            
                            // HTMLタグを除去した概要文
                            const cleanSnippet = result.snippet.replace(/<[^>]*>?/gm, '');

                            app.currentUniverse.addNode(result.title, spawnX, spawnY, 30, '#00ffcc', 'star');
                            const childNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                            childNode.note = `【${result.title}】\n${cleanSnippet}...\n\n[関連データ]`;
                            
                            // リンクの結成
                            app.currentUniverse.links.push({ source: centerNode, target: childNode });
                            
                            app.autoSave();
                            if(app.spawnRipple) app.spawnRipple(spawnX, spawnY, '#00ffcc');
                            if(window.universeAudio) window.universeAudio.playSystemSound(800 + (i * 100), 'triangle', 0.1);
                            
                            // 物理エンジンの再点火（星が中心からシュッと広がる）
                            if(app.simulation) {
                                app.simulation.nodes(app.currentUniverse.nodes);
                                app.simulation.force("link").links(app.currentUniverse.links);
                                app.simulation.alpha(0.5).restart();
                            }
                        }, (i + 1) * 200); // 0.2秒間隔で高速展開
                    });

                }, 800);

            } catch (error) {
                await typeLog(`CRITICAL ERROR: ${error.message}`, '#ff4444');
                console.error("Knowledge Weaver Error:", error);
                setTimeout(closeTerminal, 3000);
            }
        };

        if (window.universeAudio) window.universeAudio.playSystemSound(400, 'square', 0.1);
    }
}