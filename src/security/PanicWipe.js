// src/security/PanicWipe.js

export class PanicWipe {
    static isArmed = false;
    static threshold = 15; // 振りの強さの閾値（環境に合わせて調整）
    static lastUpdate = 0;
    static x = 0; static y = 0; static z = 0;
    static lastX = 0; static lastY = 0; static lastZ = 0;
    static app = null;

    /**
     * パニックプロトコルを起動する（コントロールパネル等から呼ぶ）
     */
    static arm(app) {
        this.app = app;
        
        // iOS13以降はセンサー取得にユーザーの許可（クリックイベント内での発火）が必要
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        this.startListening();
                    } else {
                        alert("⚠️ センサーへのアクセスが拒否されました。パニックプロトコルは起動できません。");
                    }
                })
                .catch(console.error);
        } else {
            // AndroidやPCなど
            this.startListening();
        }
    }

    static startListening() {
        if (this.isArmed) return;
        this.isArmed = true;
        this.motionHandler = this.handleMotion.bind(this);
        window.addEventListener('devicemotion', this.motionHandler, false);
        console.warn("🚨 [SECURITY] Panic Protocol ARMED. デバイスを激しく振ると自爆します。");
    }

    static disarm() {
        if (!this.isArmed) return;
        window.removeEventListener('devicemotion', this.motionHandler, false);
        this.isArmed = false;
        console.log("🟢 [SECURITY] Panic Protocol DISARMED.");
    }

    static handleMotion(event) {
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration) return;

        const currentTime = new Date().getTime();
        
        // 100msごとに加速度をチェック
        if ((currentTime - this.lastUpdate) > 100) {
            const diffTime = currentTime - this.lastUpdate;
            this.lastUpdate = currentTime;

            this.x = acceleration.x || 0;
            this.y = acceleration.y || 0;
            this.z = acceleration.z || 0;

            const speed = Math.abs(this.x + this.y + this.z - this.lastX - this.lastY - this.lastZ) / diffTime * 10000;

            if (speed > this.threshold) {
                this.triggerPurge();
            }

            this.lastX = this.x;
            this.lastY = this.y;
            this.lastZ = this.z;
        }
    }

    /**
     * 絶対防壁：自爆とデータパージ
     */
    static triggerPurge() {
        if (!this.isArmed) return;
        this.disarm(); // 連続発火を防ぐ
        console.error("💥 [SECURITY] PANIC TRIGGERED! PURGING RAM AND STORAGE...");

        // 1. アプリケーションメモリ（RAM）の破壊
        if (this.app && this.app.currentUniverse) {
            this.app.currentUniverse.nodes = [];
            this.app.currentUniverse.links = [];
            this.app.universeHistory = [];
            this.app.blackHole = [];
        }

        // 2. ブラウザストレージの消去
        sessionStorage.clear();
        localStorage.removeItem('my_universe_save_data');
        localStorage.removeItem('universe_panic_armed');

        // 3. UIの強制フラッシュとダミー遷移（Stealth Mode）
        this.executeStealthTransition();
    }

    static executeStealthTransition() {
        // 赤いフラッシュの後、完全に無害な画面に偽装する
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#ff0000; z-index:999999; transition: opacity 0.5s;';
        document.body.appendChild(flash);
        
        if (window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 1.0, 1000);

        setTimeout(() => {
            // ダミー画面（Google）へ強制リダイレクト
            window.location.replace("https://www.google.com");
        }, 500);
    }
}