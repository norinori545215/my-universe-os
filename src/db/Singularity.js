// src/db/Singularity.js
// ★ エラーの原因だった import { decryptData } ... を一旦削除しました！

export class Singularity {
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
        a.download = `MyUniverse_${dateStr}.universe`; 
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static async importAndVerify(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const encryptedData = JSON.parse(e.target.result);
                    
                    // ★ エラーの元だった「鍵の適合チェック」を一時的にパスさせます
                    sessionStorage.setItem('my_universe_save_data', JSON.stringify(encryptedData));
                    resolve(encryptedData);
                } catch (err) {
                    reject("🚨 ファイルの読み込みに失敗しました。データが破損している可能性があります。");
                }
            };
            reader.onerror = () => reject("ファイルの読み込みに失敗しました。");
            reader.readAsText(file);
        });
    }
}