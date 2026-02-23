// src/engine/CameraControl.js
export class CameraControl {
    constructor(canvas, callbacks) {
        this.x = 0; this.y = 0; this.scale = 1;
        this.targetX = 0; this.targetY = 0; this.targetScale = 1;

        this.isCameraDragging = false;
        this.lastMouseX = 0; this.lastMouseY = 0;

        // ★ タップ判定用の変数（指のブレ許容用）
        this.touchStartX = 0; this.touchStartY = 0;

        const getPointer = (e) => e.touches ? e.touches[0] : e;

        // --- 押した時 ---
        const handleStart = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;
            const ptr = getPointer(e);
            
            // ★ 押し始めた瞬間の「座標」をしっかり記憶
            this.touchStartX = ptr.clientX;
            this.touchStartY = ptr.clientY;

            const { worldX, worldY } = this.getWorldCoords(canvas, ptr);

            if (callbacks.isLinkModeActive() || e.shiftKey) {
                callbacks.onLinkStart(worldX, worldY);
            } else {
                const isNodeGrabbed = callbacks.onNodeGrabStart(worldX, worldY);
                if (!isNodeGrabbed) {
                    this.isCameraDragging = true;
                    this.lastMouseX = ptr.clientX;
                    this.lastMouseY = ptr.clientY;
                }
            }
        };

        // --- 離した時 ---
        const handleEnd = (e) => {
            this.isCameraDragging = false;
            const ptr = e.changedTouches ? e.changedTouches[0] : e;
            const { worldX, worldY } = this.getWorldCoords(canvas, ptr);
            
            // ★ 押した時から何ピクセル動いたか計算
            const moveDist = Math.hypot(ptr.clientX - this.touchStartX, ptr.clientY - this.touchStartY);

            if (callbacks.isLinking()) {
                callbacks.onLinkEnd(worldX, worldY);
            }
            callbacks.onNodeGrabEnd();

            // ★【特効薬】スマホで指を離した時、動いた距離が10px未満なら「タップ」と判定して強制的にメニューを開く！
            if (e.type === 'touchend' && moveDist < 10) {
                if (!callbacks.isLinkModeActive() && !e.shiftKey) {
                    callbacks.onClick(worldX, worldY, e);
                }
            }
        };

        // --- 動かした時 ---
        const handleMove = (e) => {
            const ptr = getPointer(e);
            const { worldX, worldY } = this.getWorldCoords(canvas, ptr);
            
            // ★ 指のブレ（10px未満）は「移動」とみなさない！
            const moveDist = Math.hypot(ptr.clientX - this.touchStartX, ptr.clientY - this.touchStartY);
            
            if (this.isCameraDragging) {
                const dx = (ptr.clientX - this.lastMouseX) / this.scale;
                const dy = (ptr.clientY - this.lastMouseY) / this.scale;
                this.targetX += dx; this.targetY += dy;
                this.lastMouseX = ptr.clientX; this.lastMouseY = ptr.clientY;
            } else if (moveDist >= 10) { 
                // 10px以上動いた時だけノードのドラッグ処理をする
                callbacks.onMouseMove(worldX, worldY);
            }
        };

        canvas.addEventListener('mousedown', handleStart);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e); }, { passive: false });

        window.addEventListener('mouseup', handleEnd);
        canvas.addEventListener('touchend', handleEnd);

        window.addEventListener('mousemove', handleMove);
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e); }, { passive: false });

        // PC向けのクリック処理
        canvas.addEventListener('click', (e) => {
            if (callbacks.isLinkModeActive() || e.shiftKey || callbacks.wasDragging()) return;
            const moveDist = Math.hypot(e.clientX - this.touchStartX, e.clientY - this.touchStartY);
            // PCでも10px未満のブレならクリックとみなす
            if (moveDist < 10) {
                const { worldX, worldY } = this.getWorldCoords(canvas, e);
                callbacks.onClick(worldX, worldY, e);
            }
        });

        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            callbacks.onRightClick();
        });
    }

    getWorldCoords(canvas, ptr) {
        const rect = canvas.getBoundingClientRect();
        return {
            worldX: (ptr.clientX - rect.left - canvas.width / 2) / this.scale - this.x,
            worldY: (ptr.clientY - rect.top - canvas.height / 2) / this.scale - this.y
        };
    }

    update() {
        this.x += (this.targetX - this.x) * 0.15;
        this.y += (this.targetY - this.y) * 0.15;
        this.scale += (this.targetScale - this.scale) * 0.1;
    }

    zoomTo(x, y) {
        this.targetX = -x; this.targetY = -y; this.targetScale = 40;
    }

    reset() {
        this.x = 0; this.y = 0; this.scale = 1;
        this.targetX = 0; this.targetY = 0; this.targetScale = 1;
    }
}