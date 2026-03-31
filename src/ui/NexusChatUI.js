// src/ui/NexusChatUI.js
import { SecretNexus } from '../security/SecretNexus.js';
import { db } from '../security/Auth.js';
import { collection, doc, setDoc, updateDoc, addDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class NexusChatUI {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.isContactListOpen = false;
        this.activeNode = null;
        this.unsubscribeNetwork = null;
        this.unsubscribeTyping = null; 
        this.typingTimer = null;
        
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.unreadChannels = new Set(); 

        this.editingMsgId = null;
        this.replyToMsg = null;
        this.isPhantomMode = false; // ★ 追加：ファントムモード状態

        this.createUI();
        
        setTimeout(() => this.startGlobalInboxListener(), 2000);

        window.addEventListener('resize', () => this.handleResize());
    }

    getMyIdentity() {
        try {
            const saved = localStorage.getItem('universe_nexus_identity');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    }

    getShortId(pubKeyObj) {
        if (!pubKeyObj) return "UNKNOWN";
        const str = JSON.stringify(pubKeyObj);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return `NX-${Math.abs(hash).toString(16).substring(0, 6).toUpperCase()}`;
    }

    async startGlobalInboxListener() {
        if (!db) return;
        const myId = this.getMyIdentity();
        if (!myId) return;

        const myPubStr = JSON.stringify(myId.publicKey);
        const myShortId = this.getShortId(myId.publicKey);
        const channelsRef = collection(db, "nexus_channels");
        const q = query(channelsRef, where("participants", "array-contains", myPubStr));

        onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const channelData = change.doc.data();
                const channelId = change.doc.id;

                const myLastRead = (channelData.lastRead && channelData.lastRead[myShortId]) ? channelData.lastRead[myShortId] : 0;
                const lastUpdated = channelData.updatedAt ? channelData.updatedAt.toMillis() : 0;
                
                if (lastUpdated > myLastRead && (!this.isOpen || this.activeNode?.channelId !== channelId)) {
                    this.unreadChannels.add(channelId);
                    if(this.isOpen) this.refreshContacts();
                }

                if (change.type === "added") {
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
                        const shortId = this.getShortId(peerPubObj);
                        
                        const newNode = this.app.currentUniverse.addNode(`User ${shortId}`, 0, 0, 30, '#ff00ff', 'star');
                        newNode.peerPublicKey = peerPubObj;
                        newNode.channelId = channelId;
                        newNode.messages = [];
                        
                        this.app.autoSave();
                        if(window.universeAudio) window.universeAudio.playWarp();
                        if(this.isOpen) this.refreshContacts();
                    }
                }
            });
        }, (err) => {
            if (!navigator.onLine || err.code === 'permission-denied') {
                console.log("🛰️ [Stealth Mode] 圏外のため、着信レーダーを一時停止しています。");
            } else {
                console.warn("Inbox Listener Error:", err);
            }
        });
    }

    createUI() {
        if (!document.getElementById('nexus-chat-styles')) {
            const style = document.createElement('style');
            style.id = 'nexus-chat-styles';
            style.innerHTML = `
                .nexus-scroll::-webkit-scrollbar { width: 6px; }
                .nexus-scroll::-webkit-scrollbar-track { background: transparent; }
                .nexus-scroll::-webkit-scrollbar-thumb { background: rgba(255, 0, 255, 0.2); border-radius: 10px; }
                .nexus-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 0, 255, 0.5); }
                .nexus-input-scroll::-webkit-scrollbar { width: 4px; }
                .nexus-input-scroll::-webkit-scrollbar-thumb { background: rgba(0, 255, 204, 0.3); border-radius: 10px; }
                
                .nexus-contact-panel { width: 160px; border-right: 1px solid rgba(255,0,255,0.2); transition: 0.3s; z-index: 10; }
                .nexus-menu-btn { display: none; background: transparent; border: none; color: #ff00ff; font-size: 24px; cursor: pointer; margin-right: 10px; padding: 0 5px; }
                
                /* ★ ファントムモード時の紫色の脈動アニメーション */
                @keyframes phantom-pulse { 0% { box-shadow: 0 0 5px rgba(255,0,255,0.5); } 50% { box-shadow: 0 0 18px #ff00ff; } 100% { box-shadow: 0 0 5px rgba(255,0,255,0.5); } }

                @media (max-width: 600px) {
                    .nexus-contact-panel { position: absolute; left: -200px; height: 100%; background: rgba(10,15,20,0.98) !important; box-shadow: 5px 0 20px rgba(0,0,0,0.8); }
                    .nexus-contact-panel.open { left: 0; }
                    .nexus-menu-btn { display: block; }
                }
            `;
            document.head.appendChild(style);
        }

        this.triggerTab = document.createElement('div');
        this.triggerTab.style.cssText = 'position:fixed; top:50%; right:20px; transform:translateY(-50%); width:30px; height:80px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; border-radius:15px; z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#00ffcc; cursor:pointer; box-shadow:0 0 20px rgba(0,255,204,0.3); backdrop-filter:blur(5px); font-weight:bold; transition:all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); font-size:18px; letter-spacing:2px;';
        this.triggerTab.innerHTML = '<div style="transform:rotate(-90deg); white-space:nowrap; margin-top:5px;">NEXUS</div>';
        this.triggerTab.onmouseover = () => { if(!this.isOpen) this.triggerTab.style.background = 'rgba(0,255,204,0.3)'; };
        this.triggerTab.onmouseout = () => { if(!this.isOpen) this.triggerTab.style.background = 'rgba(0,255,204,0.1)'; };
        this.triggerTab.onclick = () => this.toggle();
        document.body.appendChild(this.triggerTab);

        this.panel = document.createElement('div');
        this.panel.style.cssText = 'position:fixed; top:0; right:-100%; width:100%; max-width:600px; height:100%; background:rgba(10,15,20,0.95); border-left:1px solid #ff00ff; z-index:99998; display:flex; flex-direction:column; transition:right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow:-10px 0 30px rgba(255,0,255,0.1); backdrop-filter:blur(15px); pointer-events:auto; font-family:sans-serif; color:white; overflow:hidden;';
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
        body.style.cssText = 'display:flex; flex:1; overflow:hidden; position:relative;';
        this.panel.appendChild(body);

        this.contactList = document.createElement('div');
        this.contactList.className = 'nexus-scroll nexus-contact-panel';
        this.contactList.style.cssText = 'overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px; display:flex; flex-direction:column; gap:8px; flex-shrink:0;';
        body.appendChild(this.contactList);

        this.chatArea = document.createElement('div');
        this.chatArea.style.cssText = 'flex:1; display:flex; flex-direction:column; background:rgba(0,0,0,0.6); overflow:hidden; position:relative; width:100%;';
        
        this.mobileOverlay = document.createElement('div');
        this.mobileOverlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9; display:none; backdrop-filter:blur(2px);';
        this.mobileOverlay.onclick = () => this.toggleContactList(false);
        this.chatArea.appendChild(this.mobileOverlay);
        
        body.appendChild(this.chatArea);

        this.chatHeader = document.createElement('div');
        this.chatHeader.style.cssText = 'padding:12px 20px; border-bottom:1px solid rgba(255,0,255,0.2); display:flex; align-items:center; background:rgba(0,0,0,0.4); flex-shrink:0; box-shadow:0 4px 15px rgba(0,0,0,0.2); z-index:5;';
        this.chatArea.appendChild(this.chatHeader);

        this.msgContainer = document.createElement('div');
        this.msgContainer.className = 'nexus-scroll';
        this.msgContainer.style.cssText = 'flex:1; overflow-y:auto; padding:20px 25px; display:flex; flex-direction:column; gap:20px; scroll-behavior:smooth;';
        this.chatArea.appendChild(this.msgContainer);

        this.typingIndicator = document.createElement('div');
        this.typingIndicator.style.cssText = 'font-size:11px; color:#00ffcc; padding:8px 25px; opacity:0; transition:opacity 0.3s; font-family:monospace; position:absolute; bottom:80px; left:0; width:100%; pointer-events:none; background:linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%); text-shadow:0 0 5px #00ffcc; z-index:10;';
        this.typingIndicator.innerText = '🌐 相手が暗号を編集中...';
        this.chatArea.appendChild(this.typingIndicator);

        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'padding:10px 15px; border-top:1px solid rgba(0,255,204,0.2); background:rgba(10,15,20,0.95); flex-shrink:0; display:flex; align-items:flex-end; gap:8px; z-index:15;';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
        fileInput.onchange = (e) => this.sendImage(e.target.files[0]);

        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'flex:1; display:flex; align-items:flex-end; background:rgba(0,0,0,0.4); border:1px solid rgba(0,255,204,0.3); border-radius:24px; padding:6px 6px 6px 10px; transition:0.3s; box-shadow:inset 0 2px 10px rgba(0,0,0,0.5);';

        const attachBtn = document.createElement('button');
        attachBtn.innerText = '📎';
        attachBtn.style.cssText = 'background:transparent; border:none; font-size:18px; cursor:pointer; color:#00ffcc; transition:0.2s; padding:6px; margin-right:2px; flex-shrink:0; outline:none;';
        attachBtn.onclick = () => fileInput.click();

        this.micBtn = document.createElement('button');
        this.micBtn.innerText = '🎙️';
        this.micBtn.style.cssText = 'background:transparent; border:none; font-size:18px; cursor:pointer; color:#00ffcc; transition:0.2s; padding:6px; margin-right:2px; flex-shrink:0; outline:none;';
        this.micBtn.onclick = () => this.toggleVoiceRecord();

        // ★ Phase 2: ファントムモード・トグルボタン
        this.phantomBtn = document.createElement('button');
        this.phantomBtn.innerText = '👻';
        this.phantomBtn.title = '自己消滅モード (Phantom Protocol)';
        this.phantomBtn.style.cssText = 'background:transparent; border:none; font-size:18px; cursor:pointer; color:#888; transition:0.2s; padding:6px; margin-right:2px; flex-shrink:0; outline:none; filter:grayscale(1);';
        this.phantomBtn.onclick = () => {
            this.isPhantomMode = !this.isPhantomMode;
            if (this.isPhantomMode) {
                this.phantomBtn.style.color = '#ff00ff';
                this.phantomBtn.style.filter = 'drop-shadow(0 0 5px #ff00ff)';
                this.inputField.placeholder = '👻 Phantom Message (10秒で消滅)...';
                inputWrapper.style.borderColor = '#ff00ff';
            } else {
                this.phantomBtn.style.color = '#888';
                this.phantomBtn.style.filter = 'grayscale(1)';
                this.inputField.placeholder = 'Secure Message...';
                inputWrapper.style.borderColor = 'rgba(0,255,204,0.3)';
            }
        };

        this.actionCancelBtn = document.createElement('button');
        this.actionCancelBtn.innerHTML = '✖';
        this.actionCancelBtn.title = 'キャンセル';
        this.actionCancelBtn.style.cssText = 'display:none; background:transparent; border:none; color:#ff4444; font-size:16px; cursor:pointer; margin-right:5px; padding:4px;';
        this.actionCancelBtn.onclick = () => this.cancelAction();

        this.inputField = document.createElement('textarea');
        this.inputField.className = 'nexus-input-scroll';
        this.inputField.placeholder = 'Secure Message...';
        this.inputField.rows = 1;
        this.inputField.style.cssText = 'flex:1; background:transparent; border:none; color:#fff; padding:6px 0; outline:none; font-size:14px; line-height:1.5; font-family:sans-serif; resize:none; max-height:100px; overflow-y:auto; margin-right:5px; width:100%;';
        
        this.inputField.addEventListener('input', () => {
            this.inputField.style.height = 'auto';
            this.inputField.style.height = Math.min(this.inputField.scrollHeight, 100) + 'px';

            if(this.activeNode && this.activeNode.channelId && db && this.getMyIdentity()) {
                if(this.typingTimer) clearTimeout(this.typingTimer);
                else {
                    const myShortId = this.getShortId(this.getMyIdentity().publicKey);
                    updateDoc(doc(db, "nexus_channels", this.activeNode.channelId), { [`typing.${myShortId}`]: Date.now() }).catch(()=>{});
                }
                this.typingTimer = setTimeout(() => { this.typingTimer = null; }, 2000);
            }
        });

        this.inputField.onkeydown = (e) => { 
            if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
        };
        
        this.inputField.onfocus = () => { if(!this.isPhantomMode) inputWrapper.style.borderColor = '#00ffcc'; };
        this.inputField.onblur = () => { if(!this.isPhantomMode) inputWrapper.style.borderColor = 'rgba(0,255,204,0.3)'; };
        
        const sendBtn = document.createElement('button');
        sendBtn.innerHTML = '➤';
        sendBtn.style.cssText = 'background:linear-gradient(135deg, #00ffcc 0%, #00ccff 100%); color:#000; border:none; width:34px; height:34px; border-radius:50%; font-weight:bold; cursor:pointer; font-size:16px; transition:0.3s; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 0 10px rgba(0,255,204,0.3); outline:none;';
        sendBtn.onmouseover = () => { sendBtn.style.transform = 'scale(1.1)'; sendBtn.style.boxShadow = '0 0 15px rgba(0,255,204,0.6)'; };
        sendBtn.onmouseout = () => { sendBtn.style.transform = 'scale(1)'; sendBtn.style.boxShadow = '0 0 10px rgba(0,255,204,0.3)'; };
        sendBtn.onclick = () => this.sendMessage();

        inputContainer.appendChild(fileInput);
        inputWrapper.appendChild(attachBtn);
        inputWrapper.appendChild(this.micBtn);
        inputWrapper.appendChild(this.phantomBtn); // ★追加
        inputWrapper.appendChild(this.actionCancelBtn); 
        inputWrapper.appendChild(this.inputField);
        inputWrapper.appendChild(sendBtn);
        inputContainer.appendChild(inputWrapper);
        this.chatArea.appendChild(inputContainer);
        
        this.handleResize();
    }

    handleResize() {
        if (window.innerWidth > 600) {
            this.contactList.classList.remove('open');
            this.mobileOverlay.style.display = 'none';
        } else {
            if (this.isContactListOpen) this.mobileOverlay.style.display = 'block';
        }
    }

    toggleContactList(forceState = null) {
        if (window.innerWidth > 600) return; 
        this.isContactListOpen = forceState !== null ? forceState : !this.isContactListOpen;
        if (this.isContactListOpen) {
            this.contactList.classList.add('open');
            this.mobileOverlay.style.display = 'block';
        } else {
            this.contactList.classList.remove('open');
            this.mobileOverlay.style.display = 'none';
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.panel.style.right = this.isOpen ? '0px' : '-100%';
        this.triggerTab.style.right = this.isOpen ? (window.innerWidth > 600 ? '605px' : 'calc(100% - 30px)') : '20px'; 
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
            this.contactList.innerHTML = '<div style="color:#666; font-size:10px; text-align:center; padding:20px 5px;">NO CHANNELS</div>';
            this.chatHeader.innerHTML = '';
            this.msgContainer.innerHTML = '';
            this.activeNode = null;
            return;
        }

        nexusNodes.forEach(node => {
            const btn = document.createElement('div');
            const isActive = this.activeNode === node;
            const isUnread = node.channelId && this.unreadChannels.has(node.channelId);
            
            btn.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; border:1px solid transparent; cursor:pointer; transition:0.3s; overflow:hidden; position:relative; ${isActive ? 'background:rgba(255,0,255,0.15); border-color:rgba(255,0,255,0.4);' : ''}`;
            
            const iconWrap = document.createElement('div');
            iconWrap.style.cssText = `width:36px; height:36px; border-radius:50%; overflow:hidden; border:2px solid ${isActive?'#ff00ff':'#444'}; flex-shrink:0; display:flex; justify-content:center; align-items:center; background:#111; transition:0.3s;`;
            if (node.iconUrl) iconWrap.innerHTML = `<img src="${node.iconUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            else iconWrap.style.background = isActive ? 'radial-gradient(circle, #ff00ff 0%, #111 70%)' : 'radial-gradient(circle, #444 0%, #111 70%)';
            
            const nameEl = document.createElement('div');
            nameEl.style.cssText = `font-size:13px; font-weight:${(isActive || isUnread)?'bold':'normal'}; color:${isActive?'#fff':(isUnread?'#ff00ff':'#aaa')}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
            nameEl.innerText = node.name;
            
            btn.appendChild(iconWrap); btn.appendChild(nameEl);

            if (isUnread && !isActive) {
                const badge = document.createElement('div');
                badge.style.cssText = 'position:absolute; right:10px; width:10px; height:10px; background:#ff4444; border-radius:50%; box-shadow:0 0 10px #ff4444;';
                btn.appendChild(badge);
            }

            btn.onclick = () => {
                this.openChat(node);
                this.toggleContactList(false);
            };
            this.contactList.appendChild(btn);
        });

        if (!this.activeNode || !nexusNodes.includes(this.activeNode)) this.openChat(nexusNodes[0]);
    }

    async openChat(node) {
        if (this.unsubscribeNetwork) { this.unsubscribeNetwork(); this.unsubscribeNetwork = null; }
        if (this.unsubscribeTyping) { this.unsubscribeTyping(); this.unsubscribeTyping = null; }

        this.cancelAction();

        const myId = this.getMyIdentity();
        if (!node.sharedKey && node.peerPublicKey && myId) {
            try { node.sharedKey = await SecretNexus.deriveSharedSecret(myId.privateKey, node.peerPublicKey); } 
            catch (e) { console.error("鍵の再錬成に失敗", e); }
        }

        this.activeNode = node;
        if(node.channelId) this.unreadChannels.delete(node.channelId); 
        this.refreshContacts();
        
        const shortId = this.getShortId(node.peerPublicKey);
        
        this.chatHeader.innerHTML = `
            <button class="nexus-menu-btn" onclick="document.dispatchEvent(new CustomEvent('nexusToggleMenu'))">≡</button>
            <div id="nx-header-icon" title="アイコン画像を設定" style="width:40px; height:40px; border-radius:50%; overflow:hidden; border:2px solid #ff00ff; flex-shrink:0; background:#111; display:flex; justify-content:center; align-items:center; box-shadow:0 0 10px rgba(255,0,255,0.3); cursor:pointer; transition:0.2s;">
                ${node.iconUrl ? `<img src="${node.iconUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:radial-gradient(circle, #ff00ff 0%, #111 70%);"></div>`}
            </div>
            <div style="display:flex; flex-direction:column; gap:2px; flex:1; overflow:hidden;">
                <div id="nx-header-name" title="相手の名前を変更" style="font-size:15px; font-weight:bold; color:#fff; letter-spacing:1px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:0.2s;">
                    ${node.name} <span style="font-size:10px; opacity:0.5;">✏️</span>
                </div>
                <div style="font-size:10px; color:#ff00ff; font-family:monospace;">ID: ${shortId} | 🔐 E2EE</div>
            </div>
            <button id="nx-header-wipe" title="全通信記録を完全消去" style="background:transparent; border:1px solid #ff4444; color:#ff4444; border-radius:6px; font-size:14px; cursor:pointer; padding:5px 10px; margin-left:10px; font-weight:bold; transition:0.2s; white-space:nowrap;">🔥 焼却</button>
        `;

        document.addEventListener('nexusToggleMenu', () => this.toggleContactList(), { once: true });

        document.getElementById('nx-header-name').onmouseover = (e) => e.currentTarget.style.color = '#ff00ff';
        document.getElementById('nx-header-name').onmouseout = (e) => e.currentTarget.style.color = '#fff';
        document.getElementById('nx-header-name').onclick = () => {
            const newName = prompt("この通信相手の名前を入力してください:", node.name);
            if (newName && newName.trim() !== "") {
                node.name = newName.trim(); this.app.autoSave(); this.openChat(node);
            }
        };

        document.getElementById('nx-header-icon').onmouseover = (e) => e.currentTarget.style.transform = 'scale(1.1)';
        document.getElementById('nx-header-icon').onmouseout = (e) => e.currentTarget.style.transform = 'scale(1)';
        document.getElementById('nx-header-icon').onclick = () => {
            const url = prompt("相手のアイコン画像のURLを入力してください:", node.iconUrl || "");
            if (url !== null) {
                node.iconUrl = url.trim(); this.app.autoSave(); this.openChat(node);
            }
        };

        const wipeBtn = document.getElementById('nx-header-wipe');
        wipeBtn.onmouseover = () => { wipeBtn.style.background = 'rgba(255,68,68,0.2)'; wipeBtn.style.boxShadow = '0 0 10px rgba(255,68,68,0.5)'; };
        wipeBtn.onmouseout = () => { wipeBtn.style.background = 'transparent'; wipeBtn.style.boxShadow = 'none'; };
        wipeBtn.onclick = async () => {
            if(confirm('【警告】表示されている通信記録を完全に焼却(Wipe)しますか？\n※自分と相手の画面から物理的にデータが消滅します。')) {
                if(!this.activeNode || !this.activeNode.messages) return;
                const msgs = [...this.activeNode.messages];
                let count = 0;
                wipeBtn.innerText = '処理中...';
                
                for(let msg of msgs) {
                    if(msg.id) {
                        try {
                            await deleteDoc(doc(db, "nexus_channels", this.activeNode.channelId, "messages", msg.id));
                            count++;
                        } catch(e) {}
                    }
                }
                
                this.activeNode.messages = [];
                this.msgContainer.innerHTML = '';
                this.app.autoSave();
                
                wipeBtn.innerText = '🔥 焼却';
                if(count > 0 || msgs.length > 0) alert(`通信記録を跡形もなく灰にしました。`);
            }
        };
        
        this.msgContainer.innerHTML = '';
        if (!node.messages) node.messages = [];
        
        for (let msg of node.messages) {
            await this.renderMessageObj(msg);
        }
        this.scrollToBottom();
        
        if (node.peerPublicKey && myId && db) await this.listenToNetwork(node, myId);
    }

    updateReadReceipts(peerLastRead) {
        if (!this.activeNode || !this.activeNode.messages) return;
        this.activeNode.messages.forEach(msg => {
            if (msg.sender === 'me' && !msg.isDeleted && msg.timestamp <= peerLastRead) {
                const readEl = document.getElementById(`read-${msg.id}`);
                if (readEl) readEl.style.opacity = '1';

                // ★ 送信者側のファントム溶解カウントダウン
                if (msg.phantom && !msg.phantomTimerStarted) {
                    msg.phantomTimerStarted = true;
                    const timerEl = document.getElementById(`phantom-timer-${msg.id}`);
                    if (timerEl) {
                        let timeLeft = 10;
                        const countdown = setInterval(async () => {
                            timeLeft--;
                            if (timeLeft > 0) timerEl.innerText = `👻 溶解まで: ${timeLeft}秒`;
                            else {
                                clearInterval(countdown);
                                timerEl.innerText = '💥 消滅済';
                                try { await deleteDoc(doc(db, "nexus_channels", this.activeNode.channelId, "messages", msg.id)); } catch(e){}
                            }
                        }, 1000);
                    }
                }
            }
        });
    }

    startReply(msgId, textStr) {
        if (!textStr) textStr = "Media";
        this.replyToMsg = { id: msgId, text: textStr };
        this.editingMsgId = null;
        this.actionCancelBtn.style.display = 'block';
        this.inputField.placeholder = `↩️ 返信: ${textStr.substring(0, 15)}...`;
        this.inputField.focus();
    }

    startEdit(msgId, textStr) {
        this.editingMsgId = msgId;
        this.replyToMsg = null;
        this.actionCancelBtn.style.display = 'block';
        this.inputField.value = textStr;
        this.inputField.placeholder = `✏️ メッセージを編集...`;
        this.inputField.focus();
    }

    cancelAction() {
        this.editingMsgId = null;
        this.replyToMsg = null;
        if(this.actionCancelBtn) this.actionCancelBtn.style.display = 'none';
        if(this.inputField) {
            this.inputField.value = '';
            this.inputField.placeholder = this.isPhantomMode ? '👻 Phantom Message (10秒で消滅)...' : 'Secure Message...';
        }
    }

    // ★ リアクションの表示メニュー
    showReactionMenu(msgId, x, y) {
        const existing = document.getElementById('nx-react-menu');
        if(existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'nx-react-menu';
        menu.style.cssText = `position:fixed; left:${Math.min(x, window.innerWidth-180)}px; top:${Math.max(0, y-50)}px; background:rgba(10,15,20,0.95); border:1px solid #00ffcc; border-radius:20px; padding:8px 12px; display:flex; gap:10px; z-index:10000; box-shadow:0 5px 15px rgba(0,0,0,0.5); backdrop-filter:blur(10px);`;

        const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
        emojis.forEach(em => {
            const b = document.createElement('div');
            b.innerText = em;
            b.style.cssText = 'font-size:20px; cursor:pointer; transition:0.2s;';
            b.onmouseover = () => b.style.transform = 'scale(1.3)';
            b.onmouseout = () => b.style.transform = 'scale(1)';
            b.onclick = () => { this.toggleReaction(msgId, em); document.getElementById('nx-react-overlay')?.remove(); menu.remove(); };
            menu.appendChild(b);
        });

        const overlay = document.createElement('div');
        overlay.id = 'nx-react-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:9999;';
        overlay.onclick = () => { menu.remove(); overlay.remove(); };
        document.body.appendChild(overlay);
        document.body.appendChild(menu);
    }

    // ★ リアクションの書き込み（トグル）
    async toggleReaction(msgId, emoji) {
        if (!this.activeNode || !this.activeNode.channelId) return;
        const myShortId = this.getShortId(this.getMyIdentity().publicKey);
        const localMsg = this.activeNode.messages.find(m => m.id === msgId);
        if(!localMsg) return;
        
        const currentReaction = localMsg.reactions ? localMsg.reactions[myShortId] : null;
        let newReaction = (currentReaction === emoji) ? null : emoji;
        
        try {
            await updateDoc(doc(db, "nexus_channels", this.activeNode.channelId, "messages", msgId), {
                [`reactions.${myShortId}`]: newReaction
            });
        } catch(e) {}
    }

    async listenToNetwork(node, myId) {
        try {
            const combined = [JSON.stringify(myId.publicKey), JSON.stringify(node.peerPublicKey)].sort().join('|');
            const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined));
            const channelId = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');
            node.channelId = channelId;
            const myPubStr = JSON.stringify(myId.publicKey);
            
            const myShortId = this.getShortId(myId.publicKey);
            const peerShortId = this.getShortId(node.peerPublicKey);

            if(db) updateDoc(doc(db, "nexus_channels", channelId), { [`lastRead.${myShortId}`]: Date.now() }).catch(()=>{});

            let peerLastRead = 0;

            this.unsubscribeTyping = onSnapshot(doc(db, "nexus_channels", channelId), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.typing && data.typing[peerShortId]) {
                        if (Date.now() - data.typing[peerShortId] < 3000) this.typingIndicator.style.opacity = '1';
                        else this.typingIndicator.style.opacity = '0';
                    }
                    if (data.lastRead && data.lastRead[peerShortId]) {
                        peerLastRead = data.lastRead[peerShortId];
                        this.updateReadReceipts(peerLastRead);
                    }
                }
            });

            const messagesRef = collection(db, "nexus_channels", channelId, "messages");
            const q = query(messagesRef, orderBy("timestamp", "desc"), limit(50));

            this.unsubscribeNetwork = onSnapshot(q, async (snapshot) => {
                let isNewRendered = false;
                const changes = snapshot.docChanges().reverse();

                for (let change of changes) {
                    const data = change.doc.data();
                    const docId = change.doc.id;

                    if (change.type === "added") {
                        const isDuplicate = node.messages.some(m => m.id === docId);
                        if (!isDuplicate) {
                            const senderType = (data.senderPubKey === myPubStr) ? 'me' : 'peer';
                            const msgObj = { 
                                id: docId, sender: senderType, cipher: data.cipher, iv: data.iv, 
                                timestamp: data.timestamp ? data.timestamp.toMillis() : Date.now(), 
                                isDeleted: data.isDeleted || false,
                                isEdited: data.isEdited || false,
                                phantom: data.phantom || false, // ★ ファントムフラグ読込
                                reactions: data.reactions || {} // ★ リアクション読込
                            };
                            
                            node.messages.push(msgObj);
                            await this.renderMessageObj(msgObj, peerLastRead);
                            isNewRendered = true;

                            if (senderType === 'peer') {
                                if (window.universeAudio && this.isOpen) window.universeAudio.playSystemSound(400, 'triangle', 0.1);
                                if(db) updateDoc(doc(db, "nexus_channels", channelId), { [`lastRead.${myShortId}`]: Date.now() }).catch(()=>{});
                            }
                        }
                    } else if (change.type === "modified") {
                        const targetMsg = node.messages.find(m => m.id === docId);
                        if (targetMsg) {
                            if (data.isDeleted && !targetMsg.isDeleted) {
                                targetMsg.isDeleted = true; targetMsg.cipher = "";
                                const domEl = document.getElementById(`msg-${docId}`);
                                if (domEl) domEl.innerHTML = '<div style="font-size:12px; color:rgba(255,255,255,0.3); font-style:italic; padding:10px 15px; border-radius:12px; background:rgba(0,0,0,0.3);">⊘ Message has been wiped</div>';
                            } else {
                                // 編集またはリアクションの更新
                                targetMsg.cipher = data.cipher;
                                targetMsg.iv = data.iv;
                                targetMsg.isEdited = data.isEdited || targetMsg.isEdited;
                                targetMsg.reactions = data.reactions || {};
                                await this.renderMessageObj(targetMsg, peerLastRead);
                            }
                        }
                    } else if (change.type === "removed") {
                        const targetIndex = node.messages.findIndex(m => m.id === docId);
                        if (targetIndex !== -1) {
                            node.messages.splice(targetIndex, 1);
                            const domEl = document.getElementById(`msg-${docId}`);
                            if (domEl) domEl.remove();
                            this.app.autoSave();
                        }
                    }
                }

                if (node.messages.length > 50) {
                    node.messages.sort((a, b) => a.timestamp - b.timestamp);
                    node.messages = node.messages.slice(-50);
                }

                if (isNewRendered) { this.app.autoSave(); this.scrollToBottom(); }
            }, (err) => {
                if (!navigator.onLine || err.code === 'permission-denied') {
                    console.log("🛰️ [Stealth Mode] 圏外のため、リアルタイム通信網を一時遮断しています。");
                } else {
                    console.warn("Network Listener Error:", err);
                }
            });
        } catch (e) { console.error("ワームホールエラー", e); }
    }

    async renderMessageObj(msg, peerLastRead = 0) {
        const isMe = msg.sender === 'me';
        
        const wrapper = document.createElement('div');
        wrapper.id = `msg-${msg.id}`;
        wrapper.style.cssText = `display:flex; width:100%; justify-content:${isMe ? 'flex-end' : 'flex-start'}; align-items:flex-end; gap:8px; position:relative;`;
        
        if (msg.isDeleted) {
            wrapper.innerHTML = '<div style="font-size:12px; color:rgba(255,255,255,0.3); font-style:italic; padding:10px 15px; border-radius:12px; background:rgba(0,0,0,0.3);">⊘ Message has been wiped</div>';
            
            const existingEl = document.getElementById(`msg-${msg.id}`);
            if (existingEl && existingEl.parentNode === this.msgContainer) this.msgContainer.replaceChild(wrapper, existingEl);
            else this.msgContainer.appendChild(wrapper);
            return;
        }

        if (!isMe) {
            const peerIcon = document.createElement('div');
            peerIcon.style.cssText = `width:28px; height:28px; border-radius:50%; overflow:hidden; border:1px solid rgba(255,0,255,0.5); flex-shrink:0; background:#111; display:flex; justify-content:center; align-items:center; margin-bottom: 2px;`;
            if (this.activeNode.iconUrl) peerIcon.innerHTML = `<img src="${this.activeNode.iconUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            else peerIcon.style.background = 'radial-gradient(circle, #ff00ff 0%, #111 70%)';
            wrapper.appendChild(peerIcon);
        }

        const metaContainer = document.createElement('div');
        metaContainer.style.cssText = `display:flex; align-items:flex-end; gap:4px; opacity:0.6; margin-bottom:2px; flex-shrink:0;`;

        const timeDate = new Date(msg.timestamp);
        const timeStr = `${timeDate.getHours().toString().padStart(2,'0')}:${timeDate.getMinutes().toString().padStart(2,'0')}`;
        const timeEl = document.createElement('div');
        timeEl.innerText = timeStr;
        timeEl.style.cssText = `font-size:10px; color:#aaa; font-family:sans-serif; margin-left:2px;`;

        const bubbleWrapper = document.createElement('div');
        bubbleWrapper.style.cssText = `max-width:70%; display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};`;

        const bubble = document.createElement('div');
        bubble.style.cssText = `padding:10px 14px; font-size:13px; line-height:1.5; word-break:break-all; box-shadow:0 2px 10px rgba(0,0,0,0.3); white-space:pre-wrap; letter-spacing:0.5px; position:relative;`;
        
        if (isMe) {
            bubble.style.background = 'linear-gradient(135deg, rgba(0,255,204,0.15) 0%, rgba(0,204,255,0.05) 100%)';
            bubble.style.border = '1px solid rgba(0,255,204,0.4)'; bubble.style.color = '#ccffff'; bubble.style.borderRadius = '16px 16px 4px 16px';
        } else {
            bubble.style.background = 'linear-gradient(135deg, rgba(255,0,255,0.15) 0%, rgba(255,102,204,0.05) 100%)';
            bubble.style.border = '1px solid rgba(255,102,204,0.4)'; bubble.style.color = '#ffccff'; bubble.style.borderRadius = '16px 16px 16px 4px';
        }

        // ★ ファントムモードのUI
        if (msg.phantom) {
            bubble.style.animation = 'phantom-pulse 1.5s infinite';
            const phantomTimer = document.createElement('div');
            phantomTimer.id = `phantom-timer-${msg.id}`;
            phantomTimer.style.cssText = `font-size:10px; color:#ff00ff; font-weight:bold; margin-top:5px; text-align:${isMe ? 'right' : 'left'};`;
            phantomTimer.innerText = isMe ? '👻 Phantom (未読)' : '👻 溶解まで: 10秒';
            
            // 受信者側のカウントダウン
            if (!isMe && !msg.phantomTimerStarted) {
                msg.phantomTimerStarted = true;
                let timeLeft = 10;
                const countdown = setInterval(async () => {
                    timeLeft--;
                    const tEl = document.getElementById(`phantom-timer-${msg.id}`);
                    if (tEl) {
                        if (timeLeft > 0) tEl.innerText = `👻 溶解まで: ${timeLeft}秒`;
                        else {
                            clearInterval(countdown);
                            tEl.innerText = '💥 溶解...';
                            try { await deleteDoc(doc(db, "nexus_channels", this.activeNode.channelId, "messages", msg.id)); } catch(e){}
                        }
                    } else if (timeLeft <= 0) {
                        clearInterval(countdown);
                        try { await deleteDoc(doc(db, "nexus_channels", this.activeNode.channelId, "messages", msg.id)); } catch(e){}
                    }
                }, 1000);
            }
            bubble.appendChild(phantomTimer);
        }

        let text = ""; let isImage = false; let isVoice = false;
        let replyHtml = ""; 
        
        try { 
            const decrypted = await SecretNexus.decryptData({ cipher: msg.cipher, iv: msg.iv }, this.activeNode.sharedKey); 
            try {
                const parsed = JSON.parse(decrypted);
                if (parsed.replyTo) {
                    replyHtml = `<div style="background:rgba(0,0,0,0.3); border-left:3px solid ${isMe?'#00ffcc':'#ff00ff'}; padding:6px 10px; margin-bottom:8px; font-size:11px; color:#aaa; border-radius:0 6px 6px 0; cursor:pointer;" onclick="document.getElementById('msg-${parsed.replyTo.id}')?.scrollIntoView({behavior:'smooth'})">↪ ${parsed.replyTo.text.substring(0,30)}${parsed.replyTo.text.length>30?'...':''}</div>`;
                }
                if (parsed.type === 'image') { isImage = true; text = parsed.data; } 
                else if (parsed.type === 'voice') { isVoice = true; text = parsed.data; }
                else if (parsed.type === 'text') { text = parsed.text; }
            } catch(e) { text = decrypted; }
        } catch(e) { text = "[ 復号エラー ]"; bubble.style.color = "#ff4444"; bubble.style.borderColor = "#ff4444"; }
        
        const contentDiv = document.createElement('div');
        if (isImage) {
            contentDiv.innerHTML = replyHtml + `<img src="${text}" style="max-width:100%; border-radius:8px; cursor:pointer; display:block;" onclick="window.open('${text}')">`;
            bubble.style.padding = '6px';
        } else if (isVoice) {
            contentDiv.innerHTML = replyHtml + `<div style="font-size:10px; color:#fff; margin-bottom:5px; opacity:0.8;">🎙️ Encrypted Audio</div><audio src="${text}" controls style="height:30px; max-width:180px; outline:none; filter:invert(1) hue-rotate(180deg); border-radius:15px;"></audio>`;
        } else {
            contentDiv.innerHTML = replyHtml + text.replace(/\n/g, '<br>');
        }
        bubble.prepend(contentDiv);
        bubbleWrapper.appendChild(bubble);

        // ★ リアクションの表示トレイ
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            const reactTray = document.createElement('div');
            reactTray.style.cssText = `display:flex; gap:3px; margin-top:2px; flex-wrap:wrap; justify-content:${isMe ? 'flex-end' : 'flex-start'};`;
            
            const counts = {};
            Object.values(msg.reactions).forEach(r => counts[r] = (counts[r]||0)+1);
            
            for (let [emoji, count] of Object.entries(counts)) {
                const rBadge = document.createElement('div');
                rBadge.style.cssText = 'background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:10px; padding:2px 6px; font-size:11px; display:flex; align-items:center; gap:3px; cursor:pointer;';
                rBadge.innerText = `${emoji} ${count > 1 ? count : ''}`;
                rBadge.onclick = () => this.toggleReaction(msg.id, emoji);
                reactTray.appendChild(rBadge);
            }
            bubbleWrapper.appendChild(reactTray);
        }

        // ★ リアクション追加ボタン
        const reactBtn = document.createElement('div');
        reactBtn.innerHTML = '😀';
        reactBtn.title = 'リアクション';
        reactBtn.style.cssText = 'font-size:11px; cursor:pointer; padding-bottom:1px; transition:0.2s; margin-right:4px; opacity:0.7;';
        reactBtn.onmouseover = () => reactBtn.style.opacity = '1';
        reactBtn.onmouseout = () => reactBtn.style.opacity = '0.7';
        reactBtn.onclick = (e) => this.showReactionMenu(msg.id, e.clientX, e.clientY);

        const replyBtn = document.createElement('div');
        replyBtn.innerHTML = '↩️';
        replyBtn.title = '引用返信';
        replyBtn.style.cssText = 'font-size:11px; cursor:pointer; padding-bottom:1px; transition:0.2s; margin-right:4px; opacity:0.7;';
        replyBtn.onmouseover = () => replyBtn.style.opacity = '1';
        replyBtn.onmouseout = () => replyBtn.style.opacity = '0.7';
        replyBtn.onclick = () => this.startReply(msg.id, text);

        if (isMe) {
            if (msg.isEdited) {
                const editMark = document.createElement('span');
                editMark.innerText = '(編)';
                editMark.style.cssText = 'font-size:9px; color:#888; margin-right:4px;';
                metaContainer.appendChild(editMark);
            }
            const readMark = document.createElement('div');
            readMark.id = `read-${msg.id}`;
            readMark.innerText = '👁️';
            readMark.style.cssText = `font-size:9px; color:#00ffcc; transition:0.3s; opacity:${msg.timestamp <= peerLastRead ? '1' : '0'}; margin-right:3px;`;
            metaContainer.appendChild(readMark);

            metaContainer.appendChild(reactBtn);
            metaContainer.appendChild(replyBtn);

            if (!isImage && !isVoice && msg.id) {
                const editBtn = document.createElement('div');
                editBtn.innerHTML = '✏️';
                editBtn.title = 'メッセージ編集';
                editBtn.style.cssText = 'font-size:11px; cursor:pointer; padding-bottom:1px; transition:0.2s; margin-right:4px; opacity:0.7;';
                editBtn.onmouseover = () => editBtn.style.opacity = '1';
                editBtn.onmouseout = () => editBtn.style.opacity = '0.7';
                editBtn.onclick = () => this.startEdit(msg.id, text);
                metaContainer.appendChild(editBtn);
            }

            const delBtn = document.createElement('div');
            delBtn.innerHTML = '🗑️';
            delBtn.title = 'メッセージを完全消去';
            delBtn.style.cssText = 'font-size:11px; cursor:pointer; padding-bottom:1px; transition:0.2s;';
            delBtn.onmouseover = () => delBtn.style.transform = 'scale(1.2)';
            delBtn.onmouseout = () => delBtn.style.transform = 'scale(1)';
            delBtn.onclick = async () => {
                if(confirm('空間からこの通信記録を完全に消去しますか？')) {
                    if(!msg.id) {
                        const targetIndex = this.activeNode.messages.findIndex(m => m === msg);
                        if (targetIndex !== -1) this.activeNode.messages.splice(targetIndex, 1);
                        this.app.autoSave();
                        wrapper.remove(); 
                        return;
                    }
                    try { await deleteDoc(doc(db, "nexus_channels", this.activeNode.channelId, "messages", msg.id)); } catch(e) {}
                }
            };
            metaContainer.appendChild(delBtn);
        } else {
            metaContainer.appendChild(reactBtn);
            metaContainer.appendChild(replyBtn);
        }
        
        metaContainer.appendChild(timeEl);
        
        if(isMe) { wrapper.appendChild(metaContainer); wrapper.appendChild(bubbleWrapper); }
        else { wrapper.appendChild(bubbleWrapper); wrapper.appendChild(metaContainer); }
        
        const existingEl = document.getElementById(`msg-${msg.id}`);
        if (existingEl && existingEl.parentNode === this.msgContainer) {
            this.msgContainer.replaceChild(wrapper, existingEl);
        } else {
            this.msgContainer.appendChild(wrapper);
        }
    }

    async sendMessage() {
        const text = this.inputField.value.trim();
        if (!text || !this.activeNode) return;
        
        this.inputField.value = '';
        this.inputField.style.height = 'auto'; 
        
        const payloadObj = { type: 'text', text: text };
        if (this.replyToMsg) payloadObj.replyTo = this.replyToMsg;

        const payload = JSON.stringify(payloadObj);
        const encrypted = await SecretNexus.encryptData(payload, this.activeNode.sharedKey);
        
        if (this.editingMsgId) {
            const msgId = this.editingMsgId;
            this.cancelAction();
            if (this.activeNode.channelId && db) {
                try {
                    await updateDoc(doc(db, "nexus_channels", this.activeNode.channelId, "messages", msgId), {
                        cipher: encrypted.cipher, iv: encrypted.iv, isEdited: true, updatedAt: serverTimestamp()
                    });
                } catch(e) {}
            }
        } else {
            this.cancelAction();
            await this.dispatchToNetwork(encrypted);
        }
    }

    async toggleVoiceRecord() {
        if (!this.activeNode) return;

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.micBtn.innerText = '🎙️';
            this.micBtn.style.color = '#00ffcc';
            this.micBtn.style.textShadow = 'none';
            this.inputField.placeholder = this.isPhantomMode ? '👻 Phantom Message (10秒で消滅)...' : 'Secure Message...';
        } else {
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
                            const payloadObj = { type: 'voice', data: base64Audio };
                            if (this.replyToMsg) payloadObj.replyTo = this.replyToMsg;
                            const encrypted = await SecretNexus.encryptData(JSON.stringify(payloadObj), this.activeNode.sharedKey);
                            this.cancelAction();
                            await this.dispatchToNetwork(encrypted);
                        } catch(e) { alert("音声の暗号化に失敗"); }
                        finally { this.inputField.placeholder = this.isPhantomMode ? '👻 Phantom Message (10秒で消滅)...' : 'Secure Message...'; }
                    };
                    reader.readAsDataURL(audioBlob);
                    stream.getTracks().forEach(t => t.stop()); 
                };
                
                this.mediaRecorder.start();
                this.micBtn.innerText = '🔴';
                this.micBtn.style.color = '#ff4444';
                this.micBtn.style.textShadow = '0 0 10px #ff4444';
                this.inputField.placeholder = 'Recording... (タップで送信)';
            } catch(e) { alert("マイクのアクセスが許可されていません。"); }
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
            const payloadObj = { type: 'image', data: base64Data };
            if (this.replyToMsg) payloadObj.replyTo = this.replyToMsg;
            const encrypted = await SecretNexus.encryptData(JSON.stringify(payloadObj), this.activeNode.sharedKey);
            this.cancelAction();
            await this.dispatchToNetwork(encrypted);
        } catch(e) { alert("画像の暗号化に失敗しました。"); } 
        finally { this.inputField.placeholder = this.isPhantomMode ? '👻 Phantom Message (10秒で消滅)...' : 'Secure Message...'; }
    }

    async dispatchToNetwork(encrypted) {
        const myId = this.getMyIdentity(); if (!myId) return;
        const myPubStr = JSON.stringify(myId.publicKey);
        const myShortId = this.getShortId(myId.publicKey); 
        
        // ★ Phantom状態を一旦保存して、リセットする
        const isPhantom = this.isPhantomMode;
        if (this.isPhantomMode) {
            this.isPhantomMode = false;
            this.phantomBtn.style.color = '#888';
            this.phantomBtn.style.filter = 'grayscale(1)';
            this.inputField.placeholder = 'Secure Message...';
            this.inputField.parentElement.style.borderColor = 'rgba(0,255,204,0.3)';
        }

        if (!this.activeNode.channelId || !db) {
            const msgObj = { id: "", sender: 'me', cipher: encrypted.cipher, iv: encrypted.iv, timestamp: Date.now(), phantom: isPhantom };
            if (!this.activeNode.messages) this.activeNode.messages = [];
            this.activeNode.messages.push(msgObj); this.app.autoSave();
            await this.renderMessageObj(msgObj); this.scrollToBottom(); return;
        }

        try {
            const channelRef = doc(db, "nexus_channels", this.activeNode.channelId);
            await setDoc(channelRef, { participants: [myPubStr, JSON.stringify(this.activeNode.peerPublicKey)], updatedAt: serverTimestamp(), [`lastRead.${myShortId}`]: Date.now() }, { merge: true });
            const messagesRef = collection(db, "nexus_channels", this.activeNode.channelId, "messages");
            await addDoc(messagesRef, { 
                cipher: encrypted.cipher, iv: encrypted.iv, senderPubKey: myPubStr, timestamp: serverTimestamp(), 
                isDeleted: false, phantom: isPhantom, reactions: {} 
            });
        } catch (e) {}
    }

    scrollToBottom() { setTimeout(() => { this.msgContainer.scrollTop = this.msgContainer.scrollHeight; }, 50); }
}