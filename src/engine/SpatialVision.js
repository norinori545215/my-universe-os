// src/engine/SpatialVision.js

export class SpatialVision {
    static start(app) {
        if (document.getElementById('spatial-vision-hud')) return;

        console.log("👁️‍🗨️ [Spatial Vision] ステルス・キネティック・センサー（完全版）起動");

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
        let sensorReady = false; // ★ 心臓バグ防止：起動直後のノイズを無視するフラグ
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
                        
                        // ★ 心臓バグ解決：カメラの明るさ調整が終わるまで「2.5秒間」検知を無効化する
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
            requestAnimationFrame(processFrame); // 最速でループを回し続ける

            const now = Date.now();
            if (now - lastProcessTime < 100) return; // 100ms間隔で処理
            lastProcessTime = now;

            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();

            const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            
            if (prevFrame && sensorReady) { // ★ ウォームアップ中は無視
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
                        
                        // ★ ノイズを拾わないように閾値を再調整（35以上）
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

                // ★ 発動条件を「画面の4%が動いた時」に引き上げ、誤作動を完全に防ぐ
                if (motionRatio > 0.04) {
                    if (now - lastTriggerTime > 1200) { // クールダウン1.2秒
                        lastTriggerTime = now;
                        triggerShockwave();
                    }
                }
            }
            prevFrame = new Uint8ClampedArray(currentFrame);
        };

        const triggerShockwave = () => {
            if (!app || !app.currentUniverse) return;

            // ★ HUDのフラッシュ演出
            motionBar.style.background = '#ff00ff';
            motionBar.style.width = '100%';
            hud.style.boxShadow = '0 0 40px #ff00ff';
            setTimeout(() => {
                motionBar.style.background = '#00ffcc';
                hud.style.boxShadow = '0 0 15px rgba(0, 255, 204, 0.3)';
                motionBar.style.width = '0%';
            }, 300);

            // ★ 気持ち悪い「心臓の揺れ（Bodyの揺れ）」を廃止し、キャンバス自体にサイバーなグリッチエフェクトをかける
            const canvasEl = document.getElementById('universe-canvas');
            if (canvasEl) {
                canvasEl.style.transition = 'none';
                canvasEl.style.filter = 'brightness(2.5) contrast(1.5) hue-rotate(90deg)';
                canvasEl.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    canvasEl.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
                    canvasEl.style.filter = 'none';
                    canvasEl.style.transform = 'scale(1)';
                }, 50);
            }

            if (window.universeAudio) window.universeAudio.playSystemSound(50, 'sawtooth', 0.8);
            if (window.HapticEngine) window.HapticEngine.vibrate([50, 100, 50]);

            // ★ 星が1つも無い場合は、強制的に「破片」を生成して吹き飛ばす（これで絶対に動くのが見える）
            if (app.currentUniverse.nodes.length === 0) {
                for (let i = 0; i < 20; i++) {
                    app.currentUniverse.addNode(`FRAGMENT_${i}`, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 15, '#00ffcc', 'star');
                }
            }

            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;

            app.currentUniverse.nodes.forEach(node => {
                // 重力システム(Gravity.js)のロックを強制解除
                node.fx = null; 
                node.fy = null;
                
                let dx = node.x - cx;
                let dy = node.y - cy;
                
                // 中心にいる場合はランダムな方向へ
                if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
                    dx = Math.random() - 0.5; dy = Math.random() - 0.5;
                }

                const angle = Math.atan2(dy, dx);
                // ★ 超圧倒的なスピード（vx, vy）を与えて吹き飛ばす
                const force = 300 + Math.random() * 400;

                node.vx = (node.vx || 0) + Math.cos(angle) * force;
                node.vy = (node.vy || 0) + Math.sin(angle) * force;
            });

            // エンジン強制再起動（星を動かす）
            if (app.simulation) app.simulation.alpha(1).restart();
        };
    }
}