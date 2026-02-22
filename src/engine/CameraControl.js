export class CameraControl {
    constructor(canvas, callbacks) {
        this.x = 0; this.y = 0; this.scale = 1;
        this.targetX = 0; this.targetY = 0; this.targetScale = 1;

        this.isCameraDragging = false;
        this.lastMouseX = 0; this.lastMouseY = 0;

        // PC（マウス）とスマホ（タッチ）の座標を統一して取得する便利関数
        const getPointer = (e) => e.touches ? e.touches[0] : e;

        // --- 押した時（PC & スマホ） ---
        const handleStart = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;
            const ptr = getPointer(e);
            const { worldX, worldY } = this.getWorldCoords(canvas, ptr);

            // 「結ぶモード」がONか、PCでShiftキーが押されていれば線を引く
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

        // --- 離した時（PC & スマホ） ---
        const handleEnd = (e) => {
            this.isCameraDragging = false;
            // touchendの時は座標が取れないため、最後に記憶した座標を使う
            const ptr = e.changedTouches ? e.changedTouches[0] : e;
            const { worldX, worldY } = this.getWorldCoords(canvas, ptr);
            
            if (callbacks.isLinking()) {
                callbacks.onLinkEnd(worldX, worldY);
            }
            callbacks.onNodeGrabEnd();
        };

        // --- 動かした時（PC & スマホ） ---
        const handleMove = (e) => {
            const ptr = getPointer(e);
            const { worldX, worldY } = this.getWorldCoords(canvas, ptr);
            
            if (this.isCameraDragging) {
                const dx = (ptr.clientX - this.lastMouseX) / this.scale;
                const dy = (ptr.clientY - this.lastMouseY) / this.scale;
                this.targetX += dx; this.targetY += dy;
                this.lastMouseX = ptr.clientX; this.lastMouseY = ptr.clientY;
            } else {
                callbacks.onMouseMove(worldX, worldY);
            }
        };

        // イベントリスナーの登録（マウスとタッチ両方）
        canvas.addEventListener('mousedown', handleStart);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e); }, { passive: false });

        window.addEventListener('mouseup', handleEnd);
        canvas.addEventListener('touchend', handleEnd);

        window.addEventListener('mousemove', handleMove);
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e); }, { passive: false });

        // クリック / タップ
        canvas.addEventListener('click', (e) => {
            if (callbacks.isLinkModeActive() || e.shiftKey || callbacks.wasDragging()) return;
            const { worldX, worldY } = this.getWorldCoords(canvas, e);
            callbacks.onClick(worldX, worldY, e);
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