// src/security/StardustCapsule.js

export class StardustCapsule {
    // 画像の末尾に宇宙のデータを隠してダウンロードさせる
    static async embedData(jsonString, baseImageFile) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgBuffer = e.target.result;
                const encoder = new TextEncoder();
                // 抽出用のシークレットマーカー
                const marker = encoder.encode(":::UNIVERSE:::");
                const dataBuffer = encoder.encode(jsonString);

                // 画像データ + マーカー + 宇宙データ をガッチャンコする
                const combined = new Uint8Array(imgBuffer.byteLength + marker.length + dataBuffer.byteLength);
                combined.set(new Uint8Array(imgBuffer), 0);
                combined.set(marker, imgBuffer.byteLength);
                combined.set(dataBuffer, imgBuffer.byteLength + marker.length);

                // 偽装した新しい画像として生成
                const blob = new Blob([combined], { type: baseImageFile.type });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = 'stardust_' + baseImageFile.name;
                a.click();
                URL.revokeObjectURL(url);
                resolve();
            };
            reader.readAsArrayBuffer(baseImageFile);
        });
    }

    // 画像の末尾から宇宙のデータを抽出する
    static async extractData(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const buffer = new Uint8Array(e.target.result);
                const decoder = new TextDecoder();
                const fullText = decoder.decode(buffer);
                
                // シークレットマーカーを探す
                const markerIndex = fullText.lastIndexOf(":::UNIVERSE:::");
                
                if (markerIndex !== -1) {
                    const jsonString = fullText.substring(markerIndex + 14); // マーカーの文字数分ずらす
                    resolve(jsonString);
                } else {
                    resolve(null); // 隠されていないただの画像の場合
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
}