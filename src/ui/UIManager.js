// src/ui/UIManager.js
import { Singularity } from '../db/Singularity.js';
import { saveEncryptedUniverse } from '../db/CloudSync.js';
import { NotePadUI } from './NotePadUI.js';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.notePad = new NotePadUI(app);
        this.createUI();
        
        // 古いボタンを隠す
        setTimeout(() => {
            const oldLogout = document.getElementById('btn-logout');
            const oldReset = document.getElementById('emergency-reset-btn');
            if(oldLogout) oldLogout.style.display = 'none';
            if(oldReset) oldReset.style.display = 'none';
        }, 500);
    }

    makeDraggable(el) {
        let isDragging = false, startX, startY, initX, initY, hasMoved = false;

        const down = (e) => {
            const ev = e.touches ? e.touches[0] : e;
            e.stopPropagation(); 
            hasMoved = false;
            startX = ev.clientX; startY = ev.clientY;
            const rect = el.getBoundingClientRect();
            initX = rect.left; initY = rect.top;
            isDragging = true;
            el.style.transition = 'none';
        };

        const move = (e) => {
            if (!isDragging) return;
            e.stopPropagation();
            const ev = e.touches ? e.touches[0] : e;
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
            
            let nx = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, initX + dx));
            let ny = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, initY + dy));
            
            el.style.left = `${nx}px`;
            el.style.top = `${ny}px`;
            el.style.right = 'auto'; 
            el.style.bottom = 'auto';
        };

        const up = (e) => {
            if (isDragging) { 
                isDragging = false; 
                el.style.transition = '0.2s';
                e.stopPropagation();
            }
        };

        el.addEventListener('mousedown', down); el.addEventListener('touchstart', down, {passive: false});
        window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive: false});
        window.addEventListener('mouseup', up); window.addEventListener('touchend', up);

        return () => hasMoved; 
    }

    protectUI(el) {
        el.addEventListener('mousedown', e => e.stopPropagation());
        el.addEventListener('mouseup', e => e.stopPropagation());
        el.addEventListener('touchstart', e => e.stopPropagation(), {passive: false});
        el.addEventListener('touchend', e => e.stopPropagation(), {passive: false});
    }

    createUI() {
        this.centerTextEl = document.createElement('div');
        this.centerTextEl.id = 'center-text';
        this.centerTextEl.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); color:rgba(255,255,255,0.1); font-size:4vw; font-weight:bold; cursor:pointer; pointer-events:auto; z-index:10; white-space:nowrap;';
        this.protectUI(this.centerTextEl);
        this.centerTextEl.onclick = (e) => {
            e.stopPropagation();
            const newName = prompt("現在の階層の名前を変更:", this.app.currentUniverse.name);
            if (newName) {
                this.app.currentUniverse.name = newName;
                this.app.autoSave(); this.updateBreadcrumbs(); 
            }
        };
        document.body.appendChild(this.centerTextEl);

        // ★★★ フローティング・システムカプセル ★★★
        this.systemCapsule = document.createElement('div');
        this.systemCapsule.style.cssText = 'position:fixed; top:20px; left:20px; z-index:9000; display:flex; align-items:center; background:rgba(10,15,25,0.85); border:1px solid rgba(0,255,204,0.5); border-radius:30px; padding:5px 15px 5px 5px; box-shadow:0 10px 30px rgba(0,255,204,0.2); backdrop-filter:blur(10px); pointer-events:auto; user-select:none; max-width:90vw; overflow-x:auto;';
        this.isCapsuleDragged = this.makeDraggable(this.systemCapsule);
        document.body.appendChild(this.systemCapsule);

        // コア・ボタン（メニュー開閉）
        const coreBtn = document.createElement('div');
        coreBtn.style.cssText = 'display:flex; justify-content:center; align-items:center; width:40px; height:40px; border-radius:50%; background:rgba(0,255,204,0.2); color:#00ffcc; font-size:20px; cursor:pointer; margin-right:10px; flex-shrink:0; transition:0.2s;';
        coreBtn.innerText = '🌌';
        this.systemCapsule.appendChild(coreBtn);

        // ★ 新機能：拡張モジュール（プラグイン）を追加する専用スロット
        this.capsuleSlots = document.createElement('div');
        this.capsuleSlots.style.cssText = 'display:flex; gap:5px; margin-right:10px;';
        this.systemCapsule.appendChild(this.capsuleSlots);

        // パンくずリスト
        this.breadcrumbUI = document.createElement('div');
        this.breadcrumbUI.style.cssText = 'display:flex; gap:5px; flex-wrap:nowrap; font-family:sans-serif; color:white; align-items:center; white-space:nowrap;';
        this.systemCapsule.appendChild(this.breadcrumbUI);

        // ★★★ 統合コントロールパネル ★★★
        const controlPanel = document.createElement('div');
        controlPanel.style.cssText = 'position:fixed; display:none; flex-direction:column; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(10,15,25,0.95); border:1px solid #00ffcc; border-radius:12px; padding:20px; z-index:9001; width:85%; max-width:320px; max-height:80vh; overflow-y:auto; box-shadow:0 15px 50px rgba(0,0,0,0.8); backdrop-filter:blur(10px); color:white; font-family:sans-serif; pointer-events:auto;';
        this.protectUI(controlPanel);
        document.body.appendChild(controlPanel);

        controlPanel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,255,204,0.3); padding-bottom:10px; margin-bottom:15px;">
                <h3 style="margin:0; color:#00ffcc; font-size:16px; letter-spacing:1px;">CORE SYSTEM</h3>
                <button id="cp-close" style="background:transparent; border:none; color:#aaa; font-size:20px; cursor:pointer;">×</button>
            </div>

            <div style="margin-bottom:20px; background:rgba(0,255,204,0.05); padding:10px; border-radius:8px; border:1px dashed rgba(0,255,204,0.3);">
                <div style="font-size:11px; color:#00ffcc; margin-bottom:8px;">🧩 拡張モジュール (Plugins)</div>
                <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                    <input type="checkbox" id="cp-ext-logger" style="cursor:pointer; accent-color:#00ffcc;">
                    🖥️ ターミナルをカプセルに追加
                </label>
            </div>

            <div style="margin-bottom:20px;">
                <div style="font-size:11px; color:#00ffcc; margin-bottom:5px;">🔍 レーダー検索</div>
                <input type="text" id="cp-radar" placeholder="星の名前を探す..." style="width:100%; background:rgba(0,0,0,0.6); color:#fff; border:1px solid #00ffcc; border-radius:6px; padding:8px; box-sizing:border-box; outline:none; font-size:14px;">
                <div id="cp-radar-results" style="max-height:100px; overflow-y:auto; margin-top:5px; font-size:12px;"></div>
            </div>

            <div style="margin-bottom:20px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                <div style="font-size:11px; color:#00ffff; margin-bottom:8px;">🛠️ 操作と創造</div>
                <div style="display:flex; gap:5px; margin-bottom:10px;">
                    <button id="cp-mode-run" style="flex:1; padding:8px; background:#00ffcc; color:#000; border:none; border-radius:4px; font-weight:bold; font-size:12px;">👆 実行</button>
                    <button id="cp-mode-link" style="flex:1; padding:8px; background:#113344; color:#fff; border:1px solid #00ffff; border-radius:4px; font-size:12px;">🔗 結ぶ</button>
                    <button id="cp-mode-edit" style="flex:1; padding:8px; background:#113344; color:#fff; border:1px solid #00ffff; border-radius:4px; font-size:12px;">⚙️ 編集</button>
                </div>
                <div style="display:flex; gap:8px;">
                    <input type="color" id="cp-spawn-color" value="#00ffcc" style="width:40px; height:36px; border:none; border-radius:4px; background:transparent; cursor:pointer;">
                    <button id="cp-spawn-btn" style="flex:1; background:#114433; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; font-weight:bold; font-size:12px;">🌟 新しい星を創る</button>
                </div>
            </div>

            <div style="margin-bottom:20px; background:rgba(255,102,153,0.05); padding:10px; border-radius:8px;">
                <div style="font-size:11px; color:#ff6699; margin-bottom:8px;">🎒 データ管理 (亜空間)</div>
                <button id="cp-btn-inventory" style="width:100%; background:#220022; color:#ff6699; border:1px solid #ff6699; padding:10px; border-radius:4px; margin-bottom:8px; font-size:12px;">🌌 亜空間ポケットを開く</button>
                <div style="display:flex; gap:5px;">
                    <button id="cp-btn-export" style="flex:1; background:#112244; color:#66aaff; border:1px solid #66aaff; padding:8px; border-radius:4px; font-size:11px;">💾 出力</button>
                    <button id="cp-btn-import" style="flex:1; background:#442211; color:#ffaa66; border:1px solid #ffaa66; padding:8px; border-radius:4px; font-size:11px;">📂 読込</button>
                    <input type="file" id="cp-import-file" accept=".universe" style="display:none;">
                </div>
            </div>

            <div style="background:rgba(255,0,0,0.05); padding:10px; border-radius:8px;">
                <div style="font-size:11px; color:#ff4444; margin-bottom:8px;">⚙️ システム設定</div>
                <div style="display:flex; gap:5px;">
                    <button id="cp-btn-logout" style="flex:1; background:transparent; color:#ccc; border:1px solid #666; padding:8px; border-radius:4px; font-size:11px;">🚪 ログアウト</button>
                    <button id="cp-btn-reset" style="flex:1; background:#330000; color:#ff4444; border:1px solid #ff4444; padding:8px; border-radius:4px; font-size:11px;">🚨 宇宙初期化</button>
                </div>
            </div>
        `;

        // コアボタンクリック（ドラッグ直後は発動させない）
        coreBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.isCapsuleDragged()) return;
            controlPanel.style.display = controlPanel.style.display === 'none' ? 'flex' : 'none';
        };

        document.getElementById('cp-close').onclick = () => controlPanel.style.display = 'none';

        // ★★★ プラグイン（拡張モジュール）の管理ロジック ★★★
        const extLogger = document.getElementById('cp-ext-logger');
        // 前回の状態を読み込む（シークレットモード対策済）
        let isLoggerEnabled = false;
        try { isLoggerEnabled = localStorage.getItem('universe_ext_logger') === 'true'; } catch(e) {}
        extLogger.checked = isLoggerEnabled;

        const updateCapsuleSlots = () => {
            this.capsuleSlots.innerHTML = ''; // スロットを一旦空にする
            
            // ターミナルがONになっていればカプセルにボタンを追加！
            if (extLogger.checked) {
                const logBtn = document.createElement('div');
                logBtn.innerText = '🖥️';
                logBtn.title = "ターミナルを開閉";
                logBtn.style.cssText = 'display:flex; justify-content:center; align-items:center; width:32px; height:32px; border-radius:50%; background:rgba(0,255,204,0.1); border:1px solid rgba(0,255,204,0.5); color:#00ffcc; font-size:14px; cursor:pointer; transition:0.2s;';
                
                logBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (this.isCapsuleDragged && this.isCapsuleDragged()) return;
                    if (window.universeLogger) window.universeLogger.toggle(); // ターミナル開閉
                };
                
                // ボタンのホバー効果
                logBtn.onmouseover = () => logBtn.style.background = 'rgba(0,255,204,0.4)';
                logBtn.onmouseout = () => logBtn.style.background = 'rgba(0,255,204,0.1)';

                this.capsuleSlots.appendChild(logBtn);
            }

            try { localStorage.setItem('universe_ext_logger', extLogger.checked); } catch(e) {}
        };

        // チェックボックスを押すたびにカプセルを更新
        extLogger.onchange = updateCapsuleSlots;
        updateCapsuleSlots(); // 初期描画

        // 🔍 レーダー処理
        const radarInput = document.getElementById('cp-radar');
        const radarResults = document.getElementById('cp-radar-results');
        radarInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            radarResults.innerHTML = '';
            if (!query) return;
            let count = 0;
            const searchUniverse = (u) => {
                u.nodes.forEach(n => {
                    if (n.name.toLowerCase().includes(query) && count < 10) {
                        const btn = document.createElement('button');
                        btn.innerText = `🌌 ${n.name}`;
                        btn.style.cssText = 'background:transparent; color:#00ffcc; border:none; text-align:left; cursor:pointer; padding:5px; border-bottom:1px solid rgba(0,255,204,0.2); width:100%; display:block;';
                        btn.onclick = () => {
                            this.app.executeWarp(n);
                            radarInput.value = ''; radarResults.innerHTML = '';
                            controlPanel.style.display = 'none';
                        };
                        radarResults.appendChild(btn);
                        count++;
                    }
                    searchUniverse(n.innerUniverse);
                });
            };
            searchUniverse(this.app.universeHistory.length > 0 ? this.app.universeHistory[0] : this.app.currentUniverse);
        });

        // 🛠️ モード切替
        const updateMode = (mode) => {
            this.app.appMode = mode;
            document.getElementById('cp-mode-run').style.background = mode === 'RUN' ? '#00ffcc' : '#113344';
            document.getElementById('cp-mode-run').style.color = mode === 'RUN' ? '#000' : '#fff';
            document.getElementById('cp-mode-link').style.background = mode === 'LINK' ? '#ff00ff' : '#113344';
            document.getElementById('cp-mode-edit').style.background = mode === 'EDIT' ? '#ffcc00' : '#113344';
            document.getElementById('cp-mode-edit').style.color = mode === 'EDIT' ? '#000' : '#fff';
            controlPanel.style.display = 'none';
        };
        document.getElementById('cp-mode-run').onclick = () => updateMode('RUN');
        document.getElementById('cp-mode-link').onclick = () => updateMode('LINK');
        document.getElementById('cp-mode-edit').onclick = () => updateMode('EDIT');

        // 🌟 星の創造
        document.getElementById('cp-spawn-btn').onclick = () => {
            const color = document.getElementById('cp-spawn-color').value;
            this.app.currentUniverse.addNode('新規データ', -this.app.camera.x, -this.app.camera.y, 25, color, 'star');
            this.app.autoSave(); 
            controlPanel.style.display = 'none';
        };

        // 🎒 データ管理
        document.getElementById('cp-btn-inventory').onclick = () => { controlPanel.style.display = 'none'; this.showInventoryUI(); };
        document.getElementById('cp-btn-export').onclick = () => { Singularity.export(); controlPanel.style.display = 'none'; };
        const fileInput = document.getElementById('cp-import-file');
        document.getElementById('cp-btn-import').onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
            const f = e.target.files[0];
            if (f && confirm("宇宙を上書きしますか？")) {
                const data = await Singularity.importAndVerify(f);
                await saveEncryptedUniverse(data); window.location.reload();
            }
        };

        // ⚙️ システム設定
        document.getElementById('cp-btn-logout').onclick = () => {
            sessionStorage.clear(); localStorage.clear(); window.location.reload();
        };
        document.getElementById('cp-btn-reset').onclick = () => {
            if(confirm("本当に初期化しますか？")){ sessionStorage.clear(); localStorage.clear(); window.location.reload(); }
        };

        // 各種モーダル
        this.inventoryModal = this.createModal('#ff6699', 300);
        this.appLibraryModal = this.createModal('#00ffcc', 300);
        this.actionMenu = this.createModal('#00ffcc', 200, false);
        this.actionMenu.style.background = 'rgba(0,0,0,0.95)';
        
        this.quickNotePanel = document.createElement('div');
        this.quickNotePanel.style.cssText = 'position:fixed; display:none; flex-direction:column; background:rgba(10,20,30,0.95); border-left:4px solid #00ffcc; padding:15px; border-radius:8px; z-index:200; min-width:200px; max-width:300px; color:white; pointer-events:auto; backdrop-filter:blur(5px);';
        this.protectUI(this.quickNotePanel);
        document.body.appendChild(this.quickNotePanel);

        window.addEventListener('mousedown', (e) => { if(!this.quickNotePanel.contains(e.target)) this.hideQuickNote(); });
        window.addEventListener('touchstart', (e) => { if(!this.quickNotePanel.contains(e.target)) this.hideQuickNote(); });
    }

    createModal(color, width, centered = true) {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed; display:none; flex-direction:column; background:rgba(20,20,30,0.98); border:1px solid ${color}; padding:20px; border-radius:12px; z-index:1000; min-width:${width}px; color:white; pointer-events:auto; box-shadow: 0 10px 40px rgba(0,0,0,0.5);`;
        if(centered) { el.style.top = '50%'; el.style.left = '50%'; el.style.transform = 'translate(-50%, -50%)'; }
        this.protectUI(el);
        document.body.appendChild(el);
        return el;
    }

    // --- メニュー操作など（変更なし） ---
    showMenu(node, screenX, screenY) {
        this.hideQuickNote();
        this.actionMenu.style.left = `${Math.min(screenX, window.innerWidth - 220)}px`;
        this.actionMenu.style.top = `${Math.min(screenY, window.innerHeight - 380)}px`;
        this.actionMenu.style.display = 'flex';

        const btn = 'color:white; background:rgba(255,255,255,0.1); border:none; padding:12px; cursor:pointer; text-align:left; border-radius:6px; font-size:14px; margin-bottom:2px; width:100%;';
        
        this.actionMenu.innerHTML = `
            <button id="m-dive" style="${btn}">➡ 内部へ潜る</button>
            <button id="m-note" style="${btn} color:#aaffff;">📝 記憶を編集</button>
            <div style="display:flex; gap:2px; margin-bottom:2px;">
                <button id="m-up" style="${btn} flex:1; text-align:center; color:#ffcc00; margin-bottom:0;">🌟 拡大</button>
                <button id="m-down" style="${btn} flex:1; text-align:center; color:#aaa; margin-bottom:0;">🌠 縮小</button>
            </div>
            <button id="m-ren" style="${btn} color:#ccff66;">✏ 名前変更</button>
            <button id="m-link" style="${btn} color:#aaaaff;">📱 アプリ/URL登録</button>
            <button id="m-del" style="${btn} color:#ff4444; border:1px solid #ff4444;">🎒 亜空間へ送る</button>
            <button id="m-close" style="${btn} background:transparent; text-align:center; font-size:12px;">❌ 閉じる</button>`;

        document.getElementById('m-dive').onclick = (e) => { e.stopPropagation(); this.hideMenu(); this.app.isZoomingIn = true; this.app.targetUniverse = node.innerUniverse; this.app.camera.zoomTo(node.x, node.y); };
        document.getElementById('m-note').onclick = (e) => { e.stopPropagation(); this.hideMenu(); this.notePad.open(node); };
        document.getElementById('m-up').onclick = (e) => { e.stopPropagation(); node.size = Math.min(150, node.size + 10); this.app.autoSave(); };
        document.getElementById('m-down').onclick = (e) => { e.stopPropagation(); node.size = Math.max(5, node.size - 10); this.app.autoSave(); };
        document.getElementById('m-ren').onclick = (e) => { e.stopPropagation(); const n = prompt("新しい名前:", node.name); if(n){node.name=n; this.app.autoSave();} this.hideMenu(); };
        document.getElementById('m-link').onclick = (e) => { e.stopPropagation(); this.hideMenu(); this.showAppLibrary(node); };
        document.getElementById('m-del').onclick = (e) => { e.stopPropagation(); if(confirm("亜空間へ送りますか？")){this.app.currentUniverse.removeNode(node); this.app.blackHole.push(node); this.app.autoSave();} this.hideMenu(); };
        document.getElementById('m-close').onclick = (e) => { e.stopPropagation(); this.hideMenu(); };
    }

    showQuickNote(node, x, y) {
        if (!node.note || node.note.trim() === "") return;
        this.quickNotePanel.innerHTML = `<div style="color:#00ffcc; font-weight:bold; border-bottom:1px solid #333; padding-bottom:5px; margin-bottom:5px;">${node.name} の記憶</div><div style="font-size:13px; max-height:200px; overflow-y:auto; line-height:1.5; white-space:pre-wrap; word-break:break-all;">${node.note}</div>`;
        this.quickNotePanel.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
        this.quickNotePanel.style.top = `${Math.min(y, window.innerHeight - 250)}px`;
        this.quickNotePanel.style.display = 'flex';
    }

    hideQuickNote() { this.quickNotePanel.style.display = 'none'; }
    hideMenu() { this.actionMenu.style.display = 'none'; }

    updateBreadcrumbs() {
        this.breadcrumbUI.innerHTML = '';
        const path = [...this.app.universeHistory, this.app.currentUniverse];
        path.forEach((uni, i) => {
            const b = document.createElement('button');
            const isLast = (i === path.length - 1);
            b.innerText = (i === 0) ? `👤 ${uni.name}` : uni.name;
            b.style.cssText = `background:rgba(255,255,255,${isLast ? '0.2' : '0.0'}); color:${isLast ? '#fff' : '#aaa'}; border:none; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:${isLast ? 'bold' : 'normal'};`;
            
            b.onclick = (e) => { 
                e.stopPropagation();
                if(this.isCapsuleDragged && this.isCapsuleDragged()) return;
                
                if(!isLast){
                    this.app.currentUniverse = this.app.universeHistory[i]; 
                    this.app.universeHistory = this.app.universeHistory.slice(0, i); 
                    this.app.camera.reset(); this.updateBreadcrumbs();
                } 
            };
            this.breadcrumbUI.appendChild(b);
            if(!isLast) { const s = document.createElement('span'); s.innerText = '>'; s.style.cssText = 'color:#555; margin:0 2px;'; this.breadcrumbUI.appendChild(s); }
        });
        if(this.centerTextEl) this.centerTextEl.innerHTML = `${this.app.currentUniverse.name} <span style="font-size:0.6em; opacity:0.5;">✏️</span>`;
    }

    showAppLibrary(node) {
        let html = `<h3 style="margin-top:0; color:#00ffcc;">📱 アプリを登録</h3><div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:15px;">`;
        this.app.appPresets.forEach((app, i) => {
            html += `<div id="preset-${i}" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; padding:5px; background:rgba(255,255,255,0.05); border-radius:8px;"><img src="${app.icon}" style="width:32px; height:32px; border-radius:8px; margin-bottom:5px;"><span style="font-size:9px;">${app.name}</span></div>`;
        });
        html += `</div><button id="custom-url-btn" style="width:100%; padding:10px; background:#113344; color:#00ffff; border:1px solid #00ffff; border-radius:5px; cursor:pointer; margin-bottom:10px;">✍️ 自分でURLを入力</button>`;
        if (node.url) html += `<button id="reset-app-btn" style="width:100%; padding:10px; background:#441111; color:#ff4444; border:1px solid #ff4444; border-radius:5px; cursor:pointer; margin-bottom:10px;">🧹 リンク解除</button>`;
        html += `<button id="lib-close" style="width:100%; padding:10px; background:transparent; color:white; border:1px solid #888; border-radius:6px;">キャンセル</button>`;
        
        this.appLibraryModal.innerHTML = html;
        this.appLibraryModal.style.display = 'block';
        
        this.app.appPresets.forEach((app, i) => {
            document.getElementById(`preset-${i}`).onclick = (e) => { e.stopPropagation(); node.name = app.name; node.url = app.url; node.iconUrl = app.icon; this.app.autoSave(); this.appLibraryModal.style.display='none'; };
        });
        document.getElementById('custom-url-btn').onclick = (e) => { e.stopPropagation(); this.appLibraryModal.style.display = 'none'; const newUrl = prompt("URLを入力:", node.url); if(newUrl){ node.url = newUrl; this.app.autoSave(); }};
        const resetBtn = document.getElementById('reset-app-btn');
        if(resetBtn) resetBtn.onclick = (e) => { e.stopPropagation(); node.url = ""; node.iconUrl = ""; this.app.autoSave(); this.appLibraryModal.style.display = 'none'; };
        document.getElementById('lib-close').onclick = (e) => { e.stopPropagation(); this.appLibraryModal.style.display='none'; };
    }

    showInventoryUI() {
        let html = `<h3 style="margin-top:0; color:#ff6699;">🎒 亜空間ポケット</h3><div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">`;
        this.app.blackHole.forEach((node, i) => {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.1); padding:10px; border-radius:8px;"><span>${node.name}</span><div><button id="inv-res-${i}" style="background:#003333; color:#00ffcc; border:none; padding:5px 10px; border-radius:4px; font-size:12px; margin-right:5px;">🌌 出す</button><button id="inv-del-${i}" style="background:#440000; color:#ff4444; border:none; padding:5px 10px; border-radius:4px; font-size:12px;">❌</button></div></div>`;
        });
        html += `</div><button id="inv-close" style="margin-top:15px; width:100%; padding:10px; background:transparent; color:white; border:1px solid #888; border-radius:6px;">閉じる</button>`;
        
        this.inventoryModal.innerHTML = html;
        this.inventoryModal.style.display = 'block';
        
        this.app.blackHole.forEach((node, i) => {
            document.getElementById(`inv-res-${i}`).onclick = (e) => { e.stopPropagation(); this.app.blackHole.splice(i, 1); node.x = -this.app.camera.x; node.y = -this.app.camera.y; this.app.currentUniverse.nodes.push(node); this.app.autoSave(); this.inventoryModal.style.display='none'; };
            document.getElementById(`inv-del-${i}`).onclick = (e) => { e.stopPropagation(); if(confirm("消去しますか？")){ this.app.blackHole.splice(i, 1); this.app.autoSave(); this.showInventoryUI(); }};
        });
        document.getElementById('inv-close').onclick = (e) => { e.stopPropagation(); this.inventoryModal.style.display='none'; };
    }
}