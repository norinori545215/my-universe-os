// src/security/LegalEscrow.js
import { PanicWipe } from './PanicWipe.js';

export class LegalEscrow {
    // ダミーモード（ハニーポット）かどうかを判定
    static isHoneyPotMode = false;

    // パスワードを検証し、通常の起動かダミーの起動かを振り分ける
    static async verifyAccess(inputPassword, app) {
        const realSecret = localStorage.getItem('universe_master_key'); // 本物の鍵
        const dummySecret = localStorage.getItem('universe_panic_code') || '0000'; // 以前設定したダミーコード

        if (inputPassword === realSecret) {
            this.isHoneyPotMode = false;
            return { success: true, mode: 'REAL' };
        } else if (inputPassword === dummySecret) {
            this.isHoneyPotMode = true;
            this.setupHoneyPot(app); // 偽の宇宙を構築
            return { success: true, mode: 'DUMMY' };
        }

        return { success: false };
    }

    // 偽の宇宙（ハニーポット）をメモリ上に展開
    static setupHoneyPot(app) {
        console.warn("⚠️ [SECURITY] HoneyPot Protocol Activated.");
        
        // 本物の宇宙データを一時的に退避し、空の宇宙を作る
        app.currentUniverse.name = "Guest Domain";
        app.currentUniverse.nodes = [];
        app.currentUniverse.links = [];

        // 誰に見られても恥ずかしくない「無害な星」を自動生成
        app.currentUniverse.addNode('Public Documents', -100, -50, 30, '#888888', 'galaxy');
        app.currentUniverse.addNode('Reference Images', 120, 80, 25, '#5555ff', 'star');
        app.currentUniverse.addNode('Archive', 0, 150, 20, '#ffffff', 'star');

        // ハニーポットモード中は「保存（AutoSave）」を禁止するか、
        // もしくは「偽の保存領域」に書き込むように制限をかける
        app.autoSave = () => {
            console.log("🔒 [HoneyPot] Save operation simulation (No real data written).");
        };
    }
}