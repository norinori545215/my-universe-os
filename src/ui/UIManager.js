// src/ui/UIManager.js
import { Singularity } from '../db/Singularity.js';
import { saveEncryptedUniverse } from '../db/CloudSync.js';
import { NotePadUI } from './NotePadUI.js';
import { AudioCore } from '../engine/AudioCore.js';
import { Gravity } from '../core/Gravity.js'; 
import { SingularitySearch } from './SingularitySearch.js'; 
import { TimeMachine } from '../core/TimeMachine.js'; 
import { ChaosGen } from '../ai/ChaosGen.js'; 
import { Pathways } from '../core/Pathways.js'; 
import { LockUI } from './LockUI.js';
import { StardustCapsule } from '../security/StardustCapsule.js';
import { VaultMedia } from '../db/VaultMedia.js'; 
import { MediaViewUI } from './MediaViewUI.js';
import { NexusUI } from './NexusUI.js';
import { NexusChatUI } from './NexusChatUI.js';
import { Chronos } from '../core/Chronos.js'; 
import { RealityBridge } from '../api/RealityBridge.js';
import { WebXRDive } from './WebXRDive.js';
import { WanderingEntities } from '../ai/WanderingEntities.js';
import { SpatialVision } from '../engine/SpatialVision.js';
import { NexusP2P } from '../api/NexusP2P.js'; 

export class UIManager {
    constructor(app) {
        this.app = app;
        this.notePad = new NotePadUI(app);
        
        this.lockUI = new LockUI(app, (type) => {
            if (type === 'panic') {
                this.triggerPanic();
            } else if (type === 'dummy') {
                this.triggerDummyUniverse();
            }
        });
        
        this.mediaView = new MediaViewUI(app);
        this.nexusUI = new NexusUI(app);
        this.nexusChatUI = new NexusChatUI(app);
        
        const isMobile = window.innerWidth <= 768 || localStorage.getItem('universe_mobile_mode') === 'true';
        
        this.state = {
            activeTab: 'create', 
            isRapidDeleteMode: false,
            lastSpawnTime: 0,
            touchStartX: 0,
            touchStartY: 0,
            isMobileMode: isMobile
        };
        
        this.app.isMobileMode = this.state.isMobileMode;
        
        window.universeAudio = new AudioCore();
        
        this.is3DMode = false;
        this.hyper3DInstance = null;

        this.createUI();
        
        Chronos.updatePulse();
        if (Chronos.check()) {
            alert("⚠️ [SECURITY] Chronos protocol has purged the universe.");
            if (window.resetUniverseData) {
                window.resetUniverseData(); 
            } else {
                localStorage.clear();
                window.location.reload();
            }
        }
        
        window.addEventListener('click', () => Chronos.updatePulse(), { passive: true });
        window.addEventListener('keydown', () => Chronos.updatePulse(), { passive: true });

        setTimeout(() => {
            const oldLogout = document.getElementById('btn-logout');
            const oldReset = document.getElementById('emergency-reset-btn');
            if(oldLogout) oldLogout.style.display = 'none';
            if(oldReset) oldReset.style.display = 'none';
        }, 500);
    }

    async toggle3DMode() {
        if (!this.is3DMode) {
            this.is3DMode = true;
            this.app.canvas.style.transition = 'opacity 0.3s';
            this.app.canvas.style.opacity = '0'; 
            this.app.canvas.style.pointerEvents = 'none'; 
            if(window.universeAudio) window.universeAudio.playWarp();
            try {
                const { Hyper3D } = await import('../engine/Hyper3D.js');
                this.hyper3DInstance = new Hyper3D(this.app);
            } catch (e) {
                console.error("Hyper3D.jsのロードに失敗:", e);
                alert("3Dエンジンの起動に失敗しました。");
                this.is3DMode = false;
                this.app.canvas.style.opacity = '1';
                this.app.canvas.style.pointerEvents = 'auto';
            }
        } else {
            this.is3DMode = false;
            this.app.canvas.style.pointerEvents = 'auto';
            this.app.canvas.style.opacity = '1';
            if(window.universeAudio) window.universeAudio.playSystemSound(400, 'sine', 0.2);
            if (this.hyper3DInstance) {
                this.hyper3DInstance.destroy();
                this.hyper3DInstance = null;
            }
        }
        this.updateUIState();
    }

    makeDraggable(el, dragHandleId = null) {
        let isDragging = false, startX, startY, initX, initY, hasMoved = false;
        const down = (e) => {
            if (dragHandleId && e.target.id !== dragHandleId) return; 
            const ev = e.touches ? e.touches[0] : e;
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
            if (e.cancelable) e.preventDefault(); 
            const ev = e.touches ? e.touches[0] : e;
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
            const maxW = window.innerWidth - el.offsetWidth;
            const maxH = window.innerHeight - el.offsetHeight;
            const nx = Math.max(Math.min(0, maxW), Math.min(Math.max(0, maxW), initX + dx));
            const ny = Math.max(Math.min(0, maxH), Math.min(Math.max(0, maxH), initY + dy));
            el.style.left = `${nx}px`; el.style.top = `${ny}px`; el.style.right = 'auto'; el.style.bottom = 'auto';
        };
        const up = (e) => { if (isDragging) { isDragging = false; el.style.transition = '0.2s'; } };
        el.addEventListener('mousedown', down); el.addEventListener('touchstart', down, {passive: false});
        window.addEventListener('mousemove', move, true); window.addEventListener('touchmove', move, {passive: false, capture: true});
        window.addEventListener('mouseup', up, true); window.addEventListener('touchend', up, true);
        return () => hasMoved; 
    }

    protectUI(el) {
        el.addEventListener('mousedown', e => e.stopPropagation()); el.addEventListener('mouseup', e => e.stopPropagation());
        el.addEventListener('touchstart', e => e.stopPropagation(), {passive: false}); el.addEventListener('touchend', e => e.stopPropagation(), {passive: false});
    }

    createUI() {
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

        this.systemCapsule = document.createElement('div');
        this.systemCapsule.style.cssText = 'position:fixed; top:20px; left:20px; z-index:9000; display:flex; align-items:center; background:rgba(10,15,25,0.85); border:1px solid rgba(0,255,204,0.5); border-radius:30px; padding:5px 15px 5px 5px; box-shadow:0 10px 30px rgba(0,255,204,0.2); backdrop-filter:blur(10px); pointer-events:auto; user-select:none; max-width:90vw; overflow-x:auto;';
        this.isCapsuleDragged = this.makeDraggable(this.systemCapsule);
        document.body.appendChild(this.systemCapsule);

        const coreBtn = document.createElement('div');
        coreBtn.style.cssText = 'display:flex; justify-content:center; align-items:center; width:40px; height:40px; border-radius:50%; background:rgba(0,255,204,0.2); color:#00ffcc; font-size:20px; cursor:pointer; margin-right:5px; flex-shrink:0; transition:0.2s;';
        coreBtn.innerText = '🌌';
        this.systemCapsule.appendChild(coreBtn);

        this.capsuleSlots = document.createElement('div');
        this.capsuleSlots.style.cssText = 'display:flex; gap:5px; margin-right:10px;';
        this.systemCapsule.appendChild(this.capsuleSlots);

        this.breadcrumbUI = document.createElement('div');
        this.breadcrumbUI.style.cssText = 'display:flex; gap:5px; flex-wrap:nowrap; font-family:sans-serif; color:white; align-items:center; white-space:nowrap;';
        this.systemCapsule.appendChild(this.breadcrumbUI);

        this.controlPanel = document.createElement('div');
        this.controlPanel.style.cssText = 'position:fixed; display:none; flex-direction:column; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(10,15,25,0.98); border:1px solid #00ffcc; border-radius:12px; padding:0; z-index:9001; width:90%; max-width:340px; min-height:420px; max-height:85vh; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.9); backdrop-filter:blur(20px); color:white; font-family:sans-serif; pointer-events:auto;';
        this.protectUI(this.controlPanel);
        document.body.appendChild(this.controlPanel);

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
            if (this.app.executeTimeTravel) this.app.executeTimeTravel(index);
        });

        document.getElementById('time-close').onclick = () => this.toggleTimeMachine();

        this.inventoryModal = this.createModal('#ff6699', 300);
        this.appLibraryModal = this.createModal('#00ffcc', 300);
        this.actionMenu = this.createModal('#00ffcc', 220, false);
        this.actionMenu.style.background = 'rgba(0,0,0,0.95)';
        
        this.isActionMenuDragged = this.makeDraggable(this.actionMenu, 'm-drag-handle');
        
        this.quickNotePanel = this.createModal('#00ffcc', 200, false);
        window.addEventListener('mousedown', (e) => { if(!this.quickNotePanel.contains(e.target)) this.hideQuickNote(); });

        this.renderCP();
        this.setupGlobalCanvasEvents();
        this.updateUIState();

        coreBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.isCapsuleDragged()) return;
            this.controlPanel.style.display = this.controlPanel.style.display === 'none' ? 'flex' : 'none';
        };
    }

    toggleTimeMachine() {
        const isClosed = this.timeMachineUI.style.bottom.startsWith('-');
        if (isClosed) {
            this.updateTimeSliderParams();
            this.timeMachineUI.style.bottom = '0px';
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
        } else {
            this.timeMachineUI.style.bottom = '-150px';
            this.app.autoSave();
        }
    }

    updateTimeSliderParams() {
        const slider = document.getElementById('time-slider');
        const count = Math.max(0, TimeMachine.getHistoryCount() - 1);
        slider.max = count;
        if (this.timeMachineUI.style.bottom.startsWith('-')) {
            slider.value = count; 
            document.getElementById('time-display').innerHTML = `<span style="color:#00ffcc;">[ NOW ] 現在の宇宙</span>`;
        }
    }

    triggerPanic() {
        this.hideMenu();
        this.hideQuickNote();
        this.controlPanel.style.display = 'none';

        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#ff0000;z-index:99999;pointer-events:none;transition:opacity 0.8s ease-out;';
        document.body.appendChild(flash);
        setTimeout(() => flash.style.opacity = '0', 50);
        setTimeout(() => flash.remove(), 1000);
        if (window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 0.5, 800);

        this.app.currentUniverse.name = "System Local Domain";
        this.app.currentUniverse.nodes = [];
        this.app.currentUniverse.links = [];
        
        this.app.currentUniverse.addNode('Public Docs', -150, -50, 30, '#888888', 'galaxy');
        this.app.currentUniverse.addNode('Recycle Bin', 100, -100, 20, '#555555', 'star');

        this.app.universeHistory = [];
        this.app.blackHole = [];
        this.app.wormholes = [];
        this.app.camera.reset();
        
        this.app.autoSave();
        this.updateBreadcrumbs();
    }

    triggerDummyUniverse() {
        this.hideMenu();
        this.hideQuickNote();
        this.controlPanel.style.display = 'none';

        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#ffffff;z-index:99999;pointer-events:none;transition:opacity 1s ease-out;';
        document.body.appendChild(flash);
        setTimeout(() => flash.style.opacity = '0', 50);
        setTimeout(() => flash.remove(), 1000);
        if (window.universeAudio) window.universeAudio.playWarp();

        console.warn("⚠️ [SECURITY] Legal Escrow Protocol Activated. Dummy Universe Deployed.");

        this.app.currentUniverse.name = "Guest Mode";
        this.app.currentUniverse.nodes = [];
        this.app.currentUniverse.links = [];
        
        this.app.currentUniverse.addNode('Welcome', 0, -100, 40, '#00ffcc', 'star');
        this.app.currentUniverse.addNode('Sample Image', -120, 50, 25, '#ff00ff', 'star');
        this.app.currentUniverse.addNode('Public Logs', 120, 50, 25, '#ffcc00', 'star');

        this.app.universeHistory = [];
        this.app.blackHole = [];
        this.app.camera.reset();
        
        this.app.autoSave = () => { console.log("🔒 [HoneyPot] ゲストモード中のため保存はスキップされました。"); };
        
        this.updateBreadcrumbs();
        alert("【ゲストモード】一部の機能が制限されています。");
    }

    renderCP() {
        const activeStyle = "background:rgba(0,255,204,0.2); color:#00ffcc; border-bottom:2px solid #00ffcc;";
        const inactiveStyle = "background:transparent; color:#666; border-bottom:2px solid transparent;";
        
        this.controlPanel.innerHTML = `
            <div style="display:flex; background:rgba(0,0,0,0.3); border-bottom:1px solid rgba(0,255,204,0.2);">
                <button id="tab-create" style="flex:1; padding:15px 5px; border:none; font-size:12px; font-weight:bold; cursor:pointer; transition:0.3s; ${this.state.activeTab==='create'?activeStyle:inactiveStyle}">🛠 創造</button>
                <button id="tab-config" style="flex:1; padding:15px 5px; border:none; font-size:12px; font-weight:bold; cursor:pointer; transition:0.3s; ${this.state.activeTab==='config'?activeStyle:inactiveStyle}">🧩 拡張・防壁</button>
                <button id="tab-data" style="flex:1; padding:15px 5px; border:none; font-size:12px; font-weight:bold; cursor:pointer; transition:0.3s; ${this.state.activeTab==='data'?activeStyle:inactiveStyle}">💾 データ</button>
                <button id="cp-close" style="width:50px; background:transparent; border:none; color:#ff4444; font-size:20px; cursor:pointer;">×</button>
            </div>
            <div id="cp-content" style="padding:20px; flex:1; overflow-y:auto;"></div>
        `;

        const content = document.getElementById('cp-content');

        if (this.state.activeTab === 'create') {
            content.innerHTML = `
                <div style="margin-bottom:20px;">
                    ${this.state.isMobileMode ? `
                        <div style="background:rgba(255,204,0,0.1); border:1px dashed #ffcc00; padding:12px; border-radius:6px; color:#ffcc00; font-size:11px; margin-bottom:20px; text-align:center; line-height:1.5;">
                            📱 <b>Liteモード稼働中</b><br>モード切替は不要です。星をタップするとメニューが表示されます。
                        </div>
                    ` : `
                        <div style="font-size:11px; color:#00ffcc; margin-bottom:10px; letter-spacing:1px;">MODE SELECT (Pro)</div>
                        <div style="display:flex; gap:5px; margin-bottom:20px;">
                            <button id="cp-mode-run" style="flex:1; padding:10px; background:${this.app.appMode==='RUN'?'#00ffcc':'#113344'}; color:${this.app.appMode==='RUN'?'#000':'#fff'}; border:none; border-radius:6px; font-size:12px; font-weight:bold; transition:0.2s;">👆 実行</button>
                            <button id="cp-mode-link" style="flex:1; padding:10px; background:${this.app.appMode==='LINK'?'#ff00ff':'#113344'}; color:#fff; border:none; border-radius:6px; font-size:12px; transition:0.2s;">🔗 結ぶ</button>
                            <button id="cp-mode-edit" style="flex:1; padding:10px; background:${this.app.appMode==='EDIT'?'#ffcc00':'#113344'}; color:${this.app.appMode==='EDIT'?'#000':'#fff'}; border:none; border-radius:6px; font-size:12px; transition:0.2s;">⚙️ 編集</button>
                        </div>
                    `}
                    
                    <div style="font-size:11px; color:#ffcc00; margin-bottom:10px; letter-spacing:1px;">GRAVITY FORMATION</div>
                    <div style="display:flex; gap:5px; margin-bottom:20px;">
                        <button id="cp-grav-circle" style="flex:1; padding:8px; background:rgba(255,204,0,0.1); color:#ffcc00; border:1px solid rgba(255,204,0,0.5); border-radius:6px; font-size:11px; cursor:pointer;">⭕ 円環</button>
                        <button id="cp-grav-spiral" style="flex:1; padding:8px; background:rgba(255,204,0,0.1); color:#ffcc00; border:1px solid rgba(255,204,0,0.5); border-radius:6px; font-size:11px; cursor:pointer;">🌀 螺旋</button>
                        <button id="cp-grav-grid" style="flex:1; padding:8px; background:rgba(255,204,0,0.1); color:#ffcc00; border:1px solid rgba(255,204,0,0.5); border-radius:6px; font-size:11px; cursor:pointer;">🔲 均列</button>
                        <button id="cp-pathways" style="flex:1; padding:8px; background:rgba(0,255,204,0.1); color:#00ffcc; border:1px solid rgba(0,255,204,0.5); border-radius:6px; font-size:11px; cursor:pointer;">✨ 星座</button>
                        <button id="cp-grav-sphere" style="flex:1; padding:8px; background:rgba(255,0,255,0.1); color:#ff00ff; border:1px solid rgba(255,0,255,0.5); border-radius:6px; font-size:11px; cursor:pointer;" title="3D専用">🌐 全天球</button>
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
                    </div>
                </div>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <input type="color" id="cp-spawn-color" value="#00ffcc" style="width:45px; height:45px; border:none; border-radius:8px; background:transparent; cursor:pointer;">
                    <button id="cp-spawn-btn" style="flex:1; background:#114433; color:#00ffcc; border:1px solid #00ffcc; border-radius:8px; font-weight:bold; font-size:13px;">🎯 中央に星を創る</button>
                </div>
                <!-- ★ ここにあったジェスチャー等のボタンは削除し、カプセル（updateUIState）に移動しました -->
            `;
        } else if (this.state.activeTab === 'config') {
            const chronosCfg = Chronos.getConfig(); 

            content.innerHTML = `
                <div style="font-size:11px; color:#00ffcc; margin-bottom:10px; letter-spacing:1px;">SECURITY EXTENSIONS</div>
                <div style="background:rgba(0,255,204,0.03); border:1px dashed rgba(0,255,204,0.3); padding:15px; border-radius:10px; display:flex; flex-direction:column; gap:15px;">
                    
                    <div style="border: 1px solid rgba(255, 204, 0, 0.3); padding: 10px; border-radius: 8px;">
                        <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer; color:#ffcc00;">
                            <input type="checkbox" id="cp-chronos-toggle" ${chronosCfg.enabled ? 'checked' : ''} style="accent-color:#ffcc00; width:16px; height:16px;"> 
                            <b>⏳ Chronos (自律型自爆)</b>
                        </label>
                        <div style="font-size:10px; color:#888; margin: 8px 0 5px 26px;">無アクセスが続くと宇宙を灰にする</div>
                        <div style="margin-left:26px; display:flex; align-items:center; gap:10px;">
                            <input type="number" id="cp-chronos-days" value="${chronosCfg.days}" style="width:50px; background:rgba(0,0,0,0.5); color:#ffcc00; border:1px solid #ffcc00; border-radius:4px; padding:2px 5px; font-size:12px;">
                            <span style="font-size:11px; color:#ffcc00;">日後に実行</span>
                        </div>
                    </div>

                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-mobile" ${this.state.isMobileMode?'checked':''} style="accent-color:#ffaa00; width:16px; height:16px;"> 
                        <span style="color:#ffcc00; font-weight:bold;">📱 スマホ操作モード (Lite Mode)</span>
                    </label>
                    <hr style="border:none; border-top:1px dashed rgba(255,255,255,0.1); margin:0;">

                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-3d" ${localStorage.getItem('universe_ext_3d')==='true'?'checked':''} style="accent-color:#ff00ff; width:16px; height:16px;"> 
                        <span style="color:#ff88ff; font-weight:bold;">🪐 3Dエンジン</span>
                    </label>

                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-search" ${localStorage.getItem('universe_ext_search')==='true'?'checked':''} style="accent-color:#ff00ff; width:16px; height:16px;"> 
                        <span style="color:#ff88ff;">👁️‍🗨️ 特異点ブラウザ</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-time" ${localStorage.getItem('universe_ext_time')==='true'?'checked':''} style="accent-color:#ffcc00; width:16px; height:16px;"> 
                        <span style="color:#ffee66;">⏳ タイムマシン</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-autopilot" ${localStorage.getItem('universe_ext_autopilot')==='true'?'checked':''} style="accent-color:#00ffcc; width:16px; height:16px;"> 
                        <span style="color:#00ffcc;">🤖 自動プレゼン</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-logger" ${localStorage.getItem('universe_ext_logger')==='true'?'checked':''} style="accent-color:#00ffcc; width:16px; height:16px;"> 
                        <span style="color:#00ffcc;">🖥️ ターミナル</span>
                    </label>

                    <hr style="border:none; border-top:1px dashed rgba(255,255,255,0.1); margin:0;">
                    
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-audio" ${window.universeAudio && !window.universeAudio.isMuted ? 'checked' : ''} style="accent-color:#ff00ff; width:16px; height:16px;"> 
                        <span style="color:#ff66ff;">🔊 153bpm 音響エンジン</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-center-text" ${localStorage.getItem('universe_center_text')!=='false'?'checked':''} style="accent-color:#00ffcc; width:16px; height:16px;"> 
                        🔤 中央透かし文字を表示
                    </label>

                    <!-- ★ 追加: カプセルに入れる新しい機能のON/OFFスイッチ -->
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-mic" ${localStorage.getItem('universe_ext_mic')==='true'?'checked':''} style="accent-color:#ff00ff; width:16px; height:16px;"> 
                        <span style="color:#ff88ff; font-weight:bold;">🎙️ 音響シンクロ (マイク)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-vision" ${localStorage.getItem('universe_ext_vision')==='true'?'checked':''} style="accent-color:#00ffcc; width:16px; height:16px;"> 
                        <span style="color:#00ffcc; font-weight:bold;">✋ 空間ジェスチャー (カメラ)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; cursor:pointer;">
                        <input type="checkbox" id="cp-ext-ai" ${localStorage.getItem('universe_ext_ai')==='true'?'checked':''} style="accent-color:#ffaa00; width:16px; height:16px;"> 
                        <span style="color:#ffaa00; font-weight:bold;">🤖 自律AIエンティティ</span>
                    </label>
                </div>

                <div style="font-size:11px; color:#ff00ff; margin-bottom:10px; letter-spacing:1px; margin-top:20px;">QUANTUM NETWORK (P2P)</div>
                <button id="cp-p2p-start" style="width:100%; padding:12px; background:rgba(255,0,255,0.1); color:#ff00ff; border:1px dashed #ff00ff; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer; margin-bottom:10px;">🌐 P2P通信ポータルを開く</button>

                <div style="margin-top:20px; font-size:11px; color:#ff4444; margin-bottom:10px; letter-spacing:1px;">🚨 LEGAL ESCROW (緊急擬態 / 自爆)</div>
                <div style="background:rgba(255,0,0,0.05); border:1px dashed rgba(255,0,0,0.3); padding:15px; border-radius:10px;">
                    <div style="font-size:11px; color:#ff8888; margin-bottom:10px;">ダミーコードでログインすると偽の宇宙が展開されます。</div>
                    <button id="cp-btn-set-dummy" style="width:100%; padding:10px; background:#440000; color:#ffaa00; border:1px solid #ffaa00; border-radius:6px; font-weight:bold; cursor:pointer; margin-bottom:10px;">ダミーコード (HoneyPot) を設定</button>
                    <button id="cp-btn-set-panic" style="width:100%; padding:10px; background:#440000; color:#ff4444; border:1px solid #ff4444; border-radius:6px; font-weight:bold; cursor:pointer;">自爆コード (Panic) を設定</button>
                </div>
                
                <div style="margin-top:30px;">
                    <div style="font-size:11px; color:#ff4444; margin-bottom:10px; letter-spacing:1px;">SYSTEM OVERRIDE</div>
                    <div style="display:flex; gap:8px;">
                        <button id="cp-btn-logout" style="flex:1; padding:12px; background:transparent; border:1px solid #666; color:#aaa; border-radius:8px; font-size:12px;">🚪 ログアウト</button>
                        <button id="cp-btn-reset" style="flex:1; padding:12px; background:#330000; border:1px solid #ff4444; color:#ff4444; border-radius:8px; font-size:12px;" onclick="if(window.resetUniverseData) window.resetUniverseData();">🚨 宇宙初期化</button>
                    </div>
                </div>
            `;
        } else if (this.state.activeTab === 'data') {
            content.innerHTML = `
                <div style="margin-bottom:25px;">
                    <div style="font-size:11px; color:#ffcc00; margin-bottom:10px; letter-spacing:1px;">REALITY BRIDGE (現実同期)</div>
                    <button id="cp-btn-reality" style="width:100%; padding:14px; background:#332200; color:#ffcc00; border:1px solid #ffcc00; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer;">
                        🌐 ビットコイン相場を星として召喚
                    </button>
                </div>

                <div style="margin-bottom:25px;">
                    <div style="font-size:11px; color:#00ffcc; margin-bottom:10px; letter-spacing:1px;">RADAR SEARCH</div>
                    <input type="text" id="cp-radar" placeholder="宇宙を探索..." style="width:100%; background:rgba(0,0,0,0.5); color:#fff; border:1px solid #00ffcc; border-radius:8px; padding:12px; box-sizing:border-box; outline:none; font-size:14px;">
                    <div id="cp-radar-results" style="max-height:150px; overflow-y:auto; margin-top:8px; display:flex; flex-direction:column; gap:4px;"></div>
                </div>
                <div style="font-size:11px; color:#ff6699; margin-bottom:10px; letter-spacing:1px;">STORAGE MANAGEMENT</div>
                <button id="cp-btn-inventory" style="width:100%; padding:14px; background:#220022; color:#ff6699; border:1px solid #ff6699; border-radius:8px; margin-bottom:15px; font-size:13px; font-weight:bold;">🌌 亜空間ポケットを開く</button>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; gap:10px;">
                        <button id="cp-btn-export" style="flex:1; padding:12px; background:#112244; color:#66aaff; border:1px solid #66aaff; border-radius:8px; font-size:12px;">💾 出力 (通常)</button>
                        <button id="cp-btn-export-img" style="flex:1; padding:12px; background:#221144; color:#ff66aa; border:1px solid #ff66aa; border-radius:8px; font-size:12px;">🖼️ 偽装出力 (画像へ隠す)</button>
                        <input type="file" id="cp-export-img-file" style="display:none;" accept="image/png, image/jpeg">
                    </div>
                    <button id="cp-btn-import" style="width:100%; padding:12px; background:#442211; color:#ffaa66; border:1px solid #ffaa66; border-radius:8px; font-size:12px;">📂 読込 (通常 / 偽装画像)</button>
                    <input type="file" id="cp-import-file" style="display:none;" accept=".universe, image/png, image/jpeg">
                </div>
            `;
        }

        this.bindCPEvents();
    }

    bindCPEvents() {
        const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };

        bind('cp-close', () => this.controlPanel.style.display = 'none');
        bind('tab-create', () => { this.state.activeTab = 'create'; this.renderCP(); });
        bind('tab-config', () => { this.state.activeTab = 'config'; this.renderCP(); });
        bind('tab-data', () => { this.state.activeTab = 'data'; this.renderCP(); });

        bind('cp-mode-run', () => this.updateMode('RUN'));
        bind('cp-mode-link', () => this.updateMode('LINK'));
        bind('cp-mode-edit', () => this.updateMode('EDIT'));

        bind('cp-grav-circle', () => { Gravity.applyFormation(this.app.currentUniverse.nodes, 'circle'); if(window.universeAudio) window.universeAudio.playWarp(); this.app.autoSave(); });
        bind('cp-grav-spiral', () => { Gravity.applyFormation(this.app.currentUniverse.nodes, 'spiral'); if(window.universeAudio) window.universeAudio.playWarp(); this.app.autoSave(); });
        bind('cp-grav-grid', () => { Gravity.applyFormation(this.app.currentUniverse.nodes, 'grid'); if(window.universeAudio) window.universeAudio.playWarp(); this.app.autoSave(); });

        bind('cp-grav-sphere', () => { 
            if(this.is3DMode && this.hyper3DInstance) {
                this.hyper3DInstance.applySphereFormation();
                if(window.universeAudio) window.universeAudio.playWarp();
            } else {
                alert("全天球フォーメーションは 3D MODE 起動時のみ使用可能です。");
            }
        });

        bind('cp-pathways', () => {
            const count = Pathways.autoConstellation(this.app.currentUniverse);
            if (count > 0) {
                if(window.universeAudio) window.universeAudio.playWarp(); 
                this.app.currentUniverse.nodes.forEach(n => this.app.spawnRipple(n.x, n.y, '#00ffcc'));
                this.app.autoSave();
            }
        });

        const handleCheckbox = (id, storageKey, stateKey = null) => {
            const el = document.getElementById(id);
            if(el) el.onchange = (e) => {
                if (storageKey) localStorage.setItem(storageKey, e.target.checked);
                if (stateKey) this.state[stateKey] = e.target.checked;
            };
        };

        handleCheckbox('cp-rapid-spawn', 'universe_rapid_spawn');
        handleCheckbox('cp-rapid-delete', null, 'isRapidDeleteMode');
        
        const chronosToggle = document.getElementById('cp-chronos-toggle');
        const chronosDays = document.getElementById('cp-chronos-days');
        if (chronosToggle && chronosDays) {
            const updateChronos = () => {
                const cfg = Chronos.getConfig();
                cfg.enabled = chronosToggle.checked;
                cfg.days = parseInt(chronosDays.value) || 30;
                Chronos.saveConfig(cfg);
            };
            chronosToggle.onchange = updateChronos;
            chronosDays.oninput = updateChronos;
        }
        
        const extMobile = document.getElementById('cp-ext-mobile');
        if(extMobile) extMobile.onchange = (e) => { 
            localStorage.setItem('universe_mobile_mode', e.target.checked); 
            this.state.isMobileMode = e.target.checked; 
            this.app.isMobileMode = e.target.checked; 
            this.renderCP(); 
        };

        const ext3D = document.getElementById('cp-ext-3d');
        if(ext3D) ext3D.onchange = (e) => { localStorage.setItem('universe_ext_3d', e.target.checked); this.updateUIState(); };

        const extSearch = document.getElementById('cp-ext-search');
        if(extSearch) extSearch.onchange = (e) => { localStorage.setItem('universe_ext_search', e.target.checked); this.updateUIState(); };

        const extTime = document.getElementById('cp-ext-time');
        if(extTime) extTime.onchange = (e) => { localStorage.setItem('universe_ext_time', e.target.checked); this.updateUIState(); };

        const extAutoPilot = document.getElementById('cp-ext-autopilot');
        if(extAutoPilot) extAutoPilot.onchange = (e) => { localStorage.setItem('universe_ext_autopilot', e.target.checked); this.updateUIState(); };

        const extLogger = document.getElementById('cp-ext-logger');
        if(extLogger) extLogger.onchange = (e) => { localStorage.setItem('universe_ext_logger', e.target.checked); this.updateUIState(); };

        const extText = document.getElementById('cp-ext-center-text');
        if(extText) extText.onchange = (e) => { localStorage.setItem('universe_center_text', e.target.checked); this.updateUIState(); };

        const extAudio = document.getElementById('cp-ext-audio');
        if(extAudio) extAudio.onchange = (e) => window.universeAudio?.toggle(e.target.checked);

        // ★ 新機能のチェックボックス処理
        const extMic = document.getElementById('cp-ext-mic');
        if(extMic) extMic.onchange = (e) => { localStorage.setItem('universe_ext_mic', e.target.checked); this.updateUIState(); };
        
        const extVision = document.getElementById('cp-ext-vision');
        if(extVision) extVision.onchange = (e) => { localStorage.setItem('universe_ext_vision', e.target.checked); this.updateUIState(); };
        
        const extAI = document.getElementById('cp-ext-ai');
        if(extAI) extAI.onchange = (e) => { localStorage.setItem('universe_ext_ai', e.target.checked); this.updateUIState(); };

        bind('cp-btn-set-dummy', () => {
            const currentCode = localStorage.getItem('universe_dummy_code') || '';
            const newCode = prompt("法的防壁（ダミー宇宙）を展開するパスワードを入力してください。\n（現在のコード: " + (currentCode === '' ? "未設定" : "****") + "）", "");
            if (newCode !== null && newCode.trim() !== "") {
                localStorage.setItem('universe_dummy_code', newCode.trim());
                alert("ダミーコードを設定しました。このコードで星の封印を解こうとすると、偽の宇宙が展開されます。");
            }
        });

        bind('cp-btn-set-panic', () => {
            const currentCode = localStorage.getItem('universe_panic_code') || '';
            const newCode = prompt("自爆（全データ消去）を引き起こすパスワードを入力してください。\n（現在のコード: " + (currentCode === '' ? "未設定" : "****") + "）", "");
            if (newCode !== null && newCode.trim() !== "") {
                localStorage.setItem('universe_panic_code', newCode.trim());
                alert("自爆コードを設定しました。取扱注意！");
            }
        });

        bind('cp-spawn-btn', () => {
            const color = document.getElementById('cp-spawn-color').value;
            this.app.currentUniverse.addNode('新規データ', -this.app.camera.x, -this.app.camera.y, 25, color, 'star');
            this.app.autoSave(); 
            if(window.universeAudio) window.universeAudio.playSpawn();
            if(this.state.isMobileMode || document.getElementById('cp-auto-menu')?.checked) {
                const n = this.app.currentUniverse.nodes[this.app.currentUniverse.nodes.length-1];
                this.showMenu(n, window.innerWidth/2, window.innerHeight/2);
            }
            this.controlPanel.style.display = 'none';
        });

        bind('cp-p2p-start', () => {
            NexusP2P.start(this.app);
            this.controlPanel.style.display = 'none';
        });

        bind('cp-btn-logout', () => { sessionStorage.clear(); localStorage.clear(); window.location.reload(); });
        
        bind('cp-btn-inventory', () => { this.controlPanel.style.display='none'; this.showInventoryUI(); });
        bind('cp-btn-export', () => Singularity.export());
        
        const exportImgFile = document.getElementById('cp-export-img-file');
        bind('cp-btn-export-img', () => {
            alert("データを隠すための「ベースとなる画像（カモフラージュ用）」を選択してください。");
            exportImgFile.click();
        });
        if(exportImgFile) exportImgFile.onchange = async (e) => {
            if(e.target.files[0]) {
                const rawData = sessionStorage.getItem('my_universe_save_data');
                if(!rawData) return alert("保存データがありません。");
                await StardustCapsule.embedData(rawData, e.target.files[0]);
                alert("画像の中に宇宙を封印しました！");
            }
        };
        
        const fileInput = document.getElementById('cp-import-file');
        bind('cp-btn-import', () => fileInput.click());
        if(fileInput) fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if(!file) return;
            
            if(confirm("現在の宇宙を上書きしてインポートしますか？")){
                let dataToImport = null;
                
                if (file.type.startsWith('image/')) {
                    const hiddenData = await StardustCapsule.extractData(file);
                    if (hiddenData) {
                        dataToImport = JSON.parse(hiddenData);
                    } else {
                        return alert("この画像には宇宙のデータが隠されていません。");
                    }
                } else {
                    dataToImport = await Singularity.importAndVerify(file);
                }
                
                if (dataToImport) {
                    await saveEncryptedUniverse(dataToImport); 
                    window.location.reload();
                }
            }
        };

        const radar = document.getElementById('cp-radar');
        if(radar) radar.oninput = (e) => this.handleRadar(e.target.value);

        bind('cp-btn-reality', async () => {
            const btn = document.getElementById('cp-btn-reality');
            const originalText = btn.innerText;
            btn.innerText = '🔄 現実空間と同期中...';
            btn.style.opacity = '0.5';
            
            await RealityBridge.syncCryptoStar(this.app);
            
            btn.innerText = originalText;
            btn.style.opacity = '1';
            this.controlPanel.style.display = 'none'; 
        });
    }

    updateMode(mode) {
        this.app.appMode = mode;
        this.renderCP(); 
    }

    // ★ UIのアイコンを生成するカプセル更新ロジック
    updateUIState() {
        this.capsuleSlots.innerHTML = '';
        
        const is3D = localStorage.getItem('universe_ext_3d') === 'true';
        const isSearch = localStorage.getItem('universe_ext_search') === 'true';
        const isTime = localStorage.getItem('universe_ext_time') === 'true';
        const isAutoPilot = localStorage.getItem('universe_ext_autopilot') === 'true';
        const isLog = localStorage.getItem('universe_ext_logger') === 'true';
        const isText = localStorage.getItem('universe_center_text') !== 'false';
        
        // 追加した新機能のフラグ
        const isMic = localStorage.getItem('universe_ext_mic') === 'true';
        const isVision = localStorage.getItem('universe_ext_vision') === 'true';
        const isAI = localStorage.getItem('universe_ext_ai') === 'true';

        // 共通ボタン生成ヘルパー
        const addCapsuleBtn = (icon, title, color, onClick) => {
            const btn = document.createElement('div');
            btn.innerText = icon;
            btn.title = title;
            btn.style.cssText = `display:flex; justify-content:center; align-items:center; width:32px; height:32px; border-radius:50%; background:rgba(${color},0.15); border:1px solid rgba(${color},0.5); color:#fff; cursor:pointer; transition:0.2s; box-shadow:0 0 10px rgba(${color},0.2); font-size:14px;`;
            btn.onclick = (e) => { e.stopPropagation(); if(!this.isCapsuleDragged()) onClick(); };
            this.capsuleSlots.appendChild(btn);
            return btn;
        };

        if (is3D) {
            addCapsuleBtn(this.is3DMode ? '🌌' : '🪐', this.is3DMode ? "Return to 2D" : "Enter 3D Space", this.is3DMode ? '0,255,204' : '255,0,255', () => this.toggle3DMode());
            if (this.is3DMode) addCapsuleBtn('🕶️', "Neural Dive (VR)", '0,255,204', () => WebXRDive.initiateDive(this.app, this.hyper3DInstance));
        }
        if (isSearch) addCapsuleBtn('👁️‍🗨️', "Singularity Search", '255,0,255', () => SingularitySearch.open());
        if (isTime) addCapsuleBtn('⏳', "Time Machine", '255,204,0', () => this.toggleTimeMachine());
        if (isAutoPilot) addCapsuleBtn('🤖', "Auto Presentation Mode", '0,255,204', () => {
            if(this.app.autoPilot) { this.controlPanel.style.display = 'none'; this.app.autoPilot.start(); }
        });
        if (isLog) addCapsuleBtn('🖥️', "Terminal Log", '0,255,204', () => window.universeLogger?.toggle());

        // ★ 新規追加機能のボタン
        if (isMic) {
            const micBtn = addCapsuleBtn('🎙️', "Audio Sync Matrix", '255,0,255', async () => {
                if (window.universeAudio) {
                    if (!window.universeAudio.isMicActive) {
                        const success = await window.universeAudio.startMic();
                        if (success) {
                            micBtn.style.background = 'rgba(0,255,204,0.3)';
                            micBtn.style.borderColor = '#00ffcc';
                            micBtn.style.boxShadow = '0 0 15px #00ffcc';
                            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.2);
                        } else {
                            micBtn.style.background = 'rgba(255,0,0,0.3)';
                            micBtn.style.borderColor = '#ff0000';
                            alert("マイクへのアクセスが拒否されました。");
                        }
                    } else {
                        // 既にアクティブなら停止（または警告）
                        alert("音響シンクロは既に稼働しています。音楽を流すか声を出してみてください！");
                    }
                }
            });
            // 既に起動済みの場合は最初から緑色にしておく
            if (window.universeAudio && window.universeAudio.isMicActive) {
                micBtn.style.background = 'rgba(0,255,204,0.3)';
                micBtn.style.borderColor = '#00ffcc';
                micBtn.style.boxShadow = '0 0 15px #00ffcc';
            }
        }
        
        if (isVision) {
            addCapsuleBtn('✋', "Spatial Gesture Vision", '0,255,204', () => SpatialVision.start(this.app));
        }

        if (isAI) {
            addCapsuleBtn('🧠', "Spawn AI Entity", '255,170,0', () => WanderingEntities.spawn(this.app));
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

            if (this.state.isMobileMode || localStorage.getItem('universe_auto_menu') === 'true') {
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
                if(n.isGhost) return; 

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
        if (node.isWormhole) return;

        if (this.state.isRapidDeleteMode) {
            this.app.currentUniverse.nodes = this.app.currentUniverse.nodes.filter(n => n !== node && n.id !== node.id);
            this.app.currentUniverse.links = this.app.currentUniverse.links.filter(l => l.source !== node && l.target !== node && l.source.id !== node.id && l.target.id !== node.id);
            this.app.blackHole.push(node);
            this.app.autoSave();
            if(window.universeAudio) window.universeAudio.playDelete();
            return;
        }

        if (node.isLocked && !node.isTempUnlocked) {
            this.hideQuickNote();
            this.hideMenu();
            this.lockUI.openForUnlock(node, () => {
                this.showMenu(node, screenX, screenY);
            });
            return;
        }

        this.hideQuickNote();
        
        this.actionMenu.style.left = `${Math.min(screenX, window.innerWidth - 230)}px`;
        this.actionMenu.style.top = `${Math.min(screenY, Math.max(0, window.innerHeight - 480))}px`;
        this.actionMenu.style.display = 'flex';
        
        const btnStyle = 'color:white; background:rgba(255,255,255,0.08); border:none; padding:12px; cursor:pointer; text-align:left; border-radius:8px; font-size:13px; margin-bottom:4px; width:100%; transition:background 0.2s;';
        
        const openUrlBtn = node.url ? `<button id="m-open" style="${btnStyle} color:#00ffff; border:1px solid rgba(0,255,255,0.4); font-weight:bold; box-shadow:0 0 10px rgba(0,255,255,0.2);">🌐 リンクを開く</button>` : '';

        const lockBtnText = node.isLocked ? "🔓 封印を完全に解く" : "🔒 この星を封印する";
        const lockBtnColor = node.isLocked ? "#ffcc00" : "#ff4444";
        
        const ghostBtnText = node.isGhost ? "👁️ 幽霊化を解除" : "👻 幽霊星にする";
        const ghostBtnColor = node.isGhost ? "#00ffcc" : "#8888ff";

        const vaultBtnText = (node.vault && node.vault.length > 0) ? `📦 秘匿データを開く (${node.vault.length}件)` : `📥 ファイルを暗号化格納`;
        const vaultBtnColor = (node.vault && node.vault.length > 0) ? "#ff66aa" : "#888888";
        
        const detailsStyle = "background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-bottom:8px; overflow:hidden;";
        const summaryStyle = "padding:10px; font-size:13px; font-weight:bold; cursor:pointer; outline:none; background:rgba(0,0,0,0.4); display:flex; align-items:center; gap:5px; user-select:none;";
        const contentStyle = "padding:8px; display:flex; flex-direction:column; gap:4px; background:rgba(0,0,0,0.2);";
        const innerBtnStyle = 'color:white; background:rgba(255,255,255,0.08); border:none; padding:10px; cursor:pointer; text-align:left; border-radius:6px; font-size:12px; width:100%; transition:background 0.2s;';

        const canMoveOut = this.app.universeHistory && this.app.universeHistory.length > 0;

        this.actionMenu.innerHTML = `
            <div id="m-drag-handle" style="text-align:center; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid rgba(0,255,204,0.3); color:#00ffcc; font-size:10px; letter-spacing:2px; cursor:move; user-select:none;">＝ DRAG TO MOVE ＝</div>
            
            ${node.url ? `<div style="margin-bottom:8px;">${openUrlBtn}</div>` : ''}

            <details class="nx-accordion" style="${detailsStyle}" open>
                <summary style="${summaryStyle} color:#ff00ff; border-bottom:1px solid rgba(255,0,255,0.2);">📡 通信・秘匿</summary>
                <div style="${contentStyle}">
                    <button id="m-vault" style="${innerBtnStyle} color:${vaultBtnColor}; border:1px solid rgba(255,102,170,0.3); font-weight:bold;">${vaultBtnText}</button>
                    <button id="m-nexus" style="${innerBtnStyle} color:#ff00ff; border:1px solid rgba(255,0,255,0.5); font-weight:bold;">📡 QRセキュア通信</button>
                    <button id="m-p2p-send" style="${innerBtnStyle} color:#ff88ff; border:1px dashed rgba(255,0,255,0.5); font-weight:bold;">🚀 相手の宇宙へ密輸 (P2P)</button>
                    <input type="file" id="m-vault-upload" style="display:none;" accept="*/*" multiple>
                </div>
            </details>

            <details class="nx-accordion" style="${detailsStyle}">
                <summary style="${summaryStyle} color:#00ffcc; border-bottom:1px solid rgba(0,255,204,0.2);">✏️ 基本・情報</summary>
                <div style="${contentStyle}">
                    <button id="m-note" style="${innerBtnStyle} color:#aaffff;">📝 記憶を編集</button>
                    <button id="m-exec" style="${innerBtnStyle} color:#00ff00; font-weight:bold; border:1px dashed rgba(0,255,0,0.5);">▶️ プログラムとして実行</button>
                    <button id="m-ren" style="${innerBtnStyle} color:#ccff66;">✏ 名前変更</button>
                    
                    <div style="display:flex; gap:4px; margin-bottom:4px;">
                        <input type="color" id="m-color-picker" value="${node.color || '#00ffcc'}" style="width:40px; height:32px; border:none; border-radius:6px; background:transparent; cursor:pointer; padding:0; flex-shrink:0;" title="色を変更">
                        <button id="m-shape" style="${innerBtnStyle} flex:1; color:#fff; margin-bottom:0; padding:8px;">💠 形: ${node.shape || 'star'}</button>
                    </div>

                    <button id="m-set-icon" style="${innerBtnStyle} color:#ffaa00;">🖼 画像設定</button>
                    <button id="m-link" style="${innerBtnStyle} color:#aaaaff;">📱 URL登録</button>
                </div>
            </details>

            <details class="nx-accordion" style="${detailsStyle}">
                <summary style="${summaryStyle} color:#ffcc00; border-bottom:1px solid rgba(255,204,0,0.2);">🌌 空間・探索</summary>
                <div style="${contentStyle}">
                    <button id="m-ai" style="${innerBtnStyle} color:#ff00ff; border:1px solid rgba(255,0,255,0.3); font-weight:bold;">🧠 AI思考拡張</button>
                    <button id="m-dive" style="${innerBtnStyle}">➡ 内部へ潜る</button>
                    <button id="m-connect" style="${innerBtnStyle} color:#00ffcc; border:1px solid rgba(0,255,204,0.3);">🔗 別の星と結ぶ</button>
                    
                    ${canMoveOut ? `<button id="m-move-out" style="${innerBtnStyle} color:#ffaa00; border:1px dashed #ffaa00;">⤴️ 外の空間へ出す</button>` : ''}
                    <button id="m-move-node" style="${innerBtnStyle} color:#00ffcc; border:1px solid rgba(0,255,204,0.3);">📦 別の星の中へ移動</button>

                    <div style="display:flex; gap:4px;">
                        <button id="m-up" style="${innerBtnStyle} flex:1; text-align:center; color:#ffcc00; margin-bottom:0;">🌟 拡大</button>
                        <button id="m-down" style="${innerBtnStyle} flex:1; text-align:center; color:#aaa; margin-bottom:0;">🌠 縮小</button>
                    </div>
                </div>
            </details>

            <details class="nx-accordion" style="${detailsStyle}">
                <summary style="${summaryStyle} color:#ff4444; border-bottom:1px solid rgba(255,68,68,0.2);">🚨 状態・システム</summary>
                <div style="${contentStyle}">
                    <button id="m-ghost" style="${innerBtnStyle} color:${ghostBtnColor}; border:1px dashed ${ghostBtnColor}; font-weight:bold;">${ghostBtnText}</button>
                    <button id="m-lock" style="${innerBtnStyle} color:${lockBtnColor}; border:1px solid rgba(255,68,68,0.3); font-weight:bold;">${lockBtnText}</button>
                    <button id="m-del" style="${innerBtnStyle} color:#ff4444; border:1px solid rgba(255,68,68,0.3);">🎒 亜空間へ送る</button>
                </div>
            </details>

            <button id="m-close" style="${btnStyle} background:transparent; text-align:center; font-size:12px; color:#888; margin-top:8px;">❌ 閉じる</button>`;

        const accordions = this.actionMenu.querySelectorAll('.nx-accordion');
        accordions.forEach(acc => {
            acc.addEventListener('click', (e) => {
                if (e.target.tagName !== 'SUMMARY') return; 
                if (!acc.hasAttribute('open')) {
                    accordions.forEach(otherAcc => {
                        if (otherAcc !== acc && otherAcc.hasAttribute('open')) {
                            otherAcc.removeAttribute('open');
                        }
                    });
                }
            });
        });

        const checkDrag = () => this.isActionMenuDragged && this.isActionMenuDragged();

        const mExecBtn = document.getElementById('m-exec');
        if (mExecBtn) {
            mExecBtn.onclick = () => {
                if (checkDrag()) return;
                this.hideMenu();
                if (!node.note || node.note.trim() === "") {
                    alert("⚠️ 星の記憶（ノート）が空です。\n実行したいJavaScriptコードを「記憶を編集」から記述してください。\n\n【API例（赤い星を召喚するコード）】\napp.currentUniverse.addNode('Hack', 0, 0, 50, '#ff0000', 'star');\napp.autoSave();");
                    return;
                }
                try {
                    const executeCode = new Function('app', 'node', node.note);
                    executeCode(this.app, node);
                    
                    if(window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.3);
                    const canvasEl = document.getElementById('universe-canvas');
                    if (canvasEl) {
                        canvasEl.style.transition = 'none';
                        canvasEl.style.filter = 'brightness(2) hue-rotate(180deg)';
                        setTimeout(() => {
                            canvasEl.style.transition = 'all 0.3s ease';
                            canvasEl.style.filter = 'none';
                        }, 100);
                    }
                } catch (err) {
                    alert(`🚨 実行エラー:\n${err.message}`);
                }
            };
        }

        const mColorPicker = document.getElementById('m-color-picker');
        if (mColorPicker) {
            mColorPicker.oninput = (e) => {
                node.color = e.target.value;
                if(typeof this.app.update === 'function') this.app.update();
            };
            mColorPicker.onchange = (e) => {
                node.color = e.target.value;
                this.app.autoSave();
            };
        }

        const mShapeBtn = document.getElementById('m-shape');
        if (mShapeBtn) {
            const shapes = ['star', 'circle', 'rect', 'triangle', 'diamond'];
            mShapeBtn.onclick = (e) => {
                if (checkDrag()) return;
                const currentShape = node.shape || 'star';
                const nextIdx = (shapes.indexOf(currentShape) + 1) % shapes.length;
                node.shape = shapes[nextIdx];
                e.target.innerText = `💠 形: ${node.shape}`;
                this.app.autoSave();
                if(typeof this.app.update === 'function') this.app.update();
                if(this.app.simulation) this.app.simulation.alpha(0.1).restart();
            };
        }

        const moveNodeBtn = document.getElementById('m-move-node');
        if (moveNodeBtn) {
            moveNodeBtn.onclick = () => {
                if (checkDrag()) return;
                this.hideMenu();
                this.app.isMovingNode = true;
                this.app.nodeToMove = node;
                alert("移動先の星をタップ・クリックしてください。\n（何もない場所を押すとキャンセルします）");
            };
        }

        const moveOutBtnEl = document.getElementById('m-move-out');
        if (moveOutBtnEl) {
            moveOutBtnEl.onclick = () => {
                if (checkDrag()) return;
                this.hideMenu();
                const parentUni = this.app.universeHistory[this.app.universeHistory.length - 1];
                if (confirm(`「${node.name}」を外の空間（${parentUni.name}）へ移動しますか？`)) {
                    this.app.currentUniverse.removeNode(node);
                    node.parentUniverse = parentUni;
                    parentUni.nodes.push(node);
                    node.baseX = -this.app.camera.x; node.baseY = -this.app.camera.y;
                    this.app.autoSave();
                    if(window.universeAudio) window.universeAudio.playWarp();
                }
            };
        }

        const vaultUpload = document.getElementById('m-vault-upload');
        document.getElementById('m-vault').onclick = async () => {
            if (checkDrag()) return;
            if (node.vault && node.vault.length > 0) {
                this.hideMenu();
                this.mediaView.open(node); 
                return;
            }
            vaultUpload.click();
        };

        document.getElementById('m-nexus').onclick = () => { if (checkDrag()) return; this.hideMenu(); this.nexusUI.openScanner(node); };

        const p2pSendBtn = document.getElementById('m-p2p-send');
        if (p2pSendBtn) {
            p2pSendBtn.onclick = () => {
                if (checkDrag()) return;
                this.hideMenu();
                if (NexusP2P && NexusP2P.connection) {
                    NexusP2P.sendNode(node);
                } else {
                    alert("⚠️ ターゲットとリンクしていません。\nコントロールパネルの「拡張・防壁」タブからP2Pポータルを開き、通信を確立してください。");
                }
            };
        }

        if (vaultUpload) {
            vaultUpload.onchange = async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                this.hideMenu();
                
                let successCount = 0;
                for (let i = 0; i < files.length; i++) {
                    await VaultMedia.storeMedia(files[i], node);
                    successCount++;
                }
                
                this.app.autoSave(); 
                if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.2);
                alert(`${successCount}件のファイルを暗号化して地下金庫に封印しました。`);
            };
        }

        if (node.url) {
            const mOpenBtn = document.getElementById('m-open');
            if(mOpenBtn) {
                mOpenBtn.onclick = () => {
                    if (checkDrag()) return;
                    this.hideMenu();
                    const a = document.createElement('a');
                    a.href = node.url;
                    a.target = node.url.startsWith('http') ? '_blank' : '_self';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };
            }
        }

        document.getElementById('m-ghost').onclick = () => {
            if (checkDrag()) return;
            this.hideMenu();
            node.isGhost = !node.isGhost;
            this.app.autoSave();
            if(window.universeAudio) window.universeAudio.playWarp();
        };

        document.getElementById('m-lock').onclick = () => {
            if (checkDrag()) return;
            this.hideMenu();
            if (node.isLocked) {
                if(confirm("この星の封印を完全に解除しますか？")) {
                    node.isLocked = false;
                    delete node.password; 
                    node.isTempUnlocked = false;
                    this.app.autoSave();
                }
            } else {
                this.lockUI.openForSet(node);
            }
        };

        document.getElementById('m-ai').onclick = () => { if (checkDrag()) return; this.hideMenu(); ChaosGen.expand(node, this.app); };
        
        document.getElementById('m-dive').onclick = () => { 
            if (checkDrag()) return; 
            this.hideMenu(); 
            this.app.isZoomingIn = true; 
            this.app.targetUniverse = node.innerUniverse; 
            this.app.diveTargetNode = node; 
            this.app.camera.zoomTo(node.x, node.y); 
            if(window.universeAudio) window.universeAudio.playWarp(); 
        };

        document.getElementById('m-note').onclick = () => { if (checkDrag()) return; this.hideMenu(); this.notePad.open(node); };
        document.getElementById('m-up').onclick = () => { if (checkDrag()) return; node.size = Math.min(150, node.size + 10); this.app.autoSave(); };
        document.getElementById('m-down').onclick = () => { if (checkDrag()) return; node.size = Math.max(5, node.size - 10); this.app.autoSave(); };
        document.getElementById('m-ren').onclick = () => { if (checkDrag()) return; const n = prompt("新しい名前:", node.name); if(n){node.name=n; this.app.autoSave();} this.hideMenu(); };
        document.getElementById('m-set-icon').onclick = () => { if (checkDrag()) return; const url = prompt("画像URL:", node.iconUrl || ""); if(url !== null){ node.iconUrl = url; this.app.autoSave(); } this.hideMenu(); };
        document.getElementById('m-link').onclick = () => { if (checkDrag()) return; this.hideMenu(); this.showAppLibrary(node); };
        
        document.getElementById('m-connect').onclick = () => {
            if (checkDrag()) return;
            this.hideMenu();
            this.app.isLinking = true;
            this.app.linkSourceNode = node;
            
            const onNextClick = (e) => {
                let clientX = e.clientX || 0; let clientY = e.clientY || 0;
                if (e.changedTouches && e.changedTouches.length > 0) {
                    clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY;
                }
                const rect = this.app.canvas.getBoundingClientRect();
                const worldX = ((clientX - rect.left) - this.app.canvas.width / 2) / this.app.camera.scale - this.app.camera.x;
                const worldY = ((clientY - rect.top) - this.app.canvas.height / 2) / this.app.camera.scale - this.app.camera.y;
                
                this.app.endLink(worldX, worldY);
                
                window.removeEventListener('mouseup', onNextClick);
                window.removeEventListener('touchend', onNextClick);
            };
            
            setTimeout(() => {
                window.addEventListener('mouseup', onNextClick);
                window.addEventListener('touchend', onNextClick);
            }, 100);
        };

        document.getElementById('m-del').onclick = () => { 
            if (checkDrag()) return;
            if(confirm("収納しますか？")){ 
                this.app.currentUniverse.nodes = this.app.currentUniverse.nodes.filter(n => n !== node && n.id !== node.id);
                this.app.currentUniverse.links = this.app.currentUniverse.links.filter(l => l.source !== node && l.target !== node && l.source.id !== node.id && l.target.id !== node.id);
                this.app.blackHole.push(node); 
                this.app.autoSave(); 
                if(window.universeAudio) window.universeAudio.playDelete(); 
            } 
            this.hideMenu(); 
        };

        document.getElementById('m-close').onclick = () => {
            if (checkDrag()) return;
            this.hideMenu();
        };
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
        html += `</div><button id="custom-url-btn" style="width:100%; padding:12px; background:#113344; color:#00ffff; border:1px solid #00ffff; border-radius:8px; margin-bottom:10px;">URL手動入力</button>`;
        
        if (node.url) {
            html += `<button id="remove-url-btn" style="width:100%; padding:12px; background:#441111; color:#ff4444; border:1px solid #ff4444; border-radius:8px; margin-bottom:10px;">🔗 リンクを解除して元に戻す</button>`;
        }
        
        html += `<button id="lib-close" style="width:100%; padding:10px; background:transparent; border:1px solid #444; color:#888; border-radius:6px;">Cancel</button>`;
        this.appLibraryModal.innerHTML = html; this.appLibraryModal.style.display = 'block';
        
        this.app.appPresets.forEach((app, i) => { document.getElementById(`preset-${i}`).onclick = () => { node.name = app.name; node.url = app.url; node.iconUrl = app.icon; this.app.autoSave(); this.appLibraryModal.style.display='none'; }; });
        document.getElementById('custom-url-btn').onclick = () => {
            this.appLibraryModal.style.display='none'; const url = prompt("URL:", node.url);
            if(url) { node.url = url; if(url.startsWith('http') && confirm("アイコン(Favicon)を自動取得しますか？")){ try { node.iconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`; } catch(e) { node.iconUrl = `https://www.google.com/s2/favicons?domain=${url}&sz=128`; } } this.app.autoSave(); }
        };

        if (node.url) {
            document.getElementById('remove-url-btn').onclick = () => {
                if (confirm("リンクを解除して普通の星に戻しますか？")) {
                    node.url = "";
                    node.iconUrl = ""; 
                    this.app.autoSave();
                    this.appLibraryModal.style.display = 'none';
                }
            };
        }

        document.getElementById('lib-close').onclick = () => this.appLibraryModal.style.display='none';
    }

    showInventoryUI() {
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h4 style="margin:0; color:#ff6699;">亜空間 Storage</h4>
                <label style="color:#ff6699; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" id="inv-select-all" style="accent-color:#ff6699;"> 全選択
                </label>
            </div>
            <div style="max-height:250px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
        `;
        
        this.app.blackHole.forEach((node, i) => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                    <label style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1;">
                        <input type="checkbox" class="inv-checkbox" data-index="${i}" style="accent-color:#ff6699; width:16px; height:16px;">
                        <span style="font-size:13px;">${node.name}</span>
                    </label>
                    <div style="display:flex; gap:5px;">
                        <button id="inv-res-${i}" style="background:#003333; color:#00ffcc; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:11px;">復元</button>
                        <button id="inv-del-${i}" style="background:#330000; color:#ff4444; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:11px;">消滅</button>
                    </div>
                </div>`;
        });
        
        html += `
            </div>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button id="inv-bulk-res" style="flex:1; padding:10px; background:#003333; border:1px solid #00ffcc; color:#00ffcc; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">🌌 選択を復元</button>
                <button id="inv-bulk-del" style="flex:1; padding:10px; background:#330000; border:1px solid #ff4444; color:#ff4444; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">🎒 選択を消滅</button>
            </div>
            <button id="inv-close" style="margin-top:10px; width:100%; padding:10px; background:transparent; border:1px solid #444; color:#888; border-radius:6px; cursor:pointer;">Close</button>
        `;
        
        this.inventoryModal.innerHTML = html; 
        this.inventoryModal.style.display = 'block';
        
        const selectAllCb = document.getElementById('inv-select-all');
        const checkboxes = document.querySelectorAll('.inv-checkbox');
        if (selectAllCb) {
            selectAllCb.onchange = (e) => {
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            };
        }

        this.app.blackHole.forEach((node, i) => {
            document.getElementById(`inv-res-${i}`).onclick = () => { 
                this.app.blackHole.splice(i, 1); 
                node.x = -this.app.camera.x; node.y = -this.app.camera.y; 
                this.app.currentUniverse.nodes.push(node); 
                this.app.autoSave(); 
                this.showInventoryUI(); 
                if(window.universeAudio) window.universeAudio.playSpawn(); 
            };
            document.getElementById(`inv-del-${i}`).onclick = () => { 
                if(confirm("完全に消去しますか？(元に戻せません)")){ 
                    this.app.blackHole.splice(i, 1); 
                    this.app.autoSave(); 
                    this.showInventoryUI(); 
                }
            };
        });

        document.getElementById('inv-bulk-res').onclick = () => {
            const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => parseInt(cb.dataset.index)).sort((a,b)=>b-a);
            if (selected.length === 0) return;
            
            selected.forEach(index => {
                const node = this.app.blackHole[index];
                this.app.blackHole.splice(index, 1);
                node.x = -this.app.camera.x + (Math.random() * 40 - 20); 
                node.y = -this.app.camera.y + (Math.random() * 40 - 20);
                this.app.currentUniverse.nodes.push(node);
            });
            this.app.autoSave();
            this.showInventoryUI();
            if(window.universeAudio) window.universeAudio.playSpawn();
        };

        document.getElementById('inv-bulk-del').onclick = () => {
            const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => parseInt(cb.dataset.index)).sort((a,b)=>b-a);
            if (selected.length === 0) return;
            
            if(confirm(`選択した ${selected.length} 個の星を完全に消去しますか？`)) {
                selected.forEach(index => {
                    this.app.blackHole.splice(index, 1);
                });
                this.app.autoSave();
                this.showInventoryUI();
            }
        };

        document.getElementById('inv-close').onclick = () => this.inventoryModal.style.display='none';
    }
}