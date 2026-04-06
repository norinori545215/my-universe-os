// src/ui/WebXRDive.js

export class WebXRDive {
    // VRデバイスが接続されているか確認
    static async isSupported() {
        if ('xr' in navigator) {
            return await navigator.xr.isSessionSupported('immersive-vr');
        }
        return false;
    }

    // ダイブシーケンスの開始
    static async initiateDive(app, hyper3DInstance) {
        console.log("🕶️ [WebXR] ニューラル・リンクの初期化を開始...");

        const supported = await this.isSupported();
        
        // デバイスがない場合はハッキング失敗（エラー）演出へ
        if (!supported) {
            this.showDiveError();
            return;
        }

        // デバイスがあれば、サイバーパンクなダイブ演出へ
        this.showDiveSequence(async () => {
            try {
                // VRセッションの要求
                const session = await navigator.xr.requestSession('immersive-vr');
                
                // Hyper3D（3Dエンジン）のレンダラーにVRセッションを紐付ける
                if (hyper3DInstance && hyper3DInstance.renderer) {
                    hyper3DInstance.renderer.xr.enabled = true;
                    hyper3DInstance.renderer.xr.setSession(session);
                }

                session.addEventListener('end', () => {
                    console.log("🕶️ [WebXR] ニューラル・リンク切断。");
                    if (window.universeAudio) window.universeAudio.playSystemSound(200, 'sawtooth', 0.5);
                });

                if (window.universeAudio) window.universeAudio.playWarp();
                
            } catch (e) {
                console.error("VR Dive failed:", e);
                alert("VRへのダイブに失敗しました。機器の接続と権限を確認してください。");
            }
        });
    }

    // 🌟 マトリックス風・ニューラル接続ローディング画面
    static showDiveSequence(onComplete) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:#000; z-index:100000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#00ffcc; font-family:monospace;';
        
        overlay.innerHTML = `
            <div style="font-size:24px; font-weight:bold; letter-spacing:5px; margin-bottom:20px; text-shadow:0 0 15px #00ffcc; animation: pulse 1s infinite;">
                NEURAL LINK INITIALIZING...
            </div>
            <div id="dive-progress" style="width:300px; height:2px; background:#111; position:relative; box-shadow:0 0 10px rgba(0,255,204,0.2);">
                <div id="dive-bar" style="width:0%; height:100%; background:#00ffcc; box-shadow:0 0 15px #00ffcc; transition:width 2s cubic-bezier(0.4, 0, 0.2, 1);"></div>
            </div>
            <div style="margin-top:15px; font-size:10px; color:#00ffcc; opacity:0.5;">[ CONNECTING TO VISUAL CORTEX ]</div>
        `;
        
        document.body.appendChild(overlay);

        // 接続用の高周波サウンド
        if (window.universeAudio) window.universeAudio.playSystemSound(800, 'sine', 2.0, 1600);

        setTimeout(() => {
            document.getElementById('dive-bar').style.width = '100%';
        }, 100);

        setTimeout(() => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                overlay.remove();
                onComplete();
            }, 500);
        }, 2100);
    }

    // 💀 VRゴーグル非検知時のカッコいいエラー画面
    static showDiveError() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(20,0,0,0.95); z-index:100000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#ff4444; font-family:monospace; backdrop-filter:blur(10px);';
        
        overlay.innerHTML = `
            <div style="font-size:40px; margin-bottom:10px; text-shadow:0 0 20px #ff4444;">⚠️</div>
            <div style="font-size:20px; font-weight:bold; letter-spacing:3px; margin-bottom:15px; text-shadow:0 0 15px #ff4444;">
                NEURAL LINK FAILED
            </div>
            <div style="font-size:12px; color:#aaa; text-align:center; line-height:1.8; padding:20px; border:1px dashed #ff4444; background:rgba(255,0,0,0.05);">
                生体ポートへのWebXRアクセスが拒否されました。<br>
                <span style="color:#ff8888;">[ERR_NO_HMD_DETECTED]</span><br><br>
                ※Meta Quest等のHMD、またはWebXR対応のブラウザから<br>再接続を試みてください。
            </div>
            <button id="dive-error-close" style="margin-top:30px; padding:12px 40px; background:#330000; border:1px solid #ff4444; color:#ff4444; cursor:pointer; border-radius:4px; font-weight:bold; letter-spacing:2px; box-shadow:0 0 15px rgba(255,0,0,0.3);">ABORT (切断)</button>
        `;
        
        document.body.appendChild(overlay);

        // 接続失敗のエラー音
        if (window.universeAudio) window.universeAudio.playSystemSound(150, 'sawtooth', 0.4);
        if (window.HapticEngine) window.HapticEngine.playError();

        document.getElementById('dive-error-close').onclick = () => {
            overlay.remove();
        };
    }
}