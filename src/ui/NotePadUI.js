// src/ui/NotePadUI.js

export class NotePadUI {
    constructor(app) {
        this.app = app;
        this.currentNode = null;
        this.buildUI();
    }

    buildUI() {
        // パネル本体
        this.container = document.createElement('div');
        this.container.style.cssText = 'display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:320px; background:rgba(10,15,30,0.95); border:1px solid #00ffcc; border-radius:10px; z-index:500; flex-direction:column; padding:15px; box-shadow:0 10px 30px rgba(0,255,204,0.3); backdrop-filter:blur(5px); color:white; font-family:sans-serif;';

        // ★ スマホでのすり抜け（ゴーストクリック）や、文字入力中の宇宙の移動を完全に防ぐシールド！
        const stop = (e) => e.stopPropagation();
        this.container.addEventListener('mousedown', stop);
        this.container.addEventListener('touchstart', stop, {passive: false});
        this.container.addEventListener('wheel', stop, {passive: false}); // スクロールしても宇宙がズームしないように

        // タイトル
        this.header = document.createElement('h3');
        this.header.style.cssText = 'margin:0 0 10px 0; color:#00ffcc; font-size:16px; border-bottom:1px solid rgba(0,255,204,0.3); padding-bottom:5px;';
        this.container.appendChild(this.header);

        // テキスト入力エリア
        this.textarea = document.createElement('textarea');
        this.textarea.style.cssText = 'width:100%; height:200px; background:rgba(0,0,0,0.5); color:#fff; border:1px solid #555; border-radius:5px; padding:10px; box-sizing:border-box; resize:none; outline:none; font-family:sans-serif; font-size:14px; line-height:1.5; margin-bottom:10px;';
        this.textarea.placeholder = "この星に刻む記憶、情報、アイデアを入力してください...";
        this.container.appendChild(this.textarea);

        // ボタンエリア
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex; justify-content:flex-end; gap:10px;';

        const closeBtn = document.createElement('button');
        closeBtn.innerText = "キャンセル";
        closeBtn.style.cssText = 'padding:8px 15px; background:transparent; color:#aaa; border:1px solid #aaa; border-radius:5px; cursor:pointer; font-size:12px;';
        closeBtn.onclick = () => this.close();

        const saveBtn = document.createElement('button');
        saveBtn.innerText = "💾 記憶を保存";
        saveBtn.style.cssText = 'padding:8px 15px; background:#00ffcc; color:#000; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:12px;';
        saveBtn.onclick = () => this.save();

        btnContainer.appendChild(closeBtn);
        btnContainer.appendChild(saveBtn);
        this.container.appendChild(btnContainer);

        document.body.appendChild(this.container);
    }

    open(node) {
        this.currentNode = node;
        this.header.innerText = `📝 ${node.name} の記憶`;
        // すでに保存されているメモがあれば読み込む
        this.textarea.value = node.note || "";
        this.container.style.display = 'flex';
        this.textarea.focus();
    }

    save() {
        if (!this.currentNode) return;
        
        // 星のデータに直接テキストを刻み込む
        this.currentNode.note = this.textarea.value;
        this.app.autoSave(); // クラウドと地下金庫に自動保存
        
        // 監視塔（ログ）へ報告
        if (window.universeLogger) {
            window.universeLogger.log("NOTE_SAVED", { target: this.currentNode.name, textLength: this.textarea.value.length });
        }
        
        this.close();
    }

    close() {
        this.container.style.display = 'none';
        this.currentNode = null;
    }
}