// src/ui/UIManager.js
import { Singularity } from '../db/Singularity.js';
import { saveEncryptedUniverse } from '../db/CloudSync.js';
import { NotePadUI } from './NotePadUI.js';
import { AudioCore } from '../engine/AudioCore.js';
import { Gravity } from '../core/Gravity.js'; 
import { SingularitySearch } from './SingularitySearch.js'; 
// ★ 追加：タイムマシンをインポート
import { TimeMachine } from '../core/TimeMachine.js'; 

export class UIManager {
    constructor(app) {
        this.app = app;
        this.notePad = new NotePadUI(app);
        
        // --- 状態管理 (State) ---
        this.state = {
            activeTab: 'create', // 'create' | 'config' | 'data'
            isRapidDeleteMode: false,
            lastSpawnTime: 0,
            touchStartX: 0,
            touchStartY: 0
        };
        
        // --- サウンドエンジンの初期化 ---
        window.universeAudio = new AudioCore();

        // --- UI構築の実行 ---
        this.createUI();
        
        // （後方互換）古いDOMのクリーンアップ
        setTimeout(() => {
            const oldLogout = document.getElementById('btn-logout');
            const oldReset = document.getElementById('emergency-reset-btn');
            if(oldLogout) oldLogout.style.display = 'none';
            if(oldReset) oldReset.style.display = 'none';
        }, 500);
    }

    // ==========================================
    // ユーティリティ・イベント隔離
    // ==========================================
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
            
            // 画面外への逸脱を防止
            const nx = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, initX + dx));
            const ny = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, initY + dy));
            
            el.style.left = `${nx}px`;
            el.style.top = `${ny}px`;
            el.style.right = 'auto'; el.style.bottom = 'auto';
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
        // バックグラウンド（宇宙）へのイベント貫通を防ぐ完全シールド
        el.addEventListener('mousedown', e => e.stopPropagation());
        el.addEventListener('mouseup', e => e.stopPropagation());
        el.addEventListener('touchstart', e => e.stopPropagation(), {passive: false});
        el.addEventListener('touchend', e => e.stopPropagation(), {passive: false});
    }

    // ==========================================
    // UIコンポーネントの構築
    // ==========================================
    createUI() {
        // 1. 中央透かしテキスト
        this.centerTextEl = document.createElement('div');
        this.centerTextEl.id = 'center-text';
        this.centerTextEl.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); color:rgba(255,255,255,0.1); font-size:4vw; font-weight:bold; cursor:pointer; pointer-events:auto; z-index:10; white-space:nowrap; transition: opacity 0.3s ease-out;';
        this.protectUI(this.centerTextEl);
        this.centerTextEl.onclick = (e) => {
            e.stopPropagation();
            const newName = prompt("階層の名称を変更:", this.app.currentUniverse.name);
            if (newName) {
                this.app.currentUniverse.name = newName;
                this.app.autoSave(); 
                this.updateBreadcrumbs(); 
            }
        };
        document.body.appendChild(this.centerTextEl);

        // 2. システムカプセル（フローティングメニュー）
        this.systemCapsule = document.createElement('div');
        this.systemCapsule.style.cssText = 'position:fixed; top:20px; left:20px; z-index:9000; display:flex; align-items:center; background:rgba(10,15,25,0.85); border:1px solid rgba(0,255,204,0.5); border-radius:30px; padding:5px 15px 5px 5px; box-shadow:0 10px 30px rgba(0,255,204,0.2); backdrop-filter:blur(10px); pointer-events:auto; user-select:none; max-width:90vw; overflow-x:auto;';
        this.isCapsuleDragged = this.makeDraggable(this.systemCapsule);
        document.body.appendChild(this.systemCapsule);

        // カプセル内：コアボタン
        const coreBtn = document.createElement('div');
        coreBtn.style.cssText = 'display:flex; justify-content:center; align-items:center; width:40px; height:40px; border-radius:50%; background:rgba(0,255,204,0.2); color:#00ffcc; font-size:20px; cursor:pointer; margin-right:5px; flex-shrink:0; transition:0.2s;';
        coreBtn.innerText = '🌌';
        this.systemCapsule.appendChild(coreBtn);

        // カプセル内：特異点検索モジュール
        const searchBtn = document.createElement('div');
        searchBtn.innerText = '👁️‍🗨️';
        searchBtn.title = "特異点検索 (Singularity Search)";
        searchBtn.style.cssText = 'display:flex; justify-content:center; align-items:center; width:36px; height:36px; border-radius:50%; background:rgba(255,0,255,0.15); border:1px solid rgba(255,0,255,0.5); color:#ff00ff; cursor:pointer; margin-right:5px; flex-shrink:0; transition:0.2s; box-shadow:0 0 10px rgba(255,0,255,0.2); font-size:16px;';
        searchBtn.onclick = (e) => {
            e.stopPropagation();
            if(!this.isCapsuleDragged()) SingularitySearch.open();
        };
        this.systemCapsule.appendChild(searchBtn);

        // ★ 新規追加：カプセル内：タイムマシンボタン
        const timeBtn = document.createElement('div');
        timeBtn.innerText = '⏳';
        timeBtn.title = "Time Machine";
        timeBtn.style.cssText = 'display:flex; justify-content:center; align-items:center; width:36px; height:36px; border-radius:50%; background:rgba(255,204,0,0.15); border:1px solid rgba(255,204,0,0.5); color:#ffcc00; cursor:pointer; margin-right:10px; flex-shrink:0; transition:0.2s; box-shadow:0 0 10px rgba(255,204,0,0.2); font-size:16px;';
        timeBtn.onclick = (e) => { 
            e.stopPropagation(); 
            if(!this.isCapsuleDragged()) this.toggleTimeMachine(); 
        };
        this.systemCapsule.appendChild(timeBtn);

        // カプセル内：拡張モジュールスロット
        this.capsuleSlots = document.createElement('div');
        this.capsuleSlots.style.cssText = 'display:flex; gap:5px; margin-right:10px;';
        this.systemCapsule.appendChild(this.capsuleSlots);

        // カプセル内：パンくずリスト
        this.breadcrumbUI = document.createElement('div');
        this.breadcrumbUI.style.cssText = 'display:flex; gap:5px; flex-wrap:nowrap; font-family:sans-serif; color:white; align-items:center; white-space:nowrap;';
        this.systemCapsule.appendChild(this.breadcrumbUI);

        // 3. 統合コントロールパネル (Control Panel)
        this.controlPanel = document.createElement('div');
        this.controlPanel.style.cssText = 'position:fixed; display:none; flex-direction:column; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(10,15,25,0.98); border:1px solid #00ffcc; border-radius:12px; padding:0; z-index:9001; width:90%; max-width:340px; min-height:420px; max-height:85vh; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.9); backdrop-filter:blur(20px); color:white; font-family:sans-serif; pointer-events:auto;';
        this.protectUI(this.controlPanel);
        document.body.appendChild(this.controlPanel);

        // ★ 新規追加：タイムマシン用のスライダーUI（画面下部からせり上がる）
        this.timeMachineUI = document.createElement('div');
        this.timeMachineUI.style.cssText = 'position:fixed; bottom:-150px; left:50%; transform:translateX(-50%); width:90%; max-width:600px; background:rgba(20,15,0,0.9); border:1px solid #ffcc00; border-radius:16px 16px 0 0; padding:20px; box-shadow:0 0 40px rgba(255,204,0,0.4); backdrop-filter:blur(15px); z-index:9900; transition:bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1); display:flex; flex-direction:column; align-items:center; pointer-events:auto;';
        this.protectUI(this.timeMachineUI);
        
        this.timeMachineUI.innerHTML = `
            <div style="color:#ffcc00; font-size:14px; font-weight:bold; margin-bottom:15px; letter-spacing:2px; text-shadow:0 0 10px #ffcc00;">⏳ HISTORY RECOVERY</div>
            <input type="range" id="time-slider" min="0" max="0" value="0" style="width:100%; cursor:pointer;">
            <div id="time-display" style="color:#aaa; font-size:12px; margin-top:10px; font-family:monospace;">Current Timeline</div>
            <button id="time-close" style="margin-top:15px; background:transparent; border:1px solid #ffcc00; color:#ffcc00; padding:6px 20px; border-radius:20px; cursor:pointer; font-size:12px; transition:0.2s;">次元を固定して閉じる</button>
        `;
        document.body.appendChild(this.timeMachineUI);

        // タイムトラベルのスライダーイベント設定
        const slider = document.getElementById('time-slider');
        const display = document.getElementById('time-display');
        
        slider.addEventListener('input', (e) => {
            const index = parseInt(e.target.value, 10);
            const max = parseInt(e.target.max, 10);
            
            if (index === max) {
                display.innerHTML = `<span style="color:#00ffcc;">[ NOW ] 現在の宇宙</span>`;
            } else {
                const historyRecord = TimeMachine.history[index];
                if (historyRecord) {
                    const date = new Date(historyRecord.time);
                    display.innerHTML = `<span style="color:#ffcc00;">[ PAST ] ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')} に復元中...</span>`;
                }
            }
            
            // スライダーを動かすたびに CanvasBuilder の復元処理を呼ぶ
            if (this.app.executeTimeTravel) {
                this.app.executeTimeTravel(index);
            }
        });

        document.getElementById('time-close').onclick = () => this.toggleTimeMachine();

        // 4. その他のモーダルUI
        this.inventoryModal = this.createModal('#ff6699', 300);
        this.appLibraryModal = this.createModal('#00ffcc', 300);
        this.actionMenu = this.createModal('#00ffcc', 220, false);
        this.actionMenu.style.background = 'rgba(0,0,0,0.95)';
        this.quickNotePanel = this.createModal('#00ffcc', 200, false);
        window.addEventListener('mousedown', (e) => { if(!this.quickNotePanel.contains(e.target)) this.hideQuickNote(); });

        // 初期描画とイベントバインド
        this.renderCP();
        this.setupGlobalCanvasEvents();

        // コアボタンのトグル
        coreBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.isCapsuleDragged()) return;
            this.controlPanel.style.display = this.controlPanel.style.display === 'none' ? 'flex' : 'none';
        };
    }

    // ★ 新規追加：タイムマシンUIの開閉とスライダーの更新
    toggleTimeMachine() {
        const isClosed = this.timeMachineUI.style.bottom.startsWith('-');
        if (isClosed) {
            this.updateTimeSliderParams();
            this.timeMachineUI.style.bottom = '0px';
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
        } else {
            this.timeMachineUI.style.bottom = '-150px';
            // 閉じた瞬間に、過去に戻った状態のまま現在の宇宙としてセーブして歴史を確定する
            this.app.autoSave();
        }
    }

    // ★ 新規追加：スライダーの目盛りを最新の歴史件数に合わせる
    updateTimeSliderParams() {
        const slider = document.getElementById('time-slider');
        const count = Math.max(0, TimeMachine.getHistoryCount() - 1);
        slider.max = count;
        // UIを開いたときは常に「現在（最新）」にツマミをセット
        if (this.timeMachineUI.style.bottom.startsWith('-')) {
            slider.value = count; 
            document.getElementById('time-display').innerHTML = `<span style="color:#00ffcc;">[ NOW ] 現在の宇宙</span>`;
        }
    }

    // ==========================================
    // コントロールパネルの描画（タブシステム）
    // ==========================================
    renderCP() {
        const activeStyle = "background:rgba(0,255,204,0.2); color:#00ffcc; border-bottom:2px solid #00ffcc;";
        const inactiveStyle = "background:transparent; color:#666; border-bottom:2px solid transparent;";
        
        // パネルの外枠・ヘッダー
        this.controlPanel.innerHTML = `
            <div style="display:flex; background:rgba(0,0,0,0.3); border-bottom:1px solid rgba(0,255,204,0.2);">
                <button id="tab-create" style="flex:1; padding:15px 5px; border:none; font-size:12px; font-weight:bold; cursor:pointer; transition:0.3s; ${this.state.activeTab==='create'?activeStyle:inactiveStyle}">🛠 創造</button>
                <button id="tab-config" style="flex:1; padding:15px 5px; border:none; font-size:12px; font-weight:bold; cursor:pointer; transition:0.3s; ${this.state.activeTab==='config'?activeStyle:inactiveStyle}">🧩 拡張</button>
                <button id="tab-data" style="flex:1; padding:15px 5px; border:none; font-size:12px; font-weight:bold; cursor:pointer; transition:0.3s; ${this.state.activeTab==='data'?activeStyle:inactiveStyle}">💾 データ</button>
                <button id="cp-close" style="width:50px; background:transparent; border:none; color:#ff4444; font-size:20px; cursor:pointer;">×</button>
            </div>
            <div id="cp-content" style="padding:20px; flex:1; overflow-y:auto;"></div>
        `;

        const content = document.getElementById('cp-content');

        // 各タブのコンテンツ生成
        if (this.state.activeTab === 'create') {
            content.innerHTML = `
                <div style="margin-bottom:20px;">
                    <div style="font-size:11px; color:#00ffcc; margin-bottom:10px; letter-spacing:1px;">MODE SELECT</div>
                    <div style="display:flex; gap:5px; margin-bottom:20px;">
                        <button id="cp-mode-run" style="flex:1; padding:10px; background:${this.app.appMode==='RUN'?'#00ffcc':'#113344'}; color:${this.app.appMode==='RUN'?'#000':'#fff'}; border:none; border-radius:6px; font-size:12px; font-weight:bold; transition:0.2s;">👆 実行</button>
                        <button id="cp-mode-link" style="flex:1; padding:10px; background:${this.app.appMode==='LINK'?'#ff00ff':'#113344'}; color:#fff; border:none; border-radius:6px; font-size:12px; transition:0.2s;">🔗 結ぶ</button>
                        <button id="cp-mode-edit" style="flex:1; padding:10px; background:${this.app.appMode==='EDIT'?'#ffcc00':'#113344'}; color:${this.app.appMode==='EDIT'?'#000':'#fff'}; border:none; border-radius:6px; font-size:12px; transition:0.2s;">⚙️ 編集</button>
                    </div>
                    
                    <div style="font-size:11px; color:#ffcc00; margin-bottom:10px; letter-spacing:1px;">GRAVITY FORMATION</div>
                    <div style="display:flex; gap:5px; margin-bottom:20px;">
                        <button id="cp-grav-circle" style="flex:1; padding:8px; background:rgba(255,204,0,0.1); color:#ffcc00; border:1px solid rgba(255,204,0,0.5); border-radius:6px; font-size:11px; cursor:pointer;">⭕ 円環</button>
                        <button id="cp-grav-spiral" style="flex:1; padding:8px; background:rgba(255,204,0,0.1); color:#ffcc00; border:1px solid rgba(255,204,0,0.5); border-radius:6px; font-size:11px; cursor:pointer;">🌀 螺旋</button>
                        <button id="cp-grav-grid" style="flex:1; padding:8px; background:rgba(255,204,0,0.1); color:#ffcc00; border:1px solid rgba(255,204,0,0.5); border-radius:6px; font-size:11px; cursor:pointer;">🔲 均列</button>
                    </div>
                    
                    <div style="font-size:11px; color:#00ffcc; margin-bottom:10px; letter-spacing:1px;">RAPID WORKFLOW</div>
                    <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:10px; display:flex; flex-direction:column; gap:12px;">
                        <label style="display:flex; align-items:center; gap:10px; font-size:12px; cursor:pointer; color:#ffcc00;">
                            <input type="checkbox" id="cp-rapid-spawn" ${localStorage.getItem('universe_rapid_spawn')==='true'?'checked':''} style="accent-color:#ffcc00; width:16px; height:16px;"> 
                            🌟 連続創造モード
                        </label>
                        <label style="display:flex; align-items:center; gap:10px; font-size:12px; cursor:pointer; color:#ff4444;">
                            <input type="checkbox" id="cp-rapid-delete" ${this.state.isRapidDeleteMode?'checked':''} style="accent-color:#ff4444; width:16px; height:16px;"> 
                            🎒 連続収納モード
                        </label>
                        <hr style="border:none; border-top:1px dashed rgba(255,255,255,0.1); margin:0;">
                        <label style="display:flex; align-items:center; gap:10px; font-size:12px; cursor:pointer; color:#00ffcc;">
                            <input type="checkbox" id="cp-auto-menu" ${localStorage.getItem('universe_auto_menu')==='true'?'checked':''} style="accent-color:#00ffcc; width:16px; height:16px;"> 
                            ⚙️ 生成直後にメニューを展開
                        </label>
                    </div>
                </div>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <input type="color" id="cp-spawn-color" value="#00ffcc" style="width:45px; height:45px; border:none; border-radius:8px; background:transparent; cursor:pointer;">
                    <button id="cp-spawn-btn" style="flex:1; background:#114433; color:#00ffcc; border:1px solid #00ffcc; border-radius:8px; font-weight:bold; font-size:13px;">🎯 中央に星を創る</button>
                </div>
            `;
        } else if (this.state.activeTab === 'config') {
            content.innerHTML = `
                <div style="font-size:11px; color:#00ffcc; margin-bottom:10px; letter-spacing:1px;">MODULE EXTENSIONS</div>
                <div style="background:rgba(0,255,204,0.03); border:1px dashed rgba(0,255,204,0.3); padding:15px; border-radius:10px; display:flex; flex-direction:column; gap:15px;">
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-logger" ${localStorage.getItem('universe_ext_logger')==='true'?'checked':''} style="accent-color:#00ffcc; width:16px; height:16px;"> 
                        🖥️ ターミナルボタン追加
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-audio" ${window.universeAudio && !window.universeAudio.isMuted ? 'checked' : ''} style="accent-color:#ff00ff; width:16px; height:16px;"> 
                        <span style="color:#ff66ff;">🔊 153bpm 音響エンジン</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-center-text" ${localStorage.getItem('universe_center_text')!=='false'?'checked':''} style="accent-color:#00ffcc; width:16px; height:16px;"> 
                        🔤 中央透かし文字を表示
                    </label>
                </div>
                
                <div style="margin-top:30px;">
                    <div style="font-size:11px; color:#ff4444; margin-bottom:10px; letter-spacing:1px;">SYSTEM OVERRIDE</div>
                    <div style="display:flex; gap:8px;">
                        <button id="cp-btn-logout" style="flex:1; padding:12px; background:transparent; border:1px solid #666; color:#aaa; border-radius:8px; font-size:12px;">🚪 ログアウト</button>
                        <button id="cp-btn-reset" style="flex:1; padding:12px; background:#330000; border:1px solid #ff4444; color:#ff4444; border-radius:8px; font-size:12px;">🚨 宇宙初期化</button>
                    </div>
                </div>
            `;
        } else if (this.state.activeTab === 'data') {
            content.innerHTML = `
                <div style="margin-bottom:25px;">
                    <div style="font-size:11px; color:#00ffcc; margin-bottom:10px; letter-spacing:1px;">RADAR SEARCH</div>
                    <input type="text" id="cp-radar" placeholder="宇宙を探索..." style="width:100%; background:rgba(0,0,0,0.5); color:#fff; border:1px solid #00ffcc; border-radius:8px; padding:12px; box-sizing:border-box; outline:none; font-size:14px;">
                    <div id="cp-radar-results" style="max-height:150px; overflow-y:auto; margin-top:8px; display:flex; flex-direction:column; gap:4px;"></div>
                </div>
                <div style="font-size:11px; color:#ff6699; margin-bottom:10px; letter-spacing:1px;">STORAGE MANAGEMENT</div>
                <button id="cp-btn-inventory" style="width:100%; padding:14px; background:#220022; color:#ff6699; border:1px solid #ff6699; border-radius:8px; margin-bottom:15px; font-size:13px; font-weight:bold;">🌌 亜空間ポケットを開く</button>
                <div style="display:flex; gap:10px;">
                    <button id="cp-btn-export" style="flex:1; padding:12px; background:#112244; color:#66aaff; border:1px solid #66aaff; border-radius:8px; font-size:12px;">💾 出力 (Export)</button>
                    <button id="cp-btn-import" style="flex:1; padding:12px; background:#442211; color:#ffaa66; border:1px solid #ffaa66; border-radius:8px; font-size:12px;">📂 読込 (Import)</button>
                    <input type="file" id="cp-import-file" style="display:none;" accept=".universe">
                </div>
            `;
        }

        this.bindCPEvents();
    }

    bindCPEvents() {
        const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };

        // タブ制御
        bind('cp-close', () => this.controlPanel.style.display = 'none');
        bind('tab-create', () => { this.state.activeTab = 'create'; this.renderCP(); });
        bind('tab-config', () => { this.state.activeTab = 'config'; this.renderCP(); });
        bind('tab-data', () => { this.state.activeTab = 'data'; this.renderCP(); });

        // モード変更
        bind('cp-mode-run', () => this.updateMode('RUN'));
        bind('cp-mode-link', () => this.updateMode('LINK'));
        bind('cp-mode-edit', () => this.updateMode('EDIT'));

        bind('cp-grav-circle', () => { Gravity.applyFormation(this.app.currentUniverse.nodes, 'circle'); if(window.universeAudio) window.universeAudio.playWarp(); this.app.autoSave(); });
        bind('cp-grav-spiral', () => { Gravity.applyFormation(this.app.currentUniverse.nodes, 'spiral'); if(window.universeAudio) window.universeAudio.playWarp(); this.app.autoSave(); });
        bind('cp-grav-grid', () => { Gravity.applyFormation(this.app.currentUniverse.nodes, 'grid'); if(window.universeAudio) window.universeAudio.playWarp(); this.app.autoSave(); });

        // チェックボックスの状態永続化
        const handleCheckbox = (id, storageKey, stateKey = null) => {
            const el = document.getElementById(id);
            if(el) el.onchange = (e) => {
                if (storageKey) localStorage.setItem(storageKey, e.target.checked);
                if (stateKey) this.state[stateKey] = e.target.checked;
            };
        };

        handleCheckbox('cp-rapid-spawn', 'universe_rapid_spawn');
        handleCheckbox('cp-rapid-delete', null, 'isRapidDeleteMode');
        handleCheckbox('cp-auto-menu', 'universe_auto_menu');
        
        const extLogger = document.getElementById('cp-ext-logger');
        if(extLogger) extLogger.onchange = (e) => { localStorage.setItem('universe_ext_logger', e.target.checked); this.updateUIState(); };

        const extText = document.getElementById('cp-ext-center-text');
        if(extText) extText.onchange = (e) => { localStorage.setItem('universe_center_text', e.target.checked); this.updateUIState(); };

        const extAudio = document.getElementById('cp-ext-audio');
        if(extAudio) extAudio.onchange = (e) => window.universeAudio?.toggle(e.target.checked);

        // 中央創造ボタン
        bind('cp-spawn-btn', () => {
            const color = document.getElementById('cp-spawn-color').value;
            this.app.currentUniverse.addNode('新規データ', -this.app.camera.x, -this.app.camera.y, 25, color, 'star');
            this.app.autoSave(); 
            if(window.universeAudio) window.universeAudio.playSpawn();
            if(document.getElementById('cp-auto-menu')?.checked) {
                const n = this.app.currentUniverse.nodes[this.app.currentUniverse.nodes.length-1];
                this.showMenu(n, window.innerWidth/2, window.innerHeight/2);
            }
            this.controlPanel.style.display = 'none';
        });

        // 危険な操作
        bind('cp-btn-logout', () => { sessionStorage.clear(); localStorage.clear(); window.location.reload(); });
        bind('cp-btn-reset', () => { if(confirm("【警告】現在の端末の宇宙を初期化します。よろしいですか？")){ localStorage.clear(); window.location.reload(); } });
        
        // データ管理
        bind('cp-btn-inventory', () => { this.controlPanel.style.display='none'; this.showInventoryUI(); });
        bind('cp-btn-export', () => Singularity.export());
        
        const fileInput = document.getElementById('cp-import-file');
        bind('cp-btn-import', () => fileInput.click());
        if(fileInput) fileInput.onchange = async (e) => {
            if(e.target.files[0] && confirm("現在の宇宙を上書きしてインポートしますか？")){
                const d = await Singularity.importAndVerify(e.target.files[0]);
                await saveEncryptedUniverse(d); 
                window.location.reload();
            }
        };

        // レーダー検索
        const radar = document.getElementById('cp-radar');
        if(radar) radar.oninput = (e) => this.handleRadar(e.target.value);
    }

    updateMode(mode) {
        this.app.appMode = mode;
        this.renderCP(); 
    }

    updateUIState() {
        this.capsuleSlots.innerHTML = '';
        const isLog = localStorage.getItem('universe_ext_logger') === 'true';
        const isText = localStorage.getItem('universe_center_text') !== 'false';

        if (isLog) {
            const btn = document.createElement('div');
            btn.innerText = '🖥️'; 
            btn.title = "ターミナルを開閉";
            btn.style.cssText = 'width:32px; height:32px; border-radius:50%; background:rgba(0,255,204,0.1); border:1px solid rgba(0,255,204,0.5); color:#00ffcc; display:flex; justify-content:center; align-items:center; cursor:pointer; transition:0.2s;';
            btn.onclick = (e) => { e.stopPropagation(); if(!this.isCapsuleDragged()) window.universeLogger?.toggle(); };
            this.capsuleSlots.appendChild(btn);
        }

        this.centerTextEl.style.opacity = isText ? '1' : '0';
        setTimeout(() => this.centerTextEl.style.display = isText ? 'block' : 'none', 300);
    }

    setupGlobalCanvasEvents() {
        const canvasEl = document.getElementById('universe-canvas');
        if (!canvasEl) return;

        const onDown = (e) => {
            const ev = e.touches ? e.touches[0] : e;
            this.state.touchStartX = ev.clientX; 
            this.state.touchStartY = ev.clientY;
        };

        const onUp = (e) => {
            const isRapidSpawn = localStorage.getItem('universe_rapid_spawn') === 'true';
            const isAutoMenu = localStorage.getItem('universe_auto_menu') === 'true';
            if (!isRapidSpawn) return;

            const now = Date.now();
            if (now - this.state.lastSpawnTime < 400) { e.preventDefault(); e.stopPropagation(); return; }

            const ev = e.changedTouches ? e.changedTouches[0] : e;
            const dx = ev.clientX - this.state.touchStartX; const dy = ev.clientY - this.state.touchStartY;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
            if (e.target !== canvasEl) return;

            e.preventDefault(); e.stopPropagation();
            this.state.lastSpawnTime = now;

            const rect = canvasEl.getBoundingClientRect();
            const zoom = this.app.camera.zoom || 1;
            const worldX = ((ev.clientX - rect.left - canvasEl.width / 2) / zoom) - this.app.camera.x;
            const worldY = ((ev.clientY - rect.top - canvasEl.height / 2) / zoom) - this.app.camera.y;

            const color = document.getElementById('cp-spawn-color')?.value || "#00ffcc";
            this.app.currentUniverse.addNode('新規データ', worldX, worldY, 25, color, 'star');
            this.app.autoSave();

            if (window.universeAudio) window.universeAudio.playSpawn();
            if (window.universeLogger) window.universeLogger.log("RAPID_SPAWN", { color });

            if (isAutoMenu) {
                const node = this.app.currentUniverse.nodes[this.app.currentUniverse.nodes.length - 1];
                setTimeout(() => this.showMenu(node, ev.clientX, ev.clientY), 50);
            }
        };

        canvasEl.addEventListener('mousedown', onDown); 
        canvasEl.addEventListener('touchstart', onDown, {passive: true});
        canvasEl.addEventListener('mouseup', onUp); 
        canvasEl.addEventListener('touchend', onUp, {passive: false});
    }

    createModal(color, width, centered = true) {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed; display:none; flex-direction:column; background:rgba(15,20,30,0.98); border:1px solid ${color}; padding:15px; border-radius:12px; z-index:9500; min-width:${width}px; color:white; pointer-events:auto; box-shadow:0 10px 40px rgba(0,0,0,0.6); backdrop-filter:blur(10px);`;
        if(centered) { el.style.top = '50%'; el.style.left = '50%'; el.style.transform = 'translate(-50%, -50%)'; }
        this.protectUI(el); document.body.appendChild(el); return el;
    }

    handleRadar(query) {
        const res = document.getElementById('cp-radar-results'); res.innerHTML = ''; if(!query) return;
        let count = 0;
        const search = (u) => {
            u.nodes.forEach(n => {
                if(n.name.toLowerCase().includes(query.toLowerCase()) && count < 10) {
                    const b = document.createElement('button');
                    b.innerText = `🌌 ${n.name}`; 
                    b.style.cssText = 'width:100%; text-align:left; background:rgba(0,255,204,0.05); color:#00ffcc; border:1px solid rgba(0,255,204,0.2); border-radius:6px; padding:10px; margin-bottom:4px; cursor:pointer;';
                    b.onclick = () => { this.app.executeWarp(n); this.controlPanel.style.display='none'; if(window.universeAudio) window.universeAudio.playWarp(); };
                    res.appendChild(b); count++;
                }
                search(n.innerUniverse);
            });
        };
        search(this.app.universeHistory.length > 0 ? this.app.universeHistory[0] : this.app.currentUniverse);
    }

    showMenu(node, screenX, screenY) {
        if (this.state.isRapidDeleteMode) {
            this.app.currentUniverse.removeNode(node); this.app.blackHole.push(node); this.app.autoSave();
            if(window.universeAudio) window.universeAudio.playDelete(); return;
        }

        this.hideQuickNote();
        this.actionMenu.style.left = `${Math.min(screenX, window.innerWidth - 230)}px`;
        this.actionMenu.style.top = `${Math.min(screenY, window.innerHeight - 380)}px`;
        this.actionMenu.style.display = 'flex';
        
        const btnStyle = 'color:white; background:rgba(255,255,255,0.08); border:none; padding:12px; cursor:pointer; text-align:left; border-radius:8px; font-size:13px; margin-bottom:4px; width:100%; transition:background 0.2s;';
        
        this.actionMenu.innerHTML = `
            <button id="m-dive" style="${btnStyle}">➡ 内部へ潜る</button>
            <button id="m-note" style="${btnStyle} color:#aaffff;">📝 記憶を編集</button>
            <div style="display:flex; gap:4px; margin-bottom:4px;">
                <button id="m-up" style="${btnStyle} flex:1; text-align:center; color:#ffcc00; margin-bottom:0;">🌟 拡大</button>
                <button id="m-down" style="${btnStyle} flex:1; text-align:center; color:#aaa; margin-bottom:0;">🌠 縮小</button>
            </div>
            <button id="m-ren" style="${btnStyle} color:#ccff66;">✏ 名前変更</button>
            <button id="m-set-icon" style="${btnStyle} color:#ffaa00;">🖼 画像設定</button>
            <button id="m-link" style="${btnStyle} color:#aaaaff;">📱 URL登録</button>
            <button id="m-del" style="${btnStyle} color:#ff4444; border:1px solid rgba(255,68,68,0.3);">🎒 亜空間へ送る</button>
            <button id="m-close" style="${btnStyle} background:transparent; text-align:center; font-size:11px; color:#888;">❌ 閉じる</button>`;

        document.getElementById('m-dive').onclick = () => { this.hideMenu(); this.app.isZoomingIn = true; this.app.targetUniverse = node.innerUniverse; this.app.camera.zoomTo(node.x, node.y); if(window.universeAudio) window.universeAudio.playWarp(); };
        document.getElementById('m-note').onclick = () => { this.hideMenu(); this.notePad.open(node); };
        document.getElementById('m-up').onclick = () => { node.size = Math.min(150, node.size + 10); this.app.autoSave(); };
        document.getElementById('m-down').onclick = () => { node.size = Math.max(5, node.size - 10); this.app.autoSave(); };
        document.getElementById('m-ren').onclick = () => { const n = prompt("新しい名前:", node.name); if(n){node.name=n; this.app.autoSave();} this.hideMenu(); };
        document.getElementById('m-set-icon').onclick = () => { const url = prompt("画像URL:", node.iconUrl || ""); if(url !== null){ node.iconUrl = url; this.app.autoSave(); } this.hideMenu(); };
        document.getElementById('m-link').onclick = () => { this.hideMenu(); this.showAppLibrary(node); };
        document.getElementById('m-del').onclick = () => { if(confirm("収納しますか？")){ this.app.currentUniverse.removeNode(node); this.app.blackHole.push(node); this.app.autoSave(); if(window.universeAudio) window.universeAudio.playDelete(); } this.hideMenu(); };
        document.getElementById('m-close').onclick = () => this.hideMenu();
    }

    showQuickNote(node, x, y) {
        if (!node.note || node.note.trim() === "") return;
        this.quickNotePanel.innerHTML = `<div style="color:#00ffcc; font-weight:bold; border-bottom:1px solid #333; padding-bottom:5px; margin-bottom:5px;">${node.name}</div><div style="font-size:12px; line-height:1.5; white-space:pre-wrap; word-break:break-all;">${node.note}</div>`;
        this.quickNotePanel.style.left = `${Math.min(x, window.innerWidth-220)}px`; this.quickNotePanel.style.top = `${Math.min(y, window.innerHeight-250)}px`; this.quickNotePanel.style.display = 'flex';
    }
    
    hideQuickNote() { this.quickNotePanel.style.display = 'none'; }
    hideMenu() { this.actionMenu.style.display = 'none'; }

    updateBreadcrumbs() {
        this.breadcrumbUI.innerHTML = '';
        const path = [...this.app.universeHistory, this.app.currentUniverse];
        path.forEach((uni, i) => {
            const b = document.createElement('button'); const isLast = (i === path.length - 1);
            b.innerText = (i === 0) ? `👤 ${uni.name}` : uni.name;
            b.style.cssText = `background:rgba(255,255,255,${isLast ? '0.15' : '0.0'}); color:${isLast ? '#fff' : '#888'}; border:none; padding:6px 12px; border-radius:20px; font-size:11px; cursor:pointer; transition:0.2s;`;
            b.onclick = (e) => { 
                e.stopPropagation(); if(this.isCapsuleDragged()) return;
                if(!isLast){ this.app.currentUniverse = this.app.universeHistory[i]; this.app.universeHistory = this.app.universeHistory.slice(0, i); this.app.camera.reset(); this.updateBreadcrumbs(); if(window.universeAudio) window.universeAudio.playWarp(); } 
            };
            this.breadcrumbUI.appendChild(b);
            if(!isLast) { const s = document.createElement('span'); s.innerText = '›'; s.style.cssText = 'color:#555; margin:0 2px;'; this.breadcrumbUI.appendChild(s); }
        });
        if(this.centerTextEl) this.centerTextEl.innerHTML = `${this.app.currentUniverse.name} <span style="font-size:0.5em; opacity:0.3;">EDIT</span>`;
    }

    showAppLibrary(node) {
        let html = `<h4 style="margin:top:0; color:#00ffcc;">App Sync</h4><div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:15px;">`;
        this.app.appPresets.forEach((app, i) => { html += `<div id="preset-${i}" style="display:flex; flex-direction:column; align-items:center; cursor:pointer;"><img src="${app.icon}" style="width:36px; height:36px; border-radius:8px; background:#222;"><span style="font-size:8px; margin-top:4px; text-align:center;">${app.name}</span></div>`; });
        html += `</div><button id="custom-url-btn" style="width:100%; padding:12px; background:#113344; color:#00ffff; border:1px solid #00ffff; border-radius:8px; margin-bottom:10px;">URL手動入力</button> <button id="lib-close" style="width:100%; padding:10px; background:transparent; border:1px solid #444; color:#888; border-radius:6px;">Cancel</button>`;
        this.appLibraryModal.innerHTML = html; this.appLibraryModal.style.display = 'block';
        
        this.app.appPresets.forEach((app, i) => { document.getElementById(`preset-${i}`).onclick = () => { node.name = app.name; node.url = app.url; node.iconUrl = app.icon; this.app.autoSave(); this.appLibraryModal.style.display='none'; }; });
        document.getElementById('custom-url-btn').onclick = () => {
            this.appLibraryModal.style.display='none'; const url = prompt("URL:", node.url);
            if(url) { node.url = url; if(url.startsWith('http') && confirm("アイコン(Favicon)を自動取得しますか？")){ try { node.iconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`; } catch(e) { node.iconUrl = `https://www.google.com/s2/favicons?domain=${url}&sz=128`; } } this.app.autoSave(); }
        };
        document.getElementById('lib-close').onclick = () => this.appLibraryModal.style.display='none';
    }

    showInventoryUI() {
        let html = `<h4 style="margin:0 0 15px 0; color:#ff6699;">亜空間 Storage</h4><div style="max-height:250px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">`;
        this.app.blackHole.forEach((node, i) => { html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;"><span>${node.name}</span><div><button id="inv-res-${i}" style="background:#003333; color:#00ffcc; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">🌌 復元</button> <button id="inv-del-${i}" style="background:#330000; color:#ff4444; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">消滅</button></div></div>`; });
        html += `</div><button id="inv-close" style="margin-top:15px; width:100%; padding:10px; background:transparent; border:1px solid #444; color:#888; border-radius:6px; cursor:pointer;">Close</button>`;
        this.inventoryModal.innerHTML = html; this.inventoryModal.style.display = 'block';
        
        this.app.blackHole.forEach((node, i) => {
            document.getElementById(`inv-res-${i}`).onclick = () => { this.app.blackHole.splice(i, 1); node.x = -this.app.camera.x; node.y = -this.app.camera.y; this.app.currentUniverse.nodes.push(node); this.app.autoSave(); this.inventoryModal.style.display='none'; if(window.universeAudio) window.universeAudio.playSpawn(); };
            document.getElementById(`inv-del-${i}`).onclick = () => { if(confirm("完全に消去しますか？(元に戻せません)")){ this.app.blackHole.splice(i, 1); this.app.autoSave(); this.showInventoryUI(); }};
        });
        document.getElementById('inv-close').onclick = () => this.inventoryModal.style.display='none';
    }
}