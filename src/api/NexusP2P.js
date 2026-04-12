// src/api/NexusP2P.js

export class NexusP2P {
    static peer = null;
    static hostConnection = null;
    static connections = [];
    static app = null;
    static wormholeNode = null;
    static expectedPassword = '';
    static chatLogEl = null;
    static isHost = false;
    static syncTimer = null;

    static async start(appRef) {
        if (document.getElementById('nexus-p2p-hud')) return;
        this.app = appRef;

        console.log("🌐 [Nexus P2P] 量子トンネル開通シークエンス開始...");

        if (!window.Peer) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/peerjs@1.5.2/dist/peerjs.min.js";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        this.showPortalUI();
    }

    // ★ IDの文字化けやスペースを安全な文字列に自動変換する（迷子防止）
    static cleanRoomId(id) {
        return id.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    }

    static showPortalUI(defaultId = '', defaultPw = '') {
        const portalId = 'p2p-portal-ui';
        if (document.getElementById(portalId)) document.getElementById(portalId).remove();

        const ui = document.createElement('div');
        ui.id = portalId;
        ui.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 320px; background: rgba(10, 0, 20, 0.95); border: 1px solid #ff00ff;
            border-radius: 12px; z-index: 9999; padding: 20px; color: #fff;
            box-shadow: 0 0 30px rgba(255, 0, 255, 0.4); backdrop-filter: blur(10px);
            font-family: monospace; display: flex; flex-direction: column; gap: 15px;
        `;

        ui.innerHTML = `
            <div style="text-align:center; color:#ff00ff; font-weight:bold; font-size:16px; border-bottom:1px dashed #ff00ff; padding-bottom:10px;">
                🌐 QUANTUM NETWORK
            </div>
            <div>
                <div style="font-size:11px; color:#ff88ff; margin-bottom:5px;">UNIVERSE ID (共有ルーム名)</div>
                <input type="text" id="p2p-room-id" value="${defaultId}" placeholder="例: secret-base" style="width:100%; background:rgba(0,0,0,0.5); border:1px solid #ff00ff; color:#fff; padding:8px; border-radius:4px; box-sizing:border-box; outline:none;">
            </div>
            <div>
                <div style="font-size:11px; color:#ff88ff; margin-bottom:5px;">PASSWORD (暗号鍵)</div>
                <input type="password" id="p2p-password" value="${defaultPw}" placeholder="***" style="width:100%; background:rgba(0,0,0,0.5); border:1px solid #ff00ff; color:#fff; padding:8px; border-radius:4px; box-sizing:border-box; outline:none;">
            </div>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button id="p2p-host-btn" style="flex:1; padding:8px; background:#440044; color:#ff00ff; border:1px solid #ff00ff; border-radius:4px; cursor:pointer; font-weight:bold; font-size:10px;">🌌 空間を創る<br>(Host)</button>
                <button id="p2p-join-btn" style="flex:1; padding:8px; background:#003333; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer; font-weight:bold; font-size:10px;">🛸 空間へ潜る<br>(Join)</button>
            </div>
            <div id="p2p-status" style="margin-top:5px; font-size:11px; color:#ffaa00; text-align:center; font-weight:bold;"></div>
            <button id="p2p-cancel-btn" style="width:100%; padding:8px; background:transparent; color:#888; border:none; cursor:pointer; margin-top:5px;">キャンセル</button>
        `;

        document.body.appendChild(ui);

        document.getElementById('p2p-cancel-btn').onclick = () => ui.remove();

        document.getElementById('p2p-host-btn').onclick = () => {
            const id = document.getElementById('p2p-room-id').value.trim();
            const pw = document.getElementById('p2p-password').value.trim();
            if(!id || !pw) return alert("IDとPASSWORDを入力してください。");
            document.getElementById('p2p-host-btn').style.display = 'none';
            document.getElementById('p2p-join-btn').style.display = 'none';
            this.initHost(id, pw);
        };

        document.getElementById('p2p-join-btn').onclick = () => {
            const id = document.getElementById('p2p-room-id').value.trim();
            const pw = document.getElementById('p2p-password').value.trim();
            if(!id || !pw) return alert("IDとPASSWORDを入力してください。");
            document.getElementById('p2p-host-btn').style.display = 'none';
            document.getElementById('p2p-join-btn').style.display = 'none';
            this.initJoin(id, pw);
        };

        // --- 受信検疫UI ---
        if (!document.getElementById('p2p-quarantine')) {
            const quarantine = document.createElement('div');
            quarantine.id = 'p2p-quarantine';
            quarantine.style.cssText = `
                position: fixed; top: 50%; right: 20px; transform: translateY(-50%); width: 200px;
                background: rgba(40, 0, 0, 0.95); border: 1px solid #ff4444; border-radius: 8px;
                box-shadow: 0 0 30px rgba(255, 68, 68, 0.5); z-index: 95000; padding: 15px; color: #fff;
                display: none; flex-direction: column; gap: 10px; backdrop-filter: blur(5px);
            `;
            document.body.appendChild(quarantine);
        }
    }

    // ★ HOST側の初期化（ファイアウォール突破設定を追加）
    static initHost(roomId, password) {
        this.isHost = true;
        this.expectedPassword = password;
        const statusElement = document.getElementById('p2p-status');
        statusElement.innerText = 'STATUS: INITIALIZING...';

        if (this.peer) this.peer.destroy();
        
        const cleanId = this.cleanRoomId(roomId);
        const myPeerId = 'cyberos-nexus-' + cleanId;

        // GoogleのSTUNサーバーを利用して通信の確実性を上げる
        this.peer = new Peer(myPeerId, {
            config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        this.peer.on('open', (id) => {
            statusElement.innerText = 'STATUS: WAITING FOR DIVER...';
            statusElement.style.color = '#00ffcc';
            if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.2);
            this.enterSharedUniverse(roomId);
        });

        this.peer.on('connection', (conn) => {
            // 接続された瞬間にデータ待受を開始（タイミングバグ修正）
            conn.on('data', (data) => {
                if (data.type === 'AUTH') {
                    if (data.password === this.expectedPassword) {
                        conn.send({ type: 'AUTH_SUCCESS' });
                        if (!this.connections.includes(conn)) this.connections.push(conn);
                        this.setupConnection(conn, roomId);
                    } else {
                        conn.send({ type: 'AUTH_FAIL' });
                        setTimeout(() => conn.close(), 500);
                    }
                } else {
                    this.handleIncomingData(data, conn);
                }
            });
        });

        this.peer.on('error', (err) => {
            console.error(err);
            statusElement.innerText = 'STATUS: ID CONFLICT / ERROR';
            statusElement.style.color = '#ff4444';
            if (err.type === 'unavailable-id') {
                alert(`🚨 エラー: ルーム名「${roomId}」は現在他の誰かが使用中です。別の名前に変更してください。`);
            } else {
                alert("🚨 エラー: ネットワークに問題があります。\n" + err.message);
            }
        });
    }

    // ★ JOIN側の初期化（ファイアウォール突破設定を追加）
    static initJoin(roomId, password) {
        this.isHost = false;
        const statusElement = document.getElementById('p2p-status');
        statusElement.innerText = 'STATUS: CONNECTING...';

        if (this.peer) this.peer.destroy();
        this.peer = new Peer({
            config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
        }); 

        this.peer.on('open', () => {
            const cleanId = this.cleanRoomId(roomId);
            const targetPeerId = 'cyberos-nexus-' + cleanId;
            
            // 信頼性オプションをつけて接続
            const conn = this.peer.connect(targetPeerId, { reliable: true });
            
            conn.on('open', () => {
                conn.send({ type: 'AUTH', password: password });
            });

            conn.on('data', (data) => {
                if (data.type === 'AUTH_SUCCESS') {
                    if(window.universeAudio) window.universeAudio.playWarp();
                    this.hostConnection = conn;
                    this.enterSharedUniverse(roomId);
                    this.setupConnection(conn, roomId);
                } else if (data.type === 'AUTH_FAIL') {
                    statusElement.innerText = 'STATUS: AUTH FAILED';
                    statusElement.style.color = '#ff4444';
                    alert("❌ パスワードが違います！通信を切断されました。");
                    conn.close();
                } else {
                    this.handleIncomingData(data, conn);
                }
            });
        });

        this.peer.on('error', (err) => {
            console.error(err);
            statusElement.innerText = 'STATUS: ROOM NOT FOUND';
            statusElement.style.color = '#ff4444';
            if (err.type === 'peer-unavailable') {
                alert(`🚨 エラー: ルーム「${roomId}」が見つかりません。\nHost側が「空間を創る」を押して待機しているか確認してください。`);
            } else {
                alert("🚨 接続エラーが発生しました: " + err.message);
            }
        });
    }

    static enterSharedUniverse(roomId) {
        const sharedUni = new this.app.currentUniverse.constructor(`🌌 SHARED: ${roomId}`, 'space');
        sharedUni.isShared = true; 
        
        this.app.universeHistory.push(this.app.currentUniverse);
        this.app.currentUniverse = sharedUni;
        this.app.camera.reset();
        if (this.app.ui) this.app.ui.updateBreadcrumbs();
        
        this.startSyncLoop(); 
    }

    static setupConnection(conn, roomId) {
        const portal = document.getElementById('p2p-portal-ui');
        if (portal) portal.remove();

        const statusElement = document.getElementById('p2p-status');
        if (statusElement) {
            statusElement.innerText = 'STATUS: LINK SECURED 🔒';
            statusElement.style.color = '#ff00ff';
        }
        
        this.showChatUI(roomId);
        this.appendChat('SYSTEM', `🌌 量子通信ネットワーク [ ${roomId} ] に接続しました。`, '#00ffcc');
        this.spawnWormhole(roomId, this.expectedPassword);

        conn.on('data', (data) => {
            if (data.type !== 'AUTH' && data.type !== 'AUTH_SUCCESS' && data.type !== 'AUTH_FAIL') {
                this.handleIncomingData(data, conn);
            }
        });

        conn.on('close', () => {
            this.appendChat('SYSTEM', '⚠️ 相手との通信が切断されました。', '#ff4444');
            if (this.isHost) {
                this.connections = this.connections.filter(c => c !== conn);
            } else {
                this.hostConnection = null;
            }
        });
    }

    static spawnWormhole(roomId, password) {
        if (!this.app || !this.app.currentUniverse) return;
        const cx = this.app.camera ? -this.app.camera.x : 0;
        const cy = this.app.camera ? -this.app.camera.y : 0;

        let existing = this.app.currentUniverse.nodes.find(n => n.isWormhole && n.p2pRoomId === roomId);
        
        if (existing) {
            this.wormholeNode = existing;
        } else {
            this.app.currentUniverse.addNode('🌐 P2P WORMHOLE', cx, cy, 50, '#ff00ff', 'galaxy');
            this.wormholeNode = this.app.currentUniverse.nodes[this.app.currentUniverse.nodes.length - 1];
            this.wormholeNode.isWormhole = true;
            this.wormholeNode.p2pRoomId = roomId;
            this.wormholeNode.p2pPassword = password;
            
            // ワームホールの内側を「共有空間」として設定
            this.wormholeNode.innerUniverse.isShared = true;
            this.wormholeNode.innerUniverse.name = `🌌 SHARED: ${roomId}`;
            
            this.app.autoSave();
        }

        if (this.app.simulation) this.app.simulation.alpha(0.5).restart();

        const checkCollision = () => {
            const isConnected = (this.isHost && this.connections.length > 0) || (!this.isHost && this.hostConnection && this.hostConnection.open);
            if (!isConnected || !this.wormholeNode) return;

            if (this.app.currentUniverse !== this.wormholeNode.innerUniverse) {
                this.app.currentUniverse.nodes.forEach(node => {
                    if (node.isWormhole) return;
                    if (node.fx !== null && node.fy !== null) {
                        const dx = node.x - this.wormholeNode.x;
                        const dy = node.y - this.wormholeNode.y;
                        if (Math.sqrt(dx*dx + dy*dy) < 40) {
                            this.sendSmuggleNode(node); 
                            
                            node.fx = null; node.fy = null;
                            this.app.currentUniverse.nodes = this.app.currentUniverse.nodes.filter(n => n.id !== node.id);
                            this.app.currentUniverse.links = this.app.currentUniverse.links.filter(l => l.source.id !== node.id && l.target.id !== node.id);
                            if (this.app.simulation) {
                                this.app.simulation.nodes(this.app.currentUniverse.nodes);
                                this.app.simulation.force("link").links(this.app.currentUniverse.links);
                                this.app.simulation.alpha(1).restart();
                            }
                        }
                    }
                });
            }
            requestAnimationFrame(checkCollision);
        };
        requestAnimationFrame(checkCollision);
    }

    static openWormholeMenu(node, uiManager) {
        const portalId = 'p2p-wormhole-menu';
        if (document.getElementById(portalId)) document.getElementById(portalId).remove();

        const ui = document.createElement('div');
        ui.id = portalId;
        ui.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 260px; background: rgba(10, 0, 20, 0.95); border: 1px solid #ff00ff;
            border-radius: 8px; z-index: 99999; padding: 15px; color: #fff;
            box-shadow: 0 0 20px rgba(255, 0, 255, 0.4); backdrop-filter: blur(10px);
            font-family: monospace; display: flex; flex-direction: column; gap: 10px;
        `;

        const isOnline = (this.isHost && this.connections.length > 0) || (!this.isHost && this.hostConnection && this.hostConnection.open);

        ui.innerHTML = `
            <div style="color:#ff00ff; font-weight:bold; border-bottom:1px dashed #ff00ff; padding-bottom:5px; text-align:center;">
                🌀 WORMHOLE MENU
            </div>
            <div style="font-size:11px; color:#aaa; margin-bottom:5px; text-align:center;">
                ID: <span style="color:#00ffcc;">${node.p2pRoomId || '不明'}</span>
            </div>
            
            ${isOnline ? `
                <button id="wh-dive" style="width:100%; padding:12px; background:#004444; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer; font-weight:bold; font-size:12px;">➡ 共有空間へ潜る (Dive)</button>
                <button id="wh-disconnect" style="width:100%; padding:8px; background:#444400; color:#ffaa00; border:1px dashed #ffaa00; border-radius:4px; cursor:pointer;">🔌 通信を切断する</button>
            ` : `
                <div style="font-size:10px; color:#ffaa00; text-align:center; margin-bottom:5px;">⚠️ 現在オフラインです</div>
                <button id="wh-host" style="width:100%; padding:8px; background:#440044; color:#ff00ff; border:1px solid #ff00ff; border-radius:4px; cursor:pointer;">🌌 Hostとして再接続</button>
                <button id="wh-join" style="width:100%; padding:8px; background:#003333; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer;">🛸 Joinとして再接続</button>
            `}
            
            <button id="wh-delete" style="width:100%; padding:8px; background:#440000; color:#ff4444; border:1px solid #ff4444; border-radius:4px; cursor:pointer; margin-top:5px;">🗑️ ワームホールを完全に破壊</button>
            <button id="wh-close" style="width:100%; margin-top:5px; background:transparent; border:none; color:#888; cursor:pointer;">閉じる</button>
        `;
        document.body.appendChild(ui);

        if (isOnline) {
            document.getElementById('wh-dive').onclick = () => {
                ui.remove();
                uiManager.app.isZoomingIn = true;
                uiManager.app.targetUniverse = node.innerUniverse;
                uiManager.app.diveTargetNode = node;
                uiManager.app.camera.zoomTo(node.x, node.y);
                if(window.universeAudio) window.universeAudio.playWarp();
            };
            document.getElementById('wh-disconnect').onclick = () => {
                ui.remove();
                if (this.peer) this.peer.destroy();
                this.isHost = false; this.connections = []; this.hostConnection = null;
                alert("通信を切断しました。");
            };
        } else {
            document.getElementById('wh-host').onclick = () => {
                ui.remove();
                this.showPortalUI(node.p2pRoomId, node.p2pPassword);
            };
            document.getElementById('wh-join').onclick = () => {
                ui.remove();
                this.showPortalUI(node.p2pRoomId, node.p2pPassword);
            };
        }

        document.getElementById('wh-delete').onclick = () => {
            if (confirm("このワームホールを破壊して完全に消去しますか？\n(中の共有データへのアクセスも失われます)")) {
                ui.remove();
                const idx = uiManager.app.currentUniverse.nodes.indexOf(node);
                if (idx > -1) uiManager.app.currentUniverse.nodes.splice(idx, 1);
                uiManager.app.currentUniverse.links = uiManager.app.currentUniverse.links.filter(l => l.source !== node && l.target !== node);
                uiManager.app.autoSave();
                if (this.wormholeNode === node) this.wormholeNode = null;
                if(window.universeAudio) window.universeAudio.playDelete();
            }
        };
        document.getElementById('wh-close').onclick = () => ui.remove();
    }

    static startSyncLoop() {
        if (this.syncTimer) clearInterval(this.syncTimer);
        this.syncTimer = setInterval(() => {
            const isConnected = (this.isHost && this.connections.length > 0) || (!this.isHost && this.hostConnection && this.hostConnection.open);
            if (!isConnected) return;

            let shared = this.app.currentUniverse.isShared ? this.app.currentUniverse : this.app.universeHistory.find(u => u.isShared);
            if (!shared) return;

            if (this.isHost) {
                shared.nodes.forEach(n => { if(!n.id) n.id = 'node_' + Math.random().toString(36).substr(2); });
                const state = {
                    nodes: shared.nodes.map(n => ({
                        id: n.id, name: n.name, x: n.x, y: n.y, baseX: n.baseX, baseY: n.baseY,
                        size: n.size, color: n.color, shape: n.shape, note: n.note, url: n.url, iconUrl: n.iconUrl
                    })),
                    links: shared.links.map(l => ({ sourceId: l.source.id, targetId: l.target.id }))
                };
                this.broadcast({ type: 'SYNC_STATE', state });
            } else {
                if (this.app.canvasBuilder && this.app.canvasBuilder.grabbedNode) {
                    const n = this.app.canvasBuilder.grabbedNode;
                    if (n.id && shared.nodes.includes(n)) {
                        this.broadcast({ type: 'SYNC_ACTION', action: 'UPDATE_NODE', node: { id: n.id, x: n.x, y: n.y, baseX: n.baseX, baseY: n.baseY }});
                    }
                }
            }
        }, 100);
    }

    static broadcast(payload) {
        if (this.isHost) {
            this.connections.forEach(c => { if (c.open) c.send(payload); });
        } else if (this.hostConnection && this.hostConnection.open) {
            this.hostConnection.send(payload);
        }
    }

    static onNodeAdded(node) {
        if (!node.id) node.id = 'node_' + Math.random().toString(36).substr(2);
        if (this.app && this.app.currentUniverse.isShared && !this.isHost) {
            this.broadcast({ type: 'SYNC_ACTION', action: 'ADD_NODE', node: this.serializeNode(node) });
        }
    }
    static onNodeUpdated(node) {
        if (this.app && this.app.currentUniverse.isShared && !this.isHost) {
            this.broadcast({ type: 'SYNC_ACTION', action: 'UPDATE_NODE', node: this.serializeNode(node) });
        }
    }
    static onNodeDeleted(node) {
        if (this.app && this.app.currentUniverse.isShared && !this.isHost) {
            this.broadcast({ type: 'SYNC_ACTION', action: 'DELETE_NODE', id: node.id });
        }
    }
    static serializeNode(n) {
        return { id: n.id, name: n.name, x: n.x, y: n.y, baseX: n.baseX, baseY: n.baseY, size: n.size, color: n.color, shape: n.shape, note: n.note, url: n.url, iconUrl: n.iconUrl };
    }

    static handleIncomingData(data, senderConn) {
        if (data.type === 'CHAT') {
            this.appendChat('PEER', data.message, '#ff00ff');
            if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.1);
            if (this.isHost) this.connections.forEach(c => { if (c !== senderConn && c.open) c.send(data); });
        }
        else if (data.type === 'SMUGGLE_NODE') {
            this.triggerQuarantine(data.data);
            if (this.isHost) this.connections.forEach(c => { if (c !== senderConn && c.open) c.send(data); });
        }
        else if (data.type === 'SYNC_STATE' && !this.isHost) {
            let shared = this.app.currentUniverse.isShared ? this.app.currentUniverse : this.app.universeHistory.find(u => u.isShared);
            if (!shared) return;

            data.state.nodes.forEach(rn => {
                let ln = shared.nodes.find(n => n.id === rn.id);
                if (!ln) {
                    ln = { ...rn, isGhost: false };
                    shared.nodes.push(ln);
                } else {
                    const isGrabbed = this.app.canvasBuilder && this.app.canvasBuilder.grabbedNode === ln;
                    if (!isGrabbed) Object.assign(ln, rn); 
                }
            });
            shared.nodes = shared.nodes.filter(ln => data.state.nodes.some(rn => rn.id === ln.id));
            
            shared.links = [];
            data.state.links.forEach(rl => {
                const s = shared.nodes.find(n => n.id === rl.sourceId);
                const t = shared.nodes.find(n => n.id === rl.targetId);
                if (s && t) shared.links.push({ source: s, target: t });
            });
            if (this.app.simulation) this.app.simulation.alpha(0.1).restart();
        }
        else if (data.type === 'SYNC_ACTION' && this.isHost) {
            let shared = this.app.currentUniverse.isShared ? this.app.currentUniverse : this.app.universeHistory.find(u => u.isShared);
            if (!shared) return;

            if (data.action === 'ADD_NODE') {
                if (!shared.nodes.find(n => n.id === data.node.id)) shared.nodes.push({ ...data.node, isGhost: false });
            } else if (data.action === 'UPDATE_NODE') {
                let ln = shared.nodes.find(n => n.id === data.node.id);
                if (ln) Object.assign(ln, data.node);
            } else if (data.action === 'DELETE_NODE') {
                shared.nodes = shared.nodes.filter(n => n.id !== data.id);
                shared.links = shared.links.filter(l => l.source.id !== data.id && l.target.id !== data.id);
            }
            if (this.app.simulation) this.app.simulation.alpha(0.1).restart();
        }
    }

    static sendSmuggleNode(node) {
        const payload = {
            type: 'SMUGGLE_NODE',
            data: { name: node.name, note: node.note || '', color: node.color, shape: node.shape, size: node.size, url: node.url || '', iconUrl: node.iconUrl || '' }
        };
        this.broadcast(payload);
        document.body.style.filter = 'hue-rotate(90deg)';
        setTimeout(() => document.body.style.filter = 'none', 100);
        if (window.universeAudio) window.universeAudio.playSystemSound(200, 'square', 0.3);
        this.appendChat('SYSTEM', `🚀 星「${node.name}」を相手へ密輸しました。`, '#ffaa00');
    }

    static triggerQuarantine(data) {
        const quarantine = document.getElementById('p2p-quarantine');
        if (window.universeAudio) window.universeAudio.playSystemSound(800, 'sawtooth', 0.2);
        quarantine.style.boxShadow = '0 0 50px #ff0000';
        setTimeout(() => quarantine.style.boxShadow = '0 0 30px rgba(255, 68, 68, 0.5)', 300);

        quarantine.innerHTML = `
            <div style="font-size:11px; font-weight:bold; color:#ff4444; border-bottom:1px solid #ff4444; padding-bottom:5px;">
                ⚠️ UNKNOWN SIGNAL DETECTED
            </div>
            <div style="font-size:12px; color:#aaa;">
                Target: <span style="color:${data.color}; font-weight:bold;">${data.name}</span><br>
                Size: ${Math.floor(data.size)}MB
            </div>
            <div style="display:flex; gap:5px; margin-top:5px;">
                <button id="q-accept" style="flex:1; padding:8px; background:#004400; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">許可</button>
                <button id="q-purge" style="flex:1; padding:8px; background:#440000; color:#ff4444; border:1px solid #ff4444; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">焼却</button>
            </div>
        `;
        quarantine.style.display = 'flex';

        document.getElementById('q-accept').onclick = () => {
            quarantine.style.display = 'none';
            const cx = this.app.camera ? -this.app.camera.x : 0;
            const cy = this.app.camera ? -this.app.camera.y : 0;
            
            this.app.currentUniverse.addNode(data.name, cx, cy, data.size, data.color, data.shape || 'star');
            const newNode = this.app.currentUniverse.nodes[this.app.currentUniverse.nodes.length - 1];
            newNode.note = data.note; newNode.url = data.url; newNode.iconUrl = data.iconUrl;
            
            if (this.app.simulation) this.app.simulation.alpha(1).restart();
            if (this.app.autoSave) this.app.autoSave();
            if (window.universeAudio) window.universeAudio.playSpawn();
            
            this.onNodeAdded(newNode);
            this.appendChat('SYSTEM', `📦 密輸された星「${data.name}」を展開しました。`, '#ffaa00');
        };

        document.getElementById('q-purge').onclick = () => {
            quarantine.style.display = 'none';
            if (window.universeAudio) window.universeAudio.playDelete();
            this.appendChat('SYSTEM', `🔥 送られてきた星「${data.name}」を焼却破棄しました。`, '#ff4444');
        };
    }

    static showChatUI(roomId) {
        if (document.getElementById('p2p-chat-ui')) return;

        const ui = document.createElement('div');
        ui.id = 'p2p-chat-ui';
        ui.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; width: 300px; height: 350px;
            background: rgba(0, 10, 20, 0.85); border: 1px solid #00ffcc; border-radius: 8px;
            display: flex; flex-direction: column; z-index: 9900;
            box-shadow: 0 0 20px rgba(0, 255, 204, 0.2); backdrop-filter: blur(10px);
            font-family: sans-serif;
        `;

        ui.innerHTML = `
            <div style="background: rgba(0, 255, 204, 0.2); padding: 10px; font-weight: bold; color: #00ffcc; border-bottom: 1px solid #00ffcc; border-radius: 8px 8px 0 0; display:flex; justify-content:space-between;">
                <span>🛰️ MULTIVERSE CHAT</span>
                <span style="font-size:10px; color:#aaa; cursor:pointer;" onclick="document.getElementById('p2p-chat-ui').remove()">❌</span>
            </div>
            <div id="p2p-chat-log" style="flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: #fff;"></div>
            <div style="padding: 10px; border-top: 1px dashed #00ffcc; display: flex; gap: 5px;">
                <input type="text" id="p2p-chat-input" placeholder="メッセージ..." style="flex: 1; background: transparent; border: 1px solid #00ffcc; color: #fff; padding: 5px; border-radius: 4px; outline: none;">
                <button id="p2p-chat-send" style="background: #00ffcc; color: #000; border: none; padding: 0 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">送信</button>
            </div>
        `;

        document.body.appendChild(ui);
        this.chatLogEl = document.getElementById('p2p-chat-log');

        const sendBtn = document.getElementById('p2p-chat-send');
        const inputEl = document.getElementById('p2p-chat-input');

        const sendMessage = () => {
            const msg = inputEl.value.trim();
            if (!msg) return;
            this.broadcast({ type: 'CHAT', message: msg });
            this.appendChat('YOU', msg, '#00ffcc');
            inputEl.value = '';
        };

        sendBtn.onclick = sendMessage;
        inputEl.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    }

    static appendChat(sender, message, color) {
        if (!this.chatLogEl) return;
        const align = sender === 'YOU' ? 'flex-end' : 'flex-start';
        const bg = sender === 'YOU' ? 'rgba(0,255,204,0.1)' : (sender === 'SYSTEM' ? 'rgba(255,170,0,0.1)' : 'rgba(255,0,255,0.1)');
        const border = sender === 'YOU' ? '#00ffcc' : (sender === 'SYSTEM' ? '#ffaa00' : '#ff00ff');

        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = `
            align-self: ${align}; background: ${bg}; border: 1px solid ${border};
            padding: 6px 10px; border-radius: 6px; max-width: 80%; word-break: break-all;
        `;
        msgDiv.innerHTML = `<div style="font-size:9px; color:${color}; margin-bottom:2px;">[${sender}]</div><div>${message}</div>`;
        this.chatLogEl.appendChild(msgDiv);
        this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;
    }
}