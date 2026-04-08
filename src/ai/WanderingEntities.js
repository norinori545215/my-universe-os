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
            background: rgba(0, 15, 25, 0.9);
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.5), inset 0 0 15px rgba(0, 255, 204, 0.3);
            border: 1px solid #00ffcc; backdrop-filter: blur(5px);
            z-index: 100000; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        const ring = document.createElement('div');
        ring.style.cssText = `position: absolute; width: 130%; height: 130%; border: 1px dashed rgba(0, 255, 204, 0.6); border-radius: 50%; animation: oracle-spin 10s linear infinite;`;
        const innerNode = document.createElement('div');
        innerNode.style.cssText = `width: 15px; height: 15px; background: #00ffcc; border-radius: 50%; box-shadow: 0 0 10px #00ffcc; animation: oracle-pulse 2s infinite alternate;`;
        
        core.appendChild(ring); core.appendChild(innerNode);
        document.body.appendChild(core);

        if (!document.getElementById('oracle-styles')) {
            const style = document.createElement('style');
            style.id = 'oracle-styles';
            style.innerHTML = `
                @keyframes oracle-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes oracle-pulse { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.2); opacity: 1; } }
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
        promptText.innerText = 'NEURAL QUERY INTERFACE';
        promptText.style.cssText = `color: #00ffcc; font-size: 16px; letter-spacing: 5px; margin-bottom: 30px; text-shadow: 0 0 15px #00ffcc;`;
        terminal.appendChild(promptText);

        // ★ 日本語入力バグを完全に防ぐための form 要素
        const form = document.createElement('form');
        form.style.cssText = 'position: relative; z-index: 100002; display: flex; flex-direction: column; align-items: center;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search Concept...';
        input.style.cssText = `
            width: 320px; padding: 15px; background: rgba(0,255,204,0.05);
            border: 1px solid #00ffcc; border-radius: 4px; color: #fff;
            font-size: 16px; text-align: center; outline: none;
            box-shadow: 0 0 20px rgba(0,255,204,0.2); transition: 0.3s;
        `;
        
        form.appendChild(input);
        terminal.appendChild(form);

        const logArea = document.createElement('div');
        logArea.style.cssText = `margin-top: 30px; width: 320px; height: 120px; color: #00ffcc; font-size: 12px; overflow-y: hidden; text-align: left; opacity: 0.8; line-height: 1.6;`;
        terminal.appendChild(logArea);

        // UI制御
        core.onmouseenter = () => { core.style.transform = 'scale(1.1)'; core.style.borderColor = '#ff00ff'; innerNode.style.background = '#ff00ff'; innerNode.style.boxShadow = '0 0 10px #ff00ff'; };
        core.onmouseleave = () => { core.style.transform = 'scale(1)'; core.style.borderColor = '#00ffcc'; innerNode.style.background = '#00ffcc'; innerNode.style.boxShadow = '0 0 10px #00ffcc'; };
        
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

        // タイピング風のログ出力関数
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
                }, 15); // タイピング速度
            });
        };

        // 3. 未来的なマインドマップ構築エンジン
        form.onsubmit = async (e) => {
            e.preventDefault(); // 画面リロードを防止
            const query = input.value.trim();
            if (!query) return;

            input.style.display = 'none';
            await typeLog(`INITIATING NEURAL DIVE: [${query}]...`);
            if(window.universeAudio) window.universeAudio.playWarp();

            try {
                // STEP 1: メイン記事の概要を取得
                await typeLog('ACCESSING GLOBAL DATABANKS...');
                const sumRes = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
                
                if (!sumRes.ok) {
                    await typeLog('ERROR: CONCEPT NOT FOUND.', '#ff4444');
                    if (window.HapticEngine) window.HapticEngine.playError();
                    setTimeout(closeTerminal, 2000);
                    return;
                }
                const mainData = await sumRes.json();
                
                if (mainData.type === 'disambiguation') {
                    await typeLog('ERROR: AMBIGUOUS QUERY. PLEASE BE SPECIFIC.', '#ffaa00');
                    setTimeout(closeTerminal, 2500);
                    return;
                }

                await typeLog(`TARGET ACQUIRED: ${mainData.title}`);

                // STEP 2: 「完全に関連する」ページ群を抽出（ゴミデータ撲滅）
                await typeLog('EXTRACTING SEMANTIC KNOWLEDGE...');
                const relRes = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/related/${encodeURIComponent(mainData.title)}`);
                const relData = await relRes.json();
                
                // 本物の関連用語（標準的な記事）だけを最大5つ厳選
                const relatedPages = (relData.pages || []).filter(p => p.type === 'standard').slice(0, 5);

                await typeLog('DATA COMPILED. CONSTRUCTING CONSTELLATION...', '#ff00ff');

                // STEP 3: OSの空間に物理的に構築（カスケード・アニメーション）
                setTimeout(() => {
                    closeTerminal();

                    if(app.camera) app.camera.zoomTo(0, 0, 1);
                    const cx = app.camera ? -app.camera.x : 0;
                    const cy = app.camera ? -app.camera.y : 0;

                    // まず中心の親星を召喚
                    app.currentUniverse.addNode(mainData.title, cx, cy, 60, '#ff00ff', 'galaxy');
                    const centerNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                    if (mainData.thumbnail && mainData.thumbnail.source) centerNode.iconUrl = mainData.thumbnail.source;
                    centerNode.note = `【${mainData.title}】\n${mainData.extract}\n\n[Data from Global Net]`;
                    
                    app.autoSave();
                    if(app.spawnRipple) app.spawnRipple(cx, cy, '#ff00ff');
                    if(window.universeAudio) window.universeAudio.playSpawn();

                    // 子星を「時間差」で一つずつ召喚していく（未来的な演出）
                    relatedPages.forEach((page, i) => {
                        setTimeout(() => {
                            const angle = (i / relatedPages.length) * Math.PI * 2;
                            const dist = 220;
                            const nx = cx + Math.cos(angle) * dist;
                            const ny = cy + Math.sin(angle) * dist;
                            
                            app.currentUniverse.addNode(page.title, nx, ny, 30, '#00ffcc', 'star');
                            const childNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                            if (page.thumbnail && page.thumbnail.source) childNode.iconUrl = page.thumbnail.source;
                            childNode.note = `【${page.title}】\n${page.extract ? page.extract : "関連データ"}`;
                            
                            app.currentUniverse.links.push({ source: centerNode, target: childNode });
                            
                            // 描画エンジンに強制通知して動かす
                            app.autoSave();
                            if(app.spawnRipple) app.spawnRipple(nx, ny, '#00ffcc');
                            if(window.universeAudio) window.universeAudio.playSpawn();
                            
                            if(app.simulation) {
                                app.simulation.nodes(app.currentUniverse.nodes);
                                app.simulation.force("link").links(app.currentUniverse.links);
                                app.simulation.alpha(0.3).restart();
                            }
                        }, (i + 1) * 350); // 0.35秒間隔で次々と星が誕生する
                    });

                }, 1000);

            } catch (error) {
                await typeLog('CRITICAL ERROR: CONNECTION FAILED', '#ff4444');
                console.error(error);
                setTimeout(closeTerminal, 2000);
            }
        };

        if (window.universeAudio) window.universeAudio.playSystemSound(400, 'square', 0.1);
    }
}