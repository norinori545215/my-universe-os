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

        this.createHUD();
    }

    static createHUD() {
        const hud = document.createElement('div');
        hud.id = 'nexus-p2p-hud';
        hud.style.cssText = `
            position: fixed; top: 80px; left: 20px; width: 220px; background: rgba(10, 0, 20, 0.95);
            border: 1px solid #ff00ff; border-radius: 8px; box-shadow: 0 0 20px rgba(255, 0, 255, 0.3);
            z-index: 90000; padding: 15px; color: #fff; font-family: monospace; transition: 0.3s;
            display: flex; flex-direction: column; gap: 10px;
        `;

        hud.innerHTML = `
            <div style="color:#ff00ff; font-weight:bold; font-size:12px; border-bottom:1px solid rgba(255,0,255,0.4); padding-bottom:5px; text-align:center;">
                🌐 QUANTUM NETWORK
            </div>
            <div>
                <div style="font-size:10px; color:#ff88ff; margin-bottom:3px;">UNIVERSE ID (共有ルーム名)</div>
                <input type="text" id="p2p-room-id" placeholder="例: secret-base" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); color:#fff; border:1px solid #ff00ff; border-radius:4px; padding:6px; outline:none; font-size:11px;">
            </div>
            <div>
                <div style="font-size:10px; color:#ff88ff; margin-bottom:3px;">PASSWORD (暗号鍵)</div>
                <input type="password" id="p2p-password" placeholder="***" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); color:#fff; border:1px solid #ff00ff; border-radius:4px; padding:6px; outline:none; font-size:11px;">
            </div>
            <div style="display:flex; gap:5px; margin-top:5px;">
                <button id="p2p-host-btn" style="flex:1; padding:8px; background:#440044; color:#ff00ff; border:1px solid #ff00ff; border-radius:4px; cursor:pointer; font-weight:bold; font-size:10px;">🌌 空間を創る<br>(Host)</button>
                <button id="p2p-join-btn" style="flex:1; padding:8px; background:#003333; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer; font-weight:bold; font-size:10px;">🛸 空間へ潜る<br>(Join)</button>
            </div>
            <div id="p2p-status" style="margin-top:5px; font-size:10px; color:#ffaa00; text-align:center;">STATUS: OFFLINE</div>
            <button id="p2p-close" style="width:100%; margin-top:5px; background:transparent; border:none; color:#888; cursor:pointer; font-size:10px;">[ CLOSE HUD ]</button>
        `;
        document.body.appendChild(hud);

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

        document.getElementById('p2p-close').onclick = () => hud.style.display = 'none';

        // 受信検疫UI (密輸用)
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

    static initHost(roomId, password) {
        this.isHost = true;
        this.expectedPassword = password;
        const statusElement = document.getElementById('p2p-status');
        statusElement.innerText = 'STATUS: INITIALIZING...';

        this.peer = new Peer('nexus-' + roomId);

        this.peer.on('open', (id) => {
            statusElement.innerText = 'STATUS: WAITING FOR DIVER...';
            statusElement.style.color = '#00ffcc';
            if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.2);
            
            // ホストとして共有宇宙を生成して入室
            this.enterSharedUniverse(roomId);
        });

        this.peer.on('connection', (conn) => {
            conn.on('open', () => {
                conn.on('data', (data) => {
                    if (data.type === 'AUTH') {
                        if (data.password === this.expectedPassword) {
                            conn.send({ type: 'AUTH_SUCCESS' });
                            this.connections.push(conn);
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
        });

        this.peer.on('error', (err) => {
            console.error(err);
            statusElement.innerText = 'STATUS: ID CONFLICT / ERROR';
            statusElement.style.color = '#ff4444';
            alert("🚨 エラー: すでに同名の宇宙が存在するか、ネットワークに問題があります。");
        });
    }

    static initJoin(roomId, password) {
        this.isHost = false;
        const statusElement = document.getElementById('p2p-status');
        statusElement.innerText = 'STATUS: CONNECTING...';

        this.peer = new Peer(); 

        this.peer.on('open', () => {
            const conn = this.peer.connect('nexus-' + roomId);
            
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
            alert("🚨 接続エラー: ルームが存在しません。");
        });
    }

    // ★ 共有宇宙（マルチプレイルーム）へダイブ
    static enterSharedUniverse(roomId) {
        const sharedUni = new this.app.currentUniverse.constructor(`🌌 SHARED: ${roomId}`, 'space');
        sharedUni.isShared = true; // 共有空間フラグ
        
        this.app.universeHistory.push(this.app.currentUniverse);
        this.app.currentUniverse = sharedUni;
        this.app.camera.reset();
        if (this.app.ui) this.app.ui.updateBreadcrumbs();
        
        this.startSyncLoop(); // 同期ループ開始
    }

    static setupConnection(conn, roomId) {
        const statusElement = document.getElementById('p2p-status');
        statusElement.innerText = 'STATUS: LINK SECURED 🔒';
        statusElement.style.color = '#ff00ff';
        
        this.showChatUI(roomId);
        this.appendChat('SYSTEM', `🌌 量子通信ネットワーク [ ${roomId} ] に接続しました。`, '#00ffcc');

        conn.on('data', (data) => {
            if (data.type !== 'AUTH' && data.type !== 'AUTH_SUCCESS' && data.type !== 'AUTH_FAIL') {
                this.handleIncomingData(data, conn);
            }
        });

        conn.on('close', () => {
            statusElement.innerText = 'STATUS: LINK LOST';
            statusElement.style.color = '#ff4444';
            this.appendChat('SYSTEM', '⚠️ 相手との通信が切断されました。', '#ff4444');
            if (this.isHost) {
                this.connections = this.connections.filter(c => c !== conn);
            } else {
                this.hostConnection = null;
            }
        });
    }

    // ★ 0.1秒ごとのリアルタイム同期ループ
    static startSyncLoop() {
        if (this.syncTimer) clearInterval(this.syncTimer);
        this.syncTimer = setInterval(() => {
            if (this.isHost && this.connections.length === 0) return;
            if (!this.isHost && (!this.hostConnection || !this.hostConnection.open)) return;

            let shared = this.app.currentUniverse.isShared ? this.app.currentUniverse : this.app.universeHistory.find(u => u.isShared);
            if (!shared) return;

            if (this.isHost) {
                // ホストは全データ（真実）をゲストに送信する
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
                // ゲストは「今自分が掴んで動かしている星」の座標だけをホストに送る
                if (this.app.canvasBuilder && this.app.canvasBuilder.grabbedNode) {
                    const n = this.app.canvasBuilder.grabbedNode;
                    if (n.id && shared.nodes.includes(n)) {
                        this.broadcast({ type: 'SYNC_ACTION', action: 'UPDATE_NODE', node: {
                            id: n.id, x: n.x, y: n.y, baseX: n.baseX, baseY: n.baseY
                        }});
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

    // --- ローカルアクション（作成・編集・削除）を相手に伝えるフック ---
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

    // ★ 相手からデータを受信した時の処理
    static handleIncomingData(data, senderConn) {
        if (data.type === 'CHAT') {
            this.appendChat('PEER', data.message, '#ff00ff');
            if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.1);
            if (this.isHost) this.connections.forEach(c => { if (c !== senderConn && c.open) c.send(data); });
        }
        else if (data.type === 'SMUGGLE_NODE') {
            // 密輸された星は赤い検疫画面を通す
            this.triggerQuarantine(data.data);
        }
        else if (data.type === 'SYNC_STATE' && !this.isHost) {
            // ゲスト：ホストから送られてきた宇宙の状態を完全にコピーする
            let shared = this.app.currentUniverse.isShared ? this.app.currentUniverse : this.app.universeHistory.find(u => u.isShared);
            if (!shared) return;

            data.state.nodes.forEach(rn => {
                let ln = shared.nodes.find(n => n.id === rn.id);
                if (!ln) {
                    ln = { ...rn, isGhost: false };
                    shared.nodes.push(ln);
                } else {
                    const isGrabbed = this.app.canvasBuilder && this.app.canvasBuilder.grabbedNode === ln;
                    if (!isGrabbed) Object.assign(ln, rn); // 自分が掴んでいない星だけ座標を上書き
                }
            });
            shared.nodes = shared.nodes.filter(ln => data.state.nodes.some(rn => rn.id === ln.id));
            
            shared.links = [];
            data.state.links.forEach(rl => {
                const s = shared.nodes.find(n => n.id === rl.sourceId);
                const t = shared.nodes.find(n => n.id === rl.targetId);
                if (s && t) shared.links.push({ source: s, target: t });
            });
        }
        else if (data.type === 'SYNC_ACTION' && this.isHost) {
            // ホスト：ゲストから「星を作った/消した/動かした」という報告を受けて宇宙を更新する
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
        }
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

    // ★ 星の「密輸（強制送りつけ）」処理
    static sendNode(node) {
        if (!this.isHost && (!this.hostConnection || !this.hostConnection.open)) return;

        const payload = {
            type: 'SMUGGLE_NODE',
            data: {
                name: node.name, note: node.note || '', color: node.color,
                shape: node.shape, size: node.size, url: node.url || '', iconUrl: node.iconUrl || ''
            }
        };

        this.broadcast(payload);
        document.body.style.filter = 'hue-rotate(90deg)';
        setTimeout(() => document.body.style.filter = 'none', 100);
        if (window.universeAudio) window.universeAudio.playSystemSound(200, 'square', 0.3);
        this.appendChat('SYSTEM', `🚀 星「${node.name}」を相手の宇宙へ密輸しました。`, '#ffaa00');
    }

    // 相手から密輸された星の「検疫UI」
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
                <button id="q-accept" style="flex:1; padding:8px; background:#004400; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">許可 (ACCEPT)</button>
                <button id="q-purge" style="flex:1; padding:8px; background:#440000; color:#ff4444; border:1px solid #ff4444; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">焼却 (PURGE)</button>
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
            
            // もし共有宇宙で密輸を受け取ったら、全員に同期させる
            this.onNodeAdded(newNode);
            this.appendChat('SYSTEM', `📦 密輸された星「${data.name}」を宇宙に展開しました。`, '#ffaa00');
        };

        document.getElementById('q-purge').onclick = () => {
            quarantine.style.display = 'none';
            if (window.universeAudio) window.universeAudio.playDelete();
            this.appendChat('SYSTEM', `🔥 送られてきた星「${data.name}」を焼却破棄しました。`, '#ff4444');
        };
    }
}