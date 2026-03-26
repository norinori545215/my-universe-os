// src/ui/NexusUI.js
import { SecretNexus } from '../security/SecretNexus.js';

export class NexusUI {
    constructor(app) {
        this.app = app;
        this.myKeys = null;
        this.sharedKey = null;
        this.cryptoError = false;
        this.initKeys();
    }

    async initKeys() {
        if (!window.crypto || !window.crypto.subtle) {
            this.cryptoError = true;
            console.error("Web Crypto API is not available.");
            return;
        }

        try {
            const saved = localStorage.getItem('universe_nexus_identity');
            if(saved) {
                this.myKeys = JSON.parse(saved);
            } else {
                this.myKeys = await SecretNexus.generateIdentity();
                localStorage.setItem('universe_nexus_identity', JSON.stringify(this.myKeys));
            }
        } catch (error) {
            console.error("鍵の生成に失敗:", error);
            this.cryptoError = true;
        }

        this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.4.4/qrcode.min.js');
        this.loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js');
    }

    loadScript(src) {
        if (document.querySelector(`script[src="${src}"]`)) return;
        const script = document.createElement('script');
        script.src = src;
        document.head.appendChild(script);
    }

    openScanner(hubNode) {
        if (this.cryptoError) {
            alert("🚨 【セキュリティ制限エラー】\nお使いのブラウザ環境では、量子暗号機能（Web Crypto API）がブロックされています。\n\n※スマホからPCのローカルサーバーに「http://192.168...」のようなURLでアクセスしている場合、暗号化が動作しません。「https://〜」の環境か、PCの「localhost」で実行してください。");
            return;
        }

        if (!this.myKeys) {
            alert("🔐 量子暗号キーを生成中、またはライブラリをロード中です...\n数秒後にもう一度お試しください。");
            return;
        }

        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,15,20,0.95); z-index:15000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#00ffcc; font-family:sans-serif; backdrop-filter:blur(15px);';

        modal.innerHTML = `
            <div style="font-size:20px; font-weight:bold; margin-bottom:30px; letter-spacing:3px; text-shadow:0 0 10px #00ffcc;">📡 ADD CHANNEL TO HUB</div>
            <div style="display:flex; flex-direction:column; gap:15px; width:80%; max-width:300px;">
                <button id="nx-btn-show" style="padding:15px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; color:#00ffcc; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; transition:0.2s;">1️⃣ 自分の鍵を表示 (QR)</button>
                <button id="nx-btn-scan" style="padding:15px; background:rgba(255,0,255,0.1); border:1px solid #ff00ff; color:#ff00ff; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; transition:0.2s;">2️⃣ 相手の鍵を読み取る</button>
                <button id="nx-btn-close" style="padding:15px; background:transparent; border:1px solid #666; color:#888; border-radius:8px; cursor:pointer; margin-top:20px; font-weight:bold;">キャンセル</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('nx-btn-show').onclick = () => { modal.remove(); this.showMyQR(hubNode); };
        document.getElementById('nx-btn-scan').onclick = () => { modal.remove(); this.startScanning(hubNode); };
        document.getElementById('nx-btn-close').onclick = () => modal.remove();
    }

    showMyQR(hubNode) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,15,20,0.98); z-index:15001; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif;';
        
        modal.innerHTML = `
            <div style="margin-bottom:20px; font-size:14px; color:#00ffcc; font-weight:bold; letter-spacing:2px;">YOUR PUBLIC KEY</div>
            <div id="nx-qr-container" style="background:#fff; padding:15px; border-radius:12px; box-shadow:0 0 40px rgba(0,255,204,0.3); display:flex; justify-content:center; align-items:center; min-width:250px; min-height:250px;">
                <div id="nx-qr-loading" style="color:#000; font-weight:bold;">Generating QR...</div>
                <canvas id="nexus-large-qr" width="250" height="250" style="display:none;"></canvas>
            </div>
            <div style="margin-top:20px; color:#aaa; font-size:12px; text-align:center; max-width:80%; line-height:1.5;">
                このQRコードを相手に読み取らせるか、<br>スクショして送信してください。<br>
                <span style="color:#ffcc00;">※一人でテストする場合は、これをスクショして「写真から読み込む」で自分自身と繋がれます。</span>
            </div>
            <button id="nx-qr-close" style="margin-top:40px; background:transparent; border:1px solid #00ffcc; color:#00ffcc; padding:12px 40px; border-radius:30px; cursor:pointer; font-weight:bold; letter-spacing:2px;">戻る</button>
        `;
        document.body.appendChild(modal);

        let retryCount = 0;
        const drawQR = () => {
            if (window.QRCode && this.myKeys) {
                const canvas = document.getElementById('nexus-large-qr');
                const loading = document.getElementById('nx-qr-loading');
                if(!canvas) return; 
                
                try {
                    const payload = JSON.stringify({ type: 'nexus_key', pub: this.myKeys.publicKey });
                    window.QRCode.toCanvas(canvas, payload, { width: 250, margin: 2, errorCorrectionLevel: 'M', color: { dark:"#000000", light:"#ffffff" } }, (error) => {
                        if (error) {
                            console.error("QR生成エラー:", error);
                            loading.innerText = "Error: " + error.message;
                        } else {
                            loading.style.display = 'none';
                            canvas.style.display = 'block';
                        }
                    });
                } catch (e) {
                    console.error("QR描画例外:", e);
                    loading.innerText = "Error: " + e.message;
                }
            } else {
                retryCount++;
                if (retryCount > 50) { 
                    const loading = document.getElementById('nx-qr-loading');
                    if(loading) loading.innerText = "Error: QRライブラリの読み込みに失敗しました。";
                    return;
                }
                setTimeout(drawQR, 200);
            }
        };
        drawQR();

        document.getElementById('nx-qr-close').onclick = () => { modal.remove(); this.openScanner(hubNode); };
    }

    startScanning(hubNode) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,15,20,0.98); z-index:15001; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif;';
        
        modal.innerHTML = `
            <div style="margin-bottom:20px; font-size:14px; color:#ff00ff; font-weight:bold; letter-spacing:2px;">SCAN PARTNER'S KEY</div>
            
            <div style="position:relative; width:250px; height:250px; overflow:hidden; border-radius:12px; background:#111; border:2px solid rgba(255,0,255,0.5); box-shadow:0 0 40px rgba(255,0,255,0.2);">
                <video id="nexus-video" width="250" height="250" style="object-fit:cover; transform:scaleX(-1);" playsinline></video>
                <div id="nexus-scan-line" style="position:absolute; top:0; left:0; width:100%; height:2px; background:#ff00ff; box-shadow:0 0 15px 5px rgba(255,0,255,0.5);"></div>
            </div>
            <canvas id="nexus-scan-canvas" style="display:none;"></canvas>

            <div style="margin-top:30px; display:flex; flex-direction:column; gap:15px; width:250px;">
                <button id="nx-upload-btn" style="padding:12px; background:#220022; border:1px solid #ff00ff; color:#ff00ff; border-radius:8px; font-weight:bold; cursor:pointer;">🖼️ 写真(画像)から読み込む</button>
                <input type="file" id="nx-upload-input" style="display:none;" accept="image/*">
                <button id="nx-cam-close" style="padding:12px; background:transparent; border:1px solid #666; color:#888; border-radius:8px; cursor:pointer;">戻る</button>
            </div>
        `;
        document.body.appendChild(modal);

        const video = document.getElementById('nexus-video');
        const scanCanvas = document.getElementById('nexus-scan-canvas');
        const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
        let scanning = true;

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
                video.srcObject = stream;
                video.setAttribute("playsinline", true);
                video.play();
                requestAnimationFrame(tick);
            }).catch(err => {
                console.warn("カメラが使用できません:", err);
            });
        }

        let linePos = 0; let lineDir = 2;
        const scanLine = document.getElementById('nexus-scan-line');

        const processQRData = async (dataStr) => {
            try {
                const data = JSON.parse(dataStr);
                if (data.type === 'nexus_key' && data.pub) {
                    scanning = false;
                    if(video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
                    modal.remove();
                    await this.establishConnection(data.pub, hubNode);
                } else {
                    alert("Nexusの鍵データではありません。");
                }
            } catch(e) {
                alert("無効なQRコードデータです。");
            }
        };

        const tick = async () => {
            if(!scanning) return;
            if(video.readyState === video.HAVE_ENOUGH_DATA) {
                scanCanvas.width = video.videoWidth; scanCanvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
                const imageData = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
                if (window.jsQR) {
                    const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                    if (code) { await processQRData(code.data); return; }
                }
            }
            linePos += lineDir;
            if(linePos > 248 || linePos < 0) lineDir *= -1;
            scanLine.style.top = linePos + 'px';
            requestAnimationFrame(tick);
        };

        document.getElementById('nx-upload-btn').onclick = () => document.getElementById('nx-upload-input').click();
        document.getElementById('nx-upload-input').onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            
            if(!window.jsQR) {
                alert("解析プログラムをロード中です。数秒待ってから再度お試しください。");
                return;
            }

            const img = new Image();
            img.onload = () => {
                scanCanvas.width = img.width; scanCanvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
                const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                if(code) { processQRData(code.data); } else { alert("画像からQRコードを検出できませんでした。"); }
            };
            img.src = URL.createObjectURL(file);
        };

        document.getElementById('nx-cam-close').onclick = () => {
            scanning = false;
            if(video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
            modal.remove();
            this.openScanner(hubNode);
        };
    }

    async establishConnection(peerPublicKey, hubNode) {
        if(window.universeAudio) window.universeAudio.playSystemSound(800, 'sine', 0.2);
        this.sharedKey = await SecretNexus.deriveSharedSecret(this.myKeys.privateKey, peerPublicKey);
        
        // ★★★ 天才的なアーキテクチャ変更：QRを読み込むと「チャット専用の星」がハブの横に衛星として誕生する！ ★★★
        // 1. ハブの少し横に星を作る
        const channelNode = this.app.currentUniverse.addNode("Secure Channel", hubNode.baseX + 150, hubNode.baseY + 150, 25, "#ff00ff", "star");
        
        // 2. その星に通信相手の鍵と記憶を注入する
        channelNode.sharedKey = this.sharedKey;
        channelNode.peerPublicKey = peerPublicKey;
        channelNode.messages = [];
        
        // 3. ハブ星とチャット星を線（リンク）で結び、関係性を視覚化する
        this.app.currentUniverse.addLink(hubNode, channelNode);

        this.app.autoSave();
        
        if(window.universeAudio) window.universeAudio.playWarp();
        alert("🔐 鍵の交換に成功しました！\n\nハブの隣に『チャット専用の星』が誕生しました。\nその星をタップして「💬 通信を開く」を選択してください。");
    }
}