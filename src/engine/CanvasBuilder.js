// src/engine/CanvasBuilder.js
import { CameraControl } from './CameraControl.js';
import { Universe, DataManager } from '../core/NodeGraph.js';
import { UIManager } from '../ui/UIManager.js';

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

        this.appPresets = [
            { name: 'YouTube', url: 'https://youtube.com', icon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128' },
            { name: 'X(Twitter)', url: 'https://x.com', icon: 'https://www.google.com/s2/favicons?domain=x.com&sz=128' },
            { name: 'Instagram', url: 'https://instagram.com', icon: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=128' },
            { name: 'LINE', url: 'line://', icon: 'https://www.google.com/s2/favicons?domain=line.me&sz=128' },
            { name: 'ChatGPT', url: 'https://chatgpt.com', icon: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128' },
            { name: 'Notion', url: 'https://notion.so', icon: 'https://www.google.com/s2/favicons?domain=notion.so&sz=128' },
            { name: 'Google Maps', url: 'https://maps.google.com', icon: 'https://www.google.com/s2/favicons?domain=maps.google.com&sz=128' },
            { name: 'Spotify', url: 'https://open.spotify.com', icon: 'https://www.google.com/s2/favicons?domain=open.spotify.com&sz=128' }
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
                this.grabbedNode = null; 
                if (this.hasMovedNode) this.autoSave(); 
            },
            wasDragging: () => this.hasMovedNode,
            onMouseMove: (x, y) => this.handleMouseMove(x, y)
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
        
        if (savedData) {
            this.currentUniverse = savedData.rootUniverse;
            this.wormholes = savedData.wormholes;
            this.blackHole = savedData.blackHole;
            this.allNodesMap = savedData.nodeMap;
        } else {
            const userName = "My Universe";
            this.currentUniverse = new Universe(userName, 'space');
            const galaxy = this.currentUniverse.addNode('アイデア', -150, -50, 30, '#9966ff', 'star');
            const star = this.currentUniverse.addNode('システム', 100, -100, 18, '#ffcc00', 'star');
            this.currentUniverse.addLink(galaxy, star);
            this.allNodesMap = new Map();
        }
        
        this.ui.updateBreadcrumbs();
        console.log("OS: ロード完了。システムをオンラインにします。");
    }

    async autoSave() {
        let root = this.currentUniverse;
        let histIndex = this.universeHistory.length - 1;
        while (histIndex >= 0) {
            root = this.universeHistory[histIndex];
            histIndex--;
        }
        await DataManager.save(root, this.wormholes, this.blackHole);
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
        if (node) { this.grabbedNode = node; this.hasMovedNode = false; return true; }
        return false;
    }

    handleMouseMove(x, y) {
        this.mouseWorldX = x; this.mouseWorldY = y;
        if (this.grabbedNode) {
            this.grabbedNode.baseX = x; this.grabbedNode.baseY = y;
            this.hasMovedNode = true;
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
    }

    handleNodeClick(worldX, worldY, event) {
        if (this.isZoomingIn || this.hasMovedNode || this.appMode === 'LINK') {
            this.ui.hideMenu(); 
            return;
        }

        const target = this.getNodeAt(worldX, worldY);
        
        if (target) {
            if (this.appMode === 'EDIT') {
                // ★【スマホ対応】タッチ座標を確実に取得！
                let clientX = event.clientX || 0;
                let clientY = event.clientY || 0;
                
                if (event.changedTouches && event.changedTouches.length > 0) {
                    clientX = event.changedTouches[0].clientX;
                    clientY = event.changedTouches[0].clientY;
                } else if (event.touches && event.touches.length > 0) {
                    clientX = event.touches[0].clientX;
                    clientY = event.touches[0].clientY;
                }

                let posX = clientX + 15; let posY = clientY + 15;
                if (posX + 180 > window.innerWidth) posX = window.innerWidth - 180;
                if (posY + 300 > window.innerHeight) posY = window.innerHeight - 300;
                this.ui.showMenu(target, posX, posY);
            } 
            else if (this.appMode === 'RUN') {
                if (target.url) {
                    const targetWin = target.url.startsWith('http') ? '_blank' : '_self';
                    window.open(target.url, targetWin);
                } else {
                    this.isZoomingIn = true;
                    this.targetUniverse = target.innerUniverse;
                    this.camera.zoomTo(target.x, target.y);
                }
            }
        } else {
            this.ui.hideMenu();
        }
    }

    animate() {
        this.time += 0.02;
        this.camera.update();

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

        this.currentUniverse.nodes.forEach(node => {
            if (node !== this.grabbedNode) {
                node.x = node.baseX + Math.sin(this.time + node.randomOffset) * 5;
                node.y = node.baseY + Math.cos(this.time * 0.8 + node.randomOffset) * 5;
            } else {
                node.x = node.baseX; node.y = node.baseY;
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

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1.5;
        this.currentUniverse.links.forEach(link => {
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

        // ★星の描画を1種類（シンプルな丸）に統一！
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