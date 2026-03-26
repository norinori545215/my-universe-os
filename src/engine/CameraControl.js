// src/engine/CameraControl.js

export class CameraControl {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.cb = callbacks;
        this.x = 0; this.y = 0;
        this.scale = 1;
        this.targetX = 0; this.targetY = 0;
        this.targetScale = 1;
        
        this.vx = 0; 
        this.vy = 0;
        this.lastMoveTime = 0;

        this.isDragging = false;
        this.isPanning = false; 
        this.lastX = 0; this.lastY = 0;
        this.hasMoved = false;

        this.initialPinchDist = null;
        this.initialPinchScale = 1;

        this.initEvents();
    }

    getWorldPos(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = clientX - rect.left - this.canvas.width / 2;
        const y = clientY - rect.top - this.canvas.height / 2;
        return {
            x: (x / this.scale) - this.x,
            y: (y / this.scale) - this.y
        };
    }

    initEvents() {
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            this.targetScale *= zoomFactor;
            this.targetScale = Math.max(0.1, Math.min(this.targetScale, 10)); 
            this.vx = 0; this.vy = 0;
        }, { passive: false });

        const down = (clientX, clientY, e) => {
            if (e && e.target !== this.canvas) return;

            const wPos = this.getWorldPos(clientX, clientY);
            this.isDragging = true;
            this.hasMoved = false;
            this.lastX = clientX; 
            this.lastY = clientY;
            this.lastMoveTime = Date.now();
            
            this.vx = 0; this.vy = 0;
            
            if (this.cb.isLinkModeActive()) {
                this.cb.onLinkStart(wPos.x, wPos.y);
                this.isPanning = false;
            } else if (!this.cb.onNodeGrabStart(wPos.x, wPos.y)) {
                this.isPanning = true;
            } else {
                this.isPanning = false;
            }
        };

        const move = (clientX, clientY) => {
            const wPos = this.getWorldPos(clientX, clientY);
            this.cb.onMouseMove(wPos.x, wPos.y);

            if (!this.isDragging) return;

            const dx = clientX - this.lastX;
            const dy = clientY - this.lastY;
            const now = Date.now();
            const dt = now - this.lastMoveTime;

            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.hasMoved = true;

            if (this.isPanning) {
                this.targetX += dx / this.scale;
                this.targetY += dy / this.scale;
                this.x = this.targetX; 
                this.y = this.targetY;
                
                if (dt > 0) {
                    this.vx = (dx / this.scale) / dt;
                    this.vy = (dy / this.scale) / dt;
                }
            }

            this.lastX = clientX; 
            this.lastY = clientY;
            this.lastMoveTime = now;
        };

        const up = (clientX, clientY, e) => {
            if (!this.isDragging) return; 

            const wPos = this.getWorldPos(clientX, clientY);
            if (this.cb.isLinking()) {
                this.cb.onLinkEnd(wPos.x, wPos.y);
            } else if (this.cb.wasDragging && this.cb.wasDragging()) {
                this.cb.onNodeGrabEnd();
            } else if (!this.hasMoved) {
                if (e && e.target === this.canvas) {
                    if (e.button === 2) {
                        this.cb.onRightClick();
                    } else {
                        this.cb.onClick(wPos.x, wPos.y, e);
                    }
                }
            } else {
                if (this.isPanning) {
                    if (Date.now() - this.lastMoveTime > 50) {
                        this.vx = 0; this.vy = 0;
                    } else {
                        // 初速をセット
                        this.vx *= 15; 
                        this.vy *= 15;
                    }
                }
            }
            
            this.isDragging = false;
            this.isPanning = false; 
            this.initialPinchDist = null;
        };

        this.canvas.addEventListener('mousedown', e => down(e.clientX, e.clientY, e));
        window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
        window.addEventListener('mouseup', e => up(e.clientX, e.clientY, e));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.canvas.addEventListener('touchstart', e => {
            if (e.touches.length === 2) {
                this.isPanning = false; 
                this.vx = 0; this.vy = 0;
                this.initialPinchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                this.initialPinchScale = this.targetScale;
            } else if (e.touches.length === 1) {
                down(e.touches[0].clientX, e.touches[0].clientY, e);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', e => {
            if (e.touches.length === 2 && this.initialPinchDist) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const scale = dist / this.initialPinchDist;
                this.targetScale = Math.max(0.1, Math.min(this.initialPinchScale * scale, 10)); 
            } else if (e.touches.length === 1) {
                move(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        window.addEventListener('touchend', e => {
            if (e.changedTouches.length === 1) {
                up(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e);
            }
            if (e.touches.length < 2) {
                this.initialPinchDist = null;
            }
        });
    }

    zoomTo(x, y) {
        this.targetX = -x;
        this.targetY = -y;
        this.targetScale = 40; 
        this.vx = 0; this.vy = 0;
    }

    reset() {
        this.targetX = 0; this.targetY = 0;
        this.targetScale = 1;
        this.x = 0; this.y = 0;
        this.scale = 1;
        this.vx = 0; this.vy = 0;
    }

    applyMagneticSnap(nodes) {
        // ★ 修正ポイント：PC（画面幅が広い、またはモバイルモードでない）場合は、おせっかいな自動追従を完全にシャットアウトする
        const isMobile = window.innerWidth <= 768 || localStorage.getItem('universe_mobile_mode') === 'true';
        if (!isMobile) return;

        if (!nodes || nodes.length === 0 || this.isDragging || this.cb.isLinkModeActive()) return;

        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 0.5) return;

        let closestNode = null;
        let minDistance = Infinity;
        const snapThreshold = 100;

        nodes.forEach(node => {
            const dist = Math.hypot(node.x - (-this.targetX), node.y - (-this.targetY));
            if (dist < minDistance) {
                minDistance = dist;
                closestNode = node;
            }
        });

        if (closestNode && minDistance < snapThreshold) {
            this.targetX = -closestNode.x;
            this.targetY = -closestNode.y;
            this.vx = 0; 
            this.vy = 0;
        }
    }

    update(nodes = []) {
        if (!this.isDragging) {
            this.targetX += this.vx;
            this.targetY += this.vy;
            
            this.vx *= 0.92;
            this.vy *= 0.92;

            if (Math.abs(this.vx) < 0.01) this.vx = 0;
            if (Math.abs(this.vy) < 0.01) this.vy = 0;

            this.applyMagneticSnap(nodes);
        }

        this.x += (this.targetX - this.x) * 0.1;
        this.y += (this.targetY - this.y) * 0.1;
        this.scale += (this.targetScale - this.scale) * 0.1;
    }
}