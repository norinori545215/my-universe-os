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

    // ★ 未知の相手から通信が来た場合、宇宙の中心に「着信シグナル星」を誕生させる
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

                    // 自分の宇宙に存在しない相手なら、新たな星としてスポーンさせる
                    if (!existingNode) {
                        const peerPubObj = JSON.parse(peerPubStr);
                        const newNode = this.app.currentUniverse.addNode('着信シグナル', 0, 0, 35, '#ff00ff', 'star');
                        newNode.peerPublicKey = peerPubObj;
                        newNode.channelId = channelId;
                        newNode.name = "Secure Channel";
                        newNode.messages = [];
                        
                        this.app.autoSave();
                        if(window.universeAudio) window.universeAudio.playWarp();
                    }
                }
            });
        }, (err) => console.warn("Inbox Listener Wait...", err));
    }

    createUI() {
        // ★ 画面端のタブと連絡先リストを完全廃止。星をクリックした時だけ開く大画面パネル。
        this.panel = document.createElement('div');
        this.panel.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%) scale(0.9); width:95%; max-width:700px; height:85vh; background:rgba(10,15,20,0.98); border:1px solid #ff00ff; border-radius:16px; z-index:99998; display:none; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.8); backdrop-filter:blur(20px); pointer-events:auto; font-family:sans-serif; color:white; overflow:hidden; opacity:0; transition:0.3s cubic-bezier(0.2, 0.8, 0.2, 1);';
        document.body.appendChild(this.panel);

        const header = document.createElement('div');
        header.style.cssText = 'padding:15px 20px; border-bottom:1px solid rgba(255,0,255,0.3); display:flex; justify-content:space-between; align-items:center; background:linear-gradient(90deg, rgba(255,0,255,0.1) 0%, transparent 100%); flex-shrink:0;';
        
        this.chatHeaderTitle = document.createElement('div');
        this.chatHeaderTitle.style.cssText = 'display:flex; align-items:center; gap:15px;';
        header.appendChild(this.chatHeaderTitle);

        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.style.cssText = 'background:transparent; border:none; color:#ff4444; font-size:28px; cursor:pointer; padding:0 10px; line-height:1; transition:0.2s;';
        closeBtn.onmouseover = () => closeBtn.style.color = '#ff8888';
        closeBtn.onmouseout = () => closeBtn.style.color = '#ff4444';
        closeBtn.onclick = () => this.closeChat();
        header.appendChild(closeBtn);
        this.panel.appendChild(header);

        this.msgContainer = document.createElement('div');
        this.msgContainer.style.cssText = 'flex:1; overflow-y:auto; padding:25px; display:flex; flex-direction:column; gap:20px; scroll-behavior:smooth;';
        this.panel.appendChild(this.msgContainer);

        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'padding:20px; border-top:1px solid rgba(255,0,255,0.2); background:rgba(0,0,0,0.5); flex-shrink:0; display:flex; gap:12px; align-items:flex-end;';
        
        const attachBtn = document.createElement('button');
        attachBtn.innerText = '📎';
        attachBtn.title = '画像/データを暗号化送信';
        attachBtn.style.cssText = 'background:transparent; border:none; font-size:26px; cursor:pointer; color:#ff00ff; transition:0.2s; padding-bottom:8px; flex-shrink:0;';
        attachBtn.onmouseover = () => attachBtn.style.textShadow = '0 0 10px #ff00ff';
        attachBtn.onmouseout = () => attachBtn.style.textShadow = 'none';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.sendImage(e.target.files[0]);

        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'flex:1; display:flex; gap:10px; background:rgba(255,0,255,0.05); border:1px solid rgba(255,0,255,0.3); border-radius:20px; padding:10px 10px 10px 20px; transition:0.2s; align-items:flex-end;';
        
        this.inputField = document.createElement('textarea');
        this.inputField.placeholder = 'Secure Message... (Shift+Enterで改行)';
        this.inputField.rows = 1;
        this.inputField.style.cssText = 'flex:1; background:transparent; border:none; color:#fff; padding:0; outline:none; font-size:15px; line-height:1.5; font-family:sans-serif; resize:none; max-height:200px; overflow-y:auto; margin-bottom:2px;';
        
        this.inputField.addEventListener('input', () => {
            this.inputField.style.height = 'auto';
            this.inputField.style.height = this.inputField.scrollHeight + 'px';
        });

        this.inputField.onkeydown = (e) => { 
            if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
        };
        
        this.inputField.onfocus = () => inputWrapper.style.borderColor = '#ff00ff';
        this.inputField.onblur = () => inputWrapper.style.borderColor = 'rgba(255,0,255,0.3)';
        
        const sendBtn = document.createElement('button');
        sendBtn.innerText = '➤';
        sendBtn.style.cssText = 'background:#ff00ff; color:#000; border:none; width:40px; height:40px; border-radius:50%; font-weight:bold; cursor:pointer; font-size:18px; transition:0.2s; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-bottom: -2px;';
        sendBtn.onmouseover = () => { sendBtn.style.background = '#ff66ff'; sendBtn.style.boxShadow = '0 0 10px #ff66ff'; };
        sendBtn.onmouseout = () => { sendBtn.style.background = '#ff00ff'; sendBtn.style.boxShadow = 'none'; };
        sendBtn.onclick = () => this.sendMessage();

        inputContainer.appendChild(attachBtn);
        inputContainer.appendChild(fileInput);
        inputWrapper.appendChild(this.inputField);
        inputWrapper.appendChild(sendBtn);
        inputContainer.appendChild(inputWrapper);
        this.panel.appendChild(inputContainer);
    }

    closeChat() {
        this.isOpen = false;
        this.panel.style.opacity = '0';
        this.panel.style.transform = 'translate(-50%, -50%) scale(0.9)';
        setTimeout(() => this.panel.style.display = 'none', 300);
        if (this.unsubscribeNetwork) {
            this.unsubscribeNetwork();
            this.unsubscribeNetwork = null;
        }
    }

    async openChat(node) {
        if (this.unsubscribeNetwork) { this.unsubscribeNetwork(); this.unsubscribeNetwork = null; }

        const myId = this.getMyIdentity();
        if (!node.sharedKey && node.peerPublicKey && myId) {
            try { node.sharedKey = await SecretNexus.deriveSharedSecret(myId.privateKey, node.peerPublicKey); } catch (e) {}
        }

        this.activeNode = node;
        this.isOpen = true;
        this.panel.style.display = 'flex';
        setTimeout(() => {
            this.panel.style.opacity = '1';
            this.panel.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
        
        const displayName = node.name.replace('Nexus Channel', 'Secure Channel').replace('Nexus: ', '');
        this.chatHeaderTitle.innerHTML = `
            <div style="width:40px; height:40px; border-radius:50%; overflow:hidden; border:2px solid #ff00ff; flex-shrink:0; background:#111; display:flex; justify-content:center; align-items:center;">
                ${node.iconUrl ? `<img src="${node.iconUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:radial-gradient(circle, #ff00ff 0%, #111 70%);"></div>`}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                <div style="font-size:18px; font-weight:bold; color:#fff; letter-spacing:1px;">${displayName}</div>
                <div style="font-size:11px; color:#ff00ff; text-shadow:0 0 5px #ff00ff;">🔐 Hybrid E2EE Secured</div>
            </div>
        `;
        
        this.msgContainer.innerHTML = '';
        if (!node.messages) node.messages = [];
        for (let msg of node.messages) { await this.renderMessageObj(msg); }
        this.scrollToBottom();

        if (node.peerPublicKey && myId && db) await this.listenToNetwork(node, myId);
    }

    async generateChannelId(myPubJwk, peerPubJwk) {
        const combined = [JSON.stringify(myPubJwk), JSON.stringify(peerPubJwk)].sort().join('|');
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
                            const msgObj = { sender: senderType, cipher: data.cipher, iv: data.iv, timestamp: data.timestamp ? data.timestamp.toMillis() : Date.now() };
                            
                            node.messages.push(msgObj);
                            this.renderMessageObj(msgObj);
                            isNewRendered = true;

                            if (senderType === 'peer' && window.universeAudio && this.isOpen) {
                                window.universeAudio.playSystemSound(400, 'triangle', 0.1);
                            }
                        }
                    }
                });
                if (isNewRendered) { this.app.autoSave(); this.scrollToBottom(); }
            });
        } catch (e) { console.error("ワームホールの開通に失敗:", e); }
    }

    async renderMessageObj(msg) {
        const isMe = msg.sender === 'me';
        const msgRow = document.createElement('div');
        msgRow.style.cssText = `display:flex; width:100%; justify-content:${isMe ? 'flex-end' : 'flex-start'}; align-items:flex-end; gap:12px;`;
        
        if (!isMe) {
            const peerIcon = document.createElement('div');
            peerIcon.style.cssText = `width:32px; height:32px; border-radius:50%; overflow:hidden; border:1px solid rgba(255,0,255,0.5); flex-shrink:0; background:#111; display:flex; justify-content:center; align-items:center;`;
            if (this.activeNode.iconUrl) peerIcon.innerHTML = `<img src="${this.activeNode.iconUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            else peerIcon.style.background = 'radial-gradient(circle, #ff00ff 0%, #111 70%)';
            msgRow.appendChild(peerIcon);
        }
        
        const bubble = document.createElement('div');
        bubble.style.cssText = `max-width:75%; padding:14px 18px; font-size:15px; line-height:1.6; word-break:break-all; box-shadow:0 5px 20px rgba(0,0,0,0.5); white-space:pre-wrap; letter-spacing:0.5px;`;
        
        if (isMe) {
            bubble.style.background = 'linear-gradient(135deg, rgba(255,0,255,0.15) 0%, rgba(255,102,204,0.05) 100%)';
            bubble.style.border = '1px solid rgba(255,0,255,0.3)'; bubble.style.color = '#ffccff'; bubble.style.borderRadius = '20px 20px 4px 20px';
        } else {
            bubble.style.background = 'linear-gradient(135deg, rgba(255,0,255,0.1) 0%, rgba(255,102,204,0.05) 100%)';
            bubble.style.border = '1px solid rgba(255,102,204,0.3)'; bubble.style.color = '#ffccff'; bubble.style.borderRadius = '20px 20px 20px 4px';
        }

        let text = "[ 復号エラー: 旧形式のデータ、または量子干渉 ]"; 
        let isImage = false;
        
        try { 
            const decrypted = await SecretNexus.decryptData({ cipher: msg.cipher, iv: msg.iv }, this.activeNode.sharedKey); 
            try {
                const parsed = JSON.parse(decrypted);
                if (parsed.type === 'image') { isImage = true; text = parsed.data; } else if (parsed.type === 'text') { text = parsed.text; }
            } catch(e) { text = decrypted; }
        } catch(e) {
            // OperationError 等の復号失敗時は安全にエラーメッセージだけを表示する
            console.warn("メッセージの復号に失敗しました（無視して続行します）");
        }
        
        if (isImage) bubble.innerHTML = `<img src="${text}" style="max-width:100%; border-radius:12px; cursor:pointer;" onclick="window.open('${text}')">`;
        else bubble.innerText = text;
        
        msgRow.appendChild(bubble);
        this.msgContainer.appendChild(msgRow);
    }

    async sendMessage() {
        const text = this.inputField.value.trim();
        if (!text || !this.activeNode) return;
        
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
                    const canvas = document.createElement('canvas'); const MAX_SIZE = 800;
                    let w = img.width; let h = img.height;
                    if (w > h && w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } else if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
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
        } catch(e) { alert("画像の暗号化に失敗しました。"); } 
        finally { this.inputField.placeholder = 'Secure Message... (Shift+Enterで改行)'; }
    }

    async dispatchToNetwork(encrypted) {
        const myId = this.getMyIdentity(); if (!myId) return;
        const myPubStr = JSON.stringify(myId.publicKey);
        const msgObj = { sender: 'me', cipher: encrypted.cipher, iv: encrypted.iv, timestamp: Date.now() };
        
        if (!this.activeNode.channelId || !db) {
            if (!this.activeNode.messages) this.activeNode.messages = [];
            this.activeNode.messages.push(msgObj); this.app.autoSave();
            await this.renderMessageObj(msgObj); this.scrollToBottom(); return;
        }

        try {
            const channelRef = doc(db, "nexus_channels", this.activeNode.channelId);
            await setDoc(channelRef, { participants: [myPubStr, JSON.stringify(this.activeNode.peerPublicKey)], updatedAt: serverTimestamp() }, { merge: true });

            const messagesRef = collection(db, "nexus_channels", this.activeNode.channelId, "messages");
            await addDoc(messagesRef, { cipher: encrypted.cipher, iv: encrypted.iv, senderPubKey: myPubStr, timestamp: serverTimestamp() });
        } catch (e) {
            if (!this.activeNode.messages) this.activeNode.messages = [];
            this.activeNode.messages.push(msgObj); this.app.autoSave();
            await this.renderMessageObj(msgObj); this.scrollToBottom();
        }
    }

    scrollToBottom() { setTimeout(() => { this.msgContainer.scrollTop = this.msgContainer.scrollHeight; }, 50); }
}