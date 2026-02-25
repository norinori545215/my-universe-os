// src/db/Singularity.js
import { decryptData } from '../security/CryptoCore.js';

export class Singularity {
    // 宇宙を暗号化されたまま物理ファイルとして出力
    static export() {
        const data = sessionStorage.getItem('my_universe_save_data');
        if (!data) {
            alert("エクスポートするデータがありません。先に星を保存してください。");
            return;
        }
        
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        a.download = `MyUniverse_${dateStr}.universe`; // 独自の拡張子 .universe
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 物理ファイルから宇宙を展開し、鍵の適合性をチェック
    static async importAndVerify(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const encryptedData = JSON.parse(e.target.result);
                    if (!window.universeCryptoKey) throw new Error("マスターキーがメモリに存在しません。");
                    
                    // 復号テスト（現在のマスターパスワードで解読できるかチェック）
                    await decryptData(encryptedData, window.universeCryptoKey);
                    
                    // 成功したらSessionStorageを書き換え
                    sessionStorage.setItem('my_universe_save_data', JSON.stringify(encryptedData));
                    resolve(encryptedData);
                } catch (err) {
                    reject("🚨 宇宙の解読に失敗しました。\n・現在のマスターパスワードと異なる\n・ファイルが破損している\nなどの原因が考えられます。");
                }
            };
            reader.onerror = () => reject("ファイルの読み込みに失敗しました。");
            reader.readAsText(file);
        });
    }
}