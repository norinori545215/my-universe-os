// src/ui/HoloGuide.js

export class HoloGuide {
    constructor() {
        // すでに存在していれば何もしない
        if (document.getElementById('holo-guide')) return;

        this.el = document.createElement('div');
        this.el.id = 'holo-guide';
        this.el.style.cssText = `
            position: fixed;
            bottom: 12%;
            left: 50%;
            transform: translateX(-50%);
            color: rgba(0, 255, 204, 0.8);
            font-family: 'Courier New', monospace;
            font-size: 13px;
            text-align: left;
            pointer-events: none; /* クリックをすり抜けさせる */
            z-index: 8000;
            text-shadow: 0 0 10px rgba(0, 255, 204, 0.5);
            transition: opacity 1.5s ease-out, bottom 1.5s ease-out;
            background: rgba(10, 20, 30, 0.6);
            padding: 15px 25px;
            border: 1px dashed rgba(0, 255, 204, 0.4);
            border-radius: 8px;
            backdrop-filter: blur(5px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            opacity: 0; /* 最初は透明 */
        `;

        this.el.innerHTML = `
            <div style="font-size:11px; margin-bottom:10px; letter-spacing:2px; color:#ff00ff; text-align:center;">
                [ NEURAL LINK ESTABLISHED ]
            </div>
            <div style="margin-bottom:6px;">👆 <b>Tap</b> : 星を選択 / アプリ起動</div>
            <div style="margin-bottom:6px;">👆👆 <b>Double Tap</b> : 星の内部へダイブ</div>
            <div>👆🔄 <b>Hold & Drag</b> : 星を移動 / メニュー展開</div>
        `;
        
        document.body.appendChild(this.el);
        this.isHidden = false;

        // 起動から1秒後にフワッと表示させる（演出）
        setTimeout(() => {
            if (!this.isHidden) {
                this.el.style.opacity = '1';
            }
        }, 1000);
    }

    /**
     * ユーザーが操作に成功した時に呼び出し、ガイドを消去する
     */
    dismiss() {
        if (this.isHidden || !this.el) return;
        this.isHidden = true;
        
        // フワッと消えながら少し下へ落ちる演出
        this.el.style.opacity = '0';
        this.el.style.bottom = '8%';
        
        // 完全に消えたらDOMから削除
        setTimeout(() => {
            if (this.el && this.el.parentNode) {
                this.el.parentNode.removeChild(this.el);
            }
        }, 1500);

        // ログ出力
        if (window.universeLogger) window.universeLogger.log("SYSTEM", { msg: "Tutorial Cleared" });
    }
}