// src/ai/ChaosGen.js

export class ChaosGen {
    /**
     * 指定した星（ノード）のキーワードから、AIが関連概念を生成して軌道に乗せる
     */
    static async expand(node, app) {
        if (!node || !node.name) return;

        const originalName = node.name;
        
        // 演出：AIが思考中のステータスに変更
        node.name = "🧠 解析中...";
        node.color = "#ff00ff";
        app.autoSave();
        if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);

        // 思考の遅延をシミュレート（1.5秒）
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 関連キーワードを生成（※ここではポートフォリオですぐ動くように高度なモックを使用。本物のAPIに繋ぐことも可能）
        const generatedTerms = this.generateConcepts(originalName);

        // 生成された概念を星として配置し、親星とリンク（結合）させる
        const angleStep = (Math.PI * 2) / generatedTerms.length;
        const orbitRadius = node.size + 100; // 親星からの距離

        generatedTerms.forEach((term, index) => {
            const angle = index * angleStep;
            const nx = node.baseX + Math.cos(angle) * orbitRadius;
            const ny = node.baseY + Math.sin(angle) * orbitRadius;
            
            // 新しい星を創造
            const newNode = app.currentUniverse.addNode(term, nx, ny, 15, '#00ffcc', 'star');
            // 親星と重力リンクで結ぶ
            app.currentUniverse.addLink(node, newNode);
        });

        // 親星の名前と色を元に戻す
        node.name = originalName;
        node.color = "#ffcc00"; // 拡張完了の証としてゴールドに
        app.autoSave();

        // 完了エフェクト
        app.spawnRipple(node.x, node.y, '#ff00ff', true);
        if (window.universeAudio) window.universeAudio.playSpawn();
        if (window.universeLogger) window.universeLogger.log("NEURAL_EXPANSION", { target: originalName, generated: generatedTerms.length });
    }

    /**
     * キーワードから関連語を導き出す辞書アルゴリズム
     */
    static generateConcepts(keyword) {
        const kw = keyword.toLowerCase();
        
        // IT・エンジニア向けのキラーワード辞書
        if (kw.includes('web') || kw.includes('フロント')) return ['React / Vue', 'TypeScript', 'WebAssembly', 'UI/UX Design', 'Vercel / Firebase'];
        if (kw.includes('バック') || kw.includes('サーバー')) return ['Node.js', 'Go', 'Docker / K8s', 'GraphQL', 'AWS / GCP'];
        if (kw.includes('ai') || kw.includes('人工知能')) return ['LLM (大規模言語モデル)', 'LangChain', 'Python', 'Machine Learning', 'Prompt Engineering'];
        if (kw.includes('os') || kw.includes('システム')) return ['Kernel', 'Memory Management', 'File System', 'Security', 'Process'];
        if (kw.includes('デザイン') || kw.includes('ui')) return ['Figma', 'Color Theory', 'Typography', 'Micro Interaction', 'Accessibility'];
        if (kw.includes('ポートフォリオ') || kw.includes('自己pr')) return ['圧倒的技術力', '自走力', '問題解決能力', 'モダンスタック', 'UI/UXへの執念'];
        
        // 当てはまらない場合は汎用的なアイデア拡張を行う
        return [
            `${keyword}の未来`,
            `${keyword}の課題`,
            `${keyword}の自動化`,
            `新しい${keyword}`
        ];
    }
}