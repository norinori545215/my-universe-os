// src/ai/ChaosGen.js
import { NeuralCore } from './NeuralCore.js';
import { NexusP2P } from '../api/NexusP2P.js';

export class ChaosGen {
    /**
     * 指定した星（ノード）のキーワードと記憶（ノート）から、
     * ローカルAIが本物の関連概念やストーリー分岐を生成して軌道に乗せる
     */
    static async expand(node, app) {
        if (!node || !node.name) return;

        // AIエンジンが起動しているかチェック
        if (!NeuralCore.isReady) {
            alert("⚠️ 脳髄（AIコア）が起動していません。\nコントロールパネルの「創造」タブから「完全オフラインAIを構築」を実行してください。");
            return;
        }

        const originalName = node.name;
        const originalColor = node.color;
        
        // 演出：AIが思考中のステータスに変更
        node.name = "🧠 解析・分岐中...";
        node.color = "#ff00ff";
        app.autoSave();
        
        if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
        this.showToast(`🧠 「${originalName}」の可能性をAIが演算中...`, '#ff00ff');

        // ★ AIへの命令をさらに厳格化
        const prompt = `
        あなたはアイデア発想AIです。以下のデータから連想される【新しいアイデア】や【IF展開】を「3つ」考えてください。
        
        【データ】
        タイトル: ${originalName}
        詳細: ${node.note || 'なし'}

        【重要ルール】
        必ず以下のJSON配列フォーマット「のみ」を出力してください。
        マークダウン（\`\`\`json など）や説明文は絶対に書かないでください。
        [
          { "name": "短い単語やタイトル", "note": "詳しい説明や展開" },
          { "name": "...", "note": "..." },
          { "name": "...", "note": "..." }
        ]
        `;

        try {
            const messages = [
                { role: "system", content: "あなたはJSON配列のみを出力するシステムです。説明文やマークダウンは一切出力しません。" },
                { role: "user", content: prompt }
            ];

            // GPUを使ってローカルAIに思考させる
            const reply = await NeuralCore.engine.chat.completions.create({
                messages,
                temperature: 0.8, // 創造性を高めに設定
                max_tokens: 800
            });

            let answer = reply.choices[0].message.content;
            console.log("🤖 AI Raw Output:", answer); // デバッグ用：AIの生の返答をコンソールに出力

            // ★ 強力なJSONクレンジング処理
            // AIが勝手に付けた ```json などのマークダウンを取り除く
            answer = answer.replace(/```json/gi, "").replace(/```/g, "").trim();
            
            // 最初の [ から 最後の ] までを強制的に切り抜く
            const startIndex = answer.indexOf('[');
            const endIndex = answer.lastIndexOf(']');
            
            if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
                throw new Error("AIが配列フォーマット( [ ] )を返しませんでした。");
            }
            
            const jsonString = answer.substring(startIndex, endIndex + 1);
            
            let generatedTerms;
            try {
                // 切り抜いた文字列をJavaScriptのデータに変換
                generatedTerms = JSON.parse(jsonString);
            } catch (parseError) {
                console.error("Parse Error Detail:", parseError, "Target String:", jsonString);
                throw new Error("AIの返答に文法エラーが含まれています。");
            }

            // --- ここから下は成功時の処理 ---
            
            // 親星の名前と色を元に戻し、拡張完了の証としてゴールドにする
            node.name = originalName;
            node.color = "#ffcc00"; 

            // 生成された概念を星として配置し、親星とリンク（結合）させる
            const angleStep = (Math.PI * 2) / generatedTerms.length;
            const orbitRadius = (node.size || 20) + 120; // 親星からの距離

            generatedTerms.forEach((term, index) => {
                const angle = index * angleStep;
                const nx = node.baseX + Math.cos(angle) * orbitRadius;
                const ny = node.baseY + Math.sin(angle) * orbitRadius;
                
                // 新しい星を創造（AIが作った星は紫色の円形にする）
                app.currentUniverse.addNode(term.name, nx, ny, 18, '#ff00ff', 'circle');
                const newNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                
                // AIが考えた詳しい説明をノート（記憶）に書き込む
                newNode.note = term.note;
                
                // P2P同期用のIDを付与
                newNode.id = 'ai_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

                // 親星と重力リンクで結ぶ
                app.currentUniverse.addLink(node, newNode);

                // 共有空間（P2P）にいる場合は、相手の画面にも新しい星を同期させる
                if (NexusP2P && NexusP2P.onNodeAdded) NexusP2P.onNodeAdded(newNode);
            });

            app.autoSave();
            
            // 完了エフェクト
            if (app.simulation) app.simulation.alpha(1).restart();
            app.spawnRipple(node.x, node.y, '#ff00ff', true);
            if (window.universeAudio) window.universeAudio.playSpawn();
            if (window.universeLogger) window.universeLogger.log("NEURAL_EXPANSION", { target: originalName, generated: generatedTerms.length });
            
            this.showToast(`✨ 3つの新しい可能性が分岐しました`, '#00ffcc');

        } catch (err) {
            console.error(err);
            // エラー時は元の名前に戻す
            node.name = originalName; 
            node.color = originalColor;
            app.autoSave();
            alert(`🚨 思考拡張エラー:\n${err.message}\n（※AIの出力が乱れました。もう一度ボタンを押すと成功しやすいです！）`);
        }
    }

    // 画面下部にシステムメッセージを出すUI
    static showToast(msg, color) {
        const toast = document.createElement('div');
        toast.innerHTML = msg;
        toast.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(10, 0, 20, 0.9); color: ${color};
            border: 1px solid ${color}; border-radius: 8px;
            padding: 12px 24px; font-size: 14px; font-weight: bold; z-index: 999999;
            box-shadow: 0 0 20px rgba(${color === '#ff00ff' ? '255,0,255' : '0,255,204'}, 0.4);
            transition: opacity 0.3s; pointer-events: none; letter-spacing: 1px;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = '0', 3000);
        setTimeout(() => toast.remove(), 3300);
    }
}