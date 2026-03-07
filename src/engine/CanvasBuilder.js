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
                this.currentUniverse.addLink(this.linkSourceNode, targetNode);
                this.autoSave(); 
            }
        }
        this.isLinking = false; this.linkSourceNode = null;
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
                return;
            } 
            
            if (this.appMode === 'RUN') {
                const now = Date.now();
                const isDoubleTap = (target === this.lastClickedNode) && (now - this.lastClickTime < 300);

                if (isDoubleTap) {
                    if (this.singleClickTimeout) clearTimeout(this.singleClickTimeout);
                    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

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
            this.ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
            this.ctx.fill();
        });

        // ★★★ 衛星システムの物理演算（Gravity.js 布石） ★★★
        const orbitingNodes = new Map();
        
        // リンクされている「ターゲット（子）」を探し出し、親星を紐付ける
        this.currentUniverse.links.forEach(link => {
            if (!orbitingNodes.has(link.target)) {
                orbitingNodes.set(link.target, link.source);
            }
        });

        // 1. まず独立した星（親星）の座標を計算
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

        // 2. 次に衛星（子星）を親星の周りに公転させる
        this.currentUniverse.nodes.forEach(node => {
            if (orbitingNodes.has(node)) {
                if (node === this.grabbedNode) {
                    // 掴んでいる間は軌道から外れて指に従う
                    node.x = node.baseX;
                    node.y = node.baseY;
                } else {
                    const parent = orbitingNodes.get(node);
                    const dx = node.baseX - parent.baseX;
                    const dy = node.baseY - parent.baseY;
                    const radius = Math.hypot(dx, dy);
                    const baseAngle = Math.atan2(dy, dx);
                    
                    // ケプラーの法則（もどき）：親に近いほど速く、遠いほどゆっくり回る
                    const speed = 15 / Math.max(radius, 15);
                    const currentAngle = baseAngle + this.time * speed;

                    // 親星の現在の座標を中心に回る
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

        // ★★★ 軌道の描画（結ばれた線が円軌道に変わる） ★★★
        this.currentUniverse.links.forEach(link => {
            const dx = link.target.baseX - link.source.baseX;
            const dy = link.target.baseY - link.source.baseY;
            const radius = Math.hypot(dx, dy);

            // 軌道の円（うすいリング）を描画
            this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.15)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(link.source.x, link.source.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            // 親から子への薄いレーザー線（繋がりを示す）
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

        this.currentUniverse.nodes.forEach(node => {
            const isGrabbed = (node === this.grabbedNode);
            let drawSize = node.size + (isGrabbed ? 3 : 0);
            drawSize += Math.sin(this.time * 2 + node.baseX) * 1.5;

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