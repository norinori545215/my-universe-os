// src/core/PocketManager.js

export class PocketManager {
    /**
     * 複数の星を一括で亜空間（ブラックホール）へ送る
     * @param {Object} app - CanvasBuilder (this.app)
     * @param {Array} targetNodes - 消去対象の星の配列
     */
    static massBanish(app, targetNodes) {
        if (!targetNodes || targetNodes.length === 0) return 0;
        
        let count = 0;
        targetNodes.forEach(node => {
            // ゴーストリンクを完全に切断
            app.currentUniverse.links = app.currentUniverse.links.filter(l => 
                l.source !== node && l.target !== node && l.source.id !== node.id && l.target.id !== node.id
            );
            // 宇宙から除去してブラックホールへ
            app.currentUniverse.nodes = app.currentUniverse.nodes.filter(n => n !== node && n.id !== node.id);
            app.blackHole.push(node);
            node.isSelected = false; // 選択状態を解除
            count++;
        });

        app.autoSave();
        if (window.universeAudio) window.universeAudio.playDelete(); // 爆発音
        if (window.universeLogger) window.universeLogger.log("MASS_BANISH", { count: count });
        return count;
    }

    /**
     * 複数の星を一括で封印（パスワードロック等への布石）
     */
    static massSeal(app, targetNodes) {
        if (!targetNodes || targetNodes.length === 0) return 0;

        targetNodes.forEach(node => {
            node.isLocked = !node.isLocked; // ロック状態を反転
            node.isSelected = false;
        });

        app.autoSave();
        if (window.universeAudio) window.universeAudio.playSystemSound(500, 'square', 0.1);
        if (window.universeLogger) window.universeLogger.log("MASS_SEAL", { count: targetNodes.length });
        return targetNodes.length;
    }

    /**
     * 画面内のすべての星を選択状態にする（全選択）
     */
    static selectAll(app) {
        app.currentUniverse.nodes.forEach(node => {
            node.isSelected = true;
        });
        if (window.universeLogger) window.universeLogger.log("SELECT_ALL", { count: app.currentUniverse.nodes.length });
    }

    /**
     * 選択をすべて解除する
     */
    static clearSelection(app) {
        app.currentUniverse.nodes.forEach(node => {
            node.isSelected = false;
        });
    }
}