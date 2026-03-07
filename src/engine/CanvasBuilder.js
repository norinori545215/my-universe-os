// src/engine/CanvasBuilder.js
import { CameraControl } from './CameraControl.js';
import { Universe, DataManager } from '../core/NodeGraph.js';
import { UIManager } from '../ui/UIManager.js';
import { saveEncryptedUniverse } from '../db/CloudSync.js';

export class CanvasBuilder {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.universeHistory = [];
        this.wormholes = []; 
        this.blackHole = []; 
        this.memorizedNode = null; 
        this.imageCache = {};
        
        this.currentUniverse = new Universe("Loading...", 'space');
        this.allNodesMap = new Map();

        this.isZoomingIn = false;
        this.targetUniverse = null;
        this.isLinking = false;
        this.linkSourceNode = null;
        this.grabbedNode = null;
        this.hasMovedNode = false;
        this.mouseWorldX = 0; this.mouseWorldY = 0;
        this.appMode = 'RUN'; 

        this.grabOffsetX = 0;
        this.grabOffsetY = 0;
        this.grabStartX = 0;
        this.grabStartY = 0;

        this.saveTimeout = null;

        this.pressTimer = null;
        this.isLongPressed = false;

        this.lastClickTime = 0;
        this.lastClickedNode = null;
        this.singleClickTimeout = null;

        // ★ 新規：波紋（リップル）エフェクトを管理する配列
        this.ripples = [];

        this.appPresets = [
            { name: 'YouTube', url: 'https://youtube.com', icon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128' },
            { name: 'X(Twitter)', url: 'https://x.com', icon: 'https://www.google.com/s2/favicons?domain=x.com&sz=128' },
            { name: 'Instagram', url: 'https://instagram.com', icon: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=128' },
            { name: 'LINE', url: 'line://', icon: 'https://www.google.com/s2/favicons?domain=line.me&sz=128' }
        ];

        this.ui = new UIManager(this);

        this.camera = new CameraControl(this.canvas, {
            onClick: (x, y, e) => this.handleNodeClick(x, y, e),
            onRightClick: () => this.handleAscend(),
            onLinkStart: (x, y) => this.startLink(x, y),
            onLinkEnd: (x, y) => this.endLink(x, y),
            isLinking: () => this.isLinking,
            isLinkModeActive: () => this.appMode === 'LINK',
            
            onNodeGrabStart: (x, y) => this.grabNode(x, y),
            onNodeGrabEnd: () => { 
                if (this.pressTimer) clearTimeout(this.pressTimer);
                this.grabbedNode = null; 
                if (this.hasMovedNode) this.autoSave(); 
            },
            wasDragging: () => this.hasMovedNode,
            onMouseMove: (x, y) => this.handleMouseMove(x, y)
        });

        window.addEventListener('mouseup', () => {
            if (this.pressTimer) clearTimeout(this.pressTimer);
            if (this.grabbedNode && !this.hasMovedNode) this.grabbedNode = null;
        });
        window.addEventListener('touchend', () => {
            if (this.pressTimer) clearTimeout(this.pressTimer);
            if (this.grabbedNode && !this.hasMovedNode) this.grabbedNode = null;
        });

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.time = 0;
        
        this.init();
        this.animate();
    }

    async init() {
        console.log("OS: データのロードを開始します...");
        const savedData = await DataManager.load();
        
        let userName = "My Universe";
        try {
            const authModule = await import('../security/Auth.js');
            const user = authModule.auth.currentUser;
            if (user && user.displayName) userName = `${user.displayName}の宇宙`;
        } catch (e) {
            console.error("Authモジュールの読み込みに失敗しました:", e);
        }
        
        if (savedData) {
            this.currentUniverse = savedData.rootUniverse;
            this.wormholes = savedData.wormholes;
            this.blackHole = savedData.blackHole;
            this.allNodesMap = savedData.nodeMap;
        } else {
            this.currentUniverse = new Universe(userName, 'space');
            const galaxy = this.currentUniverse.addNode('アイデア', -150, -50, 30, '#9966ff', 'galaxy');
            const star = this.currentUniverse.addNode('システム', 100, -100, 18, '#ffcc00', 'star');
            this.currentUniverse.addLink(galaxy, star);
            this.allNodesMap = new Map();
        }
        
        this.ui.updateBreadcrumbs();
    }

    async autoSave() {
        let root = this.currentUniverse;
        let histIndex = this.universeHistory.length - 1;
        while (histIndex >= 0) {
            root = this.universeHistory[histIndex];
            histIndex--;
        }
        
        await DataManager.save(root, this.wormholes, this.blackHole);

        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            try {
                const rawData = sessionStorage.getItem('my_universe_save_data');
                if (rawData) {
                    const dataObj = JSON.parse(rawData);
                    await saveEncryptedUniverse(dataObj);
                }
            } catch (e) {
                console.error("OS: クラウド同期エラー", e);
            }
        }, 3000); 
    }

    executeWarp(targetNode) {
        if (this.currentUniverse.name !== targetNode.parentUniverse.name) {
            this.universeHistory.push(this.currentUniverse);
            this.currentUniverse = targetNode.parentUniverse;
            this.ui.updateBreadcrumbs();
        }
        this.camera.targetX = -targetNode.x; this.camera.targetY = -targetNode.y;
        this.camera.x = -targetNode.x; this.camera.y = -targetNode.y;
        this.camera.targetScale = 1; this.camera.scale = 1;
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // ★ 新規：波紋（リップル）を発生させるメソッド
    spawnRipple(x, y, color = '#00ffcc', isLarge = false) {
        this.ripples.push({
            x: x,
            y: y,
            radius: 10,
            maxRadius: isLarge ? 120 : 60,
            alpha: 0.8,
            color: color,
            speed: isLarge ? 8 : 4
        });
    }

    grabNode(x, y) {
        const node = this.getNodeAt(x, y);
        if (node) { 
            this.grabbedNode = node; 
            this.hasMovedNode = false; 
            
            this.grabOffsetX = node.baseX - x;
            this.grabOffsetY = node.baseY - y;
            this.grabStartX = x;
            this.grabStartY = y;

            this.isLongPressed = false;
            if (this.pressTimer) clearTimeout(this.pressTimer);

            if (this.appMode === 'RUN') {
                this.pressTimer = setTimeout(() => {
                    if (!this.hasMovedNode && this.grabbedNode) {
                        this.isLongPressed = true;
                        if (navigator.vibrate) navigator.vibrate(50);
                        
                        // 長押し成功時に波紋を出す
                        this.spawnRipple(this.grabbedNode.x, this.grabbedNode.y, '#ff00ff', true);

                        const screenX = (this.grabbedNode.x + this.camera.x) * this.camera.scale + this.canvas.width / 2;
                        const screenY = (this.grabbedNode.y + this.camera.y) * this.camera.scale + this.canvas.height / 2;
                        
                        if (this.ui.showQuickNote) this.ui.showQuickNote(this.grabbedNode, screenX, screenY);
                    }
                }, 500);
            }
            return true; 
        }
        return false;
    }

    handleMouseMove(x, y) {
        this.mouseWorldX = x; this.mouseWorldY = y;
        
        if (this.grabbedNode) {
            if (!this.hasMovedNode) {
                const dx = x - this.grabStartX;
                const dy = y - this.grabStartY;
                if (dx * dx + dy * dy > 64) { 
                    this.hasMovedNode = true;
                    if (this.pressTimer) clearTimeout(this.pressTimer);
                }
            }

            if (this.hasMovedNode) {
                this.grabbedNode.baseX = x + this.grabOffsetX;
                this.grabbedNode.baseY = y + this.grabOffsetY;
            }
        }
    }

    startLink(x, y) {
        const node = this.getNodeAt(x, y);
        if (node) { this.isLinking = true; this.linkSourceNode = node; }
    }

    endLink(x, y) {
        if (this.isLinking && this.linkSourceNode) {
            const targetNode = this.getNodeAt(x, y);
            if (targetNode && targetNode !== this.linkSourceNode) {
                
                const existingLinkIndex = this.currentUniverse.links.findIndex(link => {
                    const isSameForward = (link.source === this.linkSourceNode && link.target === targetNode) || 
                                          (link.source.id && link.source.id === this.linkSourceNode.id && link.target.id === targetNode.id);
                    const isSameReverse = (link.source === targetNode && link.target === this.linkSourceNode) || 
                                          (link.source.id && link.source.id === targetNode.id && link.target.id === this.linkSourceNode.id);
                    return isSameForward || isSameReverse;
                });

                if (existingLinkIndex !== -1) {
                    this.currentUniverse.links.splice(existingLinkIndex, 1);
                    targetNode.baseX = targetNode.x;
                    targetNode.baseY = targetNode.y;
                    this.linkSourceNode.baseX = this.linkSourceNode.x;
                    this.linkSourceNode.baseY = this.linkSourceNode.y;

                    if (window.universeLogger) window.universeLogger.log("UNLINKED", { target: targetNode.name });
                    if (window.universeAudio) window.universeAudio.playSystemSound(300, 'square', 0.1);
                    this.spawnRipple(targetNode.x, targetNode.y, '#ff4444'); // 切断の波紋
                } else {
                    this.currentUniverse.addLink(this.linkSourceNode, targetNode);
                    if (window.universeLogger) window.universeLogger.log("LINKED", { target: targetNode.name });
                    this.spawnRipple(targetNode.x, targetNode.y, '#00ffcc', true); // 結合の波紋
                }
                
                this.autoSave(); 
            }
        }
        this.isLinking = false; 
        this.linkSourceNode = null;
    }

    getNodeAt(x, y) {
        return this.currentUniverse.nodes.find(node => {
            const dx = x - node.x; const dy = y - node.y;
            return Math.sqrt(dx * dx + dy * dy) < node.size + 15;
        });
    }

    handleAscend() {
        if (this.isZoomingIn || this.universeHistory.length === 0) return;
        this.currentUniverse = this.universeHistory.pop();
        this.camera.reset();
        this.ui.updateBreadcrumbs();
        if (window.universeAudio) window.universeAudio.playWarp();
        
        // 戻った瞬間に画面中央から空間の波紋を出す
        this.spawnRipple(-this.camera.x, -this.camera.y, '#ffffff', true);
    }

    handleNodeClick(worldX, worldY, event) {
        if (this.pressTimer) clearTimeout(this.pressTimer);

        if (this.isLongPressed) {
            this.isLongPressed = false;
            this.grabbedNode = null;
            return;
        }

        this.grabbedNode = null; 

        if (this.isZoomingIn || this.hasMovedNode || this.appMode === 'LINK') {
            this.ui.hideMenu(); 
            return;
        }

        const target = this.getNodeAt(worldX, worldY);
        
        if (target) {
            if (this.appMode === 'EDIT') {
                let clientX = event.clientX || 0; let clientY = event.clientY || 0;
                if (event.changedTouches && event.changedTouches.length > 0) {
                    clientX = event.changedTouches[0].clientX; clientY = event.changedTouches[0].clientY;
                }
                let posX = clientX + 15; let posY = clientY + 15;
                if (posX + 180 > window.innerWidth) posX = window.innerWidth - 180;
                if (posY + 300 > window.innerHeight) posY = window.innerHeight - 300;
                this.ui.showMenu(target, posX, posY);
                this.spawnRipple(target.x, target.y, '#ffcc00'); // メニュー展開の波紋
                return;
            } 
            
            if (this.appMode === 'RUN') {
                const now = Date.now();
                const isDoubleTap = (target === this.lastClickedNode) && (now - this.lastClickTime < 300);

                if (isDoubleTap) {
                    if (this.singleClickTimeout) clearTimeout(this.singleClickTimeout);
                    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

                    this.spawnRipple(target.x, target.y, '#ff00ff', true); // ダブルタップ時の強烈な波紋

                    if (worldX < target.x) {
                        this.executeDiveToNode(target);
                    } else {
                        this.moveToNextNode(target);
                    }

                    this.lastClickTime = 0;
                    this.lastClickedNode = null;
                } else {
                    this.lastClickedNode = target;
                    this.lastClickTime = now;

                    this.singleClickTimeout = setTimeout(() => {
                        this.spawnRipple(target.x, target.y, target.color); // シングルタップ時の波紋

                        if (target.url) {
                            const targetWin = target.url.startsWith('http') ? '_blank' : '_self';
                            window.open(target.url, targetWin);
                        } else {
                            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
                        }
                    }, 300);
                }
            }
        } else {
            this.ui.hideMenu();
            if (this.ui.hideQuickNote) this.ui.hideQuickNote();
            this.lastClickedNode = null;
            // 空間をタップした時も小さな波紋を出す
            this.spawnRipple(worldX, worldY, 'rgba(255,255,255,0.5)');
        }
    }

    executeDiveToNode(target) {
        this.isZoomingIn = true;
        this.targetUniverse = target.innerUniverse;
        this.camera.zoomTo(target.x, target.y);
        if (window.universeAudio) window.universeAudio.playWarp();
        if (window.universeLogger) window.universeLogger.log("DIVE_DEEP", { target: target.name });
    }

    moveToNextNode(currentNode) {
        const nodes = this.currentUniverse.nodes;
        if (nodes.length <= 1) return; 

        const currentIndex = nodes.indexOf(currentNode);
        const nextIndex = (currentIndex + 1) % nodes.length;
        const nextNode = nodes[nextIndex];

        this.camera.targetX = -nextNode.x;
        this.camera.targetY = -nextNode.y;
        
        if (window.universeAudio) window.universeAudio.playSystemSound(400, 'triangle', 0.2, 200);
        if (window.universeLogger) window.universeLogger.log("SLIDE_NEXT", { from: currentNode.name, to: nextNode.name });
    }

    animate() {
        this.time += 0.02;

        // ★★★ 153bpm の絶対時間パルス計算 ★★★
        const bpm = 153;
        const msPerBeat = 60000 / bpm; // 約392ms
        // 現在時刻から、ビートの「位相（0.0〜1.0）」を計算
        const beatPhase = (Date.now() % msPerBeat) / msPerBeat; 
        // 鼓動のような鋭いパルス（ドクンッ…という感じ）を生成
        const pulse = Math.pow(Math.sin(beatPhase * Math.PI), 4); 

        this.camera.update(this.currentUniverse.nodes);

        if (this.isZoomingIn && this.camera.scale > 38) {
            this.universeHistory.push(this.currentUniverse);
            this.currentUniverse = this.targetUniverse;
            this.camera.reset();
            this.isZoomingIn = false;
            this.hasMovedNode = false;
            this.ui.updateBreadcrumbs(); 
        }

        const bgColor = '#0a0a1a'; 
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.camera.scale, this.camera.scale);
        this.ctx.translate(this.camera.x, this.camera.y);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.currentUniverse.particles.forEach(p => {
            this.ctx.beginPath();
            // 背景の粒子も153bpmでわずかに瞬く
            this.ctx.arc(p.x, p.y, Math.max(0.1, p.size + (pulse * 0.5)), 0, Math.PI * 2);
            this.ctx.fill();
        });

        const orbitingNodes = new Map();
        
        this.currentUniverse.links.forEach(link => {
            if (!orbitingNodes.has(link.target)) {
                orbitingNodes.set(link.target, link.source);
            }
        });

        this.currentUniverse.nodes.forEach(node => {
            if (!orbitingNodes.has(node)) {
                if (node === this.grabbedNode) {
                    node.x = node.baseX;
                    node.y = node.baseY;
                } else {
                    node.x = node.baseX + Math.sin(this.time + node.randomOffset) * 5;
                    node.y = node.baseY + Math.cos(this.time * 0.8 + node.randomOffset) * 5;
                }
            }
        });

        this.currentUniverse.nodes.forEach(node => {
            if (orbitingNodes.has(node)) {
                if (node === this.grabbedNode) {
                    node.x = node.baseX;
                    node.y = node.baseY;
                } else {
                    const parent = orbitingNodes.get(node);
                    const dx = node.baseX - parent.baseX;
                    const dy = node.baseY - parent.baseY;
                    const radius = Math.hypot(dx, dy);
                    const baseAngle = Math.atan2(dy, dx);
                    
                    const speed = 15 / Math.max(radius, 15);
                    const currentAngle = baseAngle + this.time * speed;

                    node.x = parent.x + Math.cos(currentAngle) * radius;
                    node.y = parent.y + Math.sin(currentAngle) * radius;
                }
            }
        });

        this.ctx.lineWidth = 3;
        this.wormholes.forEach(wh => {
            const hasSource = this.currentUniverse.nodes.includes(wh.source);
            const hasTarget = this.currentUniverse.nodes.includes(wh.target);
            
            if (hasSource || hasTarget) {
                const visibleNode = hasSource ? wh.source : wh.target;
                const destNode = hasSource ? wh.target : wh.source;

                this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
                this.ctx.beginPath();
                this.ctx.moveTo(visibleNode.x, visibleNode.y);
                const endX = visibleNode.x + Math.sin(this.time)*50;
                const endY = visibleNode.y - 500;
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();

                this.ctx.fillStyle = '#ff88ff';
                this.ctx.font = '12px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`➡ ${destNode.name} (${destNode.parentUniverse.name})`, endX, visibleNode.y - 120);
            }
        });

        this.currentUniverse.links.forEach(link => {
            const dx = link.target.baseX - link.source.baseX;
            const dy = link.target.baseY - link.source.baseY;
            const radius = Math.hypot(dx, dy);

            // 軌道リングも脈打たせる
            this.ctx.strokeStyle = `rgba(0, 255, 204, ${0.1 + (pulse * 0.15)})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(link.source.x, link.source.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            this.ctx.beginPath();
            this.ctx.moveTo(link.source.x, link.source.y);
            this.ctx.lineTo(link.target.x, link.target.y);
            this.ctx.stroke();
        });

        if (this.isLinking && this.linkSourceNode) {
            this.ctx.strokeStyle = '#00ffcc';
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.linkSourceNode.x, this.linkSourceNode.y);
            this.ctx.lineTo(this.mouseWorldX, this.mouseWorldY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // ★★★ 波紋（リップル）の更新と描画 ★★★
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += r.speed;
            r.alpha -= r.speed / r.maxRadius; // 大きくなるにつれて透明に

            if (r.alpha <= 0) {
                this.ripples.splice(i, 1);
            } else {
                this.ctx.save();
                this.ctx.strokeStyle = r.color;
                this.ctx.globalAlpha = r.alpha;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.restore();
            }
        }

        this.currentUniverse.nodes.forEach(node => {
            const isGrabbed = (node === this.grabbedNode);
            // ★ 星のサイズに153bpmのパルスを加算して脈打たせる
            let drawSize = node.size + (isGrabbed ? 3 : 0);
            drawSize += Math.sin(this.time * 2 + node.baseX) * 1.5;
            drawSize += pulse * 2.0; // 鼓動による膨張

            // ★ 星のオーラ（影）もパルスに連動して光る
            this.ctx.shadowBlur = isGrabbed ? 30 : 15 + (pulse * 15);
            this.ctx.shadowColor = node.color;

            if (node.iconUrl) {
                if (!this.imageCache[node.iconUrl]) {
                    const img = new Image();
                    img.src = node.iconUrl;
                    this.imageCache[node.iconUrl] = img;
                }

                const img = this.imageCache[node.iconUrl];
                if (img.complete && img.naturalHeight !== 0) {
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.arc(node.x, node.y, drawSize, 0, Math.PI * 2);
                    this.ctx.closePath();
                    this.ctx.clip(); 
                    
                    this.ctx.fillStyle = '#111';
                    this.ctx.fill();

                    this.ctx.drawImage(img, node.x - drawSize, node.y - drawSize, drawSize * 2, drawSize * 2);
                    this.ctx.restore();

                    this.ctx.strokeStyle = node.color;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.arc(node.x, node.y, drawSize, 0, Math.PI * 2);
                    this.ctx.stroke();
                } else {
                    this.ctx.fillStyle = node.color;
                    this.ctx.beginPath();
                    this.ctx.arc(node.x, node.y, drawSize, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            } else {
                this.ctx.fillStyle = node.color;
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, drawSize, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.shadowBlur = 0; // テキスト描画前に影をリセット

            if (node.isLocked) {
                this.ctx.fillStyle = "#ffcc00"; 
                this.ctx.font = "16px serif";
                this.ctx.textAlign = "center";
                this.ctx.fillText("🔒", node.x, node.y - drawSize - 10);
            }

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px sans-serif';
            this.ctx.textAlign = 'center';
            const displayName = node.url ? `🔗 ${node.name}` : node.name;
            this.ctx.fillText(displayName, node.x, node.y + drawSize + 20);
        });

        this.ctx.restore();
        requestAnimationFrame(() => this.animate());
    }
}