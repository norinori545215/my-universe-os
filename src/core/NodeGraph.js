// src/core/NodeGraph.js
// ★ Firebaseのインポートを完全に削除しました！（絶対主権の確立）

export class EntityNode {
    constructor(name, x, y, size, color, category = 'star') {
        this.id = Math.random().toString(36).substr(2, 9);
        this.name = name;
        this.category = category;
        this.size = size;
        this.color = color;
        this.url = ""; 
        this.iconUrl = "";
        
        // ★ メモ機能：星の中に刻まれるテキストデータ
        this.note = ""; 
        
        // ★ セキュリティ機能：星に鍵をかけるための属性
        this.isLocked = false;       // 鍵がかかっているか
        this.password = "";          // この星専用のパスワード
        this.ownerId = "";           // ※ローカル主権のため、FirebaseのID依存を解除

        this.parentUniverse = null;

        const theme = (category === 'life' || category === 'microbe') ? 'cell' : 'space';
        this.innerUniverse = new Universe(`${name}の内部`, theme);
        
        this.baseX = x; this.baseY = y;
        this.x = x; this.y = y;
        this.randomOffset = Math.random() * Math.PI * 2; 
    }
}

export class Universe {
    constructor(name, theme) {
        this.name = name;
        this.theme = theme;
        this.nodes = [];
        this.links = [];
        this.particles = this.generateParticles(150);
    }

    addNode(name, x, y, size, color, category) {
        const newNode = new EntityNode(name, x, y, size, color, category);
        newNode.parentUniverse = this;
        this.nodes.push(newNode);
        return newNode;
    }

    addLink(nodeA, nodeB) {
        if (nodeA === nodeB) return;
        const exists = this.links.some(l => 
            (l.source.id === nodeA.id && l.target.id === nodeB.id) || 
            (l.source.id === nodeB.id && l.target.id === nodeA.id)
        );
        if (!exists) this.links.push({ source: nodeA, target: nodeB });
    }

    removeNode(nodeToRemove) {
        this.nodes = this.nodes.filter(n => n.id !== nodeToRemove.id);
        this.links = this.links.filter(l => l.source.id !== nodeToRemove.id && l.target.id !== nodeToRemove.id);
    }

    generateParticles(count) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({
                x: (Math.random() - 0.5) * 4000,
                y: (Math.random() - 0.5) * 4000,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.5 + 0.1
            });
        }
        return particles;
    }
}

export const DataManager = {
    // 💾 【完全ローカル保存】
    save: async (rootUniverse, wormholes, blackHole) => {
        const serializeNode = (n) => ({
            id: n.id, name: n.name, category: n.category, size: n.size, color: n.color, 
            url: n.url, iconUrl: n.iconUrl,
            note: n.note, // ★ 保存対象に追加！
            isLocked: n.isLocked, password: n.password, ownerId: n.ownerId,
            baseX: n.baseX, baseY: n.baseY, innerUniverse: serializeUniverse(n.innerUniverse)
        });
        const serializeUniverse = (u) => ({
            name: u.name, theme: u.theme,
            nodes: u.nodes.map(serializeNode),
            links: u.links.map(l => ({ source: l.source.id, target: l.target.id }))
        });

        const data = {
            root: serializeUniverse(rootUniverse),
            wormholes: wormholes.map(w => ({ source: w.source.id, target: w.target.id })),
            blackHole: blackHole.map(serializeNode)
        };

        sessionStorage.setItem('my_universe_save_data', JSON.stringify(data));
    },

    // 💾 【完全ローカル読込】
    load: async () => {
        const raw = sessionStorage.getItem('my_universe_save_data');
        if (!raw) return null;
        
        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            console.error("データのパースに失敗しました", e);
            return null;
        }

        const nodeMap = new Map();

        const parseUniverse = (uData) => {
            const u = new Universe(uData.name, uData.theme);
            uData.nodes.forEach(nData => {
                const node = new EntityNode(nData.name, nData.baseX, nData.baseY, nData.size, nData.color, nData.category);
                node.id = nData.id;
                node.url = nData.url || "";
                node.iconUrl = nData.iconUrl || "";
                node.note = nData.note || ""; // ★ 読み込み対象に追加！
                
                node.isLocked = nData.isLocked || false;
                node.password = nData.password || "";
                node.ownerId = nData.ownerId || "";

                node.parentUniverse = u;
                node.innerUniverse = parseUniverse(nData.innerUniverse);
                u.nodes.push(node);
                nodeMap.set(node.id, node);
            });
            return u;
        };

        const rootUniverse = parseUniverse(data.root);

        const restoreLinks = (u, uData) => {
            uData.links.forEach(lData => {
                const s = nodeMap.get(lData.source);
                const t = nodeMap.get(lData.target);
                if (s && t) u.links.push({ source: s, target: t });
            });
            u.nodes.forEach((n, i) => restoreLinks(n.innerUniverse, uData.nodes[i].innerUniverse));
        };
        restoreLinks(rootUniverse, data.root);

        const wormholes = data.wormholes.map(w => ({
            source: nodeMap.get(w.source), target: nodeMap.get(w.target)
        })).filter(w => w.source && w.target);

        const blackHole = data.blackHole.map(nData => {
            const node = new EntityNode(nData.name, nData.baseX, nData.baseY, nData.size, nData.color, nData.category);
            node.id = nData.id; 
            node.url = nData.url || ""; 
            node.iconUrl = nData.iconUrl || "";
            node.note = nData.note || ""; // ★ 亜空間データも対応！
            node.isLocked = nData.isLocked || false; 
            node.password = nData.password || "";   
            node.innerUniverse = parseUniverse(nData.innerUniverse);
            return node;
        });

        return { rootUniverse, wormholes, blackHole, nodeMap };
    }
};