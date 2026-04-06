// src/ai/WanderingEntities.js

export class WanderingEntities {
    static start(app) {
        console.log("🤖 [WanderingEntities] 自律型AIエンティティ・プロトコル起動");
        
        setInterval(() => {
            if (!app.currentUniverse || !app.currentUniverse.nodes) return;
            
            let isAiActive = false;

            app.currentUniverse.nodes.forEach(node => {
                // ★修正1: セーブ/ロードしても消えないように「名前の絵文字」でAI判定する
                if (node.name && node.name.includes('🤖')) {
                    isAiActive = true;

                    // AI専用の速度ベクトルを初期化
                    if (typeof node.ai_vx !== 'number') node.ai_vx = (Math.random() - 0.5) * 3;
                    if (typeof node.ai_vy !== 'number') node.ai_vy = (Math.random() - 0.5) * 3;
                    
                    // 座標の更新
                    node.x += node.ai_vx;
                    node.y += node.ai_vy;
                    
                    // ★修正2: 物理エンジン（重力）に引き戻されないように強制固定する
                    node.fx = node.x; 
                    node.fy = node.y; 

                    // 時々ランダムに方向転換
                    if (Math.random() < 0.02) {
                        node.ai_vx = (Math.random() - 0.5) * 4;
                        node.ai_vy = (Math.random() - 0.5) * 4;
                    }
                    
                    // 活動中アピールとして波紋を出す
                    if (Math.random() < 0.02 && app.spawnRipple) {
                        app.spawnRipple(node.x, node.y, '#ff00ff');
                    }

                    // セリフを喋る
                    if (Math.random() < 0.01) {
                        if (!node.originalName) node.originalName = node.name;
                        const quotes = ["🤖「パトロール中」", "🤖「異常なし」", "🤖「データ発見」", "🤖「ゴースト…」", "🤖「zzz...」"];
                        node.name = quotes[Math.floor(Math.random() * quotes.length)];
                        
                        setTimeout(() => {
                            if (node && node.originalName) node.name = node.originalName;
                        }, 2000);
                    }
                }
            });

            // ★究極のハッキング：AIが存在する間、OSに「マウスが動いた」と錯覚させて強制レンダリングさせる
            if (isAiActive) {
                window.dispatchEvent(new Event('mousemove')); // 省エネモードを無効化
                if (app.simulation) app.simulation.alphaTarget(0.1).restart(); // 重力エンジンを温める
            }

        }, 40); 
    }

    static spawn(app) {
        const cx = app.camera ? -app.camera.x : 0;
        const cy = app.camera ? -app.camera.y : 0;
        
        // 🤖マークをつけることで、システムにAIだと認識させる
        app.currentUniverse.addNode(`🤖 Tachikoma`, cx, cy, 25, '#ff00ff', 'star');
        app.autoSave();
        
        if (window.universeAudio) window.universeAudio.playSpawn();
        
        alert("自律型AIエンティティを宇宙に放ちました！");
    }
}