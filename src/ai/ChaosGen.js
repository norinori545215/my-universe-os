// src/ai/ChaosGen.js
import { NexusP2P } from '../api/NexusP2P.js';

export class ChaosGen {
    static async expand(node, app) {
        if (!node || !node.name) return;

        const originalName = node.name;
        const originalColor = node.color;
        
        node.name = "🧠 サーバーで演算中...";
        node.color = "#ff00ff";
        app.autoSave();
        
        if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
        this.showToast(`📡 ローカルPythonサーバーへ接続中...`, '#ff00ff');

        try {
            // ★ Pythonサーバー（127.0.0.1:8000）へデータを送信
            const response = await fetch('http://127.0.0.1:8000/api/expand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: originalName,
                    note: node.note || ''
                })
            });

            if (!response.ok) throw new Error("Pythonサーバーに接続できません。server.pyが起動しているか確認してください。");

            const data = await response.json();
            
            if (data.status === "error") {
                throw new Error(data.message);
            }

            const generatedTerms = data.ideas;

            node.name = originalName;
            node.color = "#ffcc00"; 

            const angleStep = (Math.PI * 2) / generatedTerms.length;
            const orbitRadius = (node.size || 20) + 120; 

            generatedTerms.forEach((term, index) => {
                const angle = index * angleStep;
                const nx = node.baseX + Math.cos(angle) * orbitRadius;
                const ny = node.baseY + Math.sin(angle) * orbitRadius;
                
                app.currentUniverse.addNode(term.name, nx, ny, 18, '#ff00ff', 'circle');
                const newNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];
                
                newNode.note = term.note;
                newNode.id = 'ai_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

                app.currentUniverse.addLink(node, newNode);

                if (NexusP2P && NexusP2P.onNodeAdded) NexusP2P.onNodeAdded(newNode);
            });

            app.autoSave();
            
            if (app.simulation) app.simulation.alpha(1).restart();
            app.spawnRipple(node.x, node.y, '#ff00ff', true);
            if (window.universeAudio) window.universeAudio.playSpawn();
            
            this.showToast(`✨ Pythonサーバーが3つの分岐を完了しました`, '#00ffcc');

        } catch (err) {
            console.error(err);
            node.name = originalName; 
            node.color = originalColor;
            app.autoSave();
            alert(`🚨 通信エラー:\n${err.message}`);
        }
    }

    static showToast(msg, color) {
        const toast = document.createElement('div');
        toast.innerHTML = msg;
        toast.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(10, 0, 20, 0.9); color: ${color};
            border: 1px solid ${color}; border-radius: 8px;
            padding: 12px 24px; font-size: 14px; font-weight: bold; z-index: 999999;
            box-shadow: 0 0 20px rgba(${color === '#ff00ff' ? '255,0,255' : '0,255,204'}, 0.4);
            transition: opacity 0.3s; pointer-events: none; letter-spacing: 1px;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = '0', 3000);
        setTimeout(() => toast.remove(), 3300);
    }
}