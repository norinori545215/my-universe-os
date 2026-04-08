// src/engine/SpatialVision.js

export class SpatialVision {
    static start(app) {
        if (document.getElementById('spatial-vision-hud')) return;

        console.log("👁️‍🗨️ [Spatial Vision] ステルス・キネティック・センサー起動");

        // 1. ダサいカメラ映像を廃止し、スタイリッシュな「レーダーHUD」に変更
        const hud = document.createElement('div');
        hud.id = 'spatial-vision-hud';
        hud.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; width: 180px; height: 60px;
            background: rgba(0, 15, 20, 0.9); border: 1px solid #00ffcc; border-radius: 4px;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.3); z-index: 99999;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            overflow: hidden; cursor: pointer; transition: 0.3s;
        `;

        const title = document.createElement('div');
        title.innerText = 'KINETIC RADAR : STANDBY';
        title.style.cssText = `color: #ff4444; font-size: 10px; font-family: monospace; letter-spacing: 1px; z-index: 2; margin-bottom: 8px; transition: 0.3s;`;
        hud.appendChild(title);

        // 動きの量を示すサイバーパンク風のインジケーター（バーグラフ）
        const barContainer = document.createElement('div');
        barContainer.style.cssText = `width: 90%; height: 8px; background: rgba(0,255,204,0.1); border: 1px solid rgba(0,255,204,0.3); border-radius: 2px; position: relative; overflow: hidden;`;
        hud.appendChild(barContainer);

        const motionBar = document.createElement('div');
        motionBar.style.cssText = `width: 0%; height: 100%; background: #00ffcc; box-shadow: 0 0 10px #00ffcc; transition: width 0.1s ease-out, background 0.2s;`;
        barContainer.appendChild(motionBar);

        document.body.appendChild(hud);

        let isRunning = false;
        let video, canvas, ctx;
        let prevFrame = null;
        let lastTriggerTime = 0;

        // 2. カメラの起動（映像は完全に隠蔽）
        const initCamera = async () => {
            try {
                title.innerText = 'CALIBRATING SENSOR...';
                title.style.color = '#ffaa00';
                
                // 解像度を下げて処理を極限まで軽くする
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 }, audio: false });
                
                video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.playsInline = true;
                video.style.display = 'none'; // ★ カメラの映像を完全に非表示にする！

                canvas = document.createElement('canvas');
                canvas.width = 160; canvas.height = 120;
                ctx = canvas.getContext('2d', { willReadFrequently: true });

                title.innerText = 'KINETIC RADAR : ACTIVE';
                title.style.color = '#00ffcc';
                hud.style.borderColor = '#00ffcc';
                
                isRunning = true;
                if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.1);
                
                requestAnimationFrame(processFrame);
            } catch (err) {
                console.error(err);
                title.innerText = 'ACCESS DENIED';
                title.style.color = '#ff4444';
            }
        };

        // HUDをクリックでオンオフ切り替え
        hud.onclick = () => {
            if (!isRunning) {
                initCamera();
            } else {
                isRunning = false;
                title.innerText = 'KINETIC RADAR : STANDBY';
                title.style.color = '#ff4444';
                hud.style.borderColor = '#00ffcc';
                motionBar.style.width = '0%';
                if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
            }
        };

        // 3. 高精度な動体検知（モーション・センシング）
        const processFrame = () => {
            if (!isRunning) return;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            
            if (prevFrame) {
                let changedPixels = 0;
                const step = 4; // 処理を間引いて軽くする

                for (let i = 0; i < currentFrame.length; i += 4 * step) {
                    // RGBの差分から動きを検知
                    const MathAbs = Math.abs;
                    const diff = MathAbs(currentFrame[i] - prevFrame[i]) + 
                                 MathAbs(currentFrame[i+1] - prevFrame[i+1]) + 
                                 MathAbs(currentFrame[i+2] - prevFrame[i+2]);
                    
                    if (diff > 100) { // 環境光のノイズを無視する閾値
                        changedPixels++;
                    }
                }

                // 画面全体に対する「動いた割合」を計算
                const totalSampledPixels = (canvas.width * canvas.height) / step;
                const motionRatio = changedPixels / totalSampledPixels;
                
                // HUDのバーグラフに動きの激しさをリアルタイム反映
                const barPercent = Math.min(100, motionRatio * 1500); // 感度調整
                motionBar.style.width = `${barPercent}%`;

                // ★ 発動条件：画面の一定割合（約3%）が急激に動いた時
                if (motionRatio > 0.03) {
                    const now = Date.now();
                    // クールダウンタイム（連発防止：0.8秒間に1回）
                    if (now - lastTriggerTime > 800) {
                        lastTriggerTime = now;
                        
                        // HUDの発光エフェクト
                        motionBar.style.background = '#ff00ff';
                        hud.style.boxShadow = '0 0 30px #ff00ff';
                        setTimeout(() => {
                            motionBar.style.background = '#00ffcc';
                            hud.style.boxShadow = '0 0 15px rgba(0, 255, 204, 0.3)';
                        }, 300);

                        triggerShockwave();
                    }
                }
            }

            prevFrame = new Uint8ClampedArray(currentFrame);
            requestAnimationFrame(processFrame);
        };

        // 4. ジェスチャー発動時の物理演算（衝撃波）
        const triggerShockwave = () => {
            if (!app.currentUniverse || !app.currentUniverse.nodes) return;

            // カメラの中心座標
            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;

            app.currentUniverse.nodes.forEach(node => {
                // 固定状態を強制解除
                node.fx = null; 
                node.fy = null;
                
                // 中心から外側に向かって吹き飛ぶベクトルを計算
                const angle = Math.atan2(node.y - cy, node.x - cx);
                const distance = Math.sqrt(Math.pow(node.x - cx, 2) + Math.pow(node.y - cy, 2));
                
                // 近くの星ほど強く吹き飛ぶ
                const power = Math.max(5, 30 - (distance * 0.05)); 

                node.vx = (node.vx || 0) + Math.cos(angle) * power;
                node.vy = (node.vy || 0) + Math.sin(angle) * power;
            });

            // 物理エンジン（D3.js等）を再点火して運動エネルギーを適用
            if (app.simulation) app.simulation.alpha(1).restart();
            
            // ドシュッ！という重低音の衝撃波サウンド
            if (window.universeAudio) {
                window.universeAudio.playSystemSound(100, 'sawtooth', 0.4);
            }
        };
    }
}