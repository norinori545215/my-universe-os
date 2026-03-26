// src/ui/NexusChatUI.js
import { SecretNexus } from '../security/SecretNexus.js';
import { db } from '../security/Auth.js';
import { collection, doc, setDoc, updateDoc, addDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class NexusChatUI {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.activeNode = null;
        this.unsubscribeNetwork = null;
        this.unsubscribeTyping = null; // タイピング検知用
        this.typingTimer = null;
        
        this.mediaRecorder = null;
        this.audioChunks = [];

        this.createUI();
        
        setTimeout(() => this.startGlobalInboxListener(), 2000);
    }

    getMyIdentity() {
        try {
            const saved = localStorage.getItem('universe_nexus_identity');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
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
                        const newNode = this.app.currentUniverse.addNode('Secure Channel', 0, 0, 30, '#ff00ff', 'star');
                        newNode.peerPublicKey = peerPubObj;
                        newNode.channelId = channelId;
                        newNode.name = "Nexus Channel";
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
        this.panel.style.cssText = 'position:fixed; top:0; right:-620px; width:100%; max-width:600px; height:100%; background:rgba(10,15,20,0.95); border-left:1px solid #ff00ff; z-index:99998; display:flex; flex-direction:column; transition:right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow:-10px 0 30px rgba(255,0,255,0.1); backdrop-filter:blur(15px); pointer-events:auto; font-family:sans-serif; color:white; overflow:hidden;';
        document.body.appendChild(this.panel);

        const header = document.createElement('div');
        header.style.cssText = 'padding:15px 20px; border-bottom:1px solid rgba(255,0,255,0.3); display:flex; justify-content:space-between; align-items:center; background:linear-gradient(90deg, rgba(255,0,255,0.1) 0%, transparent 100%); flex-shrink:0;';
        header.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><span style="font-size:18px; color:#ff00ff;">📡</span><div style="font-size:16px; font-weight:bold; letter-spacing:2px; color:#ff00ff; text-shadow:0 0 5px #ff00ff;">NEXUS HUB</div></div>`;
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.style.cssText = 'background:transparent; border:none; color:#ff4444; font-size:26px; cursor:pointer; padding:0 10px; line-height:1; transition:0.2s;';
        closeBtn.onclick = () => this.toggle();
        header.appendChild(closeBtn);
        this.panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'display:flex; flex:1; overflow:hidden;';
        this.panel.appendChild(body);

        this.contactList = document.createElement('div');
        this.contactList.style.cssText = 'width:160px; border-right:1px solid rgba(255,0,255,0.2); overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px; display:flex; flex-direction:column; gap:8px; scrollbar-width: none; flex-shrink:0;';
        body.appendChild(this.contactList);

        this.chatArea = document.createElement('div');
        this.chatArea.style.cssText = 'flex:1; display:flex; flex-direction:column; background:rgba(0,0,0,0.5); overflow:hidden; position:relative;';
        body.appendChild(this.chatArea);

        this.chatHeader = document.createElement('div');
        this.chatHeader.style.cssText = 'padding:10px 15px; border-bottom:1px solid rgba(255,0,255,0.2); display:flex; align-items:center; gap:12px; background:rgba(255,0,255,0.03); flex-shrink:0;';
        this.chatArea.appendChild(this.chatHeader);

        this.msgContainer = document.createElement('div');
        this.msgContainer.style.cssText = 'flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:15px; scroll-behavior:smooth;';
        this.chatArea.appendChild(this.msgContainer);

        // ★ タイピングインジケーター（相手が入力中）
        this.typingIndicator = document.createElement('div');
        this.typingIndicator.style.cssText = 'font-size:11px; color:#00ffcc; padding:5px 25px; height:15px; opacity:0; transition:opacity 0.3s; font-family:monospace; position:absolute; bottom:85px; left:0; width:100%; pointer-events:none; background:linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%); text-shadow:0 0 5px #00ffcc;';
        this.typingIndicator.innerText = '🌐 相手が暗号を編集中...';
        this.chatArea.appendChild(this.typingIndicator);

        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'padding:15px; border-top:1px solid rgba(255,0,255,0.2); background:rgba(0,0,0,0.8); flex-shrink:0; display:flex; gap:8px; align-items:flex-end; z-index:10;';
        
        // 📎 画像添付ボタン
        const attachBtn = document.createElement('button');
        attachBtn.innerText = '📎';
        attachBtn.title = '画像暗号化';
        attachBtn.style.cssText = 'background:transparent; border:none; font-size:22px; cursor:pointer; color:#ff00ff; transition:0.2s; padding-bottom:8px; flex-shrink:0;';
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.sendImage(e.target.files[0]);

        // 🎙️ 音声録音ボタン
        this.micBtn = document.createElement('button');
        this.micBtn.innerText = '🎙️';
        this.micBtn.title = '音声暗号化（タップで録音/停止）';
        this.micBtn.style.cssText = 'background:transparent; border:none; font-size:22px; cursor:pointer; color:#00ffcc; transition:0.2s; padding-bottom:8px; flex-shrink:0;';
        this.micBtn.onclick = () => this.toggleVoiceRecord();

        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'flex:1; display:flex; gap:10px; background:rgba(255,0,255,0.05); border:1px solid rgba(255,0,255,0.3); border-radius:15px; padding:8px 10px 8px 15px; transition:0.2s; align-items:flex-end;';
        
        this.inputField = document.createElement('textarea');
        this.inputField.placeholder = 'Secure Message...';
        this.inputField.rows = 1;
        this.inputField.style.cssText = 'flex:1; background:transparent; border:none; color:#fff; padding:0; outline:none; font-size:14px; line-height:1.5; font-family:sans-serif; resize:none; max-height:150px; overflow-y:auto;';
        
        // ★ タイピング検知：文字を打ったらFirebaseにステータスを送る
        this.inputField.addEventListener('input', () => {
            this.inputField.style.height = 'auto';
            this.inputField.style.height = this.inputField.scrollHeight + 'px';

            if(this.activeNode && this.activeNode.channelId && db && this.getMyIdentity()) {
                if(this.typingTimer) clearTimeout(this.typingTimer);
                else {
                    const myPubStr = JSON.stringify(this.getMyIdentity().publicKey);
                    updateDoc(doc(db, "nexus_channels", this.activeNode.channelId), { [`typing.${myPubStr}`]: Date.now() }).catch(()=>{});
                }
                this.typingTimer = setTimeout(() => {
                    this.typingTimer = null;
                }, 2000); // 2秒間入力がなければタイピング判定を消す
            }
        });

        this.inputField.onkeydown = (e) => { 
            if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
        };
        
        const sendBtn = document.createElement('button');
        sendBtn.innerText = '➤';
        sendBtn.style.cssText = 'background:#ff00ff; color:#000; border:none; width:36px; height:36px; border-radius:50%; font-weight:bold; cursor:pointer; font-size:16px; transition:0.2s; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-bottom:1px;';
        sendBtn.onclick = () => this.sendMessage();

        inputContainer.appendChild(attachBtn);
        inputContainer.appendChild(fileInput);
        inputContainer.appendChild(this.micBtn);
        inputWrapper.appendChild(this.inputField);
        inputWrapper.appendChild(sendBtn);
        inputContainer.appendChild(inputWrapper);
        this.chatArea.appendChild(inputContainer);
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.panel.style.right = this.isOpen ? '0px' : '-620px';
        this.triggerTab.style.right = this.isOpen ? '605px' : '20px'; 
        this.triggerTab.style.background = this.isOpen ? 'rgba(255,68,68,0.1)' : 'rgba(0,255,204,0.1)';
        this.triggerTab.style.borderColor = this.isOpen ? '#ff4444' : '#00ffcc';
        this.triggerTab.style.color = this.isOpen ? '#ff4444' : '#00ffcc';
        this.triggerTab.innerHTML = this.isOpen ? '<div style="font-size:24px;">×</div>' : '<div style="transform:rotate(-90deg); white-space:nowrap; margin-top:5px;">NEXUS</div>';
        if (this.isOpen) this.refreshContacts();
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
            this.contactList.innerHTML = '<div style="color:#666; font-size:10px; text-align:center; padding:20px 5px; border:1px dashed #444; border-radius:8px;">NO CHANNELS</div>';
            this.msgContainer.innerHTML = '';
            this.activeNode = null;
            return;
        }

        nexusNodes.forEach(node => {
            const btn = document.createElement('div');
            const isActive = this.activeNode === node;
            btn.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; border:1px solid transparent; cursor:pointer; transition:0.2s; overflow:hidden; ${isActive ? 'background:rgba(255,0,255,0.1); border-color:rgba(255,0,255,0.3);' : ''}`;
            
            const iconWrap = document.createElement('div');
            iconWrap.style.cssText = `width:30px; height:30px; border-radius:50%; overflow:hidden; border:2px solid ${isActive?'#ff00ff':'#444'}; flex-shrink:0; display:flex; justify-content:center; align-items:center; background:#111;`;
            if (node.iconUrl) iconWrap.innerHTML = `<img src="${node.iconUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            else iconWrap.style.background = isActive ? 'radial-gradient(circle, #ff00ff 0%, #111 70%)' : 'radial-gradient(circle, #444 0%, #111 70%)';
            
            const nameEl = document.createElement('div');
            const displayName = node.name.replace('Nexus Channel', 'Channel').replace('Nexus: ', '');
            nameEl.style.cssText = `font-size:12px; color:${isActive?'#fff':'#aaa'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
            nameEl.innerText = '🌌 ' + displayName;
            
            btn.appendChild(iconWrap); btn.appendChild(nameEl);
            btn.onclick = () => this.openChat(node);
            this.contactList.appendChild(btn);
        });

        if (!this.activeNode || !nexusNodes.includes(this.activeNode)) this.openChat(nexusNodes[0]);
    }

    async openChat(node) {
        if (this.unsubscribeNetwork) { this.unsubscribeNetwork(); this.unsubscribeNetwork = null; }
        if (this.unsubscribeTyping) { this.unsubscribeTyping(); this.unsubscribeTyping = null; }

        const myId = this.getMyIdentity();
        if (!node.sharedKey && node.peerPublicKey && myId) {
            try { node.sharedKey = await SecretNexus.deriveSharedSecret(myId.privateKey, node.peerPublicKey); } 
            catch (e) { console.error("鍵の再錬成に失敗", e); }
        }

        this.activeNode = node;
        this.refreshContacts();
        
        const displayName = node.name.replace('Nexus Channel', 'Secure Channel').replace('Nexus: ', '');
        this.chatHeader.innerHTML = `
            <div style="width:36px; height:36px; border-radius:50%; overflow:hidden; border:2px solid #ff00ff; flex-shrink:0; background:#111; display:flex; justify-content:center; align-items:center;">
                ${node.iconUrl ? `<img src="${node.iconUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:radial-gradient(circle, #ff00ff 0%, #111 70%);"></div>`}
            </div>
            <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="font-size:15px; font-weight:bold; color:#fff; letter-spacing:1px;">${displayName}</div>
                <div style="font-size:10px; color:#ff00ff; text-shadow:0 0 5px #ff00ff;">🔐 Hybrid E2EE Secured</div>
            </div>
        `;
        
        this.msgContainer.innerHTML = '';
        if (!node.messages) node.messages = [];
        
        // 既存メッセージの再描画
        for (let msg of node.messages) { await this.renderMessageObj(msg); }
        this.scrollToBottom();

        if (node.peerPublicKey && myId && db) await this.listenToNetwork(node, myId);
    }

    async listenToNetwork(node, myId) {
        try {
            const combined = [JSON.stringify(myId.publicKey), JSON.stringify(node.peerPublicKey)].sort().join('|');
            const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined));
            const channelId = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');
            node.channelId = channelId;
            const myPubStr = JSON.stringify(myId.publicKey);
            const peerPubStr = JSON.stringify(node.peerPublicKey);

            // ★ タイピング状態の監視（チャンネルドキュメント自体を監視）
            this.unsubscribeTyping = onSnapshot(doc(db, "nexus_channels", channelId), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.typing && data.typing[peerPubStr]) {
                        // 相手の最終入力が3秒以内なら「入力中」とみなす
                        if (Date.now() - data.typing[peerPubStr] < 3000) {
                            this.typingIndicator.style.opacity = '1';
                        } else {
                            this.typingIndicator.style.opacity = '0';
                        }
                    }
                }
            });

            // メッセージ自体の監視
            const messagesRef = collection(db, "nexus_channels", channelId, "messages");
            const q = query(messagesRef, orderBy("timestamp", "asc"));

            this.unsubscribeNetwork = onSnapshot(q, async (snapshot) => {
                let isNewRendered = false;

                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    const docId = change.doc.id;

                    if (change.type === "added") {
                        const isDuplicate = node.messages.some(m => m.id === docId);
                        if (!isDuplicate) {
                            const senderType = (data.senderPubKey === myPubStr) ? 'me' : 'peer';
                            const msgObj = { 
                                id: docId, 
                                sender: senderType, 
                                cipher: data.cipher, 
                                iv: data.iv, 
                                timestamp: data.timestamp ? data.timestamp.toMillis() : Date.now(),
                                isDeleted: data.isDeleted || false 
                            };
                            
                            node.messages.push(msgObj);
                            this.renderMessageObj(msgObj);
                            isNewRendered = true;

                            if (senderType === 'peer' && window.universeAudio && this.isOpen) {
                                window.universeAudio.playSystemSound(400, 'triangle', 0.1);
                            }
                        }
                    } 
                    // ★ 送信取り消し（削除フラグ）を受信したときの処理
                    else if (change.type === "modified") {
                        if (data.isDeleted) {
                            const targetMsg = node.messages.find(m => m.id === docId);
                            if (targetMsg && !targetMsg.isDeleted) {
                                targetMsg.isDeleted = true;
                                targetMsg.cipher = "";
                                const domEl = document.getElementById(`msg-${docId}`);
                                if (domEl) {
                                    domEl.innerHTML = '<div style="font-size:12px; color:#666; font-style:italic; padding:10px; border:1px dashed #444; border-radius:8px;">🚫 空間から通信記録が消去されました</div>';
                                }
                            }
                        }
                    }
                });

                if (isNewRendered) { this.app.autoSave(); this.scrollToBottom(); }
            });
        } catch (e) { console.error("ワームホールエラー", e); }
    }

    async renderMessageObj(msg) {
        const isMe = msg.sender === 'me';
        
        // メッセージ全体のラッパー。IDを付与して後から「送信取消」でDOMを書き換えられるようにする
        const wrapper = document.createElement('div');
        wrapper.id = `msg-${msg.id}`;
        wrapper.style.cssText = `display:flex; width:100%; justify-content:${isMe ? 'flex-end' : 'flex-start'}; align-items:flex-end; gap:10px; position:relative;`;
        
        // ★ 削除済みのメッセージの場合の描画
        if (msg.isDeleted) {
            wrapper.innerHTML = '<div style="font-size:12px; color:#666; font-style:italic; padding:10px; border:1px dashed #444; border-radius:8px;">🚫 空間から通信記録が消去されました</div>';
            this.msgContainer.appendChild(wrapper);
            return;
        }

        // アイコン（相手のみ）
        if (!isMe) {
            const peerIcon = document.createElement('div');
            peerIcon.style.cssText = `width:28px; height:28px; border-radius:50%; overflow:hidden; border:1px solid rgba(255,0,255,0.5); flex-shrink:0; background:#111; display:flex; justify-content:center; align-items:center;`;
            if (this.activeNode.iconUrl) peerIcon.innerHTML = `<img src="${this.activeNode.iconUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            else peerIcon.style.background = 'radial-gradient(circle, #ff00ff 0%, #111 70%)';
            wrapper.appendChild(peerIcon);
        }

        // 時間と削除ボタンを入れるコンテナ
        const metaContainer = document.createElement('div');
        metaContainer.style.cssText = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom:5px; opacity:0.6;`;

        // ★ タイムスタンプ
        const timeDate = new Date(msg.timestamp);
        const timeStr = `${timeDate.getHours().toString().padStart(2,'0')}:${timeDate.getMinutes().toString().padStart(2,'0')}`;
        const timeEl = document.createElement('div');
        timeEl.innerText = timeStr;
        timeEl.style.cssText = `font-size:10px; color:#aaa; font-family:monospace; margin-${isMe ? 'right' : 'left'}:5px;`;
        
        // ★ 送信取り消しボタン（自分のみ、24時間以内）
        const timeDiff = Date.now() - msg.timestamp;
        if (isMe && timeDiff < 24 * 60 * 60 * 1000) {
            const delBtn = document.createElement('div');
            delBtn.innerText = '🗑️ 消去';
            delBtn.style.cssText = 'font-size:9px; color:#ff4444; cursor:pointer; margin-top:3px; margin-right:5px; transition:0.2s;';
            delBtn.onmouseover = () => delBtn.style.textShadow = '0 0 5px #ff4444';
            delBtn.onmouseout = () => delBtn.style.textShadow = 'none';
            delBtn.onclick = async () => {
                if(confirm('このメッセージを空間から完全に消去しますか？（相手の画面からも消えます）')) {
                    if(!msg.id) return alert("ローカルの未同期メッセージです。リロード後に実行してください。");
                    try {
                        const docRef = doc(db, "nexus_channels", this.activeNode.channelId, "messages", msg.id);
                        await updateDoc(docRef, { isDeleted: true, cipher: "", iv: "" });
                    } catch(e) { alert("消去に失敗しました"); }
                }
            };
            metaContainer.appendChild(timeEl);
            metaContainer.appendChild(delBtn);
        } else {
            metaContainer.appendChild(timeEl);
        }

        const bubble = document.createElement('div');
        bubble.style.cssText = `max-width:70%; padding:12px 16px; font-size:14px; line-height:1.6; word-break:break-all; box-shadow:0 4px 15px rgba(0,0,0,0.5); white-space:pre-wrap;`;
        
        if (isMe) {
            bubble.style.background = 'linear-gradient(135deg, rgba(0,255,204,0.15) 0%, rgba(0,204,255,0.05) 100%)';
            bubble.style.border = '1px solid rgba(0,255,204,0.3)'; bubble.style.color = '#ccffff'; bubble.style.borderRadius = '16px 16px 4px 16px';
        } else {
            bubble.style.background = 'linear-gradient(135deg, rgba(255,0,255,0.1) 0%, rgba(255,102,204,0.05) 100%)';
            bubble.style.border = '1px solid rgba(255,102,204,0.3)'; bubble.style.color = '#ffccff'; bubble.style.borderRadius = '16px 16px 16px 4px';
        }

        let text = "[ 復号エラー: 鍵不一致 ]"; 
        let isImage = false;
        let isVoice = false;
        
        try { 
            const decrypted = await SecretNexus.decryptData({ cipher: msg.cipher, iv: msg.iv }, this.activeNode.sharedKey); 
            try {
                const parsed = JSON.parse(decrypted);
                if (parsed.type === 'image') { isImage = true; text = parsed.data; } 
                else if (parsed.type === 'voice') { isVoice = true; text = parsed.data; }
                else if (parsed.type === 'text') { text = parsed.text; }
            } catch(e) { text = decrypted; }
        } catch(e) {}
        
        // ペイロードに応じた描画
        if (isImage) {
            bubble.innerHTML = `<img src="${text}" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="window.open('${text}')">`;
        } else if (isVoice) {
            // 暗号化された音声を再生するカスタムオーディオ
            bubble.innerHTML = `<div style="font-size:10px; color:#00ffcc; margin-bottom:5px;">🎙️ Encrypted Voice Memo</div><audio src="${text}" controls style="height:35px; max-width:200px; outline:none; filter:invert(1) hue-rotate(180deg);"></audio>`;
        } else {
            bubble.innerText = text;
        }
        
        if(isMe) { wrapper.appendChild(metaContainer); wrapper.appendChild(bubble); }
        else { wrapper.appendChild(bubble); wrapper.appendChild(metaContainer); }
        
        this.msgContainer.appendChild(wrapper);
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

    // ★ 🎙️ 音声録音機能のトグル
    async toggleVoiceRecord() {
        if (!this.activeNode) return;

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            // 録音停止して送信
            this.mediaRecorder.stop();
            this.micBtn.innerText = '🎙️';
            this.micBtn.style.color = '#00ffcc';
            this.micBtn.style.textShadow = 'none';
        } else {
            // 録音開始
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];
                
                this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
                
                this.mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        const base64Audio = reader.result;
                        this.inputField.placeholder = 'Encrypting Voice...';
                        try {
                            const payload = JSON.stringify({ type: 'voice', data: base64Audio });
                            const encrypted = await SecretNexus.encryptData(payload, this.activeNode.sharedKey);
                            await this.dispatchToNetwork(encrypted);
                        } catch(e) { alert("音声の暗号化に失敗"); }
                        finally { this.inputField.placeholder = 'Secure Message...'; }
                    };
                    reader.readAsDataURL(audioBlob);
                    stream.getTracks().forEach(t => t.stop()); // マイク解放
                };
                
                this.mediaRecorder.start();
                this.micBtn.innerText = '🔴';
                this.micBtn.style.color = '#ff4444';
                this.micBtn.style.textShadow = '0 0 10px #ff4444';
                this.inputField.placeholder = 'Recording... (タップで送信)';
            } catch(e) {
                alert("マイクのアクセスが許可されていません。");
            }
        }
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
        finally { this.inputField.placeholder = 'Secure Message...'; }
    }

    async dispatchToNetwork(encrypted) {
        const myId = this.getMyIdentity(); if (!myId) return;
        const myPubStr = JSON.stringify(myId.publicKey);
        
        // オフライン用（Firestore未接続時）
        if (!this.activeNode.channelId || !db) {
            const msgObj = { id: "", sender: 'me', cipher: encrypted.cipher, iv: encrypted.iv, timestamp: Date.now() };
            if (!this.activeNode.messages) this.activeNode.messages = [];
            this.activeNode.messages.push(msgObj); this.app.autoSave();
            await this.renderMessageObj(msgObj); this.scrollToBottom(); return;
        }

        try {
            const channelRef = doc(db, "nexus_channels", this.activeNode.channelId);
            await setDoc(channelRef, { participants: [myPubStr, JSON.stringify(this.activeNode.peerPublicKey)], updatedAt: serverTimestamp() }, { merge: true });

            const messagesRef = collection(db, "nexus_channels", this.activeNode.channelId, "messages");
            await addDoc(messagesRef, { cipher: encrypted.cipher, iv: encrypted.iv, senderPubKey: myPubStr, timestamp: serverTimestamp(), isDeleted: false });
        } catch (e) {}
    }

    scrollToBottom() { setTimeout(() => { this.msgContainer.scrollTop = this.msgContainer.scrollHeight; }, 50); }
}