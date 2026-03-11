// src/engine/AutoPilot.js

export class AutoPilot {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.sequenceTimer = null;
        this.step = 0;
        
        this.bindEvents();
    }

    bindEvents() {
        // マウスやタッチ操作が行われたら、進行中の自動プレゼンを即座に中止する
        const stop = () => {
            if(this.isRunning) this.stop();
        };
        window.addEventListener('mousemove', stop);
        window.addEventListener('mousedown', stop);
        window.addEventListener('touchstart', stop);
        window.addEventListener('keydown', stop);
        window.addEventListener('wheel', stop);
    }

    start() {
        // 編集中やリンクモード中は発動させない
        if (this.isRunning || this.app.appMode !== 'RUN') return;
        
        this.isRunning = true;
        this.step = 0;
        
        // ターミナルに自動操縦開始のログを出力
        if (window.universeLogger) window.universeLogger.log("SYSTEM", { msg: "Auto-Pilot Engaged" });
        
        // 最初のプレゼンシーケンスを開始
        this.runSequence();
    }

    stop() {
        this.isRunning = false;
        if (this.sequenceTimer) clearTimeout(this.sequenceTimer);
        
        // カメラのズームを戻し、UIを閉じる
        if (this.app.camera) this.app.camera.targetScale = 1;
        if (this.app.ui && this.app.ui.hideQuickNote) this.app.ui.hideQuickNote();
        
        if (window.universeLogger) window.universeLogger.log("SYSTEM", { msg: "Manual Control Restored" });
    }

    runSequence() {
        if (!this.isRunning) return;

        const nodes = this.app.currentUniverse.nodes;
        if (!nodes || nodes.length === 0) {
            // 星がない場合は2秒後に再試行
            this.sequenceTimer = setTimeout(() => this.runSequence(), 2000);
            return;
        }

        // 次にハイライトするターゲット星を順番に決定
        const targetNode = nodes[this.step % nodes.length];
        
        // 1. カメラをターゲットの星へ滑らかに移動
        if (this.app.camera) {
            this.app.camera.targetX = -targetNode.x;
            this.app.camera.targetY = -targetNode.y;
            // 2. 星に少しズームイン（没入感）
            this.app.camera.targetScale = 1.3;
        }
        
        // 3. エフェクトと音響の発生
        if (this.app.spawnRipple) this.app.spawnRipple(targetNode.x, targetNode.y, targetNode.color, true);
        if (window.universeAudio) window.universeAudio.playSystemSound(500, 'sine', 0.1);

        // 4. 星の記憶（ノート）を画面中央に自動で展開して見せる
        if (this.app.ui && this.app.ui.showQuickNote) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2 - 80;
            this.app.ui.showQuickNote(targetNode, cx, cy);
        }

        this.step++;

        // 3秒間その星を見せた後、次のアクションへ移る
        this.sequenceTimer = setTimeout(() => {
            if (!this.isRunning) return;
            
            // いったんズームアウトしてUIを閉じる
            if (this.app.camera) this.app.camera.targetScale = 1.0;
            if (this.app.ui && this.app.ui.hideQuickNote) this.app.ui.hideQuickNote();
            
            // 2秒のインターバルを置いて次の星へ
            this.sequenceTimer = setTimeout(() => this.runSequence(), 2000);
        }, 3000);
    }
}