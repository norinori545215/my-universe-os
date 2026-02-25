// src/engine/CameraControl.js

export class CameraControl {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.cb = callbacks;
        this.x = 0; this.y = 0;
        this.scale = 1;
        this.targetX = 0; this.targetY = 0;
        this.targetScale = 1;
        this.isDragging = false;
        this.lastX = 0; this.lastY = 0;
        this.hasMoved = false;

        // スマホのピンチズーム用変数
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
        // ★PC：マウスホイールでのズーム機能
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            this.targetScale *= zoomFactor;
            this.targetScale = Math.max(0.1, Math.min(this.targetScale, 10)); // 最小0.1倍、最大10倍
        }, { passive: false });

        const down = (clientX, clientY, e) => {
            const wPos = this.getWorldPos(clientX, clientY);
            this.isDragging = true;
            this.hasMoved = false;
            this.lastX = clientX; this.lastY = clientY;
            
            if (this.cb.isLinkModeActive()) {
                this.cb.onLinkStart(wPos.x, wPos.y);
            } else if (!this.cb.onNodeGrabStart(wPos.x, wPos.y)) {
                // 背景をつかんだ状態（パンニング開始）
            }
        };

        const move = (clientX, clientY) => {
            const wPos = this.getWorldPos(clientX, clientY);
            this.cb.onMouseMove(wPos.x, wPos.y);

            if (!this.isDragging) return;

            const dx = clientX - this.lastX;
            const dy = clientY - this.lastY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.hasMoved = true;

            if (!this.cb.isLinking() && !this.cb.wasDragging()) {
                // ★画面の移動（カメラのパン）
                this.targetX += dx / this.scale;
                this.targetY += dy / this.scale;
                this.x = this.targetX; 
                this.y = this.targetY;
            }

            this.lastX = clientX; this.lastY = clientY;
        };

        const up = (clientX, clientY, e) => {
            const wPos = this.getWorldPos(clientX, clientY);
            if (this.cb.isLinking()) {
                this.cb.onLinkEnd(wPos.x, wPos.y);
            } else if (this.cb.wasDragging()) {
                this.cb.onNodeGrabEnd();
            } else if (!this.hasMoved) {
                if (e && e.button === 2) {
                    this.cb.onRightClick();
                } else {
                    this.cb.onClick(wPos.x, wPos.y, e);
                }
            }
            this.isDragging = false;
            this.initialPinchDist = null;
        };

        this.canvas.addEventListener('mousedown', e => down(e.clientX, e.clientY, e));
        window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
        window.addEventListener('mouseup', e => up(e.clientX, e.clientY, e));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        // ★スマホ：指2本でのピンチズーム対応
        this.canvas.addEventListener('touchstart', e => {
            if (e.touches.length === 2) {
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
            e.preventDefault();
            if (e.touches.length === 2 && this.initialPinchDist) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const scale = dist / this.initialPinchDist;
                this.targetScale = Math.max(0.1, Math.min(this.initialPinchScale * scale, 10)); // ズーム限界
            } else if (e.touches.length === 1) {
                move(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        window.addEventListener('touchend', e => {
            if (e.changedTouches.length === 1 && !this.initialPinchDist) {
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
        this.targetScale = 40; // 星の内部へダイブする時の倍率
    }

    reset() {
        this.targetX = 0; this.targetY = 0;
        this.targetScale = 1;
        this.x = 0; this.y = 0;
        this.scale = 1;
    }

    update() {
        // スムーズなカメラ移動（イージング）
        this.x += (this.targetX - this.x) * 0.1;
        this.y += (this.targetY - this.y) * 0.1;
        this.scale += (this.targetScale - this.scale) * 0.1;
    }
}