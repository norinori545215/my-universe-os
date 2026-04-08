// src/ai/WanderingEntities.js

export class WanderingEntities {
    static start() {
        console.log("👁️ [Neural Oracle V2] 特異点オーバーロード完了");
    }

    static spawn(app) {
        if (document.getElementById('oracle-core')) document.getElementById('oracle-core').remove();

        // --- 1. HUDコア生成（思考トレースアニメーション付き） ---
        const core = document.createElement('div');
        core.id = 'oracle-core';
        core.style.cssText = `
            position: fixed; top: 20px; right: 20px; width: 45px; height: 45px; border-radius: 50%;
            display: flex; justify-content: center; align-items: center; background: rgba(0, 10, 20, 0.9);
            box-shadow: 0 0 20px rgba(0, 255, 204, 0.6), inset 0 0 15px rgba(0, 255, 204, 0.4);
            border: 1px solid #00ffcc; backdrop-filter: blur(5px); z-index: 100000; cursor: pointer; transition: 0.3s;
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
                @keyframes scan-line { 0% { top: 0; } 100% { top: 100%; } }
            `;
            document.head.appendChild(style);
        }

        // --- 2. ターミナルUI ---
        const terminal = document.createElement('div');
        terminal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: radial-gradient(circle, rgba(0,10,20,0.95) 0%, rgba(0,0,0,0.98) 100%);
            z-index: 100001; display: none; flex-direction: column; justify-content: center; align-items: center;
            backdrop-filter: blur(20px); font-family: monospace; overflow: hidden;
        `;
        document.body.appendChild(terminal);

        // 思考の物理投影（ハッキング演出）
        const scanLine = document.createElement('div');
        scanLine.style.cssText = `position: absolute; width: 100%; height: 2px; background: rgba(0, 255, 204, 0.5); box-shadow: 0 0 20px #00ffcc; animation: scan-line 2s linear infinite; pointer-events: none;`;
        terminal.appendChild(scanLine);

        const form = document.createElement('form');
        form.style.cssText = 'position: relative; z-index: 100002; display: flex; flex-direction: column; align-items: center;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Initiate Deep Dive...';
        input.style.cssText = `
            width: 400px; padding: 15px; background: rgba(0,255,204,0.05); border: 1px solid #00ffcc;
            border-radius: 4px; color: #fff; font-size: 18px; text-align: center; outline: none;
            box-shadow: 0 0 20px rgba(0,255,204,0.2); transition: 0.3s; text-transform: uppercase;
        `;
        
        form.appendChild(input);
        terminal.appendChild(form);

        const logArea = document.createElement('div');
        logArea.style.cssText = `margin-top: 30px; width: 400px; height: 150px; color: #00ffcc; font-size: 13px; overflow-y: hidden; text-align: left; opacity: 0.9; line-height: 1.5; text-shadow: 0 0 5px rgba(0,255,204,0.5);`;
        terminal.appendChild(logArea);

        // UI制御
        core.onclick = () => {
            terminal.style.display = 'flex';
            setTimeout(() => input.focus(), 100);
            playSynthTone(600, 'sine', 0.1);
        };
        const closeTerminal = () => { terminal.style.display = 'none'; input.value = ''; logArea.innerHTML = ''; input.style.display = 'block'; };
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
                }, 5); // 爆速タイピング
            });
        };

        // ★★★ 進化1: 音響データ・ソニフィケーション（概念の音化） ★★★
        const playSynthTone = (freq, type, duration) => {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(); osc.stop(ctx.currentTime + duration);
            } catch(e) {}
        };

        // ★★★ 進化2: 意味論的スペクトル（感情カラーリング） ★★★
        const analyzeSemantics = (text) => {
            if (/(死|殺|戦争|兵器|ブラックホール|崩壊|終焉)/.test(text)) return '#ff4444'; // 危険・破壊
            if (/(歴史|古|文明|神|徳川|時代)/.test(text)) return '#ffaa00'; // 歴史・古代
            if (/(宇宙|量子|物理|科学|計算)/.test(text)) return '#44aaff'; // 科学・論理
            return '#00ffcc'; // デフォルト
        };

        // ★★★ コア・エンジン（無限階層対応） ★★★
        const executeDive = async (query, parentNode = null) => {
            await typeLog(`INITIATING QUANTUM DIVE: [${query}]...`);
            playSynthTone(800, 'sawtooth', 0.2);

            try {
                const mainRes = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
                let mainData;
                if (mainRes.ok) mainData = await mainRes.json();
                else {
                    const searchRes = await fetch(`https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`);
                    const searchData = await searchRes.json();
                    if (!searchData.query.search.length) throw new Error("CONCEPT NOT FOUND");
                    const fallbackRes = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchData.query.search[0].title)}`);
                    mainData = await fallbackRes.json();
                }

                if (mainData.type === 'disambiguation') throw new Error("AMBIGUOUS CONCEPT");

                const title = mainData.title;
                const extract = mainData.extract || "";
                
                // ★★★ 進化3: 超重力井戸（文字数で質量を決定） ★★★
                const mass = Math.min(100, Math.max(30, extract.length / 5)); 
                const color = analyzeSemantics(title + extract);
                await typeLog(`CORE ACQUIRED: ${title} (MASS: ${Math.floor(mass)}T)`, color);

                const searchRes = await fetch(`https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)}&utf8=&format=json&origin=*`);
                const searchData = await searchRes.json();
                const validResults = searchData.query.search.filter(item => {
                    const t = item.title;
                    return t !== title && !/^\d+年$/.test(t) && !/\d+月\d+日/.test(t) && !t.includes('一覧') && !t.includes('曖昧さ回避');
                }).slice(0, 5);

                await typeLog('CONSTELLATION MAPPED. MATERIALIZING...', '#ff00ff');

                setTimeout(() => {
                    if(!parentNode) closeTerminal(); // 初回のみ閉じる

                    const cx = parentNode ? parentNode.x : (app.camera ? -app.camera.x : 0);
                    const cy = parentNode ? parentNode.y : (app.camera ? -app.camera.y : 0);

                    // 親星生成
                    app.currentUniverse.addNode(title, cx, cy, mass, color, 'galaxy');
                    const centerNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                    if (mainData.thumbnail) centerNode.iconUrl = mainData.thumbnail.source;
                    centerNode.note = `【${title}】\n${extract}\n\n[Double Click to Deep Dive]`;
                    
                    if(parentNode) app.currentUniverse.links.push({ source: parentNode, target: centerNode });
                    if(app.spawnRipple) app.spawnRipple(cx, cy, color);
                    playSynthTone(200, 'sine', 0.5);

                    // ★★★ 進化4: フラクタル・ダイブ（星をダブルクリックで再帰展開） ★★★
                    centerNode.onDoubleClick = () => {
                        if(confirm(`[${title}]の深層概念へダイブしますか？`)) {
                            app.camera.zoomTo(centerNode.x, centerNode.y, 1);
                            executeDive(title, centerNode);
                        }
                    };

                    validResults.forEach((result, i) => {
                        setTimeout(() => {
                            const angle = (i / validResults.length) * Math.PI * 2;
                            const spawnX = cx + Math.cos(angle) * (mass + 20);
                            const spawnY = cy + Math.sin(angle) * (mass + 20);
                            
                            const childColor = analyzeSemantics(result.title + result.snippet);
                            const cleanSnippet = result.snippet.replace(/<[^>]*>?/gm, '');

                            app.currentUniverse.addNode(result.title, spawnX, spawnY, mass*0.4, childColor, 'star');
                            const childNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                            childNode.note = `【${result.title}】\n${cleanSnippet}...\n\n[Double Click to Deep Dive]`;
                            
                            app.currentUniverse.links.push({ source: centerNode, target: childNode });
                            
                            // フラクタル展開の付与
                            childNode.onDoubleClick = () => {
                                if(confirm(`[${result.title}]の深層概念へダイブしますか？`)) {
                                    executeDive(result.title, childNode);
                                }
                            };

                            if(app.spawnRipple) app.spawnRipple(spawnX, spawnY, childColor);
                            playSynthTone(400 + (i * 100), 'triangle', 0.1);
                            
                            // ★★★ 進化5: 重力崩壊イベント（星が増えすぎたら破滅） ★★★
                            if(app.currentUniverse.nodes.length > 50) {
                                alert("⚠️ 臨界質量突破。重力崩壊が発生します。");
                                app.blackHole.push(...app.currentUniverse.nodes);
                                app.currentUniverse.nodes = []; app.currentUniverse.links = [];
                                playSynthTone(50, 'square', 1.0);
                                document.body.style.filter = 'invert(1)';
                                setTimeout(() => document.body.style.filter = '', 500);
                            }

                            app.autoSave();
                            if(app.simulation) {
                                app.simulation.nodes(app.currentUniverse.nodes);
                                app.simulation.force("link").links(app.currentUniverse.links);
                                app.simulation.alpha(0.5).restart();
                            }
                        }, (i + 1) * 200); 
                    });

                }, 800);

            } catch (error) {
                await typeLog(`CRITICAL ERROR: ${error.message}`, '#ff4444');
                playSynthTone(100, 'sawtooth', 0.5);
                if(!parentNode) setTimeout(closeTerminal, 2000);
            }
        };

        form.onsubmit = async (e) => {
            e.preventDefault();
            const query = input.value.trim();
            if (!query) return;
            input.style.display = 'none';
            executeDive(query);
        };
    }
}