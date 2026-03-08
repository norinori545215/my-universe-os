// src/core/TimeMachine.js

export class TimeMachine {
    static history = [];
    static currentIndex = -1;
    static maxHistory = 50; // 最大50回分（50世代）の過去を記憶する

    /**
     * 現在の宇宙の完全なコピー（スナップショット）を歴史に刻む
     */
    static record(universeObj, wormholes, blackHole) {
        // もし過去に戻った状態で新しい操作をした場合、そこから先の未来（枝分かれした歴史）は剪定する
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // 循環参照を断ち切って安全に保存するため、一度軽量なJSON文字列に圧縮する
        const snapshot = this.serialize(universeObj, wormholes, blackHole);

        this.history.push({
            time: Date.now(),
            data: snapshot
        });

        // 記憶容量を超えたら一番古い歴史を忘れる
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this.currentIndex = this.history.length - 1;
    }

    /**
     * 指定した歴史（インデックス）の宇宙データを復元する
     */
    static travel(index) {
        if (index < 0 || index >= this.history.length) return null;
        this.currentIndex = index;
        const historyData = JSON.parse(this.history[index].data);
        return historyData;
    }

    /**
     * 宇宙の複雑なオブジェクトを保存用に軽量化する内部メソッド
     * （DataManagerのsaveロジックを流用した簡易版）
     */
    static serialize(rootUniverse, wormholes, blackHole) {
        const extractNode = (node) => ({
            id: node.id,
            name: node.name,
            x: node.baseX, 
            y: node.baseY,
            size: node.size,
            color: node.color,
            type: node.type,
            url: node.url || null,
            iconUrl: node.iconUrl || null,
            note: node.note || "",
            isLocked: node.isLocked || false,
            innerUniverse: node.innerUniverse ? extractUniverse(node.innerUniverse) : null
        });

        const extractUniverse = (uni) => {
            const nodesData = uni.nodes.map(extractNode);
            const linksData = uni.links.map(l => ({ sourceId: l.source.id, targetId: l.target.id }));
            return { id: uni.id, name: uni.name, type: uni.type, nodes: nodesData, links: linksData };
        };

        const rootData = extractUniverse(rootUniverse);
        const bhData = blackHole.map(extractNode);
        
        return JSON.stringify({
            rootUniverse: rootData,
            blackHole: bhData,
            timestamp: Date.now()
        });
    }

    static getHistoryCount() {
        return this.history.length;
    }
}