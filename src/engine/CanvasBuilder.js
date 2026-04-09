// src/engine/CanvasBuilder.js
import { CameraControl } from './CameraControl.js';
import { Universe, DataManager } from '../core/NodeGraph.js';
import { UIManager } from '../ui/UIManager.js';
import { saveEncryptedUniverse } from '../db/CloudSync.js';
import { TimeMachine } from '../core/TimeMachine.js';
import { AutoPilot } from './AutoPilot.js';

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

        this.isMovingNode = false;
        this.nodeToMove = null;

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
                
                if (this.hasMovedNode && this.grabbedNode) {
                    const gNode = this.grabbedNode;
                    this.grabbedNode = null; 
                    const targetNode = this.getNodeAt(this.mouseWorldX, this.mouseWorldY);
                    this.grabbedNode = gNode; 

                    if (targetNode && targetNode !== this.grabbedNode && !targetNode.isGhost) {
                        if (confirm(`「${this.grabbedNode.name}」を「${targetNode.name}」の中に移動させますか？`)) {
                            this.currentUniverse.nodes = this.currentUniverse.nodes.filter(n => n !== this.grabbedNode && n.id !== this.grabbedNode.id);
                            this.currentUniverse.links = this.currentUniverse.links.filter(l => l.source !== this.grabbedNode && l.target !== this.grabbedNode && l.source.id !== this.grabbedNode.id && l.target.id !== this.grabbedNode.id);
                            
                            this.grabbedNode.parentUniverse = targetNode.innerUniverse;
                            targetNode.innerUniverse.nodes.push(this.grabbedNode);
                            
                            this.grabbedNode.baseX = 0; this.grabbedNode.baseY = 0;
                            this.grabbedNode.x = 0; this.grabbedNode.y = 0;
                            if(window.universeAudio) window.universeAudio.playWarp();
                        }
                    }
                }
                
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

        this.autoPilot = new AutoPilot(this);
    }

    async init() {
        const savedData = await DataManager.load();
        let userName = "My Universe";
        try {
            const authModule = await import('../security/Auth.js');
            const user = authModule.auth.currentUser;
            if (user && user.displayName) userName = `${user.displayName}の宇宙`;
        } catch (e) {}
        
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
        
        let root = this.currentUniverse;
        while (this.universeHistory.length > 0 && root.parentUniverse) { root = root.parentUniverse; }
        TimeMachine.record(root, this.wormholes, this.blackHole);
    }

    async autoSave() {
        let root = this.currentUniverse;
        let histIndex = this.universeHistory.length - 1;
        while (histIndex >= 0) {
            root = this.universeHistory[histIndex];
            histIndex--;
        }
        await DataManager.save(root, this.wormholes, this.blackHole);
        TimeMachine.record(root, this.wormholes, this.blackHole);
        
        if (this.ui && this.ui.updateTimeSliderParams) this.ui.updateTimeSliderParams();

        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            try {
                const rawData = sessionStorage.getItem('my_universe_save_data');
                if (rawData) {
                    const dataObj = JSON.parse(rawData);
                    await saveEncryptedUniverse(dataObj);
                }
            } catch (e) {}
        }, 3000); 
    }

    executeTimeTravel(historyIndex) {
        const pastData = TimeMachine.travel(historyIndex);
        if (!pastData) return;

        const pastNodes = [];
        const extract = (uni) => {
            if(!uni || !uni.nodes) return;
            uni.nodes.forEach(n => {
                pastNodes.push(n);
                if (n.innerUniverse) extract(n.innerUniverse);
            });
        };
        extract(pastData.rootUniverse);

        const animateToPast = (node, pastX, pastY) => {
            const startX = node.baseX; const startY = node.baseY;
            const duration = 600; 
            const startTime = performance.now();
            const easeOut = (t) => 1 - Math.pow(1 - t, 3);

            const animate = (currentTime) => {
                let elapsed = currentTime - startTime;
                if (elapsed > duration) elapsed = duration;
                const progress = elapsed / duration;
                const ease = easeOut(progress);

                node.baseX = startX + (pastX - startX) * ease;
                node.baseY = startY + (pastY - startY) * ease;

                if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
        };

        this.currentUniverse.nodes.forEach(node => {
            const pastNode = pastNodes.find(n => n.id === node.id || n.name === node.name);
            if (pastNode) {
                animateToPast(node, pastNode.x, pastNode.y);
                node.size = pastNode.size;
                node.color = pastNode.color;
            }
        });
        
        if(window.universeAudio) window.universeAudio.playWarp();
        this.spawnRipple(-this.camera.x, -this.camera.y, '#ffcc00', true);
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

    spawnRipple(x, y, color = '#00ffcc', isLarge = false) {
        this.ripples.push({
            x: x, y: y,
            radius: 10,
            maxRadius: isLarge ? 120 : 60,
            alpha: 0.6,
            color: color,
            speed: isLarge ? 8 : 4
        });
    }

    grabNode(x, y) {
        const node = this.getNodeAt(x, y);
        if (node) { 
            this.grabbedNode = node; 
            this.hasMovedNode = false; 
            
            node.baseX = node.x;
            node.baseY = node.y;

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
                const dx = x - this.grabStartX; const dy = y - this.grabStartY;
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
                    targetNode.baseX = targetNode.x; targetNode.baseY = targetNode.y;
                    this.linkSourceNode.baseX = this.linkSourceNode.x; this.linkSourceNode.baseY = this.linkSourceNode.y;
                    if (window.universeAudio) window.universeAudio.playSystemSound(300, 'square', 0.1);
                    this.spawnRipple(targetNode.x, targetNode.y, '#ff4444'); 
                } else {
                    this.currentUniverse.addLink(this.linkSourceNode, targetNode);
                    this.spawnRipple(targetNode.x, targetNode.y, '#00ffcc', true); 
                }
                this.autoSave(); 
            }
        }
        this.isLinking = false; 
        this.linkSourceNode = null;
    }

    getNodeAt(x, y) {
        const screenCenterX = -this.camera.x;
        const screenCenterY = -this.camera.y;

        const nodes = this.currentUniverse.nodes;
        for(let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];

            if (node.isGhost) {
                const distToCenter = Math.hypot(node.x - screenCenterX, node.y - screenCenterY);
                if (distToCenter > (300 / this.camera.scale)) {
                    continue; 
                }
            }

            const dx = x - node.x; 
            const dy = y - node.y;
            if (Math.sqrt(dx * dx + dy * dy) < node.size + 25) {
                return node;
            }
        }
        return null;
    }

    handleAscend() {
        if (this.isZoomingIn || this.universeHistory.length === 0) return;
        this.currentUniverse = this.universeHistory.pop();
        this.camera.reset();
        this.ui.updateBreadcrumbs();
        if (window.universeAudio) window.universeAudio.playWarp();
        this.spawnRipple(-this.camera.x, -this.camera.y, '#ffffff', true);
    }

    handleNodeClick(worldX, worldY, event) {
        if (this.pressTimer) clearTimeout(this.pressTimer);
        if (this.isLongPressed) { this.isLongPressed = false; this.grabbedNode = null; return; }
        
        const target = this.grabbedNode || this.getNodeAt(worldX, worldY);
        this.grabbedNode = null; 

        if (this.isMovingNode) {
            if (target && target !== this.nodeToMove && !target.isGhost) {
                if (confirm(`「${this.nodeToMove.name}」を「${target.name}」の中に移動させますか？`)) {
                    this.currentUniverse.nodes = this.currentUniverse.nodes.filter(n => n !== this.nodeToMove && n.id !== this.nodeToMove.id);
                    this.currentUniverse.links = this.currentUniverse.links.filter(l => l.source !== this.nodeToMove && l.target !== this.nodeToMove && l.source.id !== this.nodeToMove.id && l.target.id !== this.nodeToMove.id);
                    
                    this.nodeToMove.parentUniverse = target.innerUniverse;
                    target.innerUniverse.nodes.push(this.nodeToMove);
                    
                    this.nodeToMove.baseX = 0; this.nodeToMove.baseY = 0;
                    this.nodeToMove.x = 0; this.nodeToMove.y = 0;
                    this.autoSave();
                    if(window.universeAudio) window.universeAudio.playWarp();
                }
            }
            this.isMovingNode = false;
            this.nodeToMove = null;
            this.spawnRipple(worldX, worldY, '#ff0000');
            return;
        }

        if (this.isZoomingIn || this.hasMovedNode || this.appMode === 'LINK') {
            this.ui.hideMenu(); return;
        }

        if (target) {
            if (this.appMode === 'EDIT' || this.isMobileMode) {
                let clientX = event.clientX || 0; let clientY = event.clientY || 0;
                if (event.changedTouches && event.changedTouches.length > 0) {
                    clientX = event.changedTouches[0].clientX; clientY = event.changedTouches[0].clientY;
                }
                let posX = clientX + 15; let posY = clientY + 15;
                if (posX + 180 > window.innerWidth) posX = window.innerWidth - 180;
                if (posY + 300 > window.innerHeight) posY = window.innerHeight - 300;
                this.ui.showMenu(target, posX, posY);
                this.spawnRipple(target.x, target.y, '#ffcc00'); 
                return;
            } 
            
            if (this.appMode === 'RUN') {
                const now = Date.now();
                const isDoubleTap = (target === this.lastClickedNode) && (now - this.lastClickTime < 300);

                if (isDoubleTap) {
                    const executeDoubleTapAction = () => {
                        if (this.singleClickTimeout) clearTimeout(this.singleClickTimeout);
                        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
                        this.spawnRipple(target.x, target.y, '#ff00ff', true); 

                        if (worldX < target.x) this.executeDiveToNode(target);
                        else this.moveToNextNode(target);

                        this.lastClickTime = 0; this.lastClickedNode = null;
                    };

                    if (target.isLocked && !target.isTempUnlocked) {
                        this.ui.lockUI.openForUnlock(target, executeDoubleTapAction);
                    } else {
                        executeDoubleTapAction();
                    }

                } else {
                    this.lastClickedNode = target; this.lastClickTime = now;
                    this.singleClickTimeout = setTimeout(() => {
                        const executeSingleClickAction = () => {
                            this.spawnRipple(target.x, target.y, target.color); 
                            if (target.url) {
                                const a = document.createElement('a');
                                a.href = target.url;
                                a.target = target.url.startsWith('http') ? '_blank' : '_self';
                                a.rel = 'noopener noreferrer';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            } else if (window.universeAudio) {
                                window.universeAudio.playSystemSound(600, 'sine', 0.1);
                            }
                        };

                        if (target.isLocked && !target.isTempUnlocked) {
                            this.ui.lockUI.openForUnlock(target, executeSingleClickAction);
                        } else {
                            executeSingleClickAction();
                        }
                    }, 300);
                }
            }
        } else {
            this.ui.hideMenu();
            if (this.ui.hideQuickNote) this.ui.hideQuickNote();
            this.lastClickedNode = null;
            this.spawnRipple(worldX, worldY, 'rgba(255,255,255,0.3)');
        }
    }

    executeDiveToNode(target) {
        this.isZoomingIn = true;
        this.targetUniverse = target.innerUniverse;
        this.camera.zoomTo(target.x, target.y);
        if (window.universeAudio) window.universeAudio.playWarp();
    }

    moveToNextNode(currentNode) {
        const nodes = this.currentUniverse.nodes;
        if (nodes.length <= 1) return; 
        const currentIndex = nodes.indexOf(currentNode);
        const nextNode = nodes[(currentIndex + 1) % nodes.length];
        this.camera.targetX = -nextNode.x; this.camera.targetY = -nextNode.y;
        if (window.universeAudio) window.universeAudio.playSystemSound(400, 'triangle', 0.2, 200);
    }

    animate() {
        this.time += 0.02;

        const bpm = 153;
        const msPerBeat = 60000 / (bpm / 2); 
        const beatPhase = (Date.now() % msPerBeat) / msPerBeat; 
        
        let audioPulse = 0;
        let bassPulse = 0;
        if (window.universeAudio && window.universeAudio.isMicActive) {
            audioPulse = window.universeAudio.audioLevel * 1.5;
            bassPulse = window.universeAudio.bassLevel * 3.0; 
        }
        
        const pulse = (Math.pow(Math.sin(beatPhase * Math.PI), 2) * 0.3) + audioPulse + (bassPulse * 0.5); 

        this.camera.update(this.currentUniverse.nodes);

        if (this.isZoomingIn && this.camera.scale > 38) {
            this.universeHistory.push(this.currentUniverse);
            this.currentUniverse = this.targetUniverse;
            this.camera.reset();
            this.isZoomingIn = false;
            this.hasMovedNode = false;
            this.ui.updateBreadcrumbs(); 
        }

        const bgColor = '#05050a'; 
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);

        if (bassPulse > 0.6) {
            const shakeX = (Math.random() - 0.5) * bassPulse * 15;
            const shakeY = (Math.random() - 0.5) * bassPulse * 15;
            this.ctx.translate(shakeX, shakeY);
        }

        this.ctx.scale(this.camera.scale, this.camera.scale);
        this.ctx.translate(this.camera.x, this.camera.y);

        this.ctx.fillStyle = `rgba(0, 255, 204, ${0.2 + audioPulse * 0.3})`;
        this.currentUniverse.particles.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, Math.max(0.1, p.size + (pulse * 0.3)), 0, Math.PI * 2);
            this.ctx.fill();
        });

        const screenCenterX = -this.camera.x;
        const screenCenterY = -this.camera.y;

        const findRealNode = (ref) => {
            if (!ref) return null;
            return this.currentUniverse.nodes.find(n => 
                n === ref || 
                (n.id && n.id === ref.id) || 
                (n.name === ref.name && n.baseX === ref.baseX)
            ) || ref;
        };

        const orbitingNodes = new Map();
        this.currentUniverse.links.forEach(link => {
            const child = findRealNode(link.target);
            const parent = findRealNode(link.source);
            if (child && parent && !orbitingNodes.has(child)) {
                orbitingNodes.set(child, parent);
            }
        });

        this.currentUniverse.nodes.forEach(node => {
            if (node.baseX === undefined) node.baseX = node.x || 0;
            if (node.baseY === undefined) node.baseY = node.y || 0;

            const parent = orbitingNodes.get(node);

            if (!parent) {
                node.pseudoZ = 0;
                node.perspectiveScale = 1;
                if (node === this.grabbedNode) {
                    node.x = node.baseX; node.y = node.baseY;
                } else {
                    node.x = node.baseX + Math.sin(this.time + (node.randomOffset || 0)) * 5;
                    node.y = node.baseY + Math.cos(this.time * 0.8 + (node.randomOffset || 0)) * 5;
                }
            } else {
                if (node === this.grabbedNode) {
                    node.x = node.baseX; node.y = node.baseY;
                    node.pseudoZ = 1; 
                    node.perspectiveScale = 1.2;
                } else {
                    if (parent.baseX === undefined) parent.baseX = parent.x || 0;
                    if (parent.baseY === undefined) parent.baseY = parent.y || 0;

                    const dx = node.baseX - parent.baseX;
                    const dy = node.baseY - parent.baseY;
                    let radius = Math.hypot(dx, dy);
                    if (radius < 40) radius = 80;

                    const baseAngle = Math.atan2(dy, dx);
                    const speed = (25 / Math.max(radius, 50)) * (1 + audioPulse);
                    const currentAngle = baseAngle + (this.time * speed);

                    const orbitZ = Math.sin(currentAngle); 
                    node.pseudoZ = orbitZ; 
                    node.perspectiveScale = 1 + (orbitZ * 0.25); 

                    node.x = parent.x + Math.cos(currentAngle) * radius;
                    node.y = parent.y + Math.sin(currentAngle) * radius * 0.35; 
                }
            }
        });

        this.ctx.lineWidth = 3;
        this.wormholes.forEach(wh => {
            const realSource = findRealNode(wh.source);
            const realTarget = findRealNode(wh.target);
            const hasSource = this.currentUniverse.nodes.includes(realSource);
            const hasTarget = this.currentUniverse.nodes.includes(realTarget);
            
            if (hasSource || hasTarget) {
                const visibleNode = hasSource ? realSource : realTarget;
                const destNode = hasSource ? realTarget : realSource;
                this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
                this.ctx.beginPath(); this.ctx.moveTo(visibleNode.x, visibleNode.y);
                const endX = visibleNode.x + Math.sin(this.time)*50; const endY = visibleNode.y - 500;
                this.ctx.lineTo(endX, endY); this.ctx.stroke();
                this.ctx.fillStyle = '#ff88ff'; this.ctx.font = '12px sans-serif'; this.ctx.textAlign = 'center';
                this.ctx.fillText(`➡ ${destNode.name}`, endX, visibleNode.y - 120);
            }
        });

        this.currentUniverse.links.forEach(link => {
            const realSource = findRealNode(link.source);
            const realTarget = findRealNode(link.target);
            if (realSource && realTarget) {
                if (realSource.isGhost && Math.hypot(realSource.x - screenCenterX, realSource.y - screenCenterY) > (300 / this.camera.scale)) return;
                if (realTarget.isGhost && Math.hypot(realTarget.x - screenCenterX, realTarget.y - screenCenterY) > (300 / this.camera.scale)) return;

                const dx = realTarget.baseX - realSource.baseX;
                const dy = realTarget.baseY - realSource.baseY;
                let radius = Math.hypot(dx, dy);
                if (radius < 40) radius = 80;

                this.ctx.save();
                this.ctx.translate(realSource.x, realSource.y);
                this.ctx.scale(1, 0.35);
                this.ctx.rotate(this.time * 0.1);
                
                this.ctx.strokeStyle = `rgba(0, 255, 204, ${0.15 + (pulse * 0.1)})`;
                this.ctx.lineWidth = 1.5;
                this.ctx.setLineDash([4, 12, 2, 8]);
                this.ctx.beginPath(); 
                this.ctx.arc(0, 0, radius, 0, Math.PI * 2); 
                this.ctx.stroke();
                
                this.ctx.setLineDash([]);
                this.ctx.strokeStyle = `rgba(255, 0, 255, ${0.05 + (pulse * 0.05)})`;
                this.ctx.lineWidth = 4;
                this.ctx.beginPath(); 
                this.ctx.arc(0, 0, radius - 2, 0, Math.PI * 2); 
                this.ctx.stroke();
                this.ctx.restore();

                const grad = this.ctx.createLinearGradient(realSource.x, realSource.y, realTarget.x, realTarget.y);
                grad.addColorStop(0, `rgba(0, 255, 204, ${0.5 + pulse})`);
                grad.addColorStop(1, `rgba(0, 255, 204, 0)`);

                this.ctx.strokeStyle = grad;
                this.ctx.lineWidth = 1;
                this.ctx.setLineDash([2, 4]);
                this.ctx.beginPath(); 
                this.ctx.moveTo(realSource.x, realSource.y); 
                this.ctx.lineTo(realTarget.x, realTarget.y); 
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        });

        const sortedNodes = [...this.currentUniverse.nodes].sort((a, b) => (a.pseudoZ || 0) - (b.pseudoZ || 0));

        sortedNodes.forEach(node => {
            let baseAlpha = 1.0;
            if (node.isGhost) {
                const distToCenter = Math.hypot(node.x - screenCenterX, node.y - screenCenterY);
                const visibleRadius = 300 / this.camera.scale;
                if (distToCenter > visibleRadius) return;
                baseAlpha = 1.0 - (distToCenter / visibleRadius);
            }

            const depthDarkness = 0.5 + ((node.perspectiveScale || 1) * 0.5);
            this.ctx.globalAlpha = baseAlpha * depthDarkness;

            const isGrabbed = (node === this.grabbedNode);
            let drawSize = (node.size + (isGrabbed ? 3 : 0)) * (node.perspectiveScale || 1);
            drawSize += Math.sin(this.time * 2 + (node.baseX || 0)) * 1.5; 
            drawSize += pulse * 2.0; 
            
            this.ctx.shadowBlur = isGrabbed ? 30 : (15 + (pulse * 15)) * (node.perspectiveScale || 1); 
            this.ctx.shadowColor = node.color;

            const drawShapePath = () => {
                this.ctx.beginPath();
                const shape = node.shape || 'star';
                if (shape === 'rect') {
                    this.ctx.rect(node.x - drawSize, node.y - drawSize, drawSize * 2, drawSize * 2);
                } else if (shape === 'triangle') {
                    this.ctx.moveTo(node.x, node.y - drawSize);
                    this.ctx.lineTo(node.x + drawSize, node.y + drawSize);
                    this.ctx.lineTo(node.x - drawSize, node.y + drawSize);
                    this.ctx.closePath();
                } else if (shape === 'diamond') {
                    this.ctx.moveTo(node.x, node.y - drawSize);
                    this.ctx.lineTo(node.x + drawSize, node.y);
                    this.ctx.lineTo(node.x, node.y + drawSize);
                    this.ctx.lineTo(node.x - drawSize, node.y);
                    this.ctx.closePath();
                } else {
                    this.ctx.arc(node.x, node.y, drawSize, 0, Math.PI * 2);
                }
            };

            if (node.iconUrl) {
                if (!this.imageCache[node.iconUrl]) { const img = new Image(); img.src = node.iconUrl; this.imageCache[node.iconUrl] = img; }
                const img = this.imageCache[node.iconUrl];
                if (img.complete && img.naturalHeight !== 0) {
                    this.ctx.save(); 
                    drawShapePath();
                    this.ctx.clip(); 
                    this.ctx.fillStyle = '#111'; this.ctx.fill(); 
                    this.ctx.drawImage(img, node.x - drawSize, node.y - drawSize, drawSize * 2, drawSize * 2); 
                    this.ctx.restore();
                    this.ctx.strokeStyle = node.color; this.ctx.lineWidth = 2; 
                    drawShapePath();
                    this.ctx.stroke();
                } else { 
                    this.ctx.fillStyle = node.color; 
                    drawShapePath(); 
                    this.ctx.fill(); 
                }
            } else { 
                this.ctx.fillStyle = node.color; 
                drawShapePath(); 
                this.ctx.fill(); 
            }

            this.ctx.shadowBlur = 0; 

            if (node.isLocked) { 
                this.ctx.fillStyle = node.isTempUnlocked ? "#00ffcc" : "#ff4444"; 
                this.ctx.font = `${16 * (node.perspectiveScale || 1)}px serif`; 
                this.ctx.textAlign = "center"; 
                this.ctx.fillText(node.isTempUnlocked ? "🔓" : "🔒", node.x, node.y - drawSize - 10); 
            }
            this.ctx.fillStyle = '#ffffff'; 
            this.ctx.font = `${12 * (node.perspectiveScale || 1)}px sans-serif`; 
            this.ctx.textAlign = 'center';
            const displayName = node.url ? `🔗 ${node.name}` : node.name; 
            this.ctx.fillText(displayName, node.x, node.y + drawSize + (20 * (node.perspectiveScale || 1)));
            
            this.ctx.globalAlpha = 1.0;
        });

        this.ctx.restore();
        requestAnimationFrame(() => this.animate());
    }
}