// src/ai/NeuralCore.js

export class NeuralCore {
    static engine = null;
    static isReady = false;
    static isDownloading = false;

    static async boot(app) {
        if (this.isReady) {
            this.spawnBrain(app);
            return;
        }
        if (this.isDownloading) {
            alert("⏳ 現在ニューラルネットをダウンロード＆構築中です...");
            return;
        }
        if (!navigator.gpu) {
            alert("⚠️ お使いのブラウザはWebGPUをサポートしていません。\nPC版のChromeまたはEdgeの最新版をご利用ください。");
            return;
        }

        this.isDownloading = true;
        
        // 超軽量で高速なAIモデル（約600MB）を指定
        const modelId = "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC"; 
        
        // プログレスバーUI生成
        const progressUI = document.createElement('div');
        progressUI.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(20, 0, 30, 0.9); border: 1px solid #ff00ff; border-radius: 8px;
            padding: 15px; color: #ff00ff; font-weight: bold; z-index: 999999;
            box-shadow: 0 0 20px rgba(255, 0, 255, 0.5); text-align: center;
        `;
        document.body.appendChild(progressUI);

        try {
            progressUI.innerHTML = `📡 AIエンジン (Web-LLM) を CDNから取得中...`;
            
            // ★ 修正：一番上にあった import をここに移動（動的読み込み）
            // これにより、起動時（ログイン時）のOSクラッシュを完全に防ぎます。
            const webllm = await import("https://esm.run/@mlc.ai/web-llm");

            const initProgressCallback = (initProgress) => {
                progressUI.innerHTML = `
                    🧠 脳髄データをGPUにダウンロード中... ${Math.round(initProgress.progress * 100)}%<br>
                    <span style="font-size:10px; color:#aaa;">初回のみ約600MBの通信が発生します（次回から一瞬で起動します）</span><br>
                    <span style="font-size:10px; color:#888;">${initProgress.text}</span>
                `;
            };

            this.engine = new webllm.MLCEngine();
            this.engine.setInitProgressCallback(initProgressCallback);
            
            // AIモデルのロード開始
            await this.engine.reload(modelId);
            
            this.isReady = true;
            progressUI.remove();
            if(window.universeAudio) window.universeAudio.playSystemSound(880, 'sine', 0.5, 500);
            alert("✅ 完全オフライン・ニューラルネットの構築が完了しました！\nWi-Fiを切っても稼働し続けます。");
            
            this.spawnBrain(app);
        } catch (err) {
            console.error(err);
            progressUI.remove();
            alert(`🚨 ダウンロードエラー:\n${err.message}`);
        } finally {
            this.isDownloading = false;
        }
    }

    static spawnBrain(app) {
        const cx = app.camera ? -app.camera.x : 0;
        const cy = app.camera ? -app.camera.y : 0;
        
        // AIの脳を「ひし形」の星として召喚
        app.currentUniverse.addNode('ローカルAIコア', cx, cy, 35, '#ff00ff', 'diamond');
        const brain = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
        brain.isAI = true; // AIフラグを立てる
        brain.note = "システム：私はあなたのPC内で稼働するローカルAIです。対話履歴はここに記憶されます。";
        app.autoSave();
        
        if(window.universeAudio) window.universeAudio.playSpawn();
    }

    static async chat(node, userMessage, uiCallback) {
        if (!this.isReady) {
            uiCallback("エラー：AIコアが初期化されていません。");
            return;
        }
        try {
            // OS内でAIに与える人格設定
            const messages = [
                { role: "system", content: "あなたはユーザーのプライベートOS内で稼働する優秀なアシスタントAIです。日本語で簡潔に答えてください。" },
                { role: "user", content: userMessage }
            ];
            
            const reply = await this.engine.chat.completions.create({
                messages,
                temperature: 0.7,
            });
            
            const answer = reply.choices[0].message.content;
            uiCallback(answer);
        } catch (err) {
            uiCallback(`エラー: ${err.message}`);
        }
    }
}