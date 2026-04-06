// src/api/RealityBridge.js

export class RealityBridge {
    // 外部APIから現実のデータ（Bitcoin価格）を取得
    static async fetchCryptoData() {
        try {
            // CoinDeskの公開APIを使用（APIキー不要）
            const res = await fetch('https://api.coindesk.com/v1/bpi/currentprice/JPY.json');
            const data = await res.json();
            return {
                price: data.bpi.JPY.rate_float,
                time: data.time.updated
            };
        } catch (e) {
            console.error("📡 [RealityBridge] 外部APIとの通信が遮断されました:", e);
            return null;
        }
    }

    // 取得したデータを使って「星」を生成・更新する
    static async syncCryptoStar(app) {
        console.log("🌐 [RealityBridge] 現実世界との同期を開始...");
        
        const crypto = await this.fetchCryptoData();
        if (!crypto) {
            alert("現実世界（API）とのリンクに失敗しました。");
            return;
        }

        // 価格をカンマ区切りに整形
        const priceFormatted = Math.floor(crypto.price).toLocaleString();
        const nodeName = `₿ BTC: ¥${priceFormatted}`;
        const noteData = `=== REALITY BRIDGE ===\nBitcoin Current Price\n¥${priceFormatted}\nLast Update: ${crypto.time}\n\n※この星は現実世界のデータと同期しています。`;

        // 既にBTCの星が存在するか探す
        let btcNode = app.currentUniverse.nodes.find(n => n.name.startsWith('₿ BTC'));

        if (btcNode) {
            // 存在する場合はデータを更新し、波紋（Ripple）を発生させる
            btcNode.name = nodeName;
            btcNode.note = noteData;
            // 価格の端数に応じて星のサイズが微変動する（脈動の演出）
            btcNode.size = Math.min(80, Math.max(30, 30 + (crypto.price % 100000) / 2000)); 
            
            if (app.spawnRipple) app.spawnRipple(btcNode.x, btcNode.y, '#ffcc00');
            console.log(`[RealityBridge] 星のデータを更新: ${nodeName}`);
        } else {
            // 存在しない場合はカメラの中央に新規スポーン
            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;
            btcNode = app.currentUniverse.addNode(nodeName, cx, cy, 40, '#ffcc00', 'star');
            btcNode.note = noteData;
            console.log(`[RealityBridge] 新たな現実の星を生成: ${nodeName}`);
        }

        app.autoSave();
        
        // HapticEngineが組み込まれた生成音を鳴らす
        if (window.universeAudio) window.universeAudio.playSpawn();
    }
}