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
        
        // --- 初期状態の仮設定 ---
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
        
        // ★非同期初期化を起動
        this.init();
        this.animate();
    }

    // ★新設：クラウドデータの読み込みを待機する初期化メソッド
    async init() {
        console.log("OS: データのロードを開始します...");
        const savedData = await DataManager.load();
        
        if (savedData) {
            this.currentUniverse = savedData.rootUniverse;
            this.wormholes = savedData.wormholes;
            this.blackHole = savedData.blackHole;
            this.allNodesMap = savedData.nodeMap;
        } else {
            const userName = "My Galaxy";
            this.currentUniverse = new Universe(userName, 'space');
            const galaxy = this.currentUniverse.addNode('アイデア銀河', -150, -50, 30, '#9966ff', 'galaxy');
            const star = this.currentUniverse.addNode('基幹システム', 100, -100, 18, '#ffcc00', 'star');
            this.currentUniverse.addLink(galaxy, star);
            this.allNodesMap = new Map();
        }
        this.ui.updateBreadcrumbs();
        console.log("OS: ロード完了。システムをオンラインにします。");
    }

    // 保存も非同期に対応
    async autoSave() {
        let root = this.currentUniverse;
        let histIndex = this.universeHistory.length - 1;
        while (histIndex >= 0) {
            root = this.universeHistory[histIndex];
            histIndex--;
        }
        await DataManager.save(root, this.wormholes, this.blackHole);
    }

    // (中略: executeWarp, resizeCanvas, grabNode, handleMouseMove, startLink, endLink, getNodeAt, handleAscend, handleNodeClick は変更なし)
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
                const clientX = event.touches ? event.touches[0].clientX : event.clientX;
                const clientY = event.touches ? event.touches[0].clientY : event.clientY;
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

        const bgColor = this.currentUniverse.theme === 'cell' ? '#1a0510' : '#0a0a1a';
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.camera.scale, this.camera.scale);
        this.ctx.translate(this.camera.x, this.camera.y);

        this.currentUniverse.particles.forEach(p => {
            this.ctx.fillStyle = this.currentUniverse.theme === 'cell' ? 'rgba(255, 50, 100, 0.3)' : 'rgba(255, 255, 255, 0.5)';
            this.ctx.beginPath();
            const pulse = this.currentUniverse.theme === 'cell' ? Math.sin(this.time * p.speed * 5) * 2 : 0;
            this.ctx.arc(p.x, p.y, Math.max(0.1, p.size + pulse), 0, Math.PI * 2);
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

        // リンク描画
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.currentUniverse.links.forEach(link => {
            this.ctx.beginPath();
            this.ctx.moveTo(link.source.x, link.source.y);
            this.ctx.lineTo(link.target.x, link.target.y);
            this.ctx.stroke();
        });

        // ノード描画
        this.currentUniverse.nodes.forEach(node => {
            const isGrabbed = (node === this.grabbedNode);
            let drawSize = node.size + (isGrabbed ? 3 : 0);
            
            // ★描画ロジック：画像アイコンがある場合
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
                    this.ctx.clip(); 
                    this.ctx.fillStyle = '#111';
                    this.ctx.fill();
                    this.ctx.drawImage(img, node.x - drawSize, node.y - drawSize, drawSize * 2, drawSize * 2);
                    this.ctx.restore();
                    this.ctx.strokeStyle = node.color;
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

            // ★セキュリティ：鍵がかかっている場合に南京錠を表示
            if (node.isLocked) {
                this.ctx.fillStyle = "#ffcc00"; 
                this.ctx.font = "16px serif";
                this.ctx.textAlign = "center";
                this.ctx.fillText("🔒", node.x, node.y - drawSize - 10);
            }

            // ラベル表示
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