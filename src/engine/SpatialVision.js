// src/engine/SpatialVision.js

export class SpatialVision {
    static start(app) {
        if (document.getElementById('spatial-vision-hud')) return;

        console.log("👁️‍🗨️ [Spatial Vision] フレーム同期型センサー起動");

        const hud = document.createElement('div');
        hud.id = 'spatial-vision-hud';
        hud.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; width: 180px; height: 80px;
            background: rgba(0, 10, 15, 0.9); border: 1px solid #00ffcc; border-radius: 4px;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.3); z-index: 99999;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            overflow: hidden; cursor: pointer; transition: 0.3s;
        `;

        const title = document.createElement('div');
        title.innerText = 'KINETIC RADAR : STANDBY';
        title.style.cssText = `color: #ff4444; font-size: 10px; font-family: monospace; letter-spacing: 1px; z-index: 2; margin-bottom: 8px; text-shadow: 0 0 5px #ff4444;`;
        hud.appendChild(title);

        const barContainer = document.createElement('div');
        barContainer.style.cssText = `width: 90%; height: 6px; background: rgba(0,255,204,0.1); border: 1px solid rgba(0,255,204,0.3); border-radius: 2px; position: absolute; bottom: 5px; left: 5%; z-index: 2; overflow: hidden;`;
        hud.appendChild(barContainer);

        const motionBar = document.createElement('div');
        motionBar.style.cssText = `width: 0%; height: 100%; background: #00ffcc; box-shadow: 0 0 10px #00ffcc; transition: width 0.1s ease-out;`;
        barContainer.appendChild(motionBar);

        document.body.appendChild(hud);

        const radarCanvas = document.createElement('canvas');
        radarCanvas.width = 160; radarCanvas.height = 120;
        const radarCtx = radarCanvas.getContext('2d', { willReadFrequently: true });

        let isRunning = false;
        let video, canvas, ctx;
        let prevFrame = null;
        let lastTriggerTime = 0;
        let lastProcessTime = 0; // ★ フレームレート調整用のタイマー

        const initCamera = async () => {
            try {
                title.innerText = 'CALIBRATING SENSOR...';
                title.style.color = '#ffaa00';

                if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    throw new Error("SECURE_CONTEXT_REQUIRED");
                }

                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 }, audio: false });
                
                video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.playsInline = true;
                video.muted = true; 
                video.style.cssText = `position: absolute; top: -100px; left: -100px; width: 1px; height: 1px; opacity: 0; pointer-events: none;`;
                document.body.appendChild(video);

                canvas = document.createElement('canvas');
                canvas.width = 160; canvas.height = 120;
                ctx = canvas.getContext('2d', { willReadFrequently: true });

                video.onloadedmetadata = () => {
                    video.play().then(() => {
                        title.innerText = 'KINETIC RADAR : ACTIVE';
                        title.style.color = '#00ffcc';
                        title.style.textShadow = '0 0 5px #00ffcc';
                        hud.style.borderColor = '#00ffcc';
                        isRunning = true;
                        
                        if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.1);
                        requestAnimationFrame(processFrame);
                    });
                };
            } catch (err) {
                console.error(err);
                if (err.message === "SECURE_CONTEXT_REQUIRED") {
                    title.innerText = 'ERR: HTTPS OR LOCALHOST REQ';
                } else if (err.name === 'NotAllowedError') {
                    title.innerText = 'ERR: PERMISSION DENIED';
                } else {
                    title.innerText = 'ERR: HARDWARE FAILURE';
                }
                title.style.color = '#ff4444';
                title.style.textShadow = '0 0 5px #ff4444';
            }
        };

        hud.onclick = () => {
            if (!isRunning) {
                initCamera();
            } else {
                isRunning = false;
                title.innerText = 'KINETIC RADAR : STANDBY';
                title.style.color = '#ff4444';
                hud.style.borderColor = '#00ffcc';
                hud.style.backgroundImage = 'none';
                motionBar.style.width = '0%';
                if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
                if (video) video.remove();
            }
        };

        const processFrame = () => {
            if (!isRunning) return;

            const now = Date.now();
            
            // ★ 超重要：カメラのFPS問題解決（100ミリ秒＝0.1秒間隔で処理する）
            if (now - lastProcessTime >= 100) {
                lastProcessTime = now;

                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
                ctx.restore();

                const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                
                if (prevFrame) {
                    let changedPixels = 0;
                    const step = 4;
                    
                    // 背景にカメラ映像をうっすら描画
                    radarCtx.globalAlpha = 0.3;
                    radarCtx.drawImage(video, 0, 0, radarCanvas.width, radarCanvas.height);
                    radarCtx.globalAlpha = 1.0;
                    
                    radarCtx.fillStyle = '#ff00ff';

                    for (let y = 0; y < canvas.height; y += step) {
                        for (let x = 0; x < canvas.width; x += step) {
                            const i = (y * canvas.width + x) * 4;
                            
                            const MathAbs = Math.abs;
                            const diff = MathAbs(currentFrame[i] - prevFrame[i]) + 
                                         MathAbs(currentFrame[i+1] - prevFrame[i+1]) + 
                                         MathAbs(currentFrame[i+2] - prevFrame[i+2]);
                            
                            // 差分が30以上なら反応
                            if (diff > 30) {
                                changedPixels++;
                                radarCtx.fillRect(canvas.width - x, y, step, step);
                            }
                        }
                    }

                    hud.style.backgroundImage = `url(${radarCanvas.toDataURL()})`;
                    hud.style.backgroundSize = 'cover';
                    hud.style.backgroundPosition = 'center';

                    const totalSampledPixels = (canvas.width * canvas.height) / (step * step);
                    const motionRatio = changedPixels / totalSampledPixels;
                    
                    const barPercent = Math.min(100, motionRatio * 1500); 
                    motionBar.style.width = `${barPercent}%`;

                    // 発動条件：画面の1%に動きがあったら
                    if (motionRatio > 0.01) {
                        if (now - lastTriggerTime > 800) { // 連発防止（0.8秒）
                            lastTriggerTime = now;
                            
                            motionBar.style.background = '#ff00ff';
                            hud.style.boxShadow = '0 0 40px #ff00ff';
                            setTimeout(() => {
                                motionBar.style.background = '#00ffcc';
                                hud.style.boxShadow = '0 0 15px rgba(0, 255, 204, 0.3)';
                            }, 200);

                            triggerShockwave();
                        }
                    }
                }

                prevFrame = new Uint8ClampedArray(currentFrame);
            }
            
            // ループは最速で回し続ける
            requestAnimationFrame(processFrame);
        };

        const triggerShockwave = () => {
            if (!app || !app.currentUniverse || !app.currentUniverse.nodes) return;

            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;

            app.currentUniverse.nodes.forEach(node => {
                node.fx = null; 
                node.fy = null;
                
                const angle = Math.atan2(node.y - cy, node.x - cx);
                
                // 強制的に吹き飛ばすパワー
                const force = 120; 

                node.vx = (node.vx || 0) + Math.cos(angle) * force;
                node.vy = (node.vy || 0) + Math.sin(angle) * force;

                node.x += Math.cos(angle) * 30;
                node.y += Math.sin(angle) * 30;
            });

            if (app.simulation) app.simulation.alpha(1).restart();
            if (app.update) app.update();
            
            if (window.universeAudio) {
                window.universeAudio.playSystemSound(100, 'sawtooth', 0.5);
            }
            if (window.HapticEngine) {
                window.HapticEngine.vibrate([30, 50, 30]);
            }
        };
    }
}