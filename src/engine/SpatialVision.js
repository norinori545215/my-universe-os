// src/engine/SpatialVision.js

export class SpatialVision {
    static start(app) {
        if (document.getElementById('spatial-vision-hud')) return;

        console.log("👁️‍🗨️ [Spatial Vision] 絶対駆動プロトコル起動");

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

        // ★ 爆発テストボタン
        const testBtn = document.createElement('button');
        testBtn.innerText = '💣 爆発テスト';
        testBtn.style.cssText = `position: absolute; top: 4px; right: 4px; font-size: 9px; font-weight: bold; background: #ff4444; color: #fff; border: 1px solid #fff; border-radius: 3px; cursor: pointer; z-index: 10; padding: 2px 4px;`;
        testBtn.onclick = (e) => {
            e.stopPropagation(); 
            motionBar.style.background = '#ff00ff';
            motionBar.style.width = '100%';
            setTimeout(() => { motionBar.style.background = '#00ffcc'; motionBar.style.width = '0%'; }, 300);
            triggerShockwave();
        };
        hud.appendChild(testBtn);

        document.body.appendChild(hud);

        const radarCanvas = document.createElement('canvas');
        radarCanvas.width = 160; radarCanvas.height = 120;
        const radarCtx = radarCanvas.getContext('2d', { willReadFrequently: true });

        let isRunning = false;
        let video, canvas, ctx;
        let prevFrame = null;
        let lastTriggerTime = 0;
        let lastProcessTime = 0;

        const initCamera = async () => {
            try {
                title.innerText = 'CALIBRATING SENSOR...';
                title.style.color = '#ffaa00';

                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 }, audio: false });
                
                video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.playsInline = true;
                video.muted = true; 
                
                video.style.cssText = `position: fixed; top: -1000px; left: -1000px; width: 160px; height: 120px; opacity: 0.01; pointer-events: none; z-index: -10;`;
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
                title.innerText = 'ERR: CAMERA REJECTED';
                title.style.color = '#ff4444';
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
                            
                            // 超高感度
                            if (diff > 20) {
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

                    // 0.5%の動きで発動
                    if (motionRatio > 0.005) {
                        if (now - lastTriggerTime > 1000) { // クールダウン1秒
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
            requestAnimationFrame(processFrame);
        };

        const triggerShockwave = () => {
            // ★ 絶対に動いていることを知らせるために、画面全体（ブラウザ）を揺らす
            document.body.style.transition = 'none';
            document.body.style.transform = 'scale(1.05) translate(15px, -15px)';
            setTimeout(() => {
                document.body.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                document.body.style.transform = 'scale(1) translate(0px, 0px)';
            }, 80);

            // 音とバイブレーション
            if (window.universeAudio) window.universeAudio.playSystemSound(50, 'sawtooth', 0.8);
            if (window.HapticEngine) window.HapticEngine.vibrate([50, 100, 50]);

            if (!app || !app.currentUniverse || !app.currentUniverse.nodes) return;

            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;

            app.currentUniverse.nodes.forEach(node => {
                const dx = node.x - cx;
                const dy = node.y - cy;
                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                
                // 爆発の飛距離（超強力）
                const power = 500 + Math.random() * 500;

                // ★ 最重要：物理エンジンの引力を無視して「絶対座標(fx, fy)」にピン留めして吹き飛ばす
                node.fx = node.x + (dx / dist) * power;
                node.fy = node.y + (dy / dist) * power;

                // 1秒後にピン留めを解除し、引力で戻るようにする
                setTimeout(() => {
                    node.fx = null;
                    node.fy = null;
                    if (app.simulation) app.simulation.alpha(0.5).restart();
                }, 1000);
            });

            // 物理エンジン再点火
            if (app.simulation) app.simulation.alpha(1).restart();
        };
    }
}