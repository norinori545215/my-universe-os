// src/ui/MediaViewUI.js
import { VaultMedia } from '../db/VaultMedia.js';

export class MediaViewUI {
    constructor(app) {
        this.app = app;
        this.createUI();
    }

    createUI() {
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(5,10,15,0.85); z-index:12000; display:none; flex-direction:column; align-items:center; justify-content:center; backdrop-filter:blur(15px); pointer-events:auto;';
        
        this.panel = document.createElement('div');
        this.panel.style.cssText = 'background:rgba(0,20,30,0.8); border:1px solid #00ffcc; border-radius:16px; padding:20px; width:90%; max-width:600px; max-height:80vh; display:flex; flex-direction:column; box-shadow:0 0 50px rgba(0,255,204,0.15);';
        
        this.header = document.createElement('div');
        this.header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,255,204,0.3); padding-bottom:15px; margin-bottom:15px;';
        this.header.innerHTML = `<h3 style="margin:0; color:#00ffcc; font-size:16px; letter-spacing:2px;">📦 UNIVERSAL VAULT</h3><button id="mv-close" style="background:transparent; border:none; color:#ff4444; font-size:24px; cursor:pointer;">×</button>`;
        
        this.listContainer = document.createElement('div');
        this.listContainer.style.cssText = 'flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding-right:5px;';

        // プレビュー表示用エリア
        this.previewArea = document.createElement('div');
        this.previewArea.style.cssText = 'display:none; flex-direction:column; align-items:center; margin-top:15px; background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px dashed #ff00ff;';

        this.panel.appendChild(this.header);
        this.panel.appendChild(this.listContainer);
        this.panel.appendChild(this.previewArea);
        this.overlay.appendChild(this.panel);
        document.body.appendChild(this.overlay);

        this.overlay.addEventListener('mousedown', (e) => { if(e.target === this.overlay) this.close(); });
        this.overlay.querySelector('#mv-close').onclick = () => this.close();
    }

    open(node) {
        if (!node.vault || node.vault.length === 0) {
            alert("この星の地下金庫には何も格納されていません。");
            return;
        }
        this.currentNode = node;
        this.listContainer.innerHTML = '';
        this.previewArea.style.display = 'none';
        this.previewArea.innerHTML = '';

        node.vault.forEach((item, index) => {
            const el = document.createElement('div');
            el.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(0,255,204,0.05); border:1px solid rgba(0,255,204,0.2); padding:12px; border-radius:8px; transition:0.2s; cursor:pointer;';
            el.onmouseover = () => el.style.background = 'rgba(0,255,204,0.15)';
            el.onmouseout = () => el.style.background = 'rgba(0,255,204,0.05)';

            // アイコン判定
            let icon = '📄';
            if (item.type && item.type.startsWith('image/')) icon = '🖼️';
            else if (item.type && item.type.includes('pdf')) icon = '📕';
            else if (item.type && (item.type.includes('excel') || item.type.includes('spreadsheet'))) icon = '📊';

            const sizeMb = item.size ? (item.size / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown Size';
            const fileName = item.name || `Encrypted_Data_${index}`;

            el.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
                    <span style="font-size:20px;">${icon}</span>
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                        <span style="color:#fff; font-size:13px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${fileName}</span>
                        <span style="color:#aaa; font-size:10px;">${sizeMb} | AES-256-GCM</span>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="mv-btn-dec" style="background:#003333; color:#00ffcc; border:1px solid #00ffcc; padding:6px 12px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; flex-shrink:0;">DECRYPT</button>
                    <button class="mv-btn-del" style="background:rgba(255,68,68,0.1); color:#ff4444; border:1px solid #ff4444; padding:6px 12px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; flex-shrink:0;">🗑️</button>
                </div>
            `;

            // DECRYPT（復号）ボタンの処理
            el.querySelector('.mv-btn-dec').onclick = async (e) => {
                e.stopPropagation();
                const btn = el.querySelector('.mv-btn-dec');
                btn.innerText = 'WAIT...';
                btn.style.color = '#ffcc00';

                const decrypted = await VaultMedia.retrieveMedia(item);
                if (!decrypted) {
                    alert("復号に失敗しました。データが破損している可能性があります。");
                    btn.innerText = 'ERROR';
                    return;
                }

                btn.innerText = 'OPENED';
                btn.style.color = '#00ffcc';
                if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.1);

                // 画像ならプレビュー、それ以外ならダウンロード
                if (decrypted.type.startsWith('image/')) {
                    this.previewArea.style.display = 'flex';
                    this.previewArea.innerHTML = `
                        <div style="color:#ff00ff; font-size:11px; margin-bottom:8px; letter-spacing:1px;">SECURE PREVIEW (RAM ONLY)</div>
                        <img src="${decrypted.url}" style="max-width:100%; max-height:300px; border-radius:4px; object-fit:contain;">
                        <button id="mv-dl-img" style="margin-top:10px; background:transparent; border:1px solid #ff00ff; color:#ff00ff; padding:6px 20px; border-radius:20px; cursor:pointer; font-size:11px;">デバイスに保存</button>
                    `;
                    this.previewArea.querySelector('#mv-dl-img').onclick = () => this.triggerDownload(decrypted.url, decrypted.name);
                } else {
                    this.triggerDownload(decrypted.url, decrypted.name);
                }
            };

            // ★ 修正: 完全消去（実体パージ ＋ 記録抹消）の処理
            el.querySelector('.mv-btn-del').onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`⚠️ 警告\n\n「${fileName}」を完全に物理消去しますか？\nこの操作は取り消せません。`)) {
                    
                    // 1. IndexedDBから暗号化バイナリ実体を物理削除
                    if (VaultMedia.deleteMedia) {
                        await VaultMedia.deleteMedia(item.id);
                    }

                    // 2. 星の記憶（ノードのリスト）から抹消
                    node.vault.splice(index, 1);
                    this.app.autoSave();
                    if(window.universeAudio) window.universeAudio.playDelete();
                    
                    if (node.vault.length === 0) {
                        this.close();
                    } else {
                        this.open(node); // リストを再描画
                    }
                }
            };

            this.listContainer.appendChild(el);
        });

        this.overlay.style.display = 'flex';
        if (window.universeAudio) window.universeAudio.playSystemSound(400, 'sine', 0.1);
    }

    triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    close() {
        this.overlay.style.display = 'none';
        // プレビュー用に発行したURLをメモリからパージ（揮発）
        const img = this.previewArea.querySelector('img');
        if (img && img.src) URL.revokeObjectURL(img.src);
        this.previewArea.innerHTML = '';
        if (window.universeAudio) window.universeAudio.playSystemSound(200, 'sawtooth', 0.1);
    }
}