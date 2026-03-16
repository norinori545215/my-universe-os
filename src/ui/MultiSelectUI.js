import { PocketManager } from '../core/PocketManager.js';

export class MultiSelectUI {
    constructor(app) {
        this.app = app;
        this.createActionBar();
    }

    createActionBar() {
        this.actionBar = document.createElement('div');
        this.actionBar.style.cssText = `
            position: fixed; bottom: -100px; left: 50%; transform: translateX(-50%);
            background: rgba(20, 0, 30, 0.9); border: 1px solid #ff00ff;
            padding: 15px 25px; border-radius: 30px; display: flex; gap: 15px; align-items: center;
            box-shadow: 0 10px 40px rgba(255, 0, 255, 0.4); z-index: 10000;
            transition: bottom 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            backdrop-filter: blur(10px); pointer-events: auto;
        `;

        const btnStyle = "background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px 15px; border-radius: 20px; cursor: pointer; font-size: 13px; font-weight: bold; transition: 0.2s;";

        this.actionBar.innerHTML = `
            <div style="color: #00ffcc; font-size: 14px; font-weight: bold; margin-right: 10px;">
                <span id="pocket-count" style="font-size: 18px;">0</span> 個選択中
            </div>
            <button id="btn-pocket-seal" style="${btnStyle} border-color: #ffcc00; color: #ffcc00;">🔒 一括封印</button>
            <button id="btn-pocket-banish" style="${btnStyle} border-color: #ff4444; color: #ff4444;">🎒 一括抹消</button>
            <button id="btn-pocket-cancel" style="${btnStyle}">❌ 解除</button>
        `;

        document.body.appendChild(this.actionBar);

        // ボタンのホバーエフェクトと実行イベント
        ['seal', 'banish', 'cancel'].forEach(id => {
            const btn = document.getElementById(`btn-pocket-${id}`);
            btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.1)';
            btn.onmouseout = () => btn.style.background = 'transparent';
        });

        document.getElementById('btn-pocket-seal').onclick = () => {
            PocketManager.massSeal(this.app, this.getSelectedNodes());
            this.clearSelection();
        };

        document.getElementById('btn-pocket-banish').onclick = () => {
            if(confirm("本当に選択した星をすべて亜空間へ抹消しますか？")) {
                PocketManager.massBanish(this.app, this.getSelectedNodes());
                this.clearSelection();
            }
        };

        document.getElementById('btn-pocket-cancel').onclick = () => this.clearSelection();
    }

    getSelectedNodes() {
        return this.app.currentUniverse.nodes.filter(n => n.isSelected);
    }

    isActive() {
        return this.getSelectedNodes().length > 0;
    }

    update() {
        const selected = this.getSelectedNodes();
        if (selected.length > 0) {
            document.getElementById('pocket-count').innerText = selected.length;
            this.actionBar.style.bottom = '40px'; // 画面下部からポップアップ
        } else {
            this.actionBar.style.bottom = '-100px'; // 隠す
        }
    }

    clearSelection() {
        PocketManager.clearSelection(this.app);
        this.update();
    }
}