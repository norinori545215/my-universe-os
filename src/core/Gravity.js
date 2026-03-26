// src/core/Gravity.js

export class Gravity {
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

            // スゥーッ…と滑らかに移動させるアニメーションを実行
            this.animateNodeTo(node, targetX, targetY);
        });
    }

    /**
     * イージング関数を用いて、星を目標座標まで滑らかに移動させる
     */
    static animateNodeTo(node, targetX, targetY) {
        const startX = node.baseX;
        const startY = node.baseY;
        const duration = 1200; // 1.2秒かけてゆっくり移動
        const startTime = performance.now();

        // 滑らかに減速する計算式（Ease Out Quart）
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

        const animate = (currentTime) => {
            let elapsed = currentTime - startTime;
            if (elapsed > duration) elapsed = duration;

            const progress = elapsed / duration;
            const ease = easeOutQuart(progress);

            // 星の基準座標を少しずつ書き換える
            node.baseX = startX + (targetX - startX) * ease;
            node.baseY = startY + (targetY - startY) * ease;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }
}