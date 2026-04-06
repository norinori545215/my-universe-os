// src/ai/WanderingEntities.js

export class WanderingEntities {
    static start(app) {
        console.log("🤖 [WanderingEntities] 自律型AIエンティティ・プロトコル起動");
        
        // 約30FPS（30ms間隔）で全AIエンティティの座標を更新する
        setInterval(() => {
            if (!app.currentUniverse || !app.currentUniverse.nodes) return;
            
            app.currentUniverse.nodes.forEach(node => {
                if (node.isEntity) {
                    // 速度の初期化
                    if (typeof node.vx !== 'number') node.vx = (Math.random() - 0.5) * 2;
                    if (typeof node.vy !== 'number') node.vy = (Math.random() - 0.5) * 2;
                    
                    // 慣性移動
                    node.x += node.vx;
                    node.y += node.vy;
                    
                    // 時々ランダムに方向転換（2%の確率）
                    if (Math.random() < 0.02) {
                        node.vx = (Math.random() - 0.5) * 3;
                        node.vy = (Math.random() - 0.5) * 3;
                    }
                    
                    // 活動中アピールとして波紋を出す（1%の確率）
                    if (Math.random() < 0.01 && app.spawnRipple) {
                        app.spawnRipple(node.x, node.y, node.color || '#00ffcc');
                    }

                    // 時々独り言を喋る（名前に一時的にセリフを入れる）
                    if (Math.random() < 0.005) {
                        const originalName = node.originalName || node.name;
                        if (!node.originalName) node.originalName = node.name;
                        
                        const quotes = [
                            "「データがおいしい…」",
                            "「異常なし。」",
                            "「ここはどこ？」",
                            "「スキャン中…」",
                            "「ゴーストが囁く…」"
                        ];
                        node.name = quotes[Math.floor(Math.random() * quotes.length)];
                        
                        // 3秒後に元の名前に戻す
                        setTimeout(() => {
                            if (node && node.originalName) {
                                node.name = node.originalName;
                            }
                        }, 3000);
                    }
                }
            });
        }, 30); 
    }

    static spawn(app) {
        const cx = app.camera ? -app.camera.x : 0;
        const cy = app.camera ? -app.camera.y : 0;
        
        const names = ["Think-Tank_01", "Tachikoma", "Crawler_Ghost", "Wanderer"];
        const name = names[Math.floor(Math.random() * names.length)];
        
        // 通常の星として生成するが、特別なフラグを立てる
        const node = app.currentUniverse.addNode(`🤖 ${name}`, cx, cy, 20, '#ff00ff', 'star');
        node.isEntity = true; // ★ AI判定フラグ
        node.originalName = `🤖 ${name}`;
        node.vx = (Math.random() - 0.5) * 4;
        node.vy = (Math.random() - 0.5) * 4;
        node.note = "私は自律型思考ノードです。\nこの宇宙を永遠にパトロールしています。\n※私を消去(収納)するとパトロールは停止します。";
        
        app.autoSave();
        
        if(window.universeAudio) window.universeAudio.playSpawn();
        
        alert(`自律型AIエンティティ「${name}」を宇宙に放ちました！\n画面内を勝手に動き回り、時々独り言を喋ります。`);
    }
}