// src/security/LoginGateway.js
import { BioAuth } from './BioAuth.js';
import { VIPInvite } from '../billing/VIPInvite.js';
import { auth, db } from './Auth.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class LoginGateway {
    static ADMIN_EMAIL = "tokimogulife_0313@yahoo.co.jp";

    static async boot() {
        return new Promise((resolve) => {
            const boundCred = localStorage.getItem('universe_bound_credential');
            const currentRole = localStorage.getItem('universe_role');

            const ui = document.createElement('div');
            ui.id = 'login-gateway';
            ui.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:#050510; z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#00ffcc; font-family:sans-serif;`;

            // 【2回目以降】生体認証ログイン
            if (boundCred) {
                ui.innerHTML = `
                    <div style="font-size:24px; color:#ff00ff; font-weight:bold; letter-spacing:3px; margin-bottom:40px;">NEXUS OS</div>
                    <button id="btn-bio" style="padding:15px 40px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; color:#00ffcc; border-radius:8px; cursor:pointer; font-size:16px; font-weight:bold;">生体認証でログイン</button>
                    <button id="btn-reset" style="margin-top:30px; background:transparent; border:none; color:#666; cursor:pointer; font-size:11px; text-decoration:underline;">別のアカウントでログイン（初期化）</button>
                `;
                document.body.appendChild(ui);
                
                document.getElementById('btn-bio').onclick = async () => {
                    try {
                        await BioAuth.authenticateDevice(boundCred);

                        // ★ 修正箇所：ローカルの記憶を過信せず、Firebaseから最新の権限を強制取得してズレを直す
                        let finalRole = currentRole;
                        if (auth.currentUser) {
                            const email = auth.currentUser.email;
                            if (email && email.toLowerCase() === this.ADMIN_EMAIL.toLowerCase()) {
                                finalRole = 'ADMIN'; // 強制的に開発者に引き上げ
                            } else {
                                const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                                if (userDoc.exists() && userDoc.data().role) {
                                    finalRole = userDoc.data().role;
                                }
                            }
                            localStorage.setItem('universe_role', finalRole);
                        }

                        this.handleRoleRouting(finalRole, ui, resolve);
                    } catch (e) { alert("認証失敗"); }
                };
                document.getElementById('btn-reset').onclick = () => {
                    if(confirm("ローカルデータを消去して初期化しますか？")) { 
                        localStorage.clear(); sessionStorage.clear(); 
                        auth.signOut().then(() => window.location.reload());
                    }
                };
            } 
            // 【初回】Email / PW ログイン画面
            else {
                this.renderLoginForm(ui, resolve);
            }
        });
    }

    static renderLoginForm(ui, resolve) {
        ui.innerHTML = `
            <div style="width:320px; background:rgba(20,20,30,0.9); padding:30px; border:1px solid #333; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.8);">
                <div style="font-size:22px; color:#fff; font-weight:bold; margin-bottom:20px; text-align:center;">LOGIN</div>
                
                <div id="login-mode-email">
                    <input type="email" id="gate-email" placeholder="Email Address" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #444; color:#fff; padding:12px; border-radius:6px; margin-bottom:15px; outline:none;">
                    <input type="password" id="gate-pass" placeholder="Password" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #444; color:#fff; padding:12px; border-radius:6px; margin-bottom:20px; outline:none;">
                    <button id="gate-enter" style="width:100%; padding:12px; background:#00ffcc; color:#000; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; margin-bottom:15px;">ログイン / 新規登録</button>
                    <div style="text-align:center;"><button id="toggle-vip" style="background:transparent; border:none; color:#ff00ff; cursor:pointer; font-size:12px; text-decoration:underline;">VIPコードをお持ちの方はこちら</button></div>
                </div>

                <div id="login-mode-vip" style="display:none;">
                    <div style="font-size:11px; color:#ffaa00; margin-bottom:10px; text-align:center;">※Email登録不要でアクセスできます</div>
                    <input type="text" id="gate-vip-code" placeholder="NEXUS-..." style="width:100%; box-sizing:border-box; background:#111; border:1px solid #ffaa00; color:#ffaa00; padding:12px; border-radius:6px; margin-bottom:20px; outline:none;">
                    <button id="gate-vip-enter" style="width:100%; padding:12px; background:#ffaa00; color:#000; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; margin-bottom:15px;">コードでログイン</button>
                    <div style="text-align:center;"><button id="toggle-email" style="background:transparent; border:none; color:#888; cursor:pointer; font-size:12px; text-decoration:underline;">Emailログインに戻る</button></div>
                </div>
            </div>
        `;
        document.body.appendChild(ui);

        const modeEmail = document.getElementById('login-mode-email');
        const modeVip = document.getElementById('login-mode-vip');

        document.getElementById('toggle-vip').onclick = () => { modeEmail.style.display = 'none'; modeVip.style.display = 'block'; };
        document.getElementById('toggle-email').onclick = () => { modeVip.style.display = 'none'; modeEmail.style.display = 'block'; };

        // ★ Firebaseを用いた「本物の」Emailログイン/登録処理
        document.getElementById('gate-enter').onclick = async () => {
            const email = document.getElementById('gate-email').value.trim().toLowerCase(); // ★ 小文字化して判定を厳格に
            const pass = document.getElementById('gate-pass').value.trim();
            if (!email || !pass) return alert("Emailとパスワードを入力してください");

            const btn = document.getElementById('gate-enter');
            btn.innerText = "認証中...";
            btn.disabled = true;

            let role = 'RESTRICTED';

            try {
                if (email === this.ADMIN_EMAIL.toLowerCase()) {
                    // ① 開発者のログイン
                    await signInWithEmailAndPassword(auth, email, pass);
                    role = 'ADMIN';
                } else {
                    try {
                        // ② 既存ユーザーのログイン試行
                        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
                        const user = userCredential.user;
                        
                        // データベースから権限を読み込む
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists()) {
                            role = userDoc.data().role || 'PRO';
                        } else {
                            role = 'PRO';
                            await setDoc(doc(db, "users", user.uid), { role: 'PRO', createdAt: serverTimestamp() });
                        }

                    } catch (error) {
                        // ③ ユーザーが存在しない場合（新規ユーザー登録）
                        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                            const newCredential = await createUserWithEmailAndPassword(auth, email, pass);
                            const newUser = newCredential.user;
                            
                            role = 'RESTRICTED';
                            await setDoc(doc(db, "users", newUser.uid), { role: 'RESTRICTED', createdAt: serverTimestamp() });
                        } else {
                            throw error;
                        }
                    }
                }

                // 認証成功 -> デバイスの生体紐付けへ
                this.executeDeviceBinding(role, ui, resolve);

            } catch (error) {
                alert(`ログインエラー: パスワードが違うか、ネットワークに問題があります。\n(${error.message})`);
                btn.innerText = "ログイン / 新規登録";
                btn.disabled = false;
            }
        };

        // ★ VIPコードでの匿名ログイン（顧客・特別な人）
        document.getElementById('gate-vip-enter').onclick = async () => {
            const code = document.getElementById('gate-vip-code').value.trim();
            if (!code) return;
            
            const btn = document.getElementById('gate-vip-enter');
            btn.innerText = "暗号解読中...";
            btn.disabled = true;

            try {
                const payload = await VIPInvite.verifyTicket(code);
                const role = payload.t;

                const userCredential = await signInAnonymously(auth);
                const user = userCredential.user;

                await setDoc(doc(db, "users", user.uid), { 
                    role: role, 
                    isVip: true, 
                    vipCode: code,
                    createdAt: serverTimestamp() 
                }, { merge: true });

                this.executeDeviceBinding(role, ui, resolve);

            } catch (e) { 
                alert(`コードエラー: ${e.message}`); 
                btn.innerText = "コードでログイン";
                btn.disabled = false;
            }
        };
    }

    static async executeDeviceBinding(role, ui, resolve) {
        try {
            alert(`認証成功：デバイスを生体認証と紐付けます。`);
            const credId = await BioAuth.registerDevice();
            localStorage.setItem('universe_bound_credential', credId);
            localStorage.setItem('universe_role', role); 
            
            this.handleRoleRouting(role, ui, resolve);
        } catch (e) {
            alert("生体認証の登録に失敗しました。");
            document.getElementById('gate-enter').innerText = "ログイン / 新規登録";
            document.getElementById('gate-enter').disabled = false;
        }
    }

    // 開発者なら「2択画面」を出し、それ以外は即座にOSを起動
    static handleRoleRouting(role, ui, resolve) {
        if (role === 'ADMIN') {
            ui.innerHTML = `
                <div style="font-size:20px; color:#ff4444; font-weight:bold; margin-bottom:40px; letter-spacing:2px;">DEVELOPER AUTHORIZED</div>
                <div style="display:flex; gap:20px; flex-direction:column; align-items:center;">
                    <button id="btn-admin-console" style="padding:20px; background:#440000; border:1px solid #ff0000; color:#fff; border-radius:10px; cursor:pointer; font-weight:bold; font-size:16px; width:350px; transition:0.2s;">
                        🎟️ ① 招待コード発行＆ゲスト制限設定
                    </button>
                    <button id="btn-admin-os" style="padding:20px; background:#003344; border:1px solid #00ffcc; color:#fff; border-radius:10px; cursor:pointer; font-weight:bold; font-size:16px; width:350px; transition:0.2s;">
                        🌌 ② 従来通りのOS画面を起動 (PRO)
                    </button>
                </div>
            `;
            document.getElementById('btn-admin-console').onclick = () => {
                ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve('ROUTE_ADMIN_PORTAL'); }, 500);
            };
            document.getElementById('btn-admin-os').onclick = () => {
                ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve('ADMIN'); }, 500);
            };
        } else {
            ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve(role); }, 500);
        }
    }
}