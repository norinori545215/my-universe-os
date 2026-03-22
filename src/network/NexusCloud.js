// src/network/NexusCloud.js
// 完全にE2EE化されたクラウド同期エンジン（Firestoreベース）

import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { SecretNexus } from '../security/SecretNexus.js';

export class NexusCloud {
    constructor(app) {
        this.app = app;
        // ※ Firebase Appは src/configs/firebase.config.js 等で初期化されている前提
        this.db = getFirestore(); 
        this.unsubscribes = {}; // 星ごとの通信傍受（リスナー）を管理
        
        // 自分のテンポラリID（自分が送ったメッセージが二重に表示されるのを防ぐため）
        this.myDeviceId = localStorage.getItem('universe_device_id') || this.generateDeviceId();
    }

    generateDeviceId() {
        const id = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('universe_device_id', id);
        return id;
    }

    // 📡 【受信】星（チャットルーム）のリアルタイム監視を開始
    listenRoom(node, onMessageReceived) {
        if (!node.sharedKey || !node.id) {
            console.warn("NexusCloud: この星には通信用の鍵またはIDがありません。");
            return;
        }
        
        // 既にこの星の通信を監視中ならスキップ
        if (this.unsubscribes[node.id]) return; 

        // 星のIDをそのまま極秘チャンネルのパス（URL）として使う
        const roomRef = collection(this.db, `nexus_rooms/${node.id}/messages`);
        const q = query(roomRef, orderBy("timestamp", "asc"));

        console.log(`📡 [NexusCloud] 星(${node.name})の亜空間通信をリンクしました...`);

        // クラウドに新しいデータが降ってくるのを監視し続ける
        this.unsubscribes[node.id] = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    
                    // 自分が送信したデータはローカルで即時表示するため、クラウドからの戻りは無視する
                    if (data.senderId === this.myDeviceId) return;

                    try {
                        // ★ 最重要：クラウドから降ってきた「ゴミデータ」を、星の共通鍵で解読する
                        const decryptedText = await SecretNexus.decryptData(
                            { cipher: data.cipher, iv: data.iv }, 
                            node.sharedKey
                        );

                        // 復号に成功したら、チャットUIに渡して画面に表示させる
                        onMessageReceived({
                            sender: 'peer',
                            text: decryptedText,
                            timestamp: data.timestamp ? data.timestamp.toMillis() : Date.now()
                        });

                        // 受信音を鳴らす
                        if(window.universeAudio) window.universeAudio.playSystemSound(400, 'triangle', 0.1);

                    } catch (e) {
                        console.error("解読失敗: 鍵が違うか、データが破損しています", e);
                    }
                }
            });
        });
    }

    // 🚀 【送信】テキストを暗号化してクラウドに放り投げる
    async sendMessage(node, plainText) {
        if (!node.sharedKey || !node.id) throw new Error("鍵またはIDがありません");

        // 1. まず手元の端末内で完全に暗号化する（絶対に平文を外に出さない）
        const encrypted = await SecretNexus.encryptData(plainText, node.sharedKey);

        // 2. クラウド（Firebase）に暗号化データだけを送信する
        const roomRef = collection(this.db, `nexus_rooms/${node.id}/messages`);
        await addDoc(roomRef, {
            senderId: this.myDeviceId,
            cipher: encrypted.cipher,
            iv: encrypted.iv,
            timestamp: serverTimestamp() // サーバー側の正確な時間を記録
        });

        console.log(`🚀 [NexusCloud] 暗号化データをクラウドへ射出しました。`);
        
        return encrypted; // UI側でローカル表示するために暗号データを返す
    }

    // 🛑 監視の切断（星を消した時やOSを閉じた時）
    stopListening(nodeId) {
        if (this.unsubscribes[nodeId]) {
            this.unsubscribes[nodeId]();
            delete this.unsubscribes[nodeId];
            console.log(`🛑 [NexusCloud] 通信を切断しました。`);
        }
    }
}