// src/engine/SpatialVision.js

export class SpatialVision {
    static isRunning = false;
    static video = null;
    static canvas = null;
    static ctx = null;
    static prevFrame = null;
    static lastTriggerTime = 0;
    static lastProcessTime = 0;
    static lastMotionX = null;
    static lastMotionY = null;
    static appRef = null;

    static async start(app) {
        this.appRef = app;

        // 既に動いている場合は「OFF」にする（トグルスイッチ機能）
        if (this.isRunning) {
            this.stop();
            return;
        }

        console.log("👁️‍🗨️ [Spatial Vision] ステルス起動...");
        this.isRunning = true;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 }, audio: false });
            
            this.video = document.createElement('video');
            this.video.srcObject = stream;
            this.video.autoplay = true;
            this.video.playsInline = true;
            this.video.muted = true;
            // ★ 画面の裏側に完全に隠す（邪魔なUIを削除）
            this.video.style.cssText = `position: fixed; top: -1000px; left: -1000px; width: 16px; height: 12px; opacity: 0.01; pointer-events: none; z-index: -10;`;
            document.body.appendChild(this.video);

            this.canvas = document.createElement('canvas');
            this.canvas.width = 160; this.canvas.height = 120;
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

            this.video.onloadedmetadata = () => {
                this.video.play().then(() => {
                    if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.1);
                    this.showToast("✋ 空間ジェスチャー：ACTIVE", '#00ffcc');
                    requestAnimationFrame(() => this.processFrame());
                });
            };
        } catch (err) {
            console.error(err);
            this.isRunning = false;
            this.showToast("❌ カメラへのアクセスが拒否されました", '#ff4444');
        }
    }

    // センサーの停止
    static stop() {
        this.isRunning = false;
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(t => t.stop());
        }
        if (this.video) this.video.remove();
        this.video = null;
        this.prevFrame = null;
        this.showToast("✋ 空間ジェスチャー：OFF", '#888888');
        if (window.universeAudio) window.universeAudio.playSystemSound(300, 'square', 0.1);
    }

    // 通知だけを画面下部に一瞬表示するUI
    static showToast(msg, color) {
        const toast = document.createElement('div');
        toast.innerText = msg;
        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: rgba(10, 15, 25, 0.9); color: ${color};
            border: 1px solid ${color}; border-radius: 8px;
            padding: 10px 20px; font-size: 12px; font-weight: bold; z-index: 999999;
            box-shadow: 0 0 15px rgba(${color === '#ff4444' ? '255,68,68' : (color === '#00ffcc' ? '0,255,204' : '136,136,136')}, 0.3);
            transition: opacity 0.3s; pointer-events: none; letter-spacing: 1px;
        `;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; }, 2000);
        setTimeout(() => { toast.remove(); }, 2300);
    }

    // 裏側でのフレーム解析
    static processFrame() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.processFrame());

        const now = Date.now();
        if (now - this.lastProcessTime < 50) return;
        this.lastProcessTime = now;

        this.ctx.save();
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.video, -this.canvas.width, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        const currentFrame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

        if (this.prevFrame) {
            let changedPixels = 0;
            let sumX = 0; let sumY = 0;
            const step = 4;

            for (let y = 0; y < this.canvas.height; y += step) {
                for (let x = 0; x < this.canvas.width; x += step) {
                    const i = (y * this.canvas.width + x) * 4;
                    const diff = Math.abs(currentFrame[i] - this.prevFrame[i]) +
                                 Math.abs(currentFrame[i+1] - this.prevFrame[i+1]) +
                                 Math.abs(currentFrame[i+2] - this.prevFrame[i+2]);
                    if (diff > 35) {
                        changedPixels++;
                        sumX += x; sumY += y;
                    }
                }
            }

            const totalSampledPixels = (this.canvas.width * this.canvas.height) / (step * step);
            const motionRatio = changedPixels / totalSampledPixels;

            if (motionRatio > 0.02) {
                const avgX = sumX / changedPixels;
                const avgY = sumY / changedPixels;

                if (this.lastMotionX !== null && this.lastMotionY !== null) {
                    const dx = avgX - this.lastMotionX;
                    const dy = avgY - this.lastMotionY;

                    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
                        if (now - this.lastTriggerTime > 1000) {
                            this.lastTriggerTime = now;
                            if (Math.abs(dx) > Math.abs(dy)) {
                                if (dx > 0) this.executeGesture('RIGHT');
                                else this.executeGesture('LEFT');
                            } else {
                                if (dy > 0) this.executeGesture('DOWN');
                                else this.executeGesture('UP');
                            }
                        }
                    }
                }
                this.lastMotionX = avgX; this.lastMotionY = avgY;
            } else {
                this.lastMotionX = null; this.lastMotionY = null;
            }
        }
        this.prevFrame = new Uint8ClampedArray(currentFrame);
    }

    static executeGesture(direction) {
        if (!this.appRef || !this.appRef.currentUniverse) return;

        let icon = '';
        if (direction === 'LEFT') icon = '⬅️ SWIPE LEFT';
        if (direction === 'RIGHT') icon = '➡️ SWIPE RIGHT';
        if (direction === 'UP') icon = '⬆️ SWIPE UP';
        if (direction === 'DOWN') icon = '⬇️ SWIPE DOWN';
        
        // ジェスチャー発動時だけ一瞬トーストを出す
        this.showToast(`✨ ${icon}`, '#ff00ff');

        if (window.universeAudio) {
            if (direction === 'UP') window.universeAudio.playSystemSound(600, 'sine', 0.5);
            else window.universeAudio.playSystemSound(100, 'sawtooth', 0.5);
        }

        const app = this.appRef;
        const cx = app.camera ? -app.camera.x : 0;
        const cy = app.camera ? -app.camera.y : 0;

        if (app.currentUniverse.nodes.length === 0 && direction === 'DOWN') {
            for (let i = 0; i < 20; i++) app.currentUniverse.addNode(`DATA_${i}`, cx + (Math.random()-0.5)*10, cy + (Math.random()-0.5)*10, 15, '#00ffcc', 'star');
        }

        app.currentUniverse.nodes.forEach(node => {
            node.fx = null; node.fy = null;
            const force = 300 + Math.random() * 200;

            if (direction === 'LEFT') {
                node.x -= force; node.baseX = node.x; node.vx = -50;
            } 
            else if (direction === 'RIGHT') {
                node.x += force; node.baseX = node.x; node.vx = 50;
            } 
            else if (direction === 'UP') {
                node.x = cx + (Math.random() - 0.5) * 50;
                node.y = cy + (Math.random() - 0.5) * 50;
                node.baseX = node.x; node.baseY = node.y;
                node.vx = 0; node.vy = 0;
            } 
            else if (direction === 'DOWN') {
                let dx = node.x - cx; let dy = node.y - cy;
                if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; }
                const angle = Math.atan2(dy, dx);
                const newX = node.x + Math.cos(angle) * force;
                const newY = node.y + Math.sin(angle) * force;
                node.x = newX; node.y = newY; node.baseX = newX; node.baseY = newY;
                node.vx = Math.cos(angle) * 50; node.vy = Math.sin(angle) * 50;
            }
        });

        if (app.simulation) app.simulation.alpha(1).restart();
        if (typeof app.autoSave === 'function') app.autoSave();
    }
}