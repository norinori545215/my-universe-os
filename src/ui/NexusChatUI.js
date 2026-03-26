// src/ui/NexusChatUI.js
import { SecretNexus } from '../security/SecretNexus.js';
import { db } from '../security/Auth.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class NexusChatUI {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.activeNode = null;
        this.unsubscribeNetwork = null; // ★ リアルタイムリスナーの解除用
        this.createUI();
    }

    createUI() {
        // ① 引き出しタブ
        this.triggerTab = document.createElement('div');
        this.triggerTab.style.cssText = 'position:fixed; top:50%; right:20px; transform:translateY(-50%); width:30px; height:80px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; border-radius:15px; z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#00ffcc; cursor:pointer; box-shadow:0 0 20px rgba(0,255,204,0.3); backdrop-filter:blur(5px); font-weight:bold; transition:all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); font-size:18px; letter-spacing:2px;';
        this.triggerTab.innerHTML = '<div style="transform:rotate(-90deg); white-space:nowrap; margin-top:5px;">NEXUS</div>';
        
        this.triggerTab.onmouseover = () => { if(!this.isOpen) this.triggerTab.style.background = 'rgba(0,255,204,0.3)'; };
        this.triggerTab.onmouseout = () => { if(!this.isOpen) this.triggerTab.style.background = 'rgba(0,255,204,0.1)'; };
        this.triggerTab.onclick = () => this.toggle();
        document.body.appendChild(this.triggerTab);

        // ② スライドしてくるメインパネル
        this.panel = document.createElement('div');
        this.panel.style.cssText = 'position:fixed; top:0; right:-400px; width:100%; max-width:400px; height:100%; background:rgba(10,15,20,0.95); border-left:1px solid #00ffcc; z-index:99998; display:flex; flex-direction:column; transition:right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow:-10px 0 30px rgba(0,255,204,0.1); backdrop-filter:blur(15px); pointer-events:auto; font-family:sans-serif; color:white; overflow:hidden;';
        document.body.appendChild(this.panel);

        // ヘッダー部分
        const header = document.createElement('div');
        header.style.cssText = 'padding:15px 20px; border-bottom:1px solid rgba(0,255,204,0.3); display:flex; justify-content:space-between; align-items:center; background:rgba(0,255,204,0.05); flex-shrink:0;';
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:18px; color:#00ffcc;">📡</span>
                <div style="font-size:16px; font-weight:bold; letter-spacing:2px; color:#00ffcc; text-shadow:0 0 5px #00ffcc;">NEXUS HUB</div>
            </div>
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.style.cssText = 'background:transparent; border:none; color:#ff4444; font-size:26px; cursor:pointer; padding:0 10px; line-height:1; transition:0.2s;';
        closeBtn.onmouseover = () => closeBtn.style.color = '#ff8888';
        closeBtn.onmouseout = () => closeBtn.style.color = '#ff4444';
        closeBtn.onclick = () => this.toggle();
        header.appendChild(closeBtn);
        this.panel.appendChild(header);

        // ボディ部分
        const body = document.createElement('div');
        body.style.cssText = 'display:flex; flex:1; overflow:hidden;';
        this.panel.appendChild(body);

        // 左側：コンタクトリスト
        this.contactList = document.createElement('div');
        this.contactList.style.cssText = 'width:120px; border-right:1px solid rgba(0,255,204,0.2); overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px; display:flex; flex-direction:column; gap:8px; scrollbar-width: none; flex-shrink:0;';
        body.appendChild(this.contactList);

        // 右側：チャットエリア
        this.chatArea = document.createElement('div');
        this.chatArea.style.cssText = 'flex:1; display:flex; flex-direction:column; background:rgba(0,0,0,0.5); overflow:hidden;';
        body.appendChild(this.chatArea);

        // チャットヘッダー
        this.chatHeader = document.createElement('div');
        this.chatHeader.style.cssText = 'padding:10px 15px; border-bottom:1px solid rgba(255,0,255,0.2); display:flex; align-items:center; gap:12px; background:rgba(255,0,255,0.03); flex-shrink:0;';
        this.chatArea.appendChild(this.chatHeader);

        // メッセージ表示コンテナ
        this.msgContainer = document.createElement('div');
        this.msgContainer.style.cssText = 'flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:15px; scroll-behavior:smooth;';
        this.chatArea.appendChild(this.msgContainer);

        // 入力エリア
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'padding:15px; border-top:1px solid rgba(0,255,204,0.2); background:rgba(0,0,0,0.8); flex-shrink:0;';
        
        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'display:flex; gap:10px; background:rgba(0,255,204,0.05); border:1px solid rgba(0,255,204,0.3); border-radius:25px; padding:5px 5px 5px 15px; transition:0.2s;';
        
        this.inputField = document.createElement('input');
        this.inputField.type = 'text';
        this.inputField.placeholder = 'Type an encrypted message...';
        this.inputField.style.cssText = 'flex:1; background:transparent; border:none; color:#fff; padding:8px 0; outline:none; font-size:13px;';
        
        this.inputField.onfocus = () => inputWrapper.style.borderColor = '#00ffcc';
        this.inputField.onblur = () => inputWrapper.style.borderColor = 'rgba(0,255,204,0.3)';
        this.inputField.onkeypress = (e) => { if(e.key === 'Enter') this.sendMessage(); };
        
        const sendBtn = document.createElement('button');
        sendBtn.innerText = 'Send';
        sendBtn.style.cssText = 'background:#00ffcc; color:#000; border:none; padding:0 20px; border-radius:20px; font-weight:bold; cursor:pointer; font-size:12px; transition:0.2s;';
        
        sendBtn.onmouseover = () => { sendBtn.style.background = '#00ffff'; sendBtn.style.boxShadow = '0 0 10px #00ffff'; };
        sendBtn.onmouseout = () => { sendBtn.style.background = '#00ffcc'; sendBtn.style.boxShadow = 'none'; };
        sendBtn.onclick = () => this.sendMessage();

        inputWrapper.appendChild(this.inputField);
        inputWrapper.appendChild(sendBtn);
        inputContainer.appendChild(inputWrapper);
        this.chatArea.appendChild(inputContainer);
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.panel.style.right = this.isOpen ? '0px' : '-400px';
        
        this.triggerTab.style.right = this.isOpen ? '385px' : '20px'; 
        this.triggerTab.style.background = this.isOpen ? 'rgba(255,68,68,0.1)' : 'rgba(0,255,204,0.1)';
        this.triggerTab.style.borderColor = this.isOpen ? '#ff4444' : '#00ffcc';
        this.triggerTab.style.color = this.isOpen ? '#ff4444' : '#00ffcc';
        this.triggerTab.style.boxShadow = this.isOpen ? '0 0 20px rgba(255,68,68,0.3)' : '0 0 20px rgba(0,255,204,0.3)';
        this.triggerTab.innerHTML = this.isOpen ? '<div style="font-size:24px;">×</div>' : '<div style="transform:rotate(-90deg); white-space:nowrap; margin-top:5px;">NEXUS</div>';
        
        if (this.isOpen) {
            this.refreshContacts();
            if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
        }
    }

    refreshContacts() {
        this.contactList.innerHTML = '';
        let nexusNodes = [];
        
        const findNexus = (nodes) => {
            nodes.forEach(n => {
                if (n.sharedKey && !n.isGhost) nexusNodes.push(n);
                if (n.innerUniverse) findNexus(n.innerUniverse.nodes);
            });
        };
        findNexus(this.app.currentUniverse.nodes);

        if (nexusNodes.length === 0) {
            this.contactList.innerHTML = '<div style="color:#666; font-size:10px; text-align:center; padding:20px 5px; border:1px dashed #444; border-radius:8px;">NO LINKS</div>';
            this.chatHeader.innerHTML = '';
            this.msgContainer.innerHTML = '<div style="margin:auto; color:#444; font-size:12px; text-align:center; line-height:1.6;">星のメニューから<br><span style="color:#00ffcc;">[📡 QRセキュア通信]</span>を実行し、<br>鍵を交換してください。</div>';
            this.activeNode = null;
            return;
        }

        nexusNodes.forEach(node => {
            const btn = document.createElement('div');
            const isActive = this.activeNode === node;
            
            btn.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; border:1px solid transparent; cursor:pointer; transition:0.2s; overflow:hidden;`;
            
            const iconWrap = document.createElement('div');
            iconWrap.style.cssText = `width:36px; height:36px; border-radius:50%; overflow:hidden; border:2px solid ${isActive?'#00ffcc':'#444'}; flex-shrink:0; display:flex; justify-content:center; align-items:center; background:#111;`;
            
            if (node.iconUrl) {
                iconWrap.innerHTML = `<img src="${node.iconUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            } else {
                iconWrap.style.background = isActive ? 'radial-gradient(circle, #00ffcc 0%, #111 70%)' : 'radial-gradient(circle, #444 0%, #111 70%)';
            }
            
            const nameEl = document.createElement('div');
            const displayName = node.name.replace('Nexus: ', '');
            nameEl.style.cssText = `font-size:13px; color:${isActive?'#fff':'#aaa'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
            nameEl.innerText = '🌌 ' + displayName;
            
            btn.appendChild(iconWrap);
            btn.appendChild(nameEl);
            
            if (isActive) {
                btn.style.background = 'rgba(0,255,204,0.1)';
                btn.style.borderColor = 'rgba(0,255,204,0.3)';
            } else {
                btn.onmouseover = () => { btn.style.background = 'rgba(255,255,255,0.03)'; btn.style.borderColor = 'rgba(255,255,255,0.1)'; };
                btn.onmouseout = () => { btn.style.background = 'transparent'; btn.style.borderColor = 'transparent'; };
            }
            
            btn.onclick = () => this.openChat(node);
            this.contactList.appendChild(btn);
        });

        if (!this.activeNode || !nexusNodes.includes(this.activeNode)) {
            this.openChat(nexusNodes[0]);
        }
    }

    async openChat(node) {
        // 前の通信リスナーがあれば切断
        if (this.unsubscribeNetwork) {
            this.unsubscribeNetwork();
            this.unsubscribeNetwork = null;
        }

        this.activeNode = node;
        this.refreshContacts();
        
        const displayName = node.name.replace('Nexus: ', '');
        this.chatHeader.innerHTML = `
            <div style="width:32px; height:32px; border-radius:50%; overflow:hidden; border:2px solid #ff00ff; flex-shrink:0; background:#111; display:flex; justify-content:center; align-items:center;">
                ${node.iconUrl ? `<img src="${node.iconUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:radial-gradient(circle, #ff00ff 0%, #111 70%);"></div>`}
            </div>
            <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="font-size:14px; font-weight:bold; color:#fff;">${displayName}</div>
                <div style="font-size:10px; color:#aaa; display:flex; align-items:center; gap:4px;">🔐 Hybrid E2EE Secured</div>
            </div>
        `;
        
        this.msgContainer.innerHTML = '';
        
        // オフライン用にローカル保存された過去ログを描画
        if (!node.messages) node.messages = [];
        for (let msg of node.messages) { await this.renderMessageObj(msg); }
        this.scrollToBottom();

        // ★ Firebaseのリアルタイムワームホールを開通
        if (node.peerPublicKey && this.app.nexusUI.myKeys && db) {
            await this.listenToNetwork(node);
        }
    }

    // ★ ゼロ知識ベースのチャンネルID生成（お互いの公開鍵をソートして結合）
    async generateChannelId(myPubJwk, peerPubJwk) {
        const myStr = JSON.stringify(myPubJwk);
        const peerStr = JSON.stringify(peerPubJwk);
        const combined = [myStr, peerStr].sort().join('|');
        
        const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined));
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');
    }

    // ★ リアルタイム監視リスナーの起動
    async listenToNetwork(node) {
        try {
            const channelId = await this.generateChannelId(this.app.nexusUI.myKeys.publicKey, node.peerPublicKey);
            node.channelId = channelId; // 送信時にも使うために保存
            const myPubStr = JSON.stringify(this.app.nexusUI.myKeys.publicKey);

            const messagesRef = collection(db, "nexus_channels", channelId, "messages");
            const q = query(messagesRef, orderBy("timestamp", "asc"));

            this.unsubscribeNetwork = onSnapshot(q, async (snapshot) => {
                let isNewRendered = false;

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const data = change.doc.data();
                        
                        // ローカルにまだ無いメッセージだけを描画（重複排除）
                        const isDuplicate = node.messages.some(m => JSON.stringify(m.cipher) === JSON.stringify(data.cipher));
                        if (!isDuplicate) {
                            const senderType = (data.senderPubKey === myPubStr) ? 'me' : 'peer';
                            const msgObj = {
                                sender: senderType,
                                cipher: data.cipher,
                                iv: data.iv,
                                timestamp: data.timestamp ? data.timestamp.toMillis() : Date.now()
                            };
                            
                            node.messages.push(msgObj);
                            this.renderMessageObj(msgObj);
                            isNewRendered = true;

                            // 相手から着信した場合は音を鳴らす
                            if (senderType === 'peer' && window.universeAudio && this.isOpen) {
                                window.universeAudio.playSystemSound(400, 'triangle', 0.1);
                            }
                        }
                    }
                });

                if (isNewRendered) {
                    this.app.autoSave();
                    this.scrollToBottom();
                }
            }, (error) => {
                console.warn("📡 リアルタイム通信が一時的に切断されました:", error);
            });
        } catch (e) {
            console.error("ワームホールの開通に失敗しました:", e);
        }
    }

    async renderMessageObj(msg) {
        const isMe = msg.sender === 'me';
        
        const msgRow = document.createElement('div');
        msgRow.style.cssText = `display:flex; width:100%; justify-content:${isMe ? 'flex-end' : 'flex-start'}; align-items:flex-end; gap:10px;`;
        
        if (!isMe) {
            const peerIcon = document.createElement('div');
            peerIcon.style.cssText = `width:28px; height:28px; border-radius:50%; overflow:hidden; border:1px solid rgba(255,0,255,0.5); flex-shrink:0; background:#111; display:flex; justify-content:center; align-items:center;`;
            if (this.activeNode.iconUrl) {
                peerIcon.innerHTML = `<img src="${this.activeNode.iconUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            } else {
                peerIcon.style.background = 'radial-gradient(circle, #ff00ff 0%, #111 70%)';
            }
            msgRow.appendChild(peerIcon);
        }
        
        const bubble = document.createElement('div');
        bubble.style.cssText = `max-width:70%; padding:12px 16px; font-size:13px; line-height:1.5; word-break:break-all; box-shadow:0 4px 15px rgba(0,0,0,0.5);`;
        
        if (isMe) {
            bubble.style.background = 'linear-gradient(135deg, rgba(0,255,204,0.15) 0%, rgba(0,204,255,0.05) 100%)';
            bubble.style.border = '1px solid rgba(0,255,204,0.3)';
            bubble.style.color = '#ccffff';
            bubble.style.borderRadius = '16px 16px 4px 16px';
            bubble.style.boxShadow = '0 2px 10px rgba(0,255,204,0.2)';
        } else {
            bubble.style.background = 'linear-gradient(135deg, rgba(255,0,255,0.1) 0%, rgba(255,102,204,0.05) 100%)';
            bubble.style.border = '1px solid rgba(255,102,204,0.3)';
            bubble.style.color = '#ffccff';
            bubble.style.borderRadius = '16px 16px 16px 4px';
            bubble.style.boxShadow = '0 2px 10px rgba(255,102,204,0.2)';
        }

        let text = "[Decryption Error]";
        try { 
            // SecretNexus (ハイブリッド・エスクロー版) の復号呼び出し
            text = await SecretNexus.decryptData({ cipher: msg.cipher, iv: msg.iv }, this.activeNode.sharedKey); 
        } catch(e) {}
        bubble.innerText = text;
        
        msgRow.appendChild(bubble);
        this.msgContainer.appendChild(msgRow);
    }

    async sendMessage() {
        const text = this.inputField.value.trim();
        if (!text || !this.activeNode) return;
        this.inputField.value = '';
        
        // ハイブリッド暗号化（運営用の鍵も含めてカプセル化される）
        const encrypted = await SecretNexus.encryptData(text, this.activeNode.sharedKey);
        
        const myPubStr = JSON.stringify(this.app.nexusUI.myKeys.publicKey);
        const msgObj = { 
            sender: 'me', 
            cipher: encrypted.cipher, 
            iv: encrypted.iv, 
            timestamp: Date.now() 
        };
        
        // オフラインやチャンネル未生成時はローカルのみに保存
        if (!this.activeNode.channelId || !db) {
            if (!this.activeNode.messages) this.activeNode.messages = [];
            this.activeNode.messages.push(msgObj);
            this.app.autoSave();
            await this.renderMessageObj(msgObj);
            this.scrollToBottom();
            return;
        }

        // ★ Firebaseへ暗号データを射出
        try {
            const messagesRef = collection(db, "nexus_channels", this.activeNode.channelId, "messages");
            await addDoc(messagesRef, {
                cipher: encrypted.cipher,
                iv: encrypted.iv,
                senderPubKey: myPubStr,
                timestamp: serverTimestamp()
            });
            // ※描画と保存は onSnapshot リスナーが自動で拾って行ってくれます
        } catch (e) {
            console.error("メッセージの送信に失敗しました（オフラインフォールバック）", e);
            // 送信失敗時はローカルだけで完結させる
            if (!this.activeNode.messages) this.activeNode.messages = [];
            this.activeNode.messages.push(msgObj);
            this.app.autoSave();
            await this.renderMessageObj(msgObj);
            this.scrollToBottom();
        }
    }

    scrollToBottom() { setTimeout(() => { this.msgContainer.scrollTop = this.msgContainer.scrollHeight; }, 50); }
}