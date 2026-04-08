// src/engine/SpatialVision.js

export class SpatialVision {
    static start(app) {
        if (document.getElementById('spatial-vision-hud')) return;

        console.log("👁️‍🗨️ [Spatial Vision] カメラ・ハッキング待機中...");

        // 1. 空間認識HUDウィジェットの生成
        const hud = document.createElement('div');
        hud.id = 'spatial-vision-hud';
        hud.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; width: 160px; height: 120px;
            background: rgba(0, 10, 15, 0.8); border: 1px solid #00ffcc; border-radius: 8px;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.3); z-index: 99999;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            overflow: hidden; cursor: pointer; transition: 0.3s;
        `;

        const title = document.createElement('div');
        title.innerText = 'KINETIC SENSOR : OFFLINE';
        title.style.cssText = `color: #ff4444; font-size: 10px; font-family: monospace; letter-spacing: 1px; z-index: 2; text-shadow: 0 0 5px #ff4444;`;
        hud.appendChild(title);

        const scanline = document.createElement('div');
        scanline.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: rgba(0, 255, 204, 0.5); animation: scan-line 2s linear infinite; display: none; z-index: 3;`;
        hud.appendChild(scanline);

        if (!document.getElementById('spatial-styles')) {
            const style = document.createElement('style');
            style.id = 'spatial-styles';
            style.innerHTML = `@keyframes scan-line { 0% { top: 0; } 100% { top: 100%; } }`;
            document.head.appendChild(style);
        }

        document.body.appendChild(hud);

        let isRunning = false;
        let video, canvas, ctx;
        let prevFrame = null;
        let lastMotionX = 0, lastMotionY = 0;

        // 2. カメラの起動と映像ストリームの取得
        const initCamera = async () => {
            try {
                title.innerText = 'ACCESSING CAMERA...';
                title.style.color = '#ffaa00';
                
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 }, audio: false });
                
                video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.playsInline = true;
                // サイバーパンク風の緑色・高コントラストフィルターをかける
                video.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; filter: sepia(100%) hue-rotate(100deg) saturate(300%) contrast(150%); opacity: 0.5; z-index: 1; transform: scaleX(-1);`;
                hud.appendChild(video);

                canvas = document.createElement('canvas');
                canvas.width = 160; canvas.height = 120;
                ctx = canvas.getContext('2d', { willReadFrequently: true });

                title.innerText = 'KINETIC SENSOR : ONLINE';
                title.style.color = '#00ffcc';
                title.style.textShadow = '0 0 5px #00ffcc';
                scanline.style.display = 'block';
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

        hud.onclick = () => { if (!isRunning) initCamera(); };

        // 3. ピクセル・ディフィング（動体検知アルゴリズム）
        const processFrame = () => {
            if (!isRunning) return;

            // 映像を左右反転して描画（鏡のようにするため）
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();

            const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            
            if (prevFrame) {
                let motionX = 0; let motionY = 0; let motionPixels = 0;

                // 4ピクセル飛ばしで解析してCPU負荷を軽減
                for (let y = 0; y < canvas.height; y += 4) {
                    for (let x = 0; x < canvas.width; x += 4) {
                        const i = (y * canvas.width + x) * 4;
                        
                        // RGBの差分を計算
                        const diff = Math.abs(currentFrame[i] - prevFrame[i]) + 
                                     Math.abs(currentFrame[i+1] - prevFrame[i+1]) + 
                                     Math.abs(currentFrame[i+2] - prevFrame[i+2]);
                        
                        // 大きな動き（閾値以上）があったピクセルを検知
                        if (diff > 120) {
                            motionX += x; motionY += y; motionPixels++;
                        }
                    }
                }

                // 一定以上の動き（手が振られたなど）があった場合
                if (motionPixels > 50) {
                    const avgX = motionX / motionPixels;
                    const avgY = motionY / motionPixels;

                    // 前回の動きの中心点から、どっちにどれくらいスワイプしたか（ベクトル）を計算
                    if (lastMotionX !== 0 && lastMotionY !== 0) {
                        const dx = avgX - lastMotionX;
                        const dy = avgY - lastMotionY;

                        // 動きが早ければ「ジェスチャー入力」として宇宙に物理干渉
                        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                            hud.style.boxShadow = '0 0 30px #ff00ff'; // 反応エフェクト
                            setTimeout(() => hud.style.boxShadow = '0 0 15px rgba(0, 255, 204, 0.3)', 100);

                            triggerQuantumWind(dx, dy);
                        }
                    }
                    lastMotionX = avgX; lastMotionY = avgY;
                } else {
                    lastMotionX = 0; lastMotionY = 0; // 動きが止まったらリセット
                }
            }

            // 現在のフレームを過去フレームとして保存
            prevFrame = new Uint8ClampedArray(currentFrame);
            requestAnimationFrame(processFrame);
        };

        // 4. 現実の手の動きを、OS上の星々の「運動エネルギー」に変換
        const triggerQuantumWind = (dx, dy) => {
            if (!app.currentUniverse || !app.currentUniverse.nodes) return;

            // スワイプ方向への力を計算（画面サイズとカメラ解像度の比率を考慮）
            const forceX = dx * 1.5; 
            const forceY = dy * 1.5;

            app.currentUniverse.nodes.forEach(node => {
                // 固定されている星（fx, fy）も強制的に解除して吹き飛ばす
                node.fx = null; 
                node.fy = null;
                
                // 既存の速度に、手の動き（force）を加算
                node.vx = (node.vx || 0) + forceX * (Math.random() * 0.5 + 0.5); 
                node.vy = (node.vy || 0) + forceY * (Math.random() * 0.5 + 0.5);
            });

            // 物理エンジンを再起動（熱を与えて動かす）
            if (app.simulation) app.simulation.alpha(0.8).restart();
            
            // 効果音（風を切るような音）
            if (window.universeAudio && Math.random() < 0.3) {
                window.universeAudio.playSystemSound(200, 'sawtooth', 0.1);
            }
        };
    }
}