// src/core/Pathways.js

export class Pathways {
    /**
     * 指定した星（中心星）から、特定の距離内にある星を自動的に線で結ぶ（星座構築）
     * @param {Object} app - CanvasBuilder
     * @param {Object} centerNode - 中心となる星
     * @param {Number} maxDistance - リンクを張る最大距離
     */
    static autoConstellation(app, centerNode, maxDistance = 200) {
        if (!centerNode) return;
        let linkCount = 0;

        app.currentUniverse.nodes.forEach(targetNode => {
            if (targetNode === centerNode) return;

            // 中心星との距離を計算
            const dx = targetNode.baseX - centerNode.baseX;
            const dy = targetNode.baseY - centerNode.baseY;
            const distance = Math.hypot(dx, dy);

            // 距離が条件を満たす場合、リンクを作成
            if (distance <= maxDistance) {
                // すでにリンクが存在するかチェック
                const exists = app.currentUniverse.links.some(l => 
                    (l.source === centerNode && l.target === targetNode) ||
                    (l.source === targetNode && l.target === centerNode) ||
                    (l.source.id === centerNode.id && l.target.id === targetNode.id) ||
                    (l.source.id === targetNode.id && l.target.id === centerNode.id)
                );

                if (!exists) {
                    app.currentUniverse.addLink(centerNode, targetNode);
                    linkCount++;
                }
            }
        });

        if (linkCount > 0) {
            app.autoSave();
            if (window.universeAudio) window.universeAudio.playSystemSound(800, 'sine', 0.2); // 構築音
            if (window.universeLogger) window.universeLogger.log("CONSTELLATION_FORMED", { center: centerNode.name, links: linkCount });
        }
    }
}