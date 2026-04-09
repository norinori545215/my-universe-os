// src/api/FileSystemBridge.js

export class FileSystemBridge {
    static async importDirectory(app) {
        try {
            // ブラウザがFile System APIに対応しているかチェック
            if (!window.showDirectoryPicker) {
                alert("⚠️ お使いのブラウザは File System Access API に対応していません。（PC版の Chrome または Edge をご利用ください）");
                return;
            }

            // PCのフォルダ選択ダイアログを開く
            const dirHandle = await window.showDirectoryPicker();
            
            const cx = app.camera ? -app.camera.x : 0;
            const cy = app.camera ? -app.camera.y : 0;

            // 選択した大元のフォルダを「親星」として召喚
            app.currentUniverse.addNode(`📁 ${dirHandle.name}`, cx, cy, 40, '#ffaa00', 'rect');
            const folderNode = app.currentUniverse.nodes[app.currentUniverse.nodes.length - 1];

            if(window.universeAudio) window.universeAudio.playSpawn();

            // フォルダの中身を再帰的に読み込んで星にする処理
            const parseDirectory = async (dirHandle, parentUniverse, depth = 0) => {
                if (depth > 2) return; // フリーズ防止のため、3階層目まででストップ

                let fileCount = 0;
                for await (const entry of dirHandle.values()) {
                    fileCount++;
                    if (fileCount > 50) break; // 1フォルダにつき最大50ファイルまで（負荷軽減）

                    // 星を円形に散らばらせる計算
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 60 + Math.random() * 150;
                    const nx = Math.cos(angle) * dist;
                    const ny = Math.sin(angle) * dist;

                    if (entry.kind === 'file') {
                        // ファイルを星として追加
                        parentUniverse.addNode(entry.name, nx, ny, 15, '#aaaaaa', 'circle');
                        const fileNode = parentUniverse.nodes[parentUniverse.nodes.length - 1];
                        
                        // ★ 現実のファイルと同期するためのハンドルを記憶
                        fileNode.fileHandle = entry; 

                        try {
                            const file = await entry.getFile();
                            // テキスト・コード系ファイルなら中身を「ノート」に書き込む
                            if (file.type.startsWith('text/') || entry.name.match(/\.(js|json|md|csv|html|css|txt)$/i)) {
                                fileNode.note = await file.text();
                                fileNode.color = '#00ffcc'; // テキストは水色の四角
                                fileNode.shape = 'rect';
                            } 
                            // 画像ファイルなら、アイコンとして星に貼り付ける
                            else if (file.type.startsWith('image/')) {
                                fileNode.color = '#ff66aa'; // 画像はピンクのひし形
                                fileNode.shape = 'diamond';
                                fileNode.iconUrl = URL.createObjectURL(file);
                            }
                        } catch (e) {
                            console.warn("ファイル読み込みスキップ:", entry.name);
                        }
                    } else if (entry.kind === 'directory') {
                        // サブフォルダなら、四角い星を作ってさらに内部（innerUniverse）へ潜る
                        parentUniverse.addNode(`📁 ${entry.name}`, nx, ny, 25, '#ffaa00', 'rect');
                        const subFolderNode = parentUniverse.nodes[parentUniverse.nodes.length - 1];
                        await parseDirectory(entry, subFolderNode.innerUniverse, depth + 1);
                    }
                }
            };

            // フォルダの解析を開始（親星の内部宇宙へ）
            await parseDirectory(dirHandle, folderNode.innerUniverse);
            
            app.autoSave();
            if (app.simulation) app.simulation.alpha(1).restart();
            
            alert(`📁 現実のフォルダ「${dirHandle.name}」を宇宙空間にマッピング完了！\n\n※ 生成された星の中に入って（➡ 内部へ潜る）、現実のファイルを確認してください。\n※ セキュリティ上、ブラウザをリロードすると現実への書き込み権限は一旦リセットされます。`);
        
        } catch (e) {
            console.error(e);
        }
    }

    // 星のノートに書かれた内容を、現実のPCファイルに上書き保存する
    static async saveToFile(node) {
        if (!node.fileHandle) return false;
        try {
            // 書き込み権限を要求して上書き
            const writable = await node.fileHandle.createWritable();
            await writable.write(node.note || "");
            await writable.close();
            if(window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
            return true;
        } catch (e) {
            console.error("File save failed", e);
            alert("⚠️ 保存に失敗しました。書き込み権限が拒否されたか、ブラウザのリロードによって現実とのリンクが切断された可能性があります。");
            return false;
        }
    }
}