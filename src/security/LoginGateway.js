// src/security/LoginGateway.js
import { BioAuth } from './BioAuth.js';
import { VIPInvite } from '../billing/VIPInvite.js';
import { auth, db } from './Auth.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { deriveKey } from './CryptoCore.js';
import { loadEncryptedUniverse } from '../db/CloudSync.js';

export class LoginGateway {
    static ADMIN_EMAIL = "tokimogulife_0313@yahoo.co.jp";

    static async boot() {
        return new Promise((resolve) => {
            const boundCred = localStorage.getItem('universe_bound_credential');
            const currentRole = localStorage.getItem('universe_role');

            const ui = document.createElement('div');
            ui.id = 'login-gateway';
            ui.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:#050510; z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#00ffcc; font-family:sans-serif;`;
            document.body.appendChild(ui);

            if (boundCred) {
                this.renderBioAuth(ui, boundCred, currentRole, resolve);
            } else {
                this.renderLoginForm(ui, resolve);
            }
        });
    }

    static renderBioAuth(ui, boundCred, currentRole, resolve) {
        ui.innerHTML = `
            <div style="font-size:24px; color:#ff00ff; font-weight:bold; letter-spacing:3px; margin-bottom:40px;">NEXUS OS</div>
            <button id="btn-bio" style="padding:15px 40px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; color:#00ffcc; border-radius:8px; cursor:pointer; font-size:16px; font-weight:bold;">生体認証でログイン</button>
            <button id="btn-reset" style="margin-top:30px; background:transparent; border:none; color:#666; cursor:pointer; font-size:11px; text-decoration:underline;">別のアカウントでログイン（初期化）</button>
        `;
        
        document.getElementById('btn-bio').onclick = async () => {
            try {
                await BioAuth.authenticateDevice(boundCred);

                let finalRole = currentRole;
                if (auth.currentUser) {
                    const email = auth.currentUser.email;
                    if (email && email.toLowerCase() === this.ADMIN_EMAIL.toLowerCase()) {
                        finalRole = 'ADMIN'; 
                    } else {
                        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                        if (userDoc.exists() && userDoc.data().role) {
                            finalRole = userDoc.data().role;
                        }
                    }
                    localStorage.setItem('universe_role', finalRole);
                }

                this.requestMasterKey(finalRole, ui, resolve, false);
            } catch (e) { alert("認証失敗"); }
        };

        document.getElementById('btn-reset').onclick = () => {
            if(confirm("ローカルデータを消去して初期化しますか？")) { 
                localStorage.clear(); sessionStorage.clear(); 
                auth.signOut().then(() => window.location.reload());
            }
        };
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

        const modeEmail = document.getElementById('login-mode-email');
        const modeVip = document.getElementById('login-mode-vip');

        document.getElementById('toggle-vip').onclick = () => { modeEmail.style.display = 'none'; modeVip.style.display = 'block'; };
        document.getElementById('toggle-email').onclick = () => { modeVip.style.display = 'none'; modeEmail.style.display = 'block'; };

        document.getElementById('gate-enter').onclick = async () => {
            const email = document.getElementById('gate-email').value.trim().toLowerCase(); 
            const pass = document.getElementById('gate-pass').value.trim();
            if (!email || !pass) return alert("Emailとパスワードを入力してください");

            const btn = document.getElementById('gate-enter');
            btn.innerText = "認証中...";
            btn.disabled = true;

            let role = 'RESTRICTED';

            try {
                // ★ 修正箇所：開発者アカウントの自動創世機能を搭載
                if (email === this.ADMIN_EMAIL.toLowerCase()) {
                    try {
                        await signInWithEmailAndPassword(auth, email, pass);
                        role = 'ADMIN';
                    } catch (adminError) {
                        // もしFirebaseに開発者アカウントが無ければ、特別に新規作成する
                        if (adminError.code === 'auth/user-not-found' || adminError.code === 'auth/invalid-credential') {
                            const newAdmin = await createUserWithEmailAndPassword(auth, email, pass);
                            role = 'ADMIN';
                            await setDoc(doc(db, "users", newAdmin.user.uid), { role: 'ADMIN', createdAt: serverTimestamp() });
                            console.log("✨ 開発者用神アカウント(ADMIN)を創世しました。");
                        } else {
                            throw adminError; // パスワード短すぎ等の他のエラーは弾く
                        }
                    }
                } else {
                    try {
                        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
                        const user = userCredential.user;
                        
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists()) {
                            role = userDoc.data().role || 'PRO';
                        } else {
                            role = 'PRO';
                            await setDoc(doc(db, "users", user.uid), { role: 'PRO', createdAt: serverTimestamp() });
                        }
                    } catch (error) {
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

                this.requestMasterKey(role, ui, resolve, true);

            } catch (error) {
                alert(`ログインエラー: パスワードが違うか、ネットワークに問題があります。\n(${error.message})`);
                btn.innerText = "ログイン / 新規登録";
                btn.disabled = false;
            }
        };

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

                this.requestMasterKey(role, ui, resolve, true);

            } catch (e) { 
                alert(`コードエラー: ${e.message}`); 
                btn.innerText = "コードでログイン";
                btn.disabled = false;
            }
        };
    }

    static requestMasterKey(role, ui, resolve, isFirstTime) {
        ui.innerHTML = `
            <div style="width:320px; background:rgba(10,0,15,0.9); padding:30px; border:1px solid #ff00ff; border-radius:12px; box-shadow:0 10px 40px rgba(255,0,255,0.2); text-align:center;">
                <h2 style="margin-top:0; color:#ff00ff; letter-spacing: 2px;">ABSOLUTE SECURE</h2>
                <p style="font-size: 11px; color: #aaa; margin-bottom: 20px;">
                    宇宙を解読・暗号化するための<br>マスターパスワードを入力してください。<br>
                    <span style="color:#ff4444;">※忘れると二度と復元できません。</span>
                </p>
                <input type="password" id="master-key-input" placeholder="マスターパスワード" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #ff00ff; color:#fff; padding:12px; border-radius:6px; margin-bottom:20px; outline:none;">
                <button id="btn-unlock-universe" style="width:100%; padding:12px; background:#ff00ff; color:#fff; font-weight:bold; border:none; border-radius:6px; cursor:pointer; font-size:14px; transition:0.2s;">宇宙を創世 / 解読する</button>
                <div id="key-status" style="color:#ff00ff; font-size:11px; margin-top:15px; display:none;"></div>
            </div>
        `;

        document.getElementById('btn-unlock-universe').onclick = async () => {
            const masterPw = document.getElementById('master-key-input').value;
            const statusText = document.getElementById('key-status');
            const btn = document.getElementById('btn-unlock-universe');
            
            if (masterPw.length < 4) {
                statusText.innerText = "⚠️ パスワードが短すぎます";
                statusText.style.display = 'block';
                return;
            }

            statusText.innerText = "暗号鍵を生成中...";
            statusText.style.display = 'block';
            btn.disabled = true;

            try {
                window.universeCryptoKey = await deriveKey(masterPw);
                statusText.innerText = "クラウド/地下金庫と照合中...";
                
                const cloudData = await loadEncryptedUniverse();
                
                if (cloudData) {
                    sessionStorage.setItem('my_universe_save_data', JSON.stringify(cloudData));
                }

                statusText.innerText = "アクセス承認。事象の地平面へ接続します...";
                
                setTimeout(() => {
                    if (isFirstTime) {
                        this.executeDeviceBinding(role, ui, resolve);
                    } else {
                        this.handleRoleRouting(role, ui, resolve);
                    }
                }, 800);

            } catch (error) {
                statusText.innerText = "⚠️ 拒絶されました：パスワードが違います";
                btn.disabled = false;
                window.universeCryptoKey = null; 
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
            // BioAuth.js のドメインエラー等の場合はここに入り、スキップして次に進む
            console.warn("生体認証の登録をスキップしました:", e.message);
            this.handleRoleRouting(role, ui, resolve);
        }
    }

    static handleRoleRouting(role, ui, resolve) {
        if (role === 'ADMIN') {
            ui.innerHTML = `
                <div style="font-size:20px; color:#ff4444; font-weight:bold; margin-bottom:40px; letter-spacing:2px;">DEVELOPER AUTHORIZED</div>
                <div style="display:flex; gap:20px; flex-direction:column; align-items:center;">
                    <button id="btn-admin-console" style="padding:20px; background:#440000; border:1px solid #ff0000; color:#fff; border-radius:10px; cursor:pointer; font-weight:bold; font-size:16px; width:350px; transition:0.2s;">
                        🎟️ ① 招待コード発行 ＆ ゲスト制限調整
                    </button>
                    <button id="btn-admin-os" style="padding:20px; background:#003344; border:1px solid #00ffcc; color:#fff; border-radius:10px; cursor:pointer; font-weight:bold; font-size:16px; width:350px; transition:0.2s;">
                        🌌 ② OSを通常起動 (PRO版)
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