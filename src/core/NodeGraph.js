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
        this.note = ""; 
        this.isLocked = false;
        this.password = "";
        this.ownerId = "";
        this.parentUniverse = null;

        const theme = (category === 'life' || category === 'microbe') ? 'cell' : 'space';
        this.innerUniverse = new Universe(`${name}の内部`, theme);
        
        this.baseX = x; this.baseY = y;
        this.x = x; this.y = y;
        this.randomOffset = Math.random() * Math.PI * 2; 
        this.vault = []; // V2拡張：金庫メタデータ用
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

// ★ ローカルIndexedDBヘルパー（外部ライブラリ不要）
const CoreDB = {
    dbName: 'MyUniverse_Core',
    storeName: 'UniverseState',
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    async set(key, value) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
    async get(key) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const request = tx.objectStore(this.storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};

export const DataManager = {
    // 💾 【完全ローカル保存】 IndexedDBへ無制限保存
    save: async (rootUniverse, wormholes, blackHole) => {
        const serializeNode = (n) => ({
            id: n.id, name: n.name, category: n.category, size: n.size, color: n.color, 
            url: n.url, iconUrl: n.iconUrl, note: n.note, vault: n.vault, // vaultも保存
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

        // 5MB制限のsessionStorageを脱却
        await CoreDB.set('save_data', data);
    },

    // 💾 【完全ローカル読込】 IndexedDBから復元
    load: async () => {
        const data = await CoreDB.get('save_data');
        if (!data) return null;

        const nodeMap = new Map();

        const parseUniverse = (uData) => {
            const u = new Universe(uData.name, uData.theme);
            uData.nodes.forEach(nData => {
                const node = new EntityNode(nData.name, nData.baseX, nData.baseY, nData.size, nData.color, nData.category);
                node.id = nData.id;
                node.url = nData.url || "";
                node.iconUrl = nData.iconUrl || "";
                node.note = nData.note || "";
                node.vault = nData.vault || []; // 金庫データの復元
                
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
            node.note = nData.note || "";
            node.vault = nData.vault || [];
            node.isLocked = nData.isLocked || false; 
            node.password = nData.password || "";   
            node.innerUniverse = parseUniverse(nData.innerUniverse);
            return node;
        });

        return { rootUniverse, wormholes, blackHole, nodeMap };
    }
};