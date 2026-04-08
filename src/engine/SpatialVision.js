// src/engine/SpatialVision.js

export class SpatialVision {
    static start(app) {
        if (document.getElementById('spatial-vision-hud')) return;

        console.log("👁️‍🗨️ [Spatial Vision] エコモード無効化・強制プロトコル起動");

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

        // ★ デバッグ用：強制発動ボタン（クリックで直接衝撃波を撃つ）
        const testBtn = document.createElement('button');
        testBtn.innerText = 'TEST';
        testBtn.style.cssText = `position: absolute; top: 4px; right: 4px; font-size: 9px; font-weight: bold; background: #ff4444; color: #fff; border: 1px solid #fff; border-radius: 3px; cursor: pointer; z-index: 10; padding: 2px 4px;`;
        testBtn.onclick = (e) => {
            e.stopPropagation(); // HUDのOFF判定を防ぐ
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
                
                // ★ 最大の修正ポイント：ブラウザの最適化によるフリーズを防ぐため、透明度1%で通常サイズで配置
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
                title.innerText = 'ERR: HARDWARE FAILURE';
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
            
            // 100msごとに処理
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
                            
                            // ★ 閾値をさらに下げて高感度に
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

                    // 画面の0.5%が動いたら発動
                    if (motionRatio > 0.005) {
                        if (now - lastTriggerTime > 800) {
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
            if (!app || !app.currentUniverse || !app.currentUniverse.nodes) {
                console.error("宇宙のデータ(app.currentUniverse)が見つかりません。");
                return;
            }

            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;

            let moved = false;

            app.currentUniverse.nodes.forEach(node => {
                node.fx = null; 
                node.fy = null;
                
                const angle = Math.atan2(node.y - cy, node.x - cx);
                const force = 150; // 強制吹き飛ばしパワー

                node.vx = (node.vx || 0) + Math.cos(angle) * force;
                node.vy = (node.vy || 0) + Math.sin(angle) * force;

                node.x += Math.cos(angle) * 50;
                node.y += Math.sin(angle) * 50;
                moved = true;
            });

            if (moved) {
                if (app.simulation) app.simulation.alpha(1).restart();
                if (app.update) app.update();
                if (window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 0.5);
                if (window.HapticEngine) window.HapticEngine.vibrate([30, 50, 30]);
            } else {
                console.warn("画面上に吹き飛ばす星がありません。");
            }
        };
    }
}