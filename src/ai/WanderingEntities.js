// src/ai/WanderingEntities.js

export class WanderingEntities {
    static start() {
        console.log("👁️ [Knowledge Weaver] スタンバイ...");
    }

    static spawn(app) {
        const id = 'ai-entity-' + Date.now();
        
        const entity = document.createElement('div');
        entity.id = id;
        // ★ 座標移動(left, top)のラグを無くすため、transitionの対象を限定しました
        entity.style.cssText = `
            position: fixed;
            width: 50px; height: 50px;
            border-radius: 50%;
            display: flex; justify-content: center; align-items: center;
            box-shadow: 0 0 20px rgba(0, 255, 204, 0.3), inset 0 0 15px rgba(0, 255, 204, 0.5);
            backdrop-filter: blur(10px);
            z-index: 100000;
            pointer-events: auto;
            cursor: grab;
            user-select: none;
            transition: box-shadow 0.3s ease, transform 0.3s ease;
            background: radial-gradient(circle, rgba(0,255,204,0.6) 0%, transparent 70%);
        `;
        
        const ring = document.createElement('div');
        ring.style.cssText = `
            position: absolute; width: 100%; height: 100%;
            border: 1px solid transparent; border-top-color: #00ffcc; border-bottom-color: #00ffcc;
            border-radius: 50%;
            animation: ai-ring-spin 3s linear infinite;
        `;
        entity.appendChild(ring);

        if (!document.getElementById('ai-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-styles';
            style.innerHTML = `@keyframes ai-ring-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
        
        const speech = document.createElement('div');
        speech.style.cssText = `
            position: absolute; top: -40px; left: 50%; transform: translateX(-50%);
            color: #00ffcc; font-family: monospace; font-size: 11px; letter-spacing: 2px;
            white-space: nowrap; opacity: 0; transition: opacity 0.3s;
            text-shadow: 0 0 5px #00ffcc; pointer-events: none;
        `;
        entity.appendChild(speech);
        document.body.appendChild(entity);

        let isCommandMode = false;
        let isDragging = false;
        let hasMoved = false;
        let startX = 0, startY = 0;
        
        let x = window.innerWidth - 100; let y = 100;
        let vx = (Math.random() - 0.5) * 2; let vy = (Math.random() - 0.5) * 2;

        const talk = (text, duration = 3000) => {
            speech.innerText = text;
            speech.style.opacity = '1';
            if (duration > 0) setTimeout(() => { if (!isCommandMode) speech.style.opacity = '0'; }, duration);
        };

        talk("SYSTEM ONLINE");

        // ★★★ ドラッグ＆ドロップ（＋投げ飛ばし）の処理 ★★★
        const onDown = (e) => {
            if (isCommandMode && e.target !== entity) return;
            isDragging = true;
            hasMoved = false;
            entity.style.cursor = 'grabbing';
            entity.style.transform = 'scale(0.9)'; // 掴んだ感触
            
            const ev = e.touches ? e.touches[0] : e;
            startX = ev.clientX;
            startY = ev.clientY;
            
            if (window.HapticEngine) window.HapticEngine.vibrate([10]);
        };

        const onMove = (e) => {
            if (!isDragging) return;
            const ev = e.touches ? e.touches[0] : e;
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            
            // 5px以上動いたら「ドラッグ」と判定する（クリックと区別するため）
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;

            // マウスの動きに合わせて座標を更新
            x = ev.clientX - 25; // 25はAIの半径
            y = ev.clientY - 25;
            
            // マウスの移動量から「投げる速度（慣性）」を計算
            vx = e.movementX ? e.movementX * 0.5 : dx * 0.2;
            vy = e.movementY ? e.movementY * 0.5 : dy * 0.2;

            startX = ev.clientX;
            startY = ev.clientY;
        };

        const onUp = (e) => {
            if (!isDragging) return;
            isDragging = false;
            entity.style.cursor = 'grab';
            entity.style.transform = 'scale(1)';

            // もしドラッグせずに指を離したなら「クリック」として扱う
            if (!hasMoved) {
                openCommandMode();
            }
        };

        entity.addEventListener('mousedown', onDown);
        entity.addEventListener('touchstart', onDown, {passive: true});
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, {passive: true});
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchend', onUp);

        // ★★★ クリックされた時のコマンド入力モード ★★★
        const openCommandMode = () => {
            if (isCommandMode) return;
            isCommandMode = true;
            
            entity.style.boxShadow = '0 0 40px #ff00ff, inset 0 0 20px #ff00ff';
            ring.style.borderTopColor = '#ff00ff'; ring.style.borderBottomColor = '#ff00ff';
            ring.style.animationDuration = '0.8s';
            
            talk("QUERY REQ:", 0);

            const cmdInput = document.createElement('input');
            cmdInput.type = 'text';
            cmdInput.style.cssText = `
                position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
                width: 200px; padding: 8px; background: rgba(0,0,0,0.8);
                border: 1px solid #ff00ff; color: #ff00ff; outline: none;
                font-size: 12px; font-family: monospace; border-radius: 4px;
                box-shadow: 0 0 10px rgba(255,0,255,0.3); text-align: center; pointer-events: auto;
            `;
            entity.appendChild(cmdInput);
            cmdInput.focus();

            cmdInput.onkeydown = (e) => {
                if (e.isComposing || e.keyCode === 229) return;

                if (e.key === 'Enter') {
                    const command = cmdInput.value.trim();
                    cmdInput.remove();
                    
                    entity.style.boxShadow = '0 0 20px rgba(0, 255, 204, 0.3), inset 0 0 15px rgba(0, 255, 204, 0.5)';
                    ring.style.borderTopColor = '#00ffcc'; ring.style.borderBottomColor = '#00ffcc';
                    ring.style.animationDuration = '3s';
                    isCommandMode = false;
                    
                    if (command) executeKnowledgeWeaver(command);
                    else talk("ABORT");
                }
            };
        };

        const executeKnowledgeWeaver = async (query) => {
            if (query.includes('掃除') || query.includes('消して')) {
                app.blackHole.push(...app.currentUniverse.nodes);
                app.currentUniverse.nodes = []; app.currentUniverse.links = [];
                talk("PURGE COMPLETED");
                if(window.universeAudio) window.universeAudio.playDelete();
                app.autoSave();
                if(app.simulation) app.simulation.nodes([]).force("link").links([]);
                if(app.update) app.update();
                return;
            }

            talk(`FETCHING: ${query}...`, 0);
            if (window.universeAudio) window.universeAudio.playWarp();
            
            const keyword = query.replace(/(について教えて|とは|を調べて|を検索|教えて).*/, '').trim();

            try {
                const res = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keyword)}`);
                if (!res.ok) {
                    talk("ERR: NOT FOUND");
                    if (window.HapticEngine) window.HapticEngine.playError();
                    return;
                }

                const data = await res.json();
                const cx = app.camera ? -app.camera.x : 0;
                const cy = app.camera ? -app.camera.y : 0;

                app.currentUniverse.addNode(data.title, cx, cy, 50, '#ff00ff', 'star');
                const centerNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                if (data.thumbnail && data.thumbnail.source) centerNode.iconUrl = data.thumbnail.source;
                centerNode.note = `【${data.title}】\n${data.extract}`;
                
                const sentences = data.extract.split('。').filter(s => s.length > 10).slice(0, 4);
                
                sentences.forEach((text, i) => {
                    const angle = (i / sentences.length) * Math.PI * 2;
                    const dist = 160;
                    const nx = cx + Math.cos(angle) * dist;
                    const ny = cy + Math.sin(angle) * dist;
                    
                    app.currentUniverse.addNode(`DATA_FRAG_${i}`, nx, ny, 15, '#00ffcc', 'star');
                    const childNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                    childNode.note = text + "。";
                    app.currentUniverse.links.push({ source: centerNode, target: childNode });
                });

                talk(`GRAPH BUILT: ${data.title}`);
                if (window.universeAudio) window.universeAudio.playSystemSound(600, 'square', 0.2);
                
                app.autoSave();
                if(app.simulation) {
                    app.simulation.nodes(app.currentUniverse.nodes);
                    app.simulation.force("link").links(app.currentUniverse.links);
                    app.simulation.alpha(1).restart();
                }

            } catch (error) {
                talk("ERR: NETWORK FAILED");
            }
        };

        // ★★★ 無限ループ描画（ドラッグ中は自動移動をストップ） ★★★
        const move = () => {
            if (!document.getElementById(id)) return;
            
            if (!isCommandMode && !isDragging) {
                x += vx; y += vy;
                
                // 空気抵抗（勢いよく投げた後、だんだん減速する）
                vx *= 0.99;
                vy *= 0.99;

                // スピードが落ちすぎたら、最低限のフワフワ移動を維持する
                if (Math.abs(vx) < 0.5 && Math.random() < 0.05) vx += (Math.random() - 0.5) * 0.5;
                if (Math.abs(vy) < 0.5 && Math.random() < 0.05) vy += (Math.random() - 0.5) * 0.5;

                const size = 50;
                if (x <= 0 || x >= window.innerWidth - size) { 
                    vx *= -0.8; // 壁にぶつかると少し勢いが落ちて跳ね返る
                    x = Math.max(0, Math.min(x, window.innerWidth - size)); 
                }
                if (y <= 0 || y >= window.innerHeight - size) { 
                    vy *= -0.8; 
                    y = Math.max(0, Math.min(y, window.innerHeight - size)); 
                }
            }
            
            // 実際のDOM要素の座標を更新
            entity.style.left = `${x}px`; 
            entity.style.top = `${y}px`;
            
            requestAnimationFrame(move);
        };
        requestAnimationFrame(move);
    }
}