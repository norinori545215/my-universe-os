// src/ui/LoggerUI.js

export class LoggerUI {
    constructor(vault) {
        this.vault = vault;
        this.maxLogs = 50;
        this.buildUI();
    }

    // 他のUIと同じ魔法（ドラッグ機能）を自前で持つ
    makeDraggable(el) {
        let isDragging = false, startX, startY, initX, initY, hasMoved = false;
        const down = (e) => {
            hasMoved = false; const ev = e.touches ? e.touches[0] : e;
            startX = ev.clientX; startY = ev.clientY;
            const rect = el.getBoundingClientRect(); initX = rect.left; initY = rect.top;
            isDragging = true; el.style.transition = 'none';
        };
        const move = (e) => {
            if (!isDragging) return; const ev = e.touches ? e.touches[0] : e;
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
            el.style.left = `${Math.max(0, Math.min(window.innerWidth - el.offsetWidth, initX + dx))}px`; 
            el.style.top = `${Math.max(0, Math.min(window.innerHeight - el.offsetHeight, initY + dy))}px`; 
            el.style.right = 'auto'; el.style.bottom = 'auto';
        };
        const up = () => { if (isDragging) { isDragging = false; el.style.transition = '0.2s'; } };
        el.addEventListener('mousedown', down); el.addEventListener('touchstart', down, {passive: true});
        window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive: true});
        window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
        return () => hasMoved;
    }

    buildUI() {
        // 1. ターミナル起動ボタン（🖥️）
        this.fab = document.createElement('div');
        this.fab.style.cssText = 'position:fixed; z-index:101; display:flex; justify-content:center; align-items:center; width:46px; height:46px; border-radius:50%; cursor:pointer; font-size:22px; backdrop-filter:blur(5px); transition:0.2s; user-select:none; bottom:15px; right:80px; background:rgba(0,255,65,0.1); border:1px solid #00ff41; color:#00ff41;';
        this.fab.innerText = '🖥️';
        document.body.appendChild(this.fab);

        // 2. 隠しパネル（ログ表示エリア）
        this.panel = document.createElement('div');
        this.panel.id = 'universe-terminal-log';
        Object.assign(this.panel.style, {
            position: 'fixed', display: 'none', flexDirection: 'column', width: '300px', height: '150px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)', color: '#00ff41', fontFamily: '"Courier New", Courier, monospace',
            fontSize: '10px', padding: '10px', overflowY: 'auto', border: '1px solid #00ff41',
            borderRadius: '8px', zIndex: '100', boxShadow: '0 0 15px rgba(0, 255, 65, 0.2)'
        });
        document.body.appendChild(this.panel);

        const isDragged = this.makeDraggable(this.fab);

        // 3. クリック時の「動的メニュー展開」ロジック
        this.fab.onclick = () => {
            if (isDragged()) return;
            const isHidden = this.panel.style.display === 'none';
            
            if (isHidden) {
                this.panel.style.display = 'flex';
                this.fab.style.background = 'rgba(0,255,65,0.4)';
                
                // ★ 現在のボタン位置を計算して、はみ出さないようにパネルを配置！
                const rect = this.fab.getBoundingClientRect();
                let top = rect.top - 170; // 基本はボタンの上に出す
                let left = rect.left - 260; // 基本は左にずらす
                
                if (top < 10) top = rect.bottom + 10; // 上が狭ければ下に出す
                if (left < 10) left = 10;
                if (left + 320 > window.innerWidth) left = window.innerWidth - 320;

                this.panel.style.top = `${top}px`;
                this.panel.style.left = `${left}px`;
                this.panel.style.bottom = 'auto'; this.panel.style.right = 'auto';
            } else {
                this.panel.style.display = 'none';
                this.fab.style.background = 'rgba(0,255,65,0.1)';
            }
        };
    }

    async log(action, detail) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, action, detail };

        const logLine = document.createElement('div');
        logLine.textContent = `[${timestamp.split('T')[1].split('.')[0]}] ${action} > ${JSON.stringify(detail)}`;
        this.panel.appendChild(logLine);

        if (this.panel.childNodes.length > this.maxLogs) {
            this.panel.removeChild(this.panel.firstChild);
        }
        this.panel.scrollTop = this.panel.scrollHeight;

        try {
            if(this.vault) await this.vault.saveLog(logEntry);
        } catch (e) {
            console.error("Failed to save log:", e);
        }
    }
}