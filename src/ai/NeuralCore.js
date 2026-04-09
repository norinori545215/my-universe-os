// src/ai/NeuralCore.js

export class NeuralCore {
    static engine = null;
    static isReady = false;
    static isDownloading = false;

    // isSilentフラグを追加し、裏側での自動再起動に対応
    static async boot(app = null, isSilent = false) {
        if (this.isReady) {
            if (!isSilent && app) this.spawnBrain(app);
            return true;
        }
        if (this.isDownloading) {
            if (!isSilent) alert("⏳ 現在ニューラルネットを構築中です...");
            return false;
        }
        if (!navigator.gpu) {
            if (!isSilent) alert("⚠️ お使いのブラウザはWebGPUをサポートしていません。");
            return false;
        }

        this.isDownloading = true;
        const modelId = "Llama-3.2-1B-Instruct-q4f16_1-MLC"; 
        
        const progressUI = document.createElement('div');
        progressUI.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(20, 0, 30, 0.9); border: 1px solid #ff00ff; border-radius: 8px;
            padding: 15px; color: #ff00ff; font-weight: bold; z-index: 999999;
            box-shadow: 0 0 20px rgba(255, 0, 255, 0.5); text-align: center;
        `;
        if (!isSilent) document.body.appendChild(progressUI);

        try {
            if (!isSilent) progressUI.innerHTML = `📡 AIエンジン (Web-LLM) 起動中...`;
            const webllm = await import("https://esm.run/@mlc-ai/web-llm");

            const initProgressCallback = (initProgress) => {
                if (!isSilent) {
                    progressUI.innerHTML = `
                        🧠 脳髄データをGPUに展開中... ${Math.round(initProgress.progress * 100)}%<br>
                        <span style="font-size:10px; color:#888;">${initProgress.text}</span>
                    `;
                }
            };

            this.engine = new webllm.MLCEngine();
            this.engine.setInitProgressCallback(initProgressCallback);
            
            await this.engine.reload(modelId);
            
            this.isReady = true;
            progressUI.remove();
            
            if (!isSilent) {
                if(window.universeAudio) window.universeAudio.playSystemSound(880, 'sine', 0.5, 500);
                alert("✅ 完全オフライン・ニューラルネットの構築が完了しました！");
                if (app) this.spawnBrain(app);
            }
            return true;
        } catch (err) {
            console.error(err);
            progressUI.remove();
            if (!isSilent) alert(`🚨 起動エラー:\n${err.message}`);
            return false;
        } finally {
            this.isDownloading = false;
        }
    }

    static spawnBrain(app) {
        const cx = app.camera ? -app.camera.x : 0;
        const cy = app.camera ? -app.camera.y : 0;
        app.currentUniverse.addNode('ローカルAIコア', cx, cy, 35, '#ff00ff', 'diamond');
        const brain = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
        brain.isAI = true; 
        brain.note = "システム：私はあなたのPC内で稼働するローカルAIです。対話履歴はここに記憶されます。";
        app.autoSave();
        if(window.universeAudio) window.universeAudio.playSpawn();
    }

    static async chat(node, userMessage, uiCallback) {
        // ★ リロード後など、脳が消えている場合は裏側で自動再起動する
        if (!this.isReady) {
            uiCallback("⚠️ AIがスリープしています。自動で再起動します（数秒お待ちください）...");
            const success = await this.boot(null, true);
            if (!success) {
                uiCallback("❌ AIの再起動に失敗しました。コントロールパネルから手動で起動してください。");
                return;
            }
        }
        
        try {
            const messages = [
                { role: "system", content: "あなたはユーザーのプライベートOS内で稼働する優秀なアシスタントAIです。日本語で短く簡潔に答えてください。" },
                { role: "user", content: userMessage }
            ];
            
            const reply = await this.engine.chat.completions.create({
                messages,
                temperature: 0.7,
                max_tokens: 512 // ★ GPUのフリーズを防ぐため、一度の回答文字数にリミッターをかける
            });
            
            const answer = reply.choices[0].message.content;
            uiCallback(answer);
        } catch (err) {
            console.error(err);
            uiCallback(`🚨 GPUエラー: 一度ブラウザをリロードしてください。\n(${err.message})`);
        }
    }
}