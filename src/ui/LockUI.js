// src/ui/LockUI.js
export class LockUI {
    constructor(app) {
        this.app = app;
        this.createUI();
    }

    createUI() {
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:11000; display:none; justify-content:center; align-items:center; backdrop-filter:blur(8px);';
        
        this.panel = document.createElement('div');
        this.panel.style.cssText = 'background:rgba(20,0,0,0.95); border:1px solid #ff4444; padding:30px; border-radius:12px; text-align:center; box-shadow:0 0 40px rgba(255,0,0,0.3); min-width:280px; pointer-events:auto;';
        
        this.title = document.createElement('div');
        this.title.style.cssText = 'color:#ff4444; font-weight:bold; margin-bottom:20px; font-size:15px; letter-spacing:2px;';
        
        this.input = document.createElement('input');
        this.input.type = 'password';
        this.input.style.cssText = 'background:rgba(0,0,0,0.8); border:1px solid #ff4444; color:#ff4444; padding:12px; width:100%; box-sizing:border-box; text-align:center; font-size:18px; margin-bottom:20px; outline:none; border-radius:6px; letter-spacing:4px; font-family:monospace;';
        
        this.btnGroup = document.createElement('div');
        this.btnGroup.style.cssText = 'display:flex; gap:10px;';

        this.btnSubmit = document.createElement('button');
        this.btnSubmit.style.cssText = 'flex:1; background:#ff4444; color:#000; border:none; padding:12px; font-weight:bold; cursor:pointer; border-radius:6px; transition:0.2s;';
        
        this.btnCancel = document.createElement('button');
        this.btnCancel.innerText = 'CANCEL';
        this.btnCancel.style.cssText = 'flex:1; background:transparent; color:#888; border:1px solid #555; padding:12px; font-weight:bold; cursor:pointer; border-radius:6px; transition:0.2s;';

        this.btnGroup.appendChild(this.btnCancel);
        this.btnGroup.appendChild(this.btnSubmit);
        
        this.panel.appendChild(this.title);
        this.panel.appendChild(this.input);
        this.panel.appendChild(this.btnGroup);
        this.overlay.appendChild(this.panel);
        document.body.appendChild(this.overlay);

        this.btnCancel.onclick = () => this.close();
        // 背景クリックで閉じる
        this.overlay.addEventListener('mousedown', (e) => { if(e.target === this.overlay) this.close(); });
        this.overlay.addEventListener('touchstart', (e) => { if(e.target === this.overlay) this.close(); }, {passive:true});
    }

    close() {
        this.overlay.style.display = 'none';
        this.input.value = '';
    }

    openForSet(node, onSuccess) {
        this.title.innerText = 'SECURE THIS NODE';
        this.btnSubmit.innerText = 'LOCK';
        this.input.placeholder = 'NEW PASSCODE';
        this.overlay.style.display = 'flex';
        setTimeout(() => this.input.focus(), 100);
        
        this.btnSubmit.onclick = () => {
            if(this.input.value.length < 1) return;
            node.isLocked = true;
            node.lockCode = this.input.value;
            node.isTempUnlocked = true; // 設定直後は解除状態にしておく
            this.close();
            if(window.universeAudio) window.universeAudio.playSystemSound(300, 'square', 0.1);
            this.app.autoSave();
            if(onSuccess) onSuccess();
        };
    }

    openForUnlock(node, onSuccess) {
        this.title.innerText = 'RESTRICTED ACCESS';
        this.btnSubmit.innerText = 'AUTHORIZE';
        this.input.placeholder = 'PASSCODE';
        this.overlay.style.display = 'flex';
        setTimeout(() => this.input.focus(), 100);

        this.btnSubmit.onclick = () => {
            if(this.input.value === node.lockCode) {
                node.isTempUnlocked = true;
                this.close();
                if(window.universeAudio) window.universeAudio.playSystemSound(800, 'sine', 0.1);
                if(onSuccess) onSuccess();
            } else {
                this.input.style.borderColor = '#ffffff';
                this.input.value = '';
                if(window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 0.2);
                setTimeout(() => this.input.style.borderColor = '#ff4444', 200);
            }
        };
    }
}