// src/engine/SpatialVision.js

export class SpatialVision {
    static start(app) {
        if (document.getElementById('spatial-vision-hud')) return;

        console.log("👁️‍🗨️ [Spatial Vision] 重力アンカー切断モード起動");

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

        // テストボタン
        const testBtn = document.createElement('button');
        testBtn.innerText = '💣 TEST';
        testBtn.style.cssText = `position: absolute; top: 4px; right: 4px; font-size: 9px; font-weight: bold; background: #ff4444; color: #fff; border: 1px solid #fff; border-radius: 3px; cursor: pointer; z-index: 10; padding: 2px 4px;`;
        testBtn.onclick = (e) => {
            e.stopPropagation(); 
            triggerShockwave();
        };
        hud.appendChild(testBtn);

        document.body.appendChild(hud);

        const radarCanvas = document.createElement('canvas');
        radarCanvas.width = 160; radarCanvas.height = 120;
        const radarCtx = radarCanvas.getContext('2d', { willReadFrequently: true });

        let isRunning = false;
        let sensorReady = false; 
        let video, canvas, ctx;
        let prevFrame = null;
        let lastTriggerTime = 0;
        let lastProcessTime = 0;

        const initCamera = async () => {
            try {
                title.innerText = 'WARMING UP SENSOR...';
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
                        isRunning = true;
                        
                        setTimeout(() => {
                            sensorReady = true;
                            title.innerText = 'KINETIC RADAR : ACTIVE';
                            title.style.color = '#00ffcc';
                            title.style.textShadow = '0 0 5px #00ffcc';
                            hud.style.borderColor = '#00ffcc';
                            if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.1);
                        }, 2500);

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
                sensorReady = false;
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
            requestAnimationFrame(processFrame);

            const now = Date.now();
            if (now - lastProcessTime < 100) return; 
            lastProcessTime = now;

            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();

            const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            
            if (prevFrame && sensorReady) {
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
                        
                        if (diff > 35) {
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
                
                const barPercent = Math.min(100, motionRatio * 800); 
                motionBar.style.width = `${barPercent}%`;

                if (motionRatio > 0.04) {
                    if (now - lastTriggerTime > 1200) { 
                        lastTriggerTime = now;
                        triggerShockwave();
                    }
                }
            }
            prevFrame = new Uint8ClampedArray(currentFrame);
        };

        const triggerShockwave = () => {
            if (!app || !app.currentUniverse) return;

            motionBar.style.background = '#ff00ff';
            motionBar.style.width = '100%';
            hud.style.boxShadow = '0 0 40px #ff00ff';
            setTimeout(() => {
                motionBar.style.background = '#00ffcc';
                hud.style.boxShadow = '0 0 15px rgba(0, 255, 204, 0.3)';
                motionBar.style.width = '0%';
            }, 300);

            // ★ 赤く点滅するダサいフィルターを削除。代わりにキャンバスが一瞬「ドンッ」と拡大するだけにする。
            const canvasEl = document.getElementById('universe-canvas');
            if (canvasEl) {
                canvasEl.style.transition = 'none';
                canvasEl.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    canvasEl.style.transition = 'transform 0.5s ease-out';
                    canvasEl.style.transform = 'scale(1)';
                }, 50);
            }

            if (window.universeAudio) window.universeAudio.playSystemSound(50, 'sawtooth', 0.8);
            if (window.HapticEngine) window.HapticEngine.vibrate([50, 100, 50]);

            // 星がない場合は虚空から召喚
            if (app.currentUniverse.nodes.length === 0) {
                for (let i = 0; i < 20; i++) {
                    app.currentUniverse.addNode(`FRAGMENT_${i}`, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 15, '#00ffcc', 'star');
                }
            }

            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;

            app.currentUniverse.nodes.forEach(node => {
                let dx = node.x - cx;
                let dy = node.y - cy;
                
                if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
                    dx = Math.random() - 0.5; dy = Math.random() - 0.5;
                }

                const angle = Math.atan2(dy, dx);
                // 吹き飛ぶ距離
                const force = 400 + Math.random() * 500;

                const newX = node.x + Math.cos(angle) * force;
                const newY = node.y + Math.sin(angle) * force;

                // ★ 最大の敵「Gravity.js」の引き戻しを無力化する。
                // 現在地だけでなく、引力の中心座標（baseX, baseY）ごと遠くへ移動させる！
                node.x = newX;
                node.y = newY;
                node.baseX = newX;
                node.baseY = newY;
                
                // 固定状態も解除
                node.fx = null; 
                node.fy = null;
                
                // さらに慣性を与える
                node.vx = Math.cos(angle) * 50;
                node.vy = Math.sin(angle) * 50;
            });

            // エンジン強制再起動（星を動かす）
            if (app.simulation) app.simulation.alpha(1).restart();
            if (typeof app.autoSave === 'function') app.autoSave();
        };
    }
}