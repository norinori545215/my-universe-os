// src/api/RealityBridge.js

export class RealityBridge {
    // 外部APIから現実のデータ（Bitcoin価格）を取得（複数経路のフォールバック付き）
    static async fetchCryptoData() {
        try {
            // 第1経路: CoinDesk API
            const res = await fetch('https://api.coindesk.com/v1/bpi/currentprice/JPY.json', { cache: 'no-store' });
            if (!res.ok) throw new Error(`CoinDesk HTTP Error: ${res.status}`);
            const data = await res.json();
            return {
                price: data.bpi.JPY.rate_float,
                time: data.time.updated
            };
        } catch (e) {
            console.warn("📡 [RealityBridge] 第1経路(CoinDesk)の通信に失敗。第2経路へ切り替えます...", e.message);
            
            try {
                // 第2経路: CoinGecko API (フォールバック)
                const res2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy', { cache: 'no-store' });
                if (!res2.ok) throw new Error(`CoinGecko HTTP Error: ${res2.status}`);
                const data2 = await res2.json();
                return {
                    price: data2.bitcoin.jpy,
                    time: new Date().toISOString() // 現在時刻
                };
            } catch (e2) {
                console.error("📡 [RealityBridge] 全ての外部通信が遮断されました。シミュレーションモードに移行します。");
                return null; // 全滅時はnullを返す
            }
        }
    }

    // 取得したデータを使って「星」を生成・更新する
    static async syncCryptoStar(app) {
        console.log("🌐 [RealityBridge] 現実世界との同期を開始...");
        
        let crypto = await this.fetchCryptoData();
        let isOffline = false;

        // 通信が完全遮断された場合の「オフライン・シミュレーション」
        if (!crypto) {
            isOffline = true;
            crypto = {
                price: Math.floor(Math.random() * 2000000) + 10000000, // 1000万〜1200万の仮想価格
                time: "OFFLINE SIMULATION"
            };
        }

        // 価格をカンマ区切りに整形
        const priceFormatted = Math.floor(crypto.price).toLocaleString();
        
        // オフライン時は名前と色を変えて警告する
        const nodeName = isOffline ? `⚠️ BTC (仮想): ¥${priceFormatted}` : `₿ BTC: ¥${priceFormatted}`;
        const nodeColor = isOffline ? '#ff4444' : '#ffcc00';
        
        const noteData = `=== REALITY BRIDGE ===\nBitcoin Current Price\n¥${priceFormatted}\nLast Update: ${crypto.time}\n\n${isOffline ? '🚨 現在オフラインのため、量子シミュレーションによる仮想価格を表示しています。' : '※この星は現実世界のデータと同期しています。'}`;

        // 既にBTCの星が存在するか探す（名前に'BTC'が含まれる星）
        let btcNode = app.currentUniverse.nodes.find(n => n.name.includes('BTC'));

        if (btcNode) {
            // 存在する場合はデータを更新し、波紋（Ripple）を発生させる
            btcNode.name = nodeName;
            btcNode.note = noteData;
            btcNode.color = nodeColor;
            // 価格の端数に応じて星のサイズが微変動する
            btcNode.size = Math.min(80, Math.max(30, 30 + (crypto.price % 100000) / 2000)); 
            
            if (app.spawnRipple) app.spawnRipple(btcNode.x, btcNode.y, nodeColor);
            console.log(`[RealityBridge] 星のデータを更新: ${nodeName}`);
        } else {
            // 存在しない場合はカメラの中央に新規スポーン
            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;
            btcNode = app.currentUniverse.addNode(nodeName, cx, cy, 40, nodeColor, 'star');
            btcNode.note = noteData;
            console.log(`[RealityBridge] 新たな現実の星を生成: ${nodeName}`);
        }

        app.autoSave();
        
        // 生成・更新音
        if (window.universeAudio) {
            if (isOffline) window.universeAudio.playSystemSound(200, 'sawtooth', 0.3); // オフライン時は低いエラー音
            else window.universeAudio.playSpawn(); // 成功時は綺麗な音
        }
    }
}