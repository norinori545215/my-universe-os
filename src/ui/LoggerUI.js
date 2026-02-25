// src/ui/LoggerUI.js

export class LoggerUI {
    constructor(vault) {
        this.vault = vault;
        this.maxLogs = 30; // 画面が埋まらないよう30行に調整
        // 前回ターミナルを開いたままにしたか記憶しておく
        this.isVisible = localStorage.getItem('universe_log_visible') !== 'false';
        this.buildUI();
    }

    buildUI() {
        // ★ 浮遊ボタン(fab)は廃止し、純粋な「表示パネル」だけを構築します
        this.panel = document.createElement('div');
        this.panel.id = 'universe-terminal-log';
        
        // サイバーパンクなハッカー風の見た目にスタイル調整！
        this.panel.style.cssText = `
            position: fixed; top: 80px; left: 20px; width: 280px; height: 200px;
            background: rgba(0, 15, 5, 0.85); border: 1px solid #00ffcc; border-radius: 8px;
            color: #00ffcc; font-family: "Courier New", Courier, monospace; font-size: 11px;
            padding: 10px; overflow-y: hidden; z-index: 8000;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.2); backdrop-filter: blur(4px);
            display: flex; flex-direction: column; gap: 4px;
            pointer-events: none; /* ★パネル越しに後ろの宇宙を操作できるようにする魔法 */
            transition: opacity 0.3s, transform 0.3s;
        `;

        // ON/OFFによる初期表示の制御
        if (!this.isVisible) {
            this.panel.style.opacity = '0';
            this.panel.style.transform = 'translateX(-20px)';
        }

        // ターミナルのヘッダー
        const header = document.createElement('div');
        header.innerHTML = `>_ MY UNIVERSE OS // <span style="color:#fff;">SYS.LOG</span>`;
        header.style.cssText = "border-bottom: 1px dashed rgba(0,255,204,0.5); padding-bottom: 5px; margin-bottom: 5px; font-weight: bold;";
        this.panel.appendChild(header);

        // ログが流れる専用コンテナ
        this.logContainer = document.createElement('div');
        this.logContainer.style.cssText = "flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;";
        this.panel.appendChild(this.logContainer);

        document.body.appendChild(this.panel);
    }

    // ★ カプセルUIの「ON/OFFスイッチ」から呼ばれる関数
    toggle() {
        this.isVisible = !this.isVisible;
        localStorage.setItem('universe_log_visible', this.isVisible);
        
        if (this.isVisible) {
            this.panel.style.opacity = '1';
            this.panel.style.transform = 'translateX(0)';
        } else {
            this.panel.style.opacity = '0';
            this.panel.style.transform = 'translateX(-20px)';
        }
    }

    async log(action, detail) {
        const timestamp = new Date().toISOString();
        const timeStr = timestamp.split('T')[1].split('.')[0];
        const logEntry = { timestamp, action, detail };

        // 画面に流れるログの生成
        const logLine = document.createElement('div');
        logLine.style.cssText = "animation: fadeIn 0.3s ease-out; line-height: 1.3;";
        // JSONをそのまま出さず、少しカッコよく色分けして表示する
        const detailStr = Object.entries(detail||{}).map(([k,v]) => `<span style="color:#ffaa00;">${k}:</span>${v}`).join(' ');
        logLine.innerHTML = `<span style="color:#558866;">[${timeStr}]</span> <span style="color:#fff; font-weight:bold;">${action}</span> ${detailStr}`;
        
        this.logContainer.appendChild(logLine);

        // ログが溢れたら古いものから消す（メモリ節約）
        if (this.logContainer.childNodes.length > this.maxLogs) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }
        
        // 常に最新のログが見えるように一番下へスクロール
        this.logContainer.scrollTop = this.logContainer.scrollHeight;

        // ★ あなたの書いた完璧な地下金庫保存ロジック（そのまま活かします！）
        try {
            if(this.vault && this.vault.saveLog) {
                await this.vault.saveLog(logEntry);
            }
        } catch (e) {
            console.error("Failed to save log:", e);
        }
    }
}

// ログがフワッと浮かび上がるアニメーション
const style = document.createElement('style');
style.innerHTML = `@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`;
document.head.appendChild(style);