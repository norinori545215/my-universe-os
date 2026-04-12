// src/api/NexusP2P.js

export class NexusP2P {
    static peer = null;
    static connection = null;
    static app = null;
    static wormholeNode = null;
    static expectedPassword = ''; // 追加: パスワード保持用
    static chatLogEl = null;      // 追加: チャットログ要素保持用

    static async start(appRef) {
        if (document.getElementById('nexus-p2p-hud')) return;
        this.app = appRef;

        console.log("🌐 [Nexus P2P] 量子トンネル開通シークエンス開始...");

        // 1. P2P通信ライブラリ（PeerJS）を裏側で自動ロード
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
        // --- 通信制御HUD（コントロールパネル） ---
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
                <div style="font-size:10px; color:#ff88ff; margin-bottom:3px;">UNIVERSE ID (ルーム名)</div>
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

        document.getElementById('p2p-close').onclick = () => {
            hud.style.display = 'none';
        };

        // --- 受信検疫UI（最初は隠しておく）元のまま保持 ---
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

    // ★ 追加：ホスト（部屋を作る側）の処理
    static initHost(roomId, password) {
        this.expectedPassword = password;
        const statusElement = document.getElementById('p2p-status');
        statusElement.innerText = 'STATUS: INITIALIZING...';

        this.peer = new Peer('nexus-' + roomId);

        this.peer.on('open', (id) => {
            statusElement.innerText = 'STATUS: WAITING FOR DIVER...';
            statusElement.style.color = '#00ffcc';
            if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.2);
        });

        this.peer.on('connection', (conn) => {
            conn.on('open', () => {
                // ゲストからのパスワード認証を待つ
                conn.on('data', (data) => {
                    if (data.type === 'AUTH') {
                        if (data.password === this.expectedPassword) {
                            conn.send({ type: 'AUTH_SUCCESS' });
                            this.setupConnection(conn, roomId);
                        } else {
                            conn.send({ type: 'AUTH_FAIL' });
                            setTimeout(() => conn.close(), 500);
                        }
                    } else {
                        this.handleIncomingData(data);
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

    // ★ 追加：ジョイン（部屋に入る側）の処理
    static initJoin(roomId, password) {
        const statusElement = document.getElementById('p2p-status');
        statusElement.innerText = 'STATUS: CONNECTING...';

        this.peer = new Peer(); // ゲストのIDはランダム自動生成

        this.peer.on('open', () => {
            const conn = this.peer.connect('nexus-' + roomId);
            
            conn.on('open', () => {
                // 接続できたらパスワードを送信して認証
                conn.send({ type: 'AUTH', password: password });
            });

            conn.on('data', (data) => {
                if (data.type === 'AUTH_SUCCESS') {
                    if(window.universeAudio) window.universeAudio.playWarp();
                    this.setupConnection(conn, roomId);
                } else if (data.type === 'AUTH_FAIL') {
                    statusElement.innerText = 'STATUS: AUTH FAILED';
                    statusElement.style.color = '#ff4444';
                    alert("❌ パスワードが違います！通信を切断されました。");
                    conn.close();
                } else {
                    this.handleIncomingData(data);
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

    static setupConnection(conn, roomId) {
        this.connection = conn;
        const statusElement = document.getElementById('p2p-status');

        statusElement.innerText = 'STATUS: LINK SECURED 🔒';
        statusElement.style.color = '#ff00ff';
        
        // 接続成功したらチャット画面とワームホールを出す
        this.showChatUI(roomId);
        this.appendChat('SYSTEM', `🌌 量子通信ネットワーク [ ${roomId} ] に接続しました。`, '#00ffcc');
        this.spawnWormhole();

        // AUTH以外のデータ（星やチャット）の受信処理
        conn.on('data', (data) => {
            if (data.type !== 'AUTH' && data.type !== 'AUTH_SUCCESS' && data.type !== 'AUTH_FAIL') {
                this.handleIncomingData(data);
            }
        });

        conn.on('close', () => {
            statusElement.innerText = 'STATUS: LINK LOST';
            statusElement.style.color = '#ff4444';
            this.appendChat('SYSTEM', '⚠️ 相手との通信が切断されました。', '#ff4444');
            
            if (this.wormholeNode) {
                this.app.currentUniverse.removeNode(this.wormholeNode);
                this.wormholeNode = null;
                if (this.app.simulation) this.app.simulation.alpha(0.5).restart();
            }
            this.connection = null;
        });
    }

    // 元のロマン機能：ワームホール（特異点）の生成をそのまま保持！
    static spawnWormhole() {
        if (!this.app || !this.app.currentUniverse) return;

        const cx = this.app.camera ? -this.app.camera.x : 0;
        const cy = this.app.camera ? -this.app.camera.y : 0;

        this.app.currentUniverse.addNode('🌐 P2P WORMHOLE', cx + 150, cy - 100, 50, '#ff00ff', 'galaxy');
        this.wormholeNode = this.app.currentUniverse.nodes[this.app.currentUniverse.nodes.length - 1];
        
        this.wormholeNode.isWormhole = true;
        this.wormholeNode.isLocked = true; 
        
        if (this.app.simulation) this.app.simulation.alpha(0.5).restart();

        const checkCollision = () => {
            if (!this.connection || !this.wormholeNode) return;

            this.app.currentUniverse.nodes.forEach(node => {
                if (node.isWormhole) return;

                if (node.fx !== null && node.fy !== null) {
                    const MathAbs = Math.abs;
                    const dx = node.x - this.wormholeNode.x;
                    const dy = node.y - this.wormholeNode.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist < 40) {
                        this.sendNode(node);
                        
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
            requestAnimationFrame(checkCollision);
        };
        requestAnimationFrame(checkCollision);
    }

    // 元の星データ暗号化トンネル処理をそのまま保持！
    static sendNode(node) {
        if (!this.connection) return;

        const payload = {
            type: 'NODE_TRANSFER',
            data: {
                name: node.name,
                note: node.note || '',
                color: node.color,
                shape: node.shape,
                size: node.size,
                url: node.url || '',
                iconUrl: node.iconUrl || ''
            }
        };

        this.connection.send(payload);
        
        document.body.style.filter = 'hue-rotate(90deg)';
        setTimeout(() => document.body.style.filter = 'none', 100);
        if (window.universeAudio) window.universeAudio.playSystemSound(200, 'square', 0.3);
        console.log("🚀 [Nexus P2P] データをワームホールへ投擲しました");
    }

    // ★ 追加：チャットUIの生成
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
            if (!msg || !this.connection || !this.connection.open) return;
            
            this.connection.send({ type: 'CHAT', message: msg });
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

    // 元の受信検疫UIをそのまま保持！
    static handleIncomingData(payload) {
        if (payload.type === 'CHAT') {
            this.appendChat('PEER', payload.message, '#ff00ff');
            if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.1);
        }
        else if (payload.type === 'NODE_TRANSFER') {
            const data = payload.data;
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
                newNode.note = data.note;
                newNode.url = data.url;
                newNode.iconUrl = data.iconUrl;
                
                if (this.app.simulation) this.app.simulation.alpha(1).restart();
                if (this.app.autoSave) this.app.autoSave();
                if (window.universeAudio) window.universeAudio.playSpawn();
                this.appendChat('SYSTEM', `📦 密輸された星「${data.name}」を宇宙に展開しました。`, '#ffaa00');
            };

            document.getElementById('q-purge').onclick = () => {
                quarantine.style.display = 'none';
                if (window.universeAudio) window.universeAudio.playDelete();
                this.appendChat('SYSTEM', `🔥 送られてきた星「${data.name}」を焼却破棄しました。`, '#ff4444');
            };
        }
    }
}