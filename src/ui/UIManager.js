// src/ui/UIManager.js
import { Singularity } from '../db/Singularity.js';
import { saveEncryptedUniverse } from '../db/CloudSync.js';
import { NotePadUI } from './NotePadUI.js';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.notePad = new NotePadUI(app);
        this.createUI();
    }

    makeDraggable(el) {
        let isDragging = false, startX, startY, initX, initY, hasMoved = false;

        const down = (e) => {
            hasMoved = false;
            const ev = e.touches ? e.touches[0] : e;
            startX = ev.clientX; startY = ev.clientY;
            const rect = el.getBoundingClientRect();
            initX = rect.left; initY = rect.top;
            isDragging = true;
            el.style.transition = 'none';
        };

        const move = (e) => {
            if (!isDragging) return;
            const ev = e.touches ? e.touches[0] : e;
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
            
            let nx = initX + dx; let ny = initY + dy;
            
            nx = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, nx));
            ny = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, ny));
            
            el.style.left = `${nx}px`;
            el.style.top = `${ny}px`;
            el.style.right = 'auto'; 
            el.style.bottom = 'auto';
        };

        const up = () => {
            if (isDragging) { isDragging = false; el.style.transition = '0.2s'; }
        };

        el.addEventListener('mousedown', down); el.addEventListener('touchstart', down, {passive: true});
        window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive: true});
        window.addEventListener('mouseup', up); window.addEventListener('touchend', up);

        return () => hasMoved; 
    }

    createUI() {
        const uiStyle = 'position:fixed; z-index:100; font-family:sans-serif; color:white; background:rgba(20,20,30,0.8); border:1px solid rgba(255,255,255,0.2); border-radius:8px; padding:10px; backdrop-filter:blur(5px);';
        const fabStyle = 'position:fixed; z-index:101; display:flex; justify-content:center; align-items:center; width:46px; height:46px; border-radius:50%; cursor:pointer; font-size:22px; backdrop-filter:blur(5px); transition:0.2s; user-select:none;';

        const toggleDynamicMenu = (fab, menu, baseColor) => {
            const isHidden = menu.style.display === 'none';
            if (!isHidden) {
                menu.style.display = 'none';
                fab.style.background = `rgba(${baseColor},0.1)`;
                return;
            }

            menu.style.display = 'flex';
            fab.style.background = `rgba(${baseColor},0.4)`;

            const fabRect = fab.getBoundingClientRect();
            const menuRect = menu.getBoundingClientRect();

            let top = fabRect.bottom + 10;
            let left = fabRect.left;

            if (top + menuRect.height > window.innerHeight - 10) {
                top = fabRect.top - menuRect.height - 10;
            }
            if (left + menuRect.width > window.innerWidth - 10) {
                left = window.innerWidth - menuRect.width - 10;
            }
            if (top < 10) top = 10;
            if (left < 10) left = 10;

            menu.style.top = `${top}px`;
            menu.style.left = `${left}px`;
            menu.style.bottom = 'auto';
            menu.style.right = 'auto';
        };

        this.centerTextEl = document.createElement('div');
        this.centerTextEl.id = 'center-text';
        this.centerTextEl.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); color:rgba(255,255,255,0.1); font-size:4vw; font-weight:bold; cursor:pointer; pointer-events:auto; z-index:10; white-space:nowrap;';
        this.centerTextEl.title = "クリックで現在の階層の名前を変更";
        this.centerTextEl.onclick = () => {
            const newName = prompt("現在の階層の名前を変更します:", this.app.currentUniverse.name);
            if (newName) {
                const oldName = this.app.currentUniverse.name;
                this.app.currentUniverse.name = newName;
                this.app.autoSave();
                this.updateBreadcrumbs(); 
                if(window.universeLogger) window.universeLogger.log("UNIVERSE_RENAMED", { from: oldName, to: newName });
            }
        };
        document.body.appendChild(this.centerTextEl);

        this.breadcrumbUI = document.createElement('div');
        this.breadcrumbUI.style.cssText = 'position:fixed; top:15px; left:15px; z-index:100; display:flex; gap:5px; flex-wrap:wrap; font-family:sans-serif; color:white; align-items:center; pointer-events:auto;';
        document.body.appendChild(this.breadcrumbUI);

        const searchFab = document.createElement('div');
        searchFab.style.cssText = `${fabStyle} top:15px; right:15px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; color:#00ffcc;`;
        searchFab.innerText = '🔍';
        document.body.appendChild(searchFab);

        const searchUI = document.createElement('div');
        searchUI.style.cssText = `${uiStyle} display:none; flex-direction:column; gap:5px; width:200px;`;
        searchUI.innerHTML = `
            <input type="text" id="radar-input" placeholder="星を探す..." style="background:rgba(0,0,0,0.5); color:white; border:1px solid #00ffcc; padding:5px; border-radius:4px; outline:none; font-size:12px;">
            <div id="radar-results" style="max-height:150px; overflow-y:auto; font-size:11px; display:flex; flex-direction:column; gap:2px;"></div>
        `;
        document.body.appendChild(searchUI);

        const isSearchDragged = this.makeDraggable(searchFab);
        searchFab.onclick = () => {
            if (isSearchDragged()) return; 
            toggleDynamicMenu(searchFab, searchUI, '0,255,204');
        };

        const radarInput = document.getElementById('radar-input');
        const radarResults = document.getElementById('radar-results');
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
                        btn.style.cssText = 'background:transparent; color:#00ffcc; border:none; text-align:left; cursor:pointer; padding:3px; border-bottom:1px solid rgba(0,255,204,0.2);';
                        btn.onclick = () => {
                            this.app.executeWarp(n);
                            radarInput.value = ''; radarResults.innerHTML = '';
                            searchUI.style.display = 'none';
                            searchFab.style.background = 'rgba(0,255,204,0.1)';
                            if(window.universeLogger) window.universeLogger.log("RADAR_WARP", { target: n.name });
                        };
                        radarResults.appendChild(btn);
                        count++;
                    }
                    searchUniverse(n.innerUniverse);
                });
            };
            let root = this.app.currentUniverse;
            if (this.app.universeHistory.length > 0) root = this.app.universeHistory[0];
            searchUniverse(root);
        });

        const toolFab = document.createElement('div');
        toolFab.style.cssText = `${fabStyle} bottom:15px; left:15px; background:rgba(0,255,255,0.1); border:1px solid #00ffff; color:#00ffff;`;
        toolFab.innerText = '🛠️';
        document.body.appendChild(toolFab);

        const paletteUI = document.createElement('div');
        paletteUI.style.cssText = `${uiStyle} display:none; flex-direction:column; gap:8px; max-width: 170px;`;
        paletteUI.innerHTML = `
            <div style="font-size:11px; color:#aaa; text-align:center;">🔄 操作モード</div>
            <div style="display:flex; gap:3px;">
                <button id="mode-run" style="flex:1; padding:8px 2px; background:#00ffcc; color:#000; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">👆 実行</button>
                <button id="mode-link" style="flex:1; padding:8px 2px; background:#113344; color:#fff; border:1px solid #00ffff; border-radius:4px; cursor:pointer; font-size:11px;">🔗 結ぶ</button>
                <button id="mode-edit" style="flex:1; padding:8px 2px; background:#113344; color:#fff; border:1px solid #00ffff; border-radius:4px; cursor:pointer; font-size:11px;">⚙️ 編集</button>
            </div>
            <hr style="border-color:rgba(255,255,255,0.2); margin:2px 0;">
            <div style="font-size:11px; color:#aaa; text-align:center; margin-bottom:2px;">＋ 創造する</div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:5px; background:rgba(0,0,0,0.5); padding:5px; border-radius:5px;">
                <input type="color" id="spawn-color" value="#00ffcc" style="width:30px; height:30px; border:none; border-radius:5px; cursor:pointer; background:transparent; padding:0;">
                <button id="spawn-btn" style="flex:1; cursor:pointer; background:#114433; color:#00ffcc; border:1px solid #00ffcc; padding:8px; border-radius:5px; font-size:12px; font-weight:bold;">🌟 新しい星</button>
            </div>
        `;
        document.body.appendChild(paletteUI);

        const isToolDragged = this.makeDraggable(toolFab);
        toolFab.onclick = () => {
            if (isToolDragged()) return;
            toggleDynamicMenu(toolFab, paletteUI, '0,255,255');
        };

        const updateModeUI = () => {
            document.getElementById('mode-run').style.background = this.app.appMode === 'RUN' ? '#00ffcc' : '#113344';
            document.getElementById('mode-run').style.color = this.app.appMode === 'RUN' ? '#000' : '#fff';
            document.getElementById('mode-link').style.background = this.app.appMode === 'LINK' ? '#ff00ff' : '#113344';
            document.getElementById('mode-edit').style.background = this.app.appMode === 'EDIT' ? '#ffcc00' : '#113344';
            document.getElementById('mode-edit').style.color = this.app.appMode === 'EDIT' ? '#000' : '#fff';
            this.hideMenu(); paletteUI.style.display = 'none'; toolFab.style.background = 'rgba(0,255,255,0.1)';
            if(window.universeLogger) window.universeLogger.log("MODE_CHANGED", { mode: this.app.appMode });
        };

        document.getElementById('mode-run').onclick = () => { this.app.appMode = 'RUN'; updateModeUI(); };
        document.getElementById('mode-link').onclick = () => { this.app.appMode = 'LINK'; updateModeUI(); };
        document.getElementById('mode-edit').onclick = () => { this.app.appMode = 'EDIT'; updateModeUI(); };

        document.getElementById('spawn-btn').onclick = () => {
            if (this.app.isZoomingIn) return;
            const selectedColor = document.getElementById('spawn-color').value;
            this.app.currentUniverse.addNode('新規データ', -this.app.camera.x, -this.app.camera.y, Math.random() * 10 + 15, selectedColor, 'star');
            this.app.autoSave(); 
            if (window.universeLogger) {
                window.universeLogger.log("STAR_CREATED", { color: selectedColor, coords: `X:${-Math.floor(this.app.camera.x)}, Y:${-Math.floor(this.app.camera.y)}` });
            }
            paletteUI.style.display = 'none'; toolFab.style.background = 'rgba(0,255,255,0.1)';
        };

        const sysFab = document.createElement('div');
        sysFab.style.cssText = `${fabStyle} bottom:15px; right:15px; background:rgba(255,102,153,0.1); border:1px solid #ff6699; color:#ff6699;`;
        sysFab.innerText = '🎒';
        document.body.appendChild(sysFab);

        const hintUI = document.createElement('div');
        hintUI.style.cssText = `${uiStyle} display:none; flex-direction:column; gap:8px; max-width: 150px;`;
        hintUI.innerHTML = `
            <div style="font-size:11px; color:#aaa; text-align:center;">データ管理</div>
            <button id="btn-inventory" style="width:100%; background:#220022; color:#ff6699; border:1px solid #ff6699; padding:10px 5px; cursor:pointer; border-radius:3px; font-weight:bold;">🎒 亜空間<br>(復元/消去)</button>
            <hr style="border-color:rgba(255,255,255,0.2); margin:2px 0;">
            <div style="font-size:11px; color:#aaa; text-align:center;">特異点圧縮 (.universe)</div>
            <button id="btn-export" style="width:100%; background:#112244; color:#66aaff; border:1px solid #66aaff; padding:8px 5px; cursor:pointer; border-radius:3px; font-size:11px; font-weight:bold;">💾 宇宙を出力</button>
            <button id="btn-import" style="width:100%; background:#442211; color:#ffaa66; border:1px solid #ffaa66; padding:8px 5px; cursor:pointer; border-radius:3px; font-size:11px; font-weight:bold;">📂 宇宙を読込</button>
            <input type="file" id="import-file" accept=".universe" style="display:none;">
        `;
        document.body.appendChild(hintUI);

        const isSysDragged = this.makeDraggable(sysFab);
        sysFab.onclick = () => {
            if (isSysDragged()) return;
            toggleDynamicMenu(sysFab, hintUI, '255,102,153');
        };

        document.getElementById('btn-inventory').addEventListener('click', () => {
            hintUI.style.display = 'none'; sysFab.style.background = 'rgba(255,102,153,0.1)';
            if (this.app.blackHole.length === 0) return alert("ポケットは空です。");
            this.showInventoryUI();
        });

        document.getElementById('btn-export').onclick = () => {
            if (confirm("現在の宇宙を暗号化された物理ファイル(.universe)としてダウンロードしますか？")) {
                Singularity.export();
                if(window.universeLogger) window.universeLogger.log("SINGULARITY_EXPORT", { status: "Success" });
            }
        };

        const fileInput = document.getElementById('import-file');
        document.getElementById('btn-import').onclick = () => fileInput.click();
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (confirm(`「${file.name}」を展開し、現在の宇宙を上書きしますか？\n※この操作は取り消せません。`)) {
                try {
                    const encryptedData = await Singularity.importAndVerify(file);
                    await saveEncryptedUniverse(encryptedData);
                    alert("特異点からの宇宙展開に成功しました！再起動します。");
                    window.location.reload(); 
                } catch (err) {
                    alert(err);
                }
            }
            fileInput.value = '';
            hintUI.style.display = 'none';
        };

        this.inventoryModal = document.createElement('div');
        this.inventoryModal.style.cssText = 'display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(20,20,30,0.95); border:1px solid #ff6699; padding:20px; border-radius:10px; z-index:300; min-width:320px; color:white; box-shadow: 0 10px 30px rgba(255,102,153,0.3);';
        document.body.appendChild(this.inventoryModal);

        this.actionMenu = document.createElement('div');
        this.actionMenu.style.cssText = 'position:fixed; display:none; flex-direction:column; background:rgba(0,0,0,0.9); border:1px solid #00ffcc; padding:8px; border-radius:8px; z-index:200; gap:5px; box-shadow: 0 4px 15px rgba(0,255,204,0.2); min-width: 180px; max-height: 80vh; overflow-y: auto;';
        document.body.appendChild(this.actionMenu);

        this.appLibraryModal = document.createElement('div');
        this.appLibraryModal.style.cssText = 'display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(20,20,30,0.95); border:1px solid #00ffcc; padding:20px; border-radius:10px; z-index:400; min-width:300px; color:white; box-shadow: 0 10px 30px rgba(0,255,204,0.3);';
        document.body.appendChild(this.appLibraryModal);
    }

    showAppLibrary(node) {
        let html = `<h3 style="margin-top:0; margin-bottom:15px; color:#00ffcc; border-bottom:1px solid #00ffcc; padding-bottom:5px;">📱 アプリを追加/編集</h3>`;
        html += `<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:15px;">`;

        this.app.appPresets.forEach((app, index) => {
            html += `
                <div id="preset-${index}" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; padding:5px; border-radius:8px; transition:0.2s; background:rgba(255,255,255,0.05);">
                    <img src="${app.icon}" style="width:32px; height:32px; border-radius:8px; margin-bottom:5px;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\'><rect width=\\'32\\' height=\\'32\\' fill=\\'%23555\\'/></svg>'">
                    <span style="font-size:10px; text-align:center;">${app.name}</span>
                </div>
            `;
        });
        html += `</div>`;
        html += `<button id="custom-url-btn" style="width:100%; padding:10px; background:#113344; color:#00ffff; border:1px solid #00ffff; border-radius:5px; cursor:pointer; margin-bottom:10px;">✍️ 自分でURLを手入力する</button>`;
        
        if (node.url || node.iconUrl) {
            html += `<button id="reset-app-btn" style="width:100%; padding:10px; background:#441111; color:#ff4444; border:1px solid #ff4444; border-radius:5px; cursor:pointer; margin-bottom:10px;">🧹 リンクとアイコンを解除</button>`;
        }
        
        html += `<button id="lib-close" style="width:100%; padding:10px; background:transparent; color:white; border:1px solid #aaa; border-radius:5px; cursor:pointer;">キャンセル</button>`;

        this.appLibraryModal.innerHTML = html;
        this.appLibraryModal.style.display = 'block';

        this.app.appPresets.forEach((app, index) => {
            document.getElementById(`preset-${index}`).onclick = () => {
                node.name = app.name; node.url = app.url; node.iconUrl = app.icon;
                this.app.autoSave(); this.appLibraryModal.style.display = 'none'; this.hideMenu();
                if(window.universeLogger) window.universeLogger.log("APP_LINKED", { target: node.name, app: app.name });
            };
        });

        document.getElementById('custom-url-btn').onclick = () => {
            this.appLibraryModal.style.display = 'none';
            const newUrl = prompt("URLまたはアプリ起動用スキームを入力\n(例: https://example.com)", node.url);
            if (newUrl) { 
                node.url = newUrl;
                if (newUrl.startsWith('http') && !node.iconUrl && confirm("アイコンを自動取得しますか？")) {
                    try {
                        const domain = new URL(newUrl).hostname;
                        node.iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                    } catch(e) { node.iconUrl = `https://www.google.com/s2/favicons?domain=${newUrl}&sz=128`; }
                }
                this.app.autoSave(); 
                if(window.universeLogger) window.universeLogger.log("CUSTOM_URL_LINKED", { target: node.name, url: newUrl });
            }
            this.hideMenu();
        };

        const resetBtn = document.getElementById('reset-app-btn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if(confirm("この星のリンクとアイコンを解除しますか？")) {
                    node.url = ""; node.iconUrl = "";
                    this.app.autoSave(); this.appLibraryModal.style.display = 'none'; this.hideMenu();
                    if(window.universeLogger) window.universeLogger.log("LINK_CLEARED", { target: node.name });
                }
            };
        }
        document.getElementById('lib-close').onclick = () => { this.appLibraryModal.style.display = 'none'; };
    }

    showInventoryUI() {
        let html = `<h3 style="margin-top:0; margin-bottom:15px; color:#ff6699; border-bottom:1px solid #ff6699; padding-bottom:5px;">🎒 亜空間ポケット</h3>`;
        html += `<div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">`;

        this.app.blackHole.forEach((node, index) => {
            const innerCount = node.innerUniverse.nodes.length;
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.1); padding:10px; border-radius:5px;">
                    <div>
                        <div style="font-size:14px; font-weight:bold;">${node.name}</div>
                        <div style="font-size:11px; color:#aaa;">内包データ: ${innerCount}個</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button id="inv-restore-${index}" style="background:#003333; color:#00ffcc; border:1px solid #00ffcc; padding:5px 8px; border-radius:3px; cursor:pointer; font-size:12px;">🌌 出す</button>
                        <button id="inv-delete-${index}" style="background:#440000; color:#ff4444; border:1px solid #ff4444; padding:5px 8px; border-radius:3px; cursor:pointer; font-size:12px;">❌</button>
                    </div>
                </div>
            `;
        });
        html += `</div><button id="inv-close" style="margin-top:15px; width:100%; padding:10px; background:transparent; color:white; border:1px solid #aaa; border-radius:5px; cursor:pointer;">閉じる</button>`;
        
        this.inventoryModal.innerHTML = html;
        this.inventoryModal.style.display = 'block';

        this.app.blackHole.forEach((node, index) => {
            document.getElementById(`inv-restore-${index}`).onclick = () => {
                this.app.blackHole.splice(index, 1);
                node.x = -this.app.camera.x; node.y = -this.app.camera.y;
                node.baseX = node.x; node.baseY = node.y;
                this.app.currentUniverse.nodes.push(node);
                node.parentUniverse = this.app.currentUniverse;
                this.app.autoSave();
                this.inventoryModal.style.display = 'none';
                
                if(window.universeLogger) window.universeLogger.log("RESTORED_FROM_BLACKHOLE", { name: node.name });
            };

            document.getElementById(`inv-delete-${index}`).onclick = () => {
                if(confirm(`「${node.name}」を完全に消去しますか？`)) {
                    this.app.blackHole.splice(index, 1);
                    this.app.autoSave();
                    if(window.universeLogger) window.universeLogger.log("DATA_ERASED", { name: node.name });
                    
                    if (this.app.blackHole.length > 0) this.showInventoryUI();
                    else this.inventoryModal.style.display = 'none';
                }
            };
        });
        document.getElementById('inv-close').onclick = () => { this.inventoryModal.style.display = 'none'; };
    }

    showMenu(node, screenX, screenY) {
        // メニューが画面下部にはみ出さないよう座標を補正
        this.actionMenu.style.left = `${screenX}px`;
        this.actionMenu.style.top = `${screenY}px`;
        this.actionMenu.style.display = 'flex';
        
        const btnStyle = 'color:white; background:rgba(255,255,255,0.1); border:none; padding:10px 12px; cursor:pointer; text-align:left; border-radius:4px; font-size:14px; margin-bottom:2px; display:flex; justify-content:space-between; align-items:center;';
        
        let menuHTML = '';

        // ★ 新機能：もし星にメモ（記憶）があれば、メニューの最上部にプレビューとして表示！
        if (node.note && node.note.trim() !== "") {
            menuHTML += `
                <div style="background:rgba(0, 30, 20, 0.9); border-left:4px solid #00ffcc; padding:10px; margin-bottom:8px; border-radius:4px; font-size:12px; color:#e0f0ff; max-height:150px; overflow-y:auto; white-space:pre-wrap; word-break:break-all; line-height:1.4; box-shadow:inset 0 0 10px rgba(0,0,0,0.5);">
                    ${node.note}
                </div>
            `;
        }

        menuHTML += `<button id="menu-dive" style="${btnStyle} color:#ffffff;"><span>➡ 内部へ潜る</span></button>`;
        menuHTML += `<button id="menu-note" style="${btnStyle} color:#aaffff; background:rgba(170,255,255,0.1);"><span>📝 記憶を刻む/編集</span></button>`;

        if (node.url) {
            const isAppScheme = !node.url.startsWith('http');
            const openText = isAppScheme ? '📱 アプリを起動' : '🌐 リンクを開く';
            menuHTML += `<button id="menu-open-url" style="${btnStyle} background:rgba(0,255,204,0.2); color:#00ffcc; border:1px solid #00ffcc;"><span>${openText}</span></button>`;
        }

        menuHTML += `
            <div style="display:flex; gap:2px; margin-bottom:2px;">
                <button id="menu-size-up" style="${btnStyle} flex:1; justify-content:center; color:#ffcc00; margin-bottom:0;">🌟 拡大</button>
                <button id="menu-size-down" style="${btnStyle} flex:1; justify-content:center; color:#aaa; margin-bottom:0;">🌠 縮小</button>
            </div>
            <button id="menu-rename" style="${btnStyle} color:#ccff66;"><span>✏ 名前変更</span></button>
            <button id="menu-set-app" style="${btnStyle} color:#aaaaff; background:rgba(170,170,255,0.1);"><span>📱 アプリ/URLを登録</span></button>
            <button id="menu-set-icon" style="${btnStyle} color:#ffaa00;"><span>🖼 アイコン手動設定</span></button>
            <button id="menu-memorize" style="${btnStyle} color:#00ffff;"><span>💡 座標を記憶</span></button>
        `;

        if (this.app.memorizedNode && this.app.memorizedNode.id !== node.id) {
            menuHTML += `<button id="menu-connect" style="${btnStyle} color:#ff00ff; background:rgba(255,0,255,0.1);"><span>🌀 次元接続</span></button>`;
        }

        const connectedWormholes = this.app.wormholes.filter(wh => wh.source.id === node.id || wh.target.id === node.id);
        connectedWormholes.forEach((wh, index) => {
            const dest = (wh.source.id === node.id) ? wh.target : wh.source;
            menuHTML += `<button id="menu-warp-${index}" style="${btnStyle} color:#ff88ff;"><span>🌌 [${dest.name}]へワープ</span></button>`;
        });

        menuHTML += `<button id="menu-delete" style="${btnStyle} color:#ff4444; border:1px solid #ff4444;"><span>🎒 亜空間へ送る</span></button>`;
        this.actionMenu.innerHTML = menuHTML;

        // メニューが画面下にはみ出ないように再計算
        setTimeout(() => {
            const menuRect = this.actionMenu.getBoundingClientRect();
            if (menuRect.bottom > window.innerHeight) {
                this.actionMenu.style.top = `${Math.max(10, window.innerHeight - menuRect.height - 10)}px`;
            }
        }, 0);

        document.getElementById('menu-note').onclick = () => {
            this.hideMenu();
            this.notePad.open(node); 
        };

        document.getElementById('menu-dive').onclick = () => {
            this.hideMenu(); this.app.isZoomingIn = true;
            this.app.targetUniverse = node.innerUniverse;
            this.app.camera.zoomTo(node.x, node.y);
            if(window.universeLogger) window.universeLogger.log("DIVE_INTO_NODE", { target: node.name });
        };

        if (node.url) {
            document.getElementById('menu-open-url').onclick = () => {
                const targetWin = node.url.startsWith('http') ? '_blank' : '_self';
                window.open(node.url, targetWin); 
                this.hideMenu();
                if(window.universeLogger) window.universeLogger.log("EXECUTE_LINK", { url: node.url });
            };
        }

        document.getElementById('menu-size-up').onclick = () => {
            node.size += 5;
            if (node.size > 150) node.size = 150; 
            this.app.autoSave();
        };

        document.getElementById('menu-size-down').onclick = () => {
            node.size -= 5;
            if (node.size < 5) node.size = 5; 
            this.app.autoSave();
        };

        document.getElementById('menu-rename').onclick = () => {
            const newName = prompt("新しい名前:", node.name);
            if (newName) { node.name = newName; this.app.autoSave(); }
            this.hideMenu();
        };

        document.getElementById('menu-set-app').onclick = () => {
            this.hideMenu(); this.showAppLibrary(node);
        };

        document.getElementById('menu-set-icon').onclick = () => {
            const newIconUrl = prompt("画像のURLを入力してください:", node.iconUrl);
            if (newIconUrl !== null) { node.iconUrl = newIconUrl; this.app.autoSave(); }
            this.hideMenu();
        };

        document.getElementById('menu-memorize').onclick = () => {
            this.app.memorizedNode = node; alert(`「${node.name}」を記憶しました。`); this.hideMenu();
            if(window.universeLogger) window.universeLogger.log("COORDINATES_MEMORIZED", { target: node.name });
        };

        if (document.getElementById('menu-connect')) {
            document.getElementById('menu-connect').onclick = () => {
                this.app.wormholes.push({ source: this.app.memorizedNode, target: node });
                this.app.memorizedNode = null;
                alert("次元を超えたワームホールが開通しました！");
                this.app.autoSave(); this.hideMenu();
                if(window.universeLogger) window.universeLogger.log("WORMHOLE_OPENED", { target: node.name });
            };
        }

        connectedWormholes.forEach((wh, index) => {
            document.getElementById(`menu-warp-${index}`).onclick = () => {
                const dest = (wh.source.id === node.id) ? wh.target : wh.source;
                this.app.executeWarp(dest); this.hideMenu();
                if(window.universeLogger) window.universeLogger.log("WORMHOLE_WARP", { destination: dest.name });
            };
        });

        document.getElementById('menu-delete').onclick = () => {
            if (node.innerUniverse.nodes.length > 0) {
                if (!confirm(`内部に ${node.innerUniverse.nodes.length}個の星 が存在します。\n全てまとめて転送しますか？`)) {
                    this.hideMenu(); return;
                }
            }
            this.app.currentUniverse.removeNode(node);
            this.app.wormholes = this.app.wormholes.filter(w => w.source.id !== node.id && w.target.id !== node.id);
            this.app.blackHole.push(node);
            this.app.autoSave(); 

            if (window.universeLogger) {
                window.universeLogger.log("NODE_SENT_TO_BLACKHOLE", { name: node.name, size: node.size });
            }

            this.hideMenu();
        };
    }

    hideMenu() { this.actionMenu.style.display = 'none'; }

    updateBreadcrumbs() {
        this.breadcrumbUI.innerHTML = '';
        const path = [...this.app.universeHistory, this.app.currentUniverse];
        
        path.forEach((uni, index) => {
            const btn = document.createElement('button');
            btn.innerText = uni.name;
            const isCurrent = (index === path.length - 1);
            
            if (index === 0) btn.innerHTML = `👤 ${uni.name}`;

            btn.style.cssText = `background:rgba(255,255,255,${isCurrent ? '0.2' : '0.05'}); color:${isCurrent ? '#fff' : '#aaa'}; border:1px solid rgba(255,255,255,0.3); padding:4px 8px; border-radius:5px; cursor:pointer; font-weight:${isCurrent ? 'bold' : 'normal'}; font-size:12px;`;
            
            btn.onclick = () => {
                if (isCurrent) return;
                this.app.currentUniverse = this.app.universeHistory[index];
                this.app.universeHistory = this.app.universeHistory.slice(0, index);
                this.app.camera.reset();
                this.updateBreadcrumbs();
            };
            this.breadcrumbUI.appendChild(btn);

            if (!isCurrent) {
                const sep = document.createElement('span');
                sep.innerText = '>';
                sep.style.cssText = 'color:rgba(255,255,255,0.4); font-size:10px; margin: 0 5px;';
                this.breadcrumbUI.appendChild(sep);
            }
        });

        if (this.centerTextEl) {
            this.centerTextEl.innerHTML = `${this.app.currentUniverse.name} <span style="font-size:0.6em; opacity:0.7;">✏️</span>`;
        }
    }
}