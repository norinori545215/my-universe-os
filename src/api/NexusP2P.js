// src/api/NexusP2P.js

export class NexusP2P {
    static peer = null;
    static connection = null;
    static app = null;
    static wormholeNode = null;

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
        this.initPeer();
    }

    static createHUD() {
        // --- 通信制御HUD（コントロールパネル） ---
        const hud = document.createElement('div');
        hud.id = 'nexus-p2p-hud';
        hud.style.cssText = `
            position: fixed; top: 80px; left: 20px; width: 220px; background: rgba(10, 0, 20, 0.95);
            border: 1px solid #ff00ff; border-radius: 8px; box-shadow: 0 0 20px rgba(255, 0, 255, 0.3);
            z-index: 90000; padding: 15px; color: #fff; font-family: monospace; transition: 0.3s;
        `;

        hud.innerHTML = `
            <div style="color:#ff00ff; font-weight:bold; font-size:12px; margin-bottom:10px; border-bottom:1px solid rgba(255,0,255,0.4); padding-bottom:5px;">
                🌐 QUANTUM TUNNEL
            </div>
            <div style="font-size:10px; color:#888; margin-bottom:5px;">YOUR IDENTITY KEY:</div>
            <div id="p2p-my-id" style="background:rgba(255,255,255,0.1); padding:8px; border-radius:4px; font-size:12px; color:#00ffcc; text-align:center; word-break:break-all; user-select:all; cursor:pointer;">
                GENERATING...
            </div>
            <div style="font-size:10px; color:#888; margin-top:10px; margin-bottom:5px;">CONNECT TO TARGET:</div>
            <input type="text" id="p2p-target-id" placeholder="Paste Target Key..." style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); color:#fff; border:1px solid #ff00ff; border-radius:4px; padding:8px; outline:none; font-size:11px; margin-bottom:10px;">
            <button id="p2p-connect-btn" style="width:100%; padding:10px; background:#440044; color:#ff00ff; border:1px solid #ff00ff; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">🔗 リンク確立</button>
            <div id="p2p-status" style="margin-top:10px; font-size:10px; color:#ffaa00; text-align:center;">STATUS: OFFLINE</div>
            <button id="p2p-close" style="width:100%; margin-top:10px; background:transparent; border:none; color:#888; cursor:pointer; font-size:10px;">[ CLOSE HUD ]</button>
        `;
        document.body.appendChild(hud);

        document.getElementById('p2p-my-id').onclick = (e) => {
            navigator.clipboard.writeText(e.target.innerText);
            e.target.style.background = '#00ffcc'; e.target.style.color = '#000';
            setTimeout(() => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.color = '#00ffcc'; }, 200);
        };

        document.getElementById('p2p-connect-btn').onclick = () => {
            const targetId = document.getElementById('p2p-target-id').value.trim();
            if (targetId) this.connectToPeer(targetId);
        };

        document.getElementById('p2p-close').onclick = () => {
            hud.style.display = 'none';
        };

        // --- 受信検疫UI（最初は隠しておく） ---
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

    static initPeer() {
        const myIdElement = document.getElementById('p2p-my-id');
        const statusElement = document.getElementById('p2p-status');

        // ランダムで安全なIDを生成してPeerJSサーバーに登録
        this.peer = new Peer({ debug: 2 });

        this.peer.on('open', (id) => {
            myIdElement.innerText = id;
            statusElement.innerText = 'STATUS: WAITING FOR LINK...';
            statusElement.style.color = '#00ffcc';
        });

        // 相手から接続要求が来た時
        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error(err);
            statusElement.innerText = 'STATUS: CONNECTION ERROR';
            statusElement.style.color = '#ff4444';
        });
    }

    static connectToPeer(targetId) {
        const statusElement = document.getElementById('p2p-status');
        statusElement.innerText = 'STATUS: CONNECTING...';
        
        // 相手のIDに向けてトンネルを掘る
        const conn = this.peer.connect(targetId);
        this.setupConnection(conn);
    }

    static setupConnection(conn) {
        this.connection = conn;
        const statusElement = document.getElementById('p2p-status');

        conn.on('open', () => {
            statusElement.innerText = 'STATUS: LINK SECURED 🔒';
            statusElement.style.color = '#ff00ff';
            document.getElementById('p2p-connect-btn').style.display = 'none';
            document.getElementById('p2p-target-id').style.display = 'none';
            
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.5);
            
            // ★ 接続完了！特異点（ワームホール）を宇宙に発生させる
            this.spawnWormhole();
        });

        // 相手からデータ（星）が投げ込まれた時
        conn.on('data', (data) => {
            this.handleIncomingData(data);
        });

        conn.on('close', () => {
            statusElement.innerText = 'STATUS: LINK LOST';
            statusElement.style.color = '#ff4444';
            if (this.wormholeNode) {
                this.app.currentUniverse.removeNode(this.wormholeNode);
                this.wormholeNode = null;
                if (this.app.simulation) this.app.simulation.alpha(0.5).restart();
            }
        });
    }

    // ★ ロマン機能：ワームホール（特異点）の生成
    static spawnWormhole() {
        if (!this.app || !this.app.currentUniverse) return;

        const cx = this.app.camera ? -this.app.camera.x : 0;
        const cy = this.app.camera ? -this.app.camera.y : 0;

        // ワームホールを特別なノードとして追加
        this.app.currentUniverse.addNode('🌐 P2P WORMHOLE', cx + 150, cy - 100, 50, '#ff00ff', 'galaxy');
        this.wormholeNode = this.app.currentUniverse.nodes[this.app.currentUniverse.nodes.length - 1];
        
        // 特殊なフラグと見た目を付与
        this.wormholeNode.isWormhole = true;
        this.wormholeNode.isLocked = true; // メニューを開かせないため
        
        if (this.app.simulation) this.app.simulation.alpha(0.5).restart();

        // ★ 常時監視ループ：ドラッグ中の星がワームホールに近づいたか判定する
        const checkCollision = () => {
            if (!this.connection || !this.wormholeNode) return;

            this.app.currentUniverse.nodes.forEach(node => {
                if (node.isWormhole) return;

                // fx, fy が null じゃない ＝ ユーザーがマウスで掴んでドラッグしている最中
                if (node.fx !== null && node.fy !== null) {
                    const MathAbs = Math.abs;
                    const dx = node.x - this.wormholeNode.x;
                    const dy = node.y - this.wormholeNode.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    // ワームホールに吸い込まれる判定（距離40以内）
                    if (dist < 40) {
                        this.sendNode(node);
                        
                        // 投げ込んだ星を自分の宇宙からは消去する（亜空間送り）
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

    // ★ 星のデータを暗号化トンネルで相手に送る
    static sendNode(node) {
        if (!this.connection) return;

        // ノードの純粋なデータだけを抽出（循環参照を防ぐため）
        const payload = {
            type: 'NODE_TRANSFER',
            data: {
                name: node.name,
                note: node.note || '',
                color: node.color,
                size: node.size,
                url: node.url || '',
                iconUrl: node.iconUrl || ''
            }
        };

        this.connection.send(payload);
        
        // 吸い込まれたエフェクト
        document.body.style.filter = 'hue-rotate(90deg)';
        setTimeout(() => document.body.style.filter = 'none', 100);
        if (window.universeAudio) window.universeAudio.playSystemSound(200, 'square', 0.3);
        console.log("🚀 [Nexus P2P] データをワームホールへ投擲しました");
    }

    // ★ 相手からデータが届いた時の「検疫（ペンディング）」UI
    static handleIncomingData(payload) {
        if (payload.type === 'NODE_TRANSFER') {
            const data = payload.data;
            const quarantine = document.getElementById('p2p-quarantine');
            
            // 警告音と画面フラッシュ
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

            // 許可ボタン：自分の宇宙に展開する
            document.getElementById('q-accept').onclick = () => {
                quarantine.style.display = 'none';
                const cx = this.app.camera ? -this.app.camera.x : 0;
                const cy = this.app.camera ? -this.app.camera.y : 0;
                
                this.app.currentUniverse.addNode(data.name, cx, cy, data.size, data.color, 'star');
                const newNode = this.app.currentUniverse.nodes[this.app.currentUniverse.nodes.length - 1];
                newNode.note = data.note;
                newNode.url = data.url;
                newNode.iconUrl = data.iconUrl;
                
                if (this.app.simulation) this.app.simulation.alpha(1).restart();
                if (this.app.autoSave) this.app.autoSave();
                if (window.universeAudio) window.universeAudio.playSpawn();
            };

            // 焼却ボタン：データを破棄する
            document.getElementById('q-purge').onclick = () => {
                quarantine.style.display = 'none';
                if (window.universeAudio) window.universeAudio.playDelete();
            };
        }
    }
}