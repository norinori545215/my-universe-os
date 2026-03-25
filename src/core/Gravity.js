// src/core/Gravity.js

export class Gravity {
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
                    const angle = (index / nodes.length) * Math.PI * 2;
                    const radius = Math.max(150, nodes.length * 20);
                    targetX = centerX + Math.cos(angle) * radius;
                    targetY = centerY + Math.sin(angle) * radius;
                    break;
                    
                case 'spiral':
                    const spiralAngle = index * 0.8;
                    const spiralRadius = 50 + index * 25;
                    targetX = centerX + Math.cos(spiralAngle) * spiralRadius;
                    targetY = centerY + Math.sin(spiralAngle) * spiralRadius;
                    break;
                    
                case 'grid':
                    const cols = Math.ceil(Math.sqrt(nodes.length));
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    targetX = centerX + (col - cols / 2) * spacing;
                    targetY = centerY + (row - cols / 2) * spacing;
                    break;
            }

            // 個別のループを作らず、マスタークロックのキューに登録
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

        // マスタークロックが停止していれば再点火
        if (!this.isLoopRunning) this.startMasterClock();
    }

    /**
     * 単一の特異点ループ（153bpmのUIスレッドを保護）
     */
    static startMasterClock() {
        this.isLoopRunning = true;
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

        const tick = (currentTime) => {
            let stillAnimating = false;

            this.activeAnimations.forEach((anim, id) => {
                let elapsed = currentTime - anim.startTime;
                
                if (elapsed >= anim.duration) {
                    // 到達完了
                    anim.node.baseX = anim.targetX;
                    anim.node.baseY = anim.targetY;
                    this.activeAnimations.delete(id);
                } else {
                    // 移動中
                    const progress = elapsed / anim.duration;
                    const ease = easeOutQuart(progress);
                    anim.node.baseX = anim.startX + (anim.targetX - anim.startX) * ease;
                    anim.node.baseY = anim.startY + (anim.targetY - anim.startY) * ease;
                    stillAnimating = true;
                }
            });

            if (stillAnimating) {
                requestAnimationFrame(tick);
            } else {
                this.isLoopRunning = false; // 全ての星が定位置に着いたらループ停止
            }
        };
        requestAnimationFrame(tick);
    }
}