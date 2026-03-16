// src/core/Pathways.js

export class Pathways {
    /**
     * 空間内の星の距離を計算し、近い星同士を自動でリンクして「星座」を構築する
     * @param {Object} universe - 対象の宇宙（this.app.currentUniverse）
     * @param {Number} maxDistance - リンクを張る最大距離（ピクセル）
     * @returns {Number} 新しく作成されたリンクの数
     */
    static autoConstellation(universe, maxDistance = 280) {
        let linkCount = 0;
        const nodes = universe.nodes;

        // すべての星の組み合わせの距離を総当たりで計算
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const n1 = nodes[i];
                const n2 = nodes[j];

                const x1 = n1.baseX !== undefined ? n1.baseX : n1.x;
                const y1 = n1.baseY !== undefined ? n1.baseY : n1.y;
                const x2 = n2.baseX !== undefined ? n2.baseX : n2.x;
                const y2 = n2.baseY !== undefined ? n2.baseY : n2.y;

                const distance = Math.hypot(x1 - x2, y1 - y2);

                // 距離が規定値以内の場合、リンクを構築
                if (distance <= maxDistance) {
                    const exists = universe.links.some(l => 
                        (l.source === n1 && l.target === n2) ||
                        (l.source === n2 && l.target === n1) ||
                        (l.source.id && l.source.id === n1.id && l.target.id === n2.id) ||
                        (l.source.id && l.source.id === n2.id && l.target.id === n1.id)
                    );

                    if (!exists) {
                        universe.addLink(n1, n2);
                        linkCount++;
                    }
                }
            }
        }
        return linkCount;
    }
}