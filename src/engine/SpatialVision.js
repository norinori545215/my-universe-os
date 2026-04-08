// src/engine/SpatialVision.js

export class SpatialVision {
    static start(app) {
        if (document.getElementById('spatial-vision-hud')) return;

        console.log("👁️‍🗨️ [Spatial Vision] ジェスチャー認識パターン起動");

        const hud = document.createElement('div');
        hud.id = 'spatial-vision-hud';
        hud.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; width: 180px; height: 90px;
            background: rgba(0, 10, 15, 0.9); border: 1px solid #00ffcc; border-radius: 4px;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.3); z-index: 99999;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            overflow: hidden; cursor: pointer; transition: 0.3s;
        `;

        const title = document.createElement('div');
        title.innerText = 'KINETIC RADAR : STANDBY';
        title.style.cssText = `color: #ff4444; font-size: 10px; font-family: monospace; letter-spacing: 1px; z-index: 2; margin-bottom: 4px; text-shadow: 0 0 5px #ff4444;`;
        hud.appendChild(title);

        // ★ ジェスチャー判定結果を表示するUIを追加
        const gestureDisplay = document.createElement('div');
        gestureDisplay.innerText = '- NO SIGNAL -';
        gestureDisplay.style.cssText = `color: #fff; font-size: 14px; font-weight: bold; z-index: 2; margin-bottom: 8px; text-shadow: 0 0 5px #fff; transition: 0.2s;`;
        hud.appendChild(gestureDisplay);

        const barContainer = document.createElement('div');
        barContainer.style.cssText = `width: 90%; height: 6px; background: rgba(0,255,204,0.1); border: 1px solid rgba(0,255,204,0.3); border-radius: 2px; position: absolute; bottom: 5px; left: 5%; z-index: 2; overflow: hidden;`;
        hud.appendChild(barContainer);

        const motionBar = document.createElement('div');
        motionBar.style.cssText = `width: 0%; height: 100%; background: #00ffcc; box-shadow: 0 0 10px #00ffcc; transition: width 0.05s ease-out;`;
        barContainer.appendChild(motionBar);

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
        
        // ★ ジェスチャー認識用：前回の「動きの重心」
        let lastMotionX = null;
        let lastMotionY = null;

        const initCamera = async () => {
            try {
                title.innerText = 'WARMING UP...';
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
            if (!isRunning) initCamera();
            else {
                isRunning = false;
                sensorReady = false;
                title.innerText = 'KINETIC RADAR : STANDBY';
                title.style.color = '#ff4444';
                hud.style.borderColor = '#00ffcc';
                hud.style.backgroundImage = 'none';
                gestureDisplay.innerText = '- NO SIGNAL -';
                gestureDisplay.style.color = '#fff';
                motionBar.style.width = '0%';
                if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
                if (video) video.remove();
            }
        };

        const processFrame = () => {
            if (!isRunning) return;
            requestAnimationFrame(processFrame);

            const now = Date.now();
            if (now - lastProcessTime < 50) return; // 判定を細かく（50ms）してスワイプの速度を拾う
            lastProcessTime = now;

            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();

            const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            
            if (prevFrame && sensorReady) {
                let changedPixels = 0;
                let sumX = 0;
                let sumY = 0;
                const step = 4;
                
                radarCtx.globalAlpha = 0.3;
                radarCtx.drawImage(video, 0, 0, radarCanvas.width, radarCanvas.height);
                radarCtx.globalAlpha = 1.0;
                radarCtx.fillStyle = '#ff00ff';

                for (let y = 0; y < canvas.height; y += step) {
                    for (let x = 0; x < canvas.width; x += step) {
                        const i = (y * canvas.width + x) * 4;
                        
                        const diff = Math.abs(currentFrame[i] - prevFrame[i]) + 
                                     Math.abs(currentFrame[i+1] - prevFrame[i+1]) + 
                                     Math.abs(currentFrame[i+2] - prevFrame[i+2]);
                        
                        if (diff > 35) {
                            changedPixels++;
                            sumX += x;
                            sumY += y;
                            radarCtx.fillRect(canvas.width - x, y, step, step);
                        }
                    }
                }

                hud.style.backgroundImage = `url(${radarCanvas.toDataURL()})`;
                hud.style.backgroundSize = 'cover';
                hud.style.backgroundPosition = 'center';

                const totalSampledPixels = (canvas.width * canvas.height) / (step * step);
                const motionRatio = changedPixels / totalSampledPixels;
                motionBar.style.width = `${Math.min(100, motionRatio * 800)}%`;

                // ★ ジェスチャー（ベクトル）判定アルゴリズム
                if (motionRatio > 0.02) { 
                    // 動いたピクセルの「重心（平均座標）」を計算
                    const avgX = sumX / changedPixels;
                    const avgY = sumY / changedPixels;

                    if (lastMotionX !== null && lastMotionY !== null) {
                        // 前回の重心からの移動距離を計算
                        const dx = avgX - lastMotionX;
                        const dy = avgY - lastMotionY;

                        // 一定以上の速度で重心が移動した場合のみ「スワイプ」とみなす
                        if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
                            if (now - lastTriggerTime > 1000) { // クールダウン1秒
                                lastTriggerTime = now;
                                
                                // X軸の移動とY軸の移動、どちらが大きいかで方向を決定
                                if (Math.abs(dx) > Math.abs(dy)) {
                                    if (dx > 0) executeGesture('RIGHT'); // 鏡合わせなので右に動けばXは増える
                                    else executeGesture('LEFT');
                                } else {
                                    if (dy > 0) executeGesture('DOWN'); // 下に動けばYは増える
                                    else executeGesture('UP');
                                }
                            }
                        }
                    }
                    // 重心を更新
                    lastMotionX = avgX;
                    lastMotionY = avgY;
                } else {
                    // 動きが止まったら重心をリセット（次のジェスチャーに備える）
                    lastMotionX = null;
                    lastMotionY = null;
                }
            }
            prevFrame = new Uint8ClampedArray(currentFrame);
        };

        // ★ パターン化されたジェスチャーの実行
        const executeGesture = (direction) => {
            if (!app || !app.currentUniverse) return;

            // UI演出
            motionBar.style.background = '#ff00ff';
            motionBar.style.width = '100%';
            hud.style.boxShadow = `0 0 30px ${direction === 'UP' ? '#ffcc00' : '#ff00ff'}`;
            
            // HUDに方向を表示
            let icon = '';
            if (direction === 'LEFT') icon = '⬅️ SWIPE LEFT';
            if (direction === 'RIGHT') icon = '➡️ SWIPE RIGHT';
            if (direction === 'UP') icon = '⬆️ SWIPE UP';
            if (direction === 'DOWN') icon = '⬇️ SWIPE DOWN';
            
            gestureDisplay.innerText = icon;
            gestureDisplay.style.color = '#ff00ff';

            setTimeout(() => {
                motionBar.style.background = '#00ffcc';
                hud.style.boxShadow = '0 0 15px rgba(0, 255, 204, 0.3)';
                gestureDisplay.style.color = '#00ffcc';
            }, 500);

            // 音声フィードバック
            if (window.universeAudio) {
                if (direction === 'UP') window.universeAudio.playSystemSound(600, 'sine', 0.5); // 吸い込む音
                else window.universeAudio.playSystemSound(100, 'sawtooth', 0.5); // 吹き飛ばす音
            }

            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;

            // 星がない場合はフェイルセーフとして召喚（下スワイプ時のみ）
            if (app.currentUniverse.nodes.length === 0 && direction === 'DOWN') {
                for (let i = 0; i < 20; i++) app.currentUniverse.addNode(`DATA_${i}`, cx + (Math.random()-0.5)*10, cy + (Math.random()-0.5)*10, 15, '#00ffcc', 'star');
            }

            // 星への物理的干渉
            app.currentUniverse.nodes.forEach(node => {
                node.fx = null; 
                node.fy = null;
                
                const force = 300 + Math.random() * 200;

                if (direction === 'LEFT') {
                    // 左へ押し流す
                    node.x -= force; node.baseX = node.x; node.vx = -50;
                } 
                else if (direction === 'RIGHT') {
                    // 右へ押し流す
                    node.x += force; node.baseX = node.x; node.vx = 50;
                } 
                else if (direction === 'UP') {
                    // 中心に収束させる（ブラックホール）
                    node.x = cx + (Math.random() - 0.5) * 50;
                    node.y = cy + (Math.random() - 0.5) * 50;
                    node.baseX = node.x;
                    node.baseY = node.y;
                    node.vx = 0; node.vy = 0;
                } 
                else if (direction === 'DOWN') {
                    // 四方八方へ爆散（ショックウェーブ）
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
        };
    }
}