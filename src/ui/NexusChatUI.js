// src/ui/NexusChatUI.js
import { SecretNexus } from '../security/SecretNexus.js';

export class NexusChatUI {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.activeNode = null;
        this.createUI();
    }

    createUI() {
        // ① 確実にタップできる、サイバーパンクな「引き出しタブ」
        this.triggerTab = document.createElement('div');
        this.triggerTab.style.cssText = 'position:fixed; top:50%; right:0; transform:translateY(-50%); width:25px; height:70px; background:rgba(0,255,204,0.15); border:1px solid #00ffcc; border-right:none; border-radius:12px 0 0 12px; z-index:99999; display:flex; align-items:center; justify-content:center; color:#00ffcc; cursor:pointer; box-shadow:-2px 0 15px rgba(0,255,204,0.3); backdrop-filter:blur(5px); font-weight:bold; transition:right 0.3s;';
        this.triggerTab.innerHTML = '⟨';
        this.triggerTab.onclick = () => this.toggle();
        document.body.appendChild(this.triggerTab);

        // ② スライドしてくるメインパネル
        this.panel = document.createElement('div');
        this.panel.style.cssText = 'position:fixed; top:0; right:-400px; width:100%; max-width:400px; height:100%; background:rgba(10,15,20,0.95); border-left:1px solid #00ffcc; z-index:99998; display:flex; flex-direction:column; transition:right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow:-10px 0 30px rgba(0,255,204,0.1); backdrop-filter:blur(15px); pointer-events:auto; font-family:sans-serif; color:white;';
        document.body.appendChild(this.panel);

        // ヘッダー部分
        const header = document.createElement('div');
        header.style.cssText = 'padding:15px; border-bottom:1px solid rgba(0,255,204,0.3); display:flex; justify-content:space-between; align-items:center; background:rgba(0,255,204,0.05);';
        header.innerHTML = `<div style="font-size:14px; font-weight:bold; letter-spacing:2px; color:#00ffcc; text-shadow:0 0 5px #00ffcc;">📡 NEXUS HUB</div>`;
        
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.style.cssText = 'background:transparent; border:none; color:#ff4444; font-size:24px; cursor:pointer; padding:0 10px;';
        closeBtn.onclick = () => this.toggle();
        header.appendChild(closeBtn);
        this.panel.appendChild(header);

        // ボディ部分（左：コンタクト一覧、右：チャット画面）
        const body = document.createElement('div');
        body.style.cssText = 'display:flex; flex:1; overflow:hidden;';
        this.panel.appendChild(body);

        // 左側：通信が確立している星のリスト
        this.contactList = document.createElement('div');
        this.contactList.style.cssText = 'width:120px; border-right:1px solid rgba(0,255,204,0.2); overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px 0; scrollbar-width: none;';
        body.appendChild(this.contactList);

        // 右側：チャット履歴エリア
        this.chatArea = document.createElement('div');
        this.chatArea.style.cssText = 'flex:1; display:flex; flex-direction:column; background:rgba(0,0,0,0.5);';
        body.appendChild(this.chatArea);

        this.msgContainer = document.createElement('div');
        this.msgContainer.style.cssText = 'flex:1; overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:10px; scroll-behavior:smooth;';
        this.chatArea.appendChild(this.msgContainer);

        // 入力エリア
        const inputArea = document.createElement('div');
        inputArea.style.cssText = 'padding:10px; border-top:1px solid rgba(0,255,204,0.2); display:flex; gap:5px; background:rgba(0,0,0,0.8);';
        
        this.inputField = document.createElement('input');
        this.inputField.type = 'text';
        this.inputField.placeholder = 'Encrypted text...';
        this.inputField.style.cssText = 'flex:1; background:rgba(0,255,204,0.1); border:1px solid rgba(0,255,204,0.3); color:#fff; padding:10px; border-radius:20px; outline:none; font-size:13px;';
        this.inputField.onkeypress = (e) => { if(e.key === 'Enter') this.sendMessage(); };
        
        const sendBtn = document.createElement('button');
        sendBtn.innerText = '送信';
        sendBtn.style.cssText = 'background:#00ffcc; color:#000; border:none; padding:0 15px; border-radius:20px; font-weight:bold; cursor:pointer; font-size:12px;';
        sendBtn.onclick = () => this.sendMessage();

        inputArea.appendChild(this.inputField);
        inputArea.appendChild(sendBtn);
        this.chatArea.appendChild(inputArea);
    }

    toggle() {
        this.isOpen = !this.isOpen;
        // パネルをスライドさせると同時に、トリガータブも一緒に左へ移動させる
        this.panel.style.right = this.isOpen ? '0px' : '-400px';
        this.triggerTab.style.right = this.isOpen ? (window.innerWidth < 400 ? window.innerWidth+'px' : '400px') : '0px';
        this.triggerTab.innerHTML = this.isOpen ? '⟩' : '⟨';
        
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
            this.contactList.innerHTML = '<div style="color:#666; font-size:10px; text-align:center; padding:20px 5px;">NO LINKS</div>';
            this.msgContainer.innerHTML = '<div style="margin:auto; color:#444; font-size:12px;">星のメニューから[📡 QRセキュア通信]を実行し、鍵を交換してください。</div>';
            this.activeNode = null;
            return;
        }

        nexusNodes.forEach(node => {
            const btn = document.createElement('div');
            const isActive = this.activeNode === node;
            btn.style.cssText = `padding:12px 10px; border-bottom:1px solid rgba(0,255,204,0.1); cursor:pointer; font-size:12px; color:${isActive?'#00ffcc':'#aaa'}; background:${isActive?'rgba(0,255,204,0.1)':'transparent'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:0.2s;`;
            btn.innerText = '🌌 ' + node.name.replace('Nexus: ', '');
            btn.onclick = () => this.openChat(node);
            this.contactList.appendChild(btn);
        });

        if (!this.activeNode || !nexusNodes.includes(this.activeNode)) {
            this.openChat(nexusNodes[0]);
        }
    }

    async openChat(node) {
        this.activeNode = node;
        this.refreshContacts();
        this.msgContainer.innerHTML = `<div style="text-align:center; color:#00ffcc; font-size:10px; letter-spacing:2px; margin-bottom:10px; opacity:0.5;">- E2EE SECURE CHANNEL -</div>`;
        
        if (!node.messages) node.messages = [];
        for (let msg of node.messages) { await this.renderMessageObj(msg); }
        this.scrollToBottom();
    }

    async renderMessageObj(msg) {
        const isMe = msg.sender === 'me';
        const wrap = document.createElement('div');
        wrap.style.cssText = `display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; width:100%;`;
        
        const bubble = document.createElement('div');
        bubble.style.cssText = `max-width:80%; padding:10px 14px; border-radius:16px; font-size:13px; line-height:1.4; word-break:break-all; box-shadow:0 2px 10px rgba(0,0,0,0.5);`;
        
        if (isMe) {
            bubble.style.background = 'rgba(0,255,204,0.2)'; bubble.style.border = '1px solid rgba(0,255,204,0.4)'; bubble.style.color = '#00ffff'; bubble.style.borderBottomRightRadius = '4px';
        } else {
            bubble.style.background = 'rgba(255,0,255,0.1)'; bubble.style.border = '1px solid rgba(255,0,255,0.3)'; bubble.style.color = '#ff88ff'; bubble.style.borderBottomLeftRadius = '4px';
        }

        let text = "[Decryption Error]";
        try { text = await SecretNexus.decryptData({ cipher: msg.cipher, iv: msg.iv }, this.activeNode.sharedKey); } catch(e) {}
        bubble.innerText = text; wrap.appendChild(bubble); this.msgContainer.appendChild(wrap);
    }

    async sendMessage() {
        const text = this.inputField.value.trim();
        if (!text || !this.activeNode) return;
        this.inputField.value = '';
        
        const encrypted = await SecretNexus.encryptData(text, this.activeNode.sharedKey);
        const msgObj = { sender: 'me', cipher: encrypted.cipher, iv: encrypted.iv, timestamp: Date.now() };
        
        if (!this.activeNode.messages) this.activeNode.messages = [];
        this.activeNode.messages.push(msgObj);
        this.app.autoSave();
        
        await this.renderMessageObj(msgObj);
        this.scrollToBottom();

        // モック（テスト用自動返信）
        setTimeout(async () => {
            const replyText = "Re: " + text; 
            const replyEnc = await SecretNexus.encryptData(replyText, this.activeNode.sharedKey);
            const replyObj = { sender: 'peer', cipher: replyEnc.cipher, iv: replyEnc.iv, timestamp: Date.now() };
            this.activeNode.messages.push(replyObj);
            this.app.autoSave();
            if(this.isOpen && this.activeNode === this.activeNode) {
                await this.renderMessageObj(replyObj);
                this.scrollToBottom();
                if(window.universeAudio) window.universeAudio.playSystemSound(400, 'triangle', 0.1);
            }
        }, 1000);
    }

    scrollToBottom() { setTimeout(() => { this.msgContainer.scrollTop = this.msgContainer.scrollHeight; }, 50); }
}