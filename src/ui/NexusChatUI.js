// src/ui/NexusChatUI.js
import { SecretNexus } from '../security/SecretNexus.js';
import { db } from '../security/Auth.js';
import { collection, doc, setDoc, addDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class NexusChatUI {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.activeNode = null;
        this.unsubscribeNetwork = null;
        this.createUI();
        
        // 起動時に「着信」を常時監視するレーダーを起動
        setTimeout(() => this.startGlobalInboxListener(), 2000);
    }

    getMyIdentity() {
        try {
            const saved = localStorage.getItem('universe_nexus_identity');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    }

    async startGlobalInboxListener() {
        if (!db) return;
        const myId = this.getMyIdentity();
        if (!myId) return;

        const myPubStr = JSON.stringify(myId.publicKey);
        const channelsRef = collection(db, "nexus_channels");
        const q = query(channelsRef, where("participants", "array-contains", myPubStr));

        onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const channelData = change.doc.data();
                    const channelId = change.doc.id;
                    const peerPubStr = channelData.participants.find(p => p !== myPubStr);
                    if (!peerPubStr) return;

                    let existingNode = null;
                    const searchUniverse = (nodes) => {
                        nodes.forEach(n => {
                            if (JSON.stringify(n.peerPublicKey) === peerPubStr) existingNode = n;
                            if (n.innerUniverse) searchUniverse(n.innerUniverse.nodes);
                        });
                    };
                    searchUniverse(this.app.currentUniverse.nodes);

                    if (!existingNode) {
                        const peerPubObj = JSON.parse(peerPubStr);
                        const newNode = this.app.currentUniverse.addNode('着信シグナル', 0, 0, 35, '#ff00ff', 'star');
                        newNode.peerPublicKey = peerPubObj;
                        newNode.channelId = channelId;
                        newNode.name = "Nexus: 未知の相手";
                        newNode.messages = [];
                        
                        this.app.autoSave();
                        if(window.universeAudio) window.universeAudio.playWarp();
                        if(this.isOpen) this.refreshContacts();
                    }
                }
            });
        }, (err) => console.warn("Inbox Listener Wait...", err));
    }

    createUI() {
        this.triggerTab = document.createElement('div');
        this.triggerTab.style.cssText = 'position:fixed; top:50%; right:20px; transform:translateY(-50%); width:30px; height:80px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; border-radius:15px; z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#00ffcc; cursor:pointer; box-shadow:0 0 20px rgba(0,255,204,0.3); backdrop-filter:blur(5px); font-weight:bold; transition:all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); font-size:18px; letter-spacing:2px;';
        this.triggerTab.innerHTML = '<div style="transform:rotate(-90deg); white-space:nowrap; margin-top:5px;">NEXUS</div>';
        
        this.triggerTab.onmouseover = () => { if(!this.isOpen) this.triggerTab.style.background = 'rgba(0,255,204,0.3)'; };
        this.triggerTab.onmouseout = () => { if(!this.isOpen) this.triggerTab.style.background = 'rgba(0,255,204,0.1)'; };
        this.triggerTab.onclick = () => this.toggle();
        document.body.appendChild(this.triggerTab);

        this.panel = document.createElement('div');
        this.panel.style.cssText = 'position:fixed; top:0; right:-400px; width:100%; max-width:400px; height:100%; background:rgba(10,15,20,0.95); border-left:1px solid #00ffcc; z-index:99998; display:flex; flex-direction:column; transition:right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow:-10px 0 30px rgba(0,255,204,0.1); backdrop-filter:blur(15px); pointer-events:auto; font-family:sans-serif; color:white; overflow:hidden;';
        document.body.appendChild(this.panel);

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

        const body = document.createElement('div');
        body.style.cssText = 'display:flex; flex:1; overflow:hidden;';
        this.panel.appendChild(body);

        this.contactList = document.createElement('div');
        this.contactList.style.cssText = 'width:120px; border-right:1px solid rgba(0,255,204,0.2); overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px; display:flex; flex-direction:column; gap:8px; scrollbar-width: none; flex-shrink:0;';
        body.appendChild(this.contactList);

        this.chatArea = document.createElement('div');
        this.chatArea.style.cssText = 'flex:1; display:flex; flex-direction:column; background:rgba(0,0,0,0.5); overflow:hidden;';
        body.appendChild(this.chatArea);

        this.chatHeader = document.createElement('div');
        this.chatHeader.style.cssText = 'padding:10px 15px; border-bottom:1px solid rgba(255,0,255,0.2); display:flex; align-items:center; gap:12px; background:rgba(255,0,255,0.03); flex-shrink:0;';
        this.chatArea.appendChild(this.chatHeader);

        this.msgContainer = document.createElement('div');
        this.msgContainer.style.cssText = 'flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:15px; scroll-behavior:smooth;';
        this.chatArea.appendChild(this.msgContainer);

        // ★★★ 入力エリアの大幅拡張 ★★★
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'padding:15px; border-top:1px solid rgba(0,255,204,0.2); background:rgba(0,0,0,0.8); flex-shrink:0; display:flex; gap:10px; align-items:flex-end;';
        
        const attachBtn = document.createElement('button');
        attachBtn.innerText = '📎';
        attachBtn.title = '画像/データを暗号化送信';
        // 下揃えにして、入力欄が広がってもずれないようにする
        attachBtn.style.cssText = 'background:transparent; border:none; font-size:24px; cursor:pointer; color:#00ffcc; transition:0.2s; padding-bottom:6px; flex-shrink:0;';
        attachBtn.onmouseover = () => attachBtn.style.textShadow = '0 0 10px #00ffcc';
        attachBtn.onmouseout = () => attachBtn.style.textShadow = 'none';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.sendImage(e.target.files[0]);

        const inputWrapper = document.createElement('div');
        // ボーダーの丸みを調整し、上下のパディングを増やして入力しやすくする
        inputWrapper.style.cssText = 'flex:1; display:flex; gap:10px; background:rgba(0,255,204,0.05); border:1px solid rgba(0,255,204,0.3); border-radius:15px; padding:8px 10px 8px 15px; transition:0.2s; align-items:flex-end;';
        
        // input ではなく textarea を使用して複数行対応
        this.inputField = document.createElement('textarea');
        this.inputField.placeholder = 'Encrypted message...\n(Shift + Enter で改行)';
        this.inputField.rows = 1;
        this.inputField.style.cssText = 'flex:1; background:transparent; border:none; color:#fff; padding:0; outline:none; font-size:14px; line-height:1.5; font-family:sans-serif; resize:none; max-height:150px; overflow-y:auto;';
        
        // 入力内容に合わせて高さを自動拡張
        this.inputField.addEventListener('input', () => {
            this.inputField.style.height = 'auto';
            this.inputField.style.height = this.inputField.scrollHeight + 'px';
        });

        // Enterで送信、Shift+Enterで改行
        this.inputField.onkeydown = (e) => { 
            if(e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // デフォルトの改行を防ぐ
                this.sendMessage();
            }
        };
        
        this.inputField.onfocus = () => inputWrapper.style.borderColor = '#00ffcc';
        this.inputField.onblur = () => inputWrapper.style.borderColor = 'rgba(0,255,204,0.3)';
        
        const sendBtn = document.createElement('button');
        sendBtn.innerText = 'Send';
        // 送信ボタンを下揃えにして高さを固定
        sendBtn.style.cssText = 'background:#00ffcc; color:#000; border:none; padding:0 20px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:13px; transition:0.2s; height:38px; display:flex; align-items:center; justify-content:center; flex-shrink:0;';
        
        sendBtn.onmouseover = () => { sendBtn.style.background = '#00ffff'; sendBtn.style.boxShadow = '0 0 10px #00ffff'; };
        sendBtn.onmouseout = () => { sendBtn.style.background = '#00ffcc'; sendBtn.style.boxShadow = 'none'; };
        sendBtn.onclick = () => this.sendMessage();

        inputContainer.appendChild(attachBtn);
        inputContainer.appendChild(fileInput);
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
                if ((n.sharedKey || n.peerPublicKey) && !n.isGhost) nexusNodes.push(n);
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
        if (this.unsubscribeNetwork) {
            this.unsubscribeNetwork();
            this.unsubscribeNetwork = null;
        }

        const myId = this.getMyIdentity();

        if (!node.sharedKey && node.peerPublicKey && myId) {
            try {
                node.sharedKey = await SecretNexus.deriveSharedSecret(myId.privateKey, node.peerPublicKey);
            } catch (e) {
                console.error("鍵の再錬成に失敗しました", e);
            }
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
        
        if (!node.messages) node.messages = [];
        for (let msg of node.messages) { await this.renderMessageObj(msg); }
        this.scrollToBottom();

        if (node.peerPublicKey && myId && db) {
            await this.listenToNetwork(node, myId);
        }
    }

    async generateChannelId(myPubJwk, peerPubJwk) {
        const myStr = JSON.stringify(myPubJwk);
        const peerStr = JSON.stringify(peerPubJwk);
        const combined = [myStr, peerStr].sort().join('|');
        
        const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined));
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');
    }

    async listenToNetwork(node, myId) {
        try {
            const channelId = await this.generateChannelId(myId.publicKey, node.peerPublicKey);
            node.channelId = channelId;
            const myPubStr = JSON.stringify(myId.publicKey);

            const messagesRef = collection(db, "nexus_channels", channelId, "messages");
            const q = query(messagesRef, orderBy("timestamp", "asc"));

            this.unsubscribeNetwork = onSnapshot(q, async (snapshot) => {
                let isNewRendered = false;

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const data = change.doc.data();
                        
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
        bubble.style.cssText = `max-width:70%; padding:12px 16px; font-size:14px; line-height:1.6; word-break:break-all; box-shadow:0 4px 15px rgba(0,0,0,0.5); white-space:pre-wrap;`;
        
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
        let isImage = false;
        
        try { 
            const decrypted = await SecretNexus.decryptData({ cipher: msg.cipher, iv: msg.iv }, this.activeNode.sharedKey); 
            try {
                const parsed = JSON.parse(decrypted);
                if (parsed.type === 'image') {
                    isImage = true;
                    text = parsed.data;
                } else if (parsed.type === 'text') {
                    text = parsed.text;
                }
            } catch(e) {
                text = decrypted;
            }
        } catch(e) {}
        
        if (isImage) {
            bubble.innerHTML = `<img src="${text}" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="window.open('${text}')">`;
        } else {
            bubble.innerText = text;
        }
        
        msgRow.appendChild(bubble);
        this.msgContainer.appendChild(msgRow);
    }

    async sendMessage() {
        const text = this.inputField.value.trim();
        if (!text || !this.activeNode) return;
        
        // 入力欄をリセットして高さを戻す
        this.inputField.value = '';
        this.inputField.style.height = 'auto';
        
        const payload = JSON.stringify({ type: 'text', text: text });
        const encrypted = await SecretNexus.encryptData(payload, this.activeNode.sharedKey);
        await this.dispatchToNetwork(encrypted);
    }

    async compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 800;
                    let w = img.width; let h = img.height;
                    if (w > h && w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
                    else if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }
                    
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); 
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async sendImage(file) {
        if (!file || !this.activeNode) return;
        
        this.inputField.placeholder = 'Compressing & Encrypting...';
        
        try {
            const base64Data = await this.compressImage(file);
            const payload = JSON.stringify({ type: 'image', data: base64Data });
            const encrypted = await SecretNexus.encryptData(payload, this.activeNode.sharedKey);
            await this.dispatchToNetwork(encrypted);
        } catch(e) {
            console.error("画像送信エラー", e);
            alert("画像の暗号化に失敗しました。");
        } finally {
            this.inputField.placeholder = 'Encrypted message...\n(Shift + Enter で改行)';
        }
    }

    async dispatchToNetwork(encrypted) {
        const myId = this.getMyIdentity();
        if (!myId) return;

        const myPubStr = JSON.stringify(myId.publicKey);
        const msgObj = { 
            sender: 'me', 
            cipher: encrypted.cipher, 
            iv: encrypted.iv, 
            timestamp: Date.now() 
        };
        
        if (!this.activeNode.channelId || !db) {
            if (!this.activeNode.messages) this.activeNode.messages = [];
            this.activeNode.messages.push(msgObj);
            this.app.autoSave();
            await this.renderMessageObj(msgObj);
            this.scrollToBottom();
            return;
        }

        try {
            const channelRef = doc(db, "nexus_channels", this.activeNode.channelId);
            await setDoc(channelRef, { participants: [myPubStr, JSON.stringify(this.activeNode.peerPublicKey)], updatedAt: serverTimestamp() }, { merge: true });

            const messagesRef = collection(db, "nexus_channels", this.activeNode.channelId, "messages");
            await addDoc(messagesRef, {
                cipher: encrypted.cipher,
                iv: encrypted.iv,
                senderPubKey: myPubStr,
                timestamp: serverTimestamp()
            });
        } catch (e) {
            console.error("送信失敗", e);
            if (!this.activeNode.messages) this.activeNode.messages = [];
            this.activeNode.messages.push(msgObj);
            this.app.autoSave();
            await this.renderMessageObj(msgObj);
            this.scrollToBottom();
        }
    }

    scrollToBottom() { setTimeout(() => { this.msgContainer.scrollTop = this.msgContainer.scrollHeight; }, 50); }
}