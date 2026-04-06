// src/ai/WanderingEntities.js

export class WanderingEntities {
    static start(app) {
        console.log("🤖 [WanderingEntities] 自律型AIエンティティ・プロトコル起動");
        
        // 約30FPS（30ms間隔）で全AIエンティティの座標を更新する
        setInterval(() => {
            if (!app.currentUniverse || !app.currentUniverse.nodes) return;
            
            let hasEntity = false;

            app.currentUniverse.nodes.forEach(node => {
                if (node.isEntity && !node.isGhost) {
                    hasEntity = true;

                    // 速度の初期化
                    if (typeof node.vx !== 'number') node.vx = (Math.random() - 0.5) * 2;
                    if (typeof node.vy !== 'number') node.vy = (Math.random() - 0.5) * 2;
                    
                    // ★修正1: 物理エンジン（重力）に逆らって強制移動させるため、固定座標(fx, fy)を直接書き換える
                    const speed = 1.5;
                    node.x += node.vx * speed;
                    node.y += node.vy * speed;
                    node.fx = node.x; 
                    node.fy = node.y; 
                    
                    // 画面外に逃亡しないよう、中心（カメラ位置）へうっすら引き戻す引力
                    if (app.camera) {
                        const targetX = -app.camera.x;
                        const targetY = -app.camera.y;
                        node.vx += (targetX - node.x) * 0.0005;
                        node.vy += (targetY - node.y) * 0.0005;
                    }

                    // 時々ランダムに方向転換
                    if (Math.random() < 0.05) {
                        node.vx = (Math.random() - 0.5) * 3;
                        node.vy = (Math.random() - 0.5) * 3;
                    }
                    
                    // 活動中アピールとして波紋を出す（1%の確率）
                    if (Math.random() < 0.01 && app.spawnRipple) {
                        app.spawnRipple(node.x, node.y, node.color || '#ff00ff');
                    }

                    // 時々独り言を喋る
                    if (Math.random() < 0.01) {
                        if (!node.originalName) node.originalName = node.name;
                        const quotes = ["「データ収集…」", "「パトロール中…」", "「異常なし」", "「ゴーストが囁く…」", "「zzz...」"];
                        node.name = quotes[Math.floor(Math.random() * quotes.length)];
                        
                        setTimeout(() => {
                            if (node && node.originalName) node.name = node.originalName;
                        }, 2000);
                    }
                }
            });

            // ★修正2: AIが存在する間は、省エネモードを無効化し、Canvasを強制的に再描画し続ける
            if (hasEntity) {
                if (typeof app.draw === 'function') app.draw();
                if (typeof app.render === 'function') app.render();
                if (typeof app.update === 'function') app.update();
                // 物理エンジン(D3.js等)が動いている場合は、シミュレーションに熱を持たせて画面を動かす
                if (app.simulation) app.simulation.alpha(0.1).restart();
            }

        }, 30); 
    }

    static spawn(app) {
        const cx = app.camera ? -app.camera.x : 0;
        const cy = app.camera ? -app.camera.y : 0;
        
        const names = ["Think-Tank", "Tachikoma", "Crawler_Ghost", "Wanderer"];
        const name = names[Math.floor(Math.random() * names.length)];
        
        app.currentUniverse.addNode(`🤖 ${name}`, cx, cy, 20, '#ff00ff', 'star');
        
        // 生成したばかりの最新の星を取得する
        const node = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
        
        node.isEntity = true;
        node.originalName = `🤖 ${name}`;
        node.vx = (Math.random() - 0.5) * 4;
        node.vy = (Math.random() - 0.5) * 4;
        node.note = "私は自律型思考ノードです。\nこの宇宙を永遠にパトロールしています。\n※私を消去(収納)するとパトロールは停止します。";
        
        app.autoSave();
        
        if (window.universeAudio) window.universeAudio.playSpawn();
        
        alert(`自律型AIエンティティ「${name}」を宇宙に放ちました！\n画面内を勝手に動き回り、時々独り言を喋ります。`);
    }
}