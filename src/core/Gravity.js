// src/core/Gravity.js

export class Gravity {
    // ★ 進行中のアニメーションを管理する特異点（辞書）
    static activeAnimations = new Map();
    static isLoopRunning = false;

    /**
     * 宇宙の星々を指定の陣形（フォーメーション）に整列させます
     * @param {Array} nodes - 現在の宇宙にある星の配列
     * @param {String} type - 'circle' | 'spiral' | 'grid'
     */
    static applyFormation(nodes, type = 'circle') {
        if (!nodes || nodes.length === 0) return;

        const centerX = 0;
        const centerY = 0;
        const spacing = 120; // 星同士の間隔

        nodes.forEach((node, index) => {
            let targetX = node.baseX;
            let targetY = node.baseY;

            // 陣形の計算
            switch (type) {
                case 'circle':
                    // 円形配置（曼荼羅）
                    const angle = (index / nodes.length) * Math.PI * 2;
                    const radius = Math.max(150, nodes.length * 20); // 星が多いほど大きな円に
                    targetX = centerX + Math.cos(angle) * radius;
                    targetY = centerY + Math.sin(angle) * radius;
                    break;
                    
                case 'spiral':
                    // 螺旋配置（銀河系）
                    const spiralAngle = index * 0.8;
                    const spiralRadius = 50 + index * 25;
                    targetX = centerX + Math.cos(spiralAngle) * spiralRadius;
                    targetY = centerY + Math.sin(spiralAngle) * spiralRadius;
                    break;
                    
                case 'grid':
                    // 格子状配置（データマトリクス）
                    const cols = Math.ceil(Math.sqrt(nodes.length));
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    targetX = centerX + (col - cols / 2) * spacing;
                    targetY = centerY + (row - cols / 2) * spacing;
                    break;
            }

            // ★ 修正点：個別にループを作らず、アニメーションキュー（Map）に登録するだけ
            this.activeAnimations.set(node.id, {
                node,
                startX: node.baseX,
                startY: node.baseY,
                targetX,
                targetY,
                startTime: performance.now(),
                duration: 1200
            });
        });

        // マスタークロックが止まっていれば再起動
        if (!this.isLoopRunning) {
            this.startMasterClock();
        }
    }

    /**
     * ★ 追加：単一のマスタークロック（153bpmのUIスレッドを保護）
     */
    static startMasterClock() {
        this.isLoopRunning = true;
        // 滑らかに減速する計算式（Ease Out Quart）
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

        const tick = (currentTime) => {
            let stillAnimating = false;

            this.activeAnimations.forEach((anim, id) => {
                let elapsed = currentTime - anim.startTime;
                if (elapsed >= anim.duration) {
                    // 到達完了
                    anim.node.baseX = anim.targetX;
                    anim.node.baseY = anim.targetY;
                    this.activeAnimations.delete(id); // キューから削除
                } else {
                    // 移動中
                    const progress = elapsed / anim.duration;
                    const ease = easeOutQuart(progress);
                    
                    // 星の基準座標を少しずつ書き換える
                    anim.node.baseX = anim.startX + (anim.targetX - anim.startX) * ease;
                    anim.node.baseY = anim.startY + (anim.targetY - anim.startY) * ease;
                    stillAnimating = true;
                }
            });

            // まだ動いている星があれば次のフレームを要求、なければ完全停止
            if (stillAnimating) {
                requestAnimationFrame(tick);
            } else {
                this.isLoopRunning = false;
            }
        };
        requestAnimationFrame(tick);
    }
}