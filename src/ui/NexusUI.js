// src/ui/NexusUI.js
import { SecretNexus } from '../security/SecretNexus.js';

export class NexusUI {
    constructor(app) {
        this.app = app;
        this.myKeys = null;
        this.sharedKey = null; // 相手との共通鍵
        this.initKeys();
    }

    async initKeys() {
        // ローカルストレージから自分の鍵ペアを読み込む（無ければ新規錬成）
        const saved = localStorage.getItem('universe_nexus_identity');
        if(saved) {
            this.myKeys = JSON.parse(saved);
        } else {
            this.myKeys = await SecretNexus.generateIdentity();
            localStorage.setItem('universe_nexus_identity', JSON.stringify(this.myKeys));
        }
        
        // 外部の強力なQRコード生成＆解析ライブラリを「自動ロード」する
        this.loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js');
        this.loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js');
    }

    loadScript(src) {
        if (document.querySelector(`script[src="${src}"]`)) return;
        const script = document.createElement('script');
        script.src = src;
        document.head.appendChild(script);
    }

    openScanner(node) {
        // UIの構築：サイバーパンクなスキャン画面
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:15000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#00ffcc; font-family:sans-serif; backdrop-filter:blur(15px);';

        modal.innerHTML = `
            <div style="font-size:18px; font-weight:bold; margin-bottom:30px; letter-spacing:3px; text-shadow:0 0 10px #ff00ff; color:#ff00ff;">📡 QUANTUM KEY HANDSHAKE</div>
            
            <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center; align-items:center; width:100%; max-width:600px;">
                
                <div style="display:flex; flex-direction:column; align-items:center; background:rgba(0,255,204,0.05); border:1px solid #00ffcc; padding:20px; border-radius:16px; box-shadow:0 0 30px rgba(0,255,204,0.1);">
                    <div style="margin-bottom:10px; font-size:11px; color:#00ffcc; font-weight:bold; letter-spacing:1px;">YOUR PUBLIC KEY (SHOW THIS)</div>
                    <canvas id="nexus-my-qr" width="180" height="180" style="border-radius:8px; background:#fff; padding:5px;"></canvas>
                </div>

                <div style="display:flex; flex-direction:column; align-items:center; background:rgba(255,0,255,0.05); border:1px solid #ff00ff; padding:20px; border-radius:16px; box-shadow:0 0 30px rgba(255,0,255,0.1);">
                    <div style="margin-bottom:10px; font-size:11px; color:#ff00ff; font-weight:bold; letter-spacing:1px;">SCAN PARTNER'S KEY</div>
                    <div style="position:relative; width:180px; height:180px; overflow:hidden; border-radius:8px; background:#111; border:1px solid rgba(255,0,255,0.5);">
                        <video id="nexus-video" width="180" height="180" style="object-fit:cover; transform:scaleX(-1);" playsinline></video>
                        <div id="nexus-scan-line" style="position:absolute; top:0; left:0; width:100%; height:2px; background:#ff00ff; box-shadow:0 0 15px 5px rgba(255,0,255,0.5); transition:top 0.1s;"></div>
                    </div>
                    <canvas id="nexus-scan-canvas" style="display:none;"></canvas>
                </div>
            </div>

            <button id="nexus-close" style="margin-top:40px; background:transparent; border:1px solid #ff4444; color:#ff4444; padding:12px 40px; border-radius:30px; cursor:pointer; font-weight:bold; letter-spacing:2px; transition:0.2s;">ABORT</button>
        `;
        document.body.appendChild(modal);

        // QRコードの生成（一瞬遅らせてライブラリの読み込みを待つ）
        setTimeout(() => {
            if(window.QRCode && this.myKeys) {
                const canvas = document.getElementById('nexus-my-qr');
                const payload = JSON.stringify({ type: 'nexus_key', pub: this.myKeys.publicKey });
                // エラー訂正レベルHで生成（認識性アップ）
                window.QRCode.toCanvas(canvas, payload, { width: 180, margin: 2, errorCorrectionLevel: 'H', color: { dark:"#000000", light:"#ffffff" } });
            }
        }, 300);

        // カメラの起動とスキャンループ処理
        const video = document.getElementById('nexus-video');
        const scanCanvas = document.getElementById('nexus-scan-canvas');
        const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
        let scanning = true;

        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.play();
            requestAnimationFrame(tick);
        }).catch(err => {
            console.error(err);
            alert("カメラの起動に失敗しました。ブラウザの権限設定を確認してください。");
        });

        // サイバーパンクなスキャンアニメーション（レーザー上下移動）
        let linePos = 0; 
        let lineDir = 2;
        const scanLine = document.getElementById('nexus-scan-line');

        const tick = async () => {
            if(!scanning) return;
            if(video.readyState === video.HAVE_ENOUGH_DATA) {
                scanCanvas.width = video.videoWidth;
                scanCanvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
                
                const imageData = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
                if (window.jsQR) {
                    const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                    
                    if (code) {
                        try {
                            const data = JSON.parse(code.data);
                            // 相手の鍵を認識した場合の処理
                            if (data.type === 'nexus_key' && data.pub) {
                                scanning = false; 
                                video.srcObject.getTracks().forEach(track => track.stop()); // カメラ停止
                                await this.establishConnection(data.pub, node);
                                modal.remove();
                                return;
                            }
                        } catch(e) { /* 無視してスキャン続行 */ }
                    }
                }
            }
            
            // レーザーの移動処理
            linePos += lineDir;
            if(linePos > 178 || linePos < 0) lineDir *= -1;
            scanLine.style.top = linePos + 'px';
            
            requestAnimationFrame(tick);
        };

        // 閉じるボタンの処理
        document.getElementById('nexus-close').onclick = () => {
            scanning = false;
            if(video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
            modal.remove();
        };
    }

    async establishConnection(peerPublicKey, node) {
        if(window.universeAudio) window.universeAudio.playSystemSound(800, 'sine', 0.2);
        
        // ECDH方式で、相手の公開鍵と自分の秘密鍵を混ぜ合わせて共通鍵を錬成
        this.sharedKey = await SecretNexus.deriveSharedSecret(this.myKeys.privateKey, peerPublicKey);
        
        // 成功演出：星の色と名前を変える
        node.color = "#ff00ff"; // マゼンタに輝く
        node.name = "Nexus: " + node.name;
        node.sharedKey = this.sharedKey; // 星のデータに暗号鍵を持たせる
        this.app.autoSave();
        
        if(window.universeAudio) window.universeAudio.playWarp();
        alert("🔐 相手の鍵を認識しました！\n軍事レベル(AES-GCM)の暗号化チャネルを確立しました。\n\n※チャットUIは次のステップで実装します。");
    }
}