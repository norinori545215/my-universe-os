// src/ui/LoggerUI.js

export class LoggerUI {
    constructor(vault) {
        this.vault = vault;
        this.maxLogs = 50; 
        
        // ★ 絶対防弾仕様：シークレットモード等で記憶領域が使えなくてもクラッシュさせない
        this.isVisible = true;
        try {
            if (localStorage.getItem('universe_log_visible') === 'false') {
                this.isVisible = false;
            }
        } catch (e) {
            console.warn("プライベートモードのため、状態の保存をスキップしました");
        }
        
        this.buildUI();
    }

    makeDraggable(el, handle) {
        let isDragging = false, startX, startY, initX, initY;
        const down = (e) => {
            const ev = e.touches ? e.touches[0] : e;
            e.stopPropagation(); 
            startX = ev.clientX; startY = ev.clientY;
            const rect = el.getBoundingClientRect();
            initX = rect.left; initY = rect.top;
            isDragging = true;
            el.style.transition = 'none';
        };
        const move = (e) => {
            if (!isDragging) return;
            const ev = e.touches ? e.touches[0] : e;
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            
            let nx = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, initX + dx));
            let ny = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, initY + dy));
            
            el.style.left = `${nx}px`;
            el.style.top = `${ny}px`;
            el.style.right = 'auto'; el.style.bottom = 'auto';
        };
        const up = () => {
            if (isDragging) {
                isDragging = false;
                el.style.transition = 'opacity 0.3s, transform 0.3s';
            }
        };
        handle.addEventListener('mousedown', down); handle.addEventListener('touchstart', down, {passive: false});
        window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive: false});
        window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
    }

    makeResizable(el, handle) {
        let isResizing = false, startX, startY, startWidth, startHeight;
        const down = (e) => {
            const ev = e.touches ? e.touches[0] : e;
            e.stopPropagation();
            startX = ev.clientX; startY = ev.clientY;
            const rect = el.getBoundingClientRect();
            startWidth = rect.width; startHeight = rect.height;
            isResizing = true;
            el.style.transition = 'none';
        };
        const move = (e) => {
            if (!isResizing) return;
            const ev = e.touches ? e.touches[0] : e;
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            
            let newWidth = Math.max(200, Math.min(startWidth + dx, window.innerWidth - el.offsetLeft - 10));
            let newHeight = Math.max(100, Math.min(startHeight + dy, window.innerHeight - el.offsetTop - 10));
            
            el.style.width = `${newWidth}px`;
            el.style.height = `${newHeight}px`;
            
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        };
        const up = () => {
            if (isResizing) {
                isResizing = false;
                el.style.transition = 'opacity 0.3s, transform 0.3s';
            }
        };
        handle.addEventListener('mousedown', down); handle.addEventListener('touchstart', down, {passive: false});
        window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive: false});
        window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
    }

    buildUI() {
        this.panel = document.createElement('div');
        this.panel.id = 'universe-terminal-log';
        this.panel.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; width: 280px; height: 200px;
            background: rgba(0, 15, 5, 0.85); border: 1px solid #00ffcc; border-radius: 8px;
            color: #00ffcc; font-family: "Courier New", Courier, monospace; font-size: 11px;
            display: flex; flex-direction: column; z-index: 8000;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.2); backdrop-filter: blur(4px);
            transition: opacity 0.3s, transform 0.3s; pointer-events: auto;
        `;

        if (!this.isVisible) {
            this.panel.style.opacity = '0';
            this.panel.style.pointerEvents = 'none';
            this.panel.style.transform = 'translateY(20px)';
        }

        this.header = document.createElement('div');
        this.header.innerHTML = `>_ MY UNIVERSE OS <span style="color:#fff;">[SYS.LOG]</span> <span style="float:right; cursor:move;">☷</span>`;
        this.header.style.cssText = "border-bottom: 1px solid rgba(0,255,204,0.3); padding: 8px 10px; font-weight: bold; cursor: move; background: rgba(0,255,204,0.1); border-radius: 8px 8px 0 0; user-select: none; flex-shrink: 0;";
        this.panel.appendChild(this.header);

        this.logContainer = document.createElement('div');
        this.logContainer.style.cssText = "flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 10px;";
        
        const stop = (e) => e.stopPropagation();
        this.logContainer.addEventListener('mousedown', stop);
        this.logContainer.addEventListener('touchstart', stop, {passive: false});
        
        this.panel.appendChild(this.logContainer);

        // リサイズ用のつまみ
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.style.cssText = `
            position: absolute; bottom: 0; right: 0; width: 20px; height: 20px;
            cursor: se-resize; user-select: none;
            background: linear-gradient(135deg, transparent 50%, rgba(0,255,204,0.5) 50%);
            border-bottom-right-radius: 8px; z-index: 10;
        `;
        this.panel.appendChild(this.resizeHandle);

        document.body.appendChild(this.panel);

        this.makeDraggable(this.panel, this.header);
        this.makeResizable(this.panel, this.resizeHandle);
    }

    toggle() {
        this.isVisible = !this.isVisible;
        try {
            localStorage.setItem('universe_log_visible', this.isVisible);
        } catch(e) {} // ここも保護
        
        if (this.isVisible) {
            this.panel.style.opacity = '1';
            this.panel.style.pointerEvents = 'auto';
            this.panel.style.transform = 'translateY(0)';
        } else {
            this.panel.style.opacity = '0';
            this.panel.style.pointerEvents = 'none';
            this.panel.style.transform = 'translateY(20px)';
        }
    }

    async log(action, detail) {
        const timestamp = new Date().toISOString();
        const timeStr = timestamp.split('T')[1].split('.')[0];
        const logEntry = { timestamp, action, detail };

        const logLine = document.createElement('div');
        logLine.style.cssText = "animation: fadeIn 0.3s ease-out; line-height: 1.3;";
        const detailStr = Object.entries(detail||{}).map(([k,v]) => `<span style="color:#ffaa00;">${k}:</span>${v}`).join(' ');
        logLine.innerHTML = `<span style="color:#558866;">[${timeStr}]</span> <span style="color:#fff; font-weight:bold;">${action}</span> ${detailStr}`;
        
        this.logContainer.appendChild(logLine);

        if (this.logContainer.childNodes.length > this.maxLogs) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }
        this.logContainer.scrollTop = this.logContainer.scrollHeight;

        try {
            if(this.vault && this.vault.saveLog) {
                await this.vault.saveLog(logEntry);
            }
        } catch (e) {
            console.error("Failed to save log:", e);
        }
    }
}

if (!document.getElementById('log-fade-style')) {
    const style = document.createElement('style');
    style.id = 'log-fade-style';
    style.innerHTML = `@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`;
    document.head.appendChild(style);
}