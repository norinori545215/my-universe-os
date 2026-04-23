// src/security/LoginGateway.js
import { BioAuth } from './BioAuth.js';
import { VIPInvite } from '../billing/VIPInvite.js';
import { auth, db } from './Auth.js';
import { signInWithEmailAndPassword, signInAnonymously, updateProfile, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

            if (isSignInWithEmailLink(auth, window.location.href)) {
                this.handleEmailLinkSignIn(ui, resolve);
                return;
            }

            if (boundCred) {
                this.renderBioAuth(ui, boundCred, currentRole, resolve);
            } else {
                this.renderLoginForm(ui, resolve);
            }
        });
    }

    static async handleEmailLinkSignIn(ui, resolve) {
        ui.innerHTML = `<div style="font-size:16px; color:#ff00ff; font-weight:bold;">📧 メール認証を確認中...</div>`;
        
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('確認のため、登録したメールアドレスをもう一度入力してください。');
        }

        try {
            const result = await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');

            const user = result.user;
            let role = 'PRO'; // ★既存ユーザーのデフォルトはPROにする

            if (email.toLowerCase() === this.ADMIN_EMAIL.toLowerCase()) {
                role = 'ADMIN';
                await setDoc(doc(db, "users", user.uid), { role: 'ADMIN' }, { merge: true });
            } else if (result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
                // ★ 新規ユーザーの場合のみ RESTRICTED（制限付き）にする
                const savedName = window.localStorage.getItem('nameForSignIn') || "Guest User";
                await updateProfile(user, { displayName: savedName });
                role = 'RESTRICTED';
                await setDoc(doc(db, "users", user.uid), { 
                    role: 'RESTRICTED', 
                    name: savedName,
                    createdAt: serverTimestamp() 
                }, { merge: true });
                window.localStorage.removeItem('nameForSignIn');
            } else {
                // ★ 既存ユーザーの場合
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists() && userDoc.data().role) {
                    role = userDoc.data().role;
                } else {
                    role = 'PRO';
                    await setDoc(doc(db, "users", user.uid), { role: 'PRO' }, { merge: true });
                }
            }

            window.history.replaceState(null, null, window.location.pathname);
            this.requestMasterKey(role, ui, resolve, result.additionalUserInfo?.isNewUser || false);

        } catch (error) {
            ui.innerHTML = `
                <div style="font-size:16px; color:#ff4444; font-weight:bold; margin-bottom:20px;">🚨 認証エラー</div>
                <div style="font-size:12px; color:#888;">リンクが古いか、別のブラウザで開かれています。</div>
                <button onclick="window.location.reload()" style="margin-top:20px; padding:10px 20px; background:#111; color:#fff; border:1px solid #444; border-radius:6px; cursor:pointer;">やり直す</button>
            `;
        }
    }

    static renderBioAuth(ui, boundCred, currentRole, resolve) {
        ui.innerHTML = `
            <div style="font-size:24px; color:#ff00ff; font-weight:bold; letter-spacing:3px; margin-bottom:40px;">NEXUS OS</div>
            <button id="btn-bio" style="padding:15px 40px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; color:#00ffcc; border-radius:8px; cursor:pointer; font-size:16px; font-weight:bold; transition:0.2s;">生体認証でログイン</button>
            <button id="btn-reset" style="margin-top:30px; background:transparent; border:none; color:#666; cursor:pointer; font-size:11px; text-decoration:underline;">別のアカウントでログイン（初期化）</button>
        `;
        
        document.getElementById('btn-bio').onclick = async () => {
            const btn = document.getElementById('btn-bio');
            if (btn.disabled) return; 
            btn.disabled = true;
            btn.innerText = "センサー起動中...";
            btn.style.opacity = "0.5";

            try {
                await BioAuth.authenticateDevice(boundCred);

                let finalRole = currentRole;
                if (auth.currentUser) {
                    const email = auth.currentUser.email;
                    if (email && email.toLowerCase() === this.ADMIN_EMAIL.toLowerCase()) {
                        finalRole = 'ADMIN'; 
                        await setDoc(doc(db, "users", auth.currentUser.uid), { role: 'ADMIN' }, { merge: true });
                    } else {
                        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                        if (userDoc.exists() && userDoc.data().role) {
                            finalRole = userDoc.data().role;
                        }
                    }
                    localStorage.setItem('universe_role', finalRole);
                }

                this.requestMasterKey(finalRole, ui, resolve, false);
            } catch (e) { 
                console.warn("生体認証キャンセル/失敗:", e);
                btn.disabled = false;
                btn.innerText = "生体認証でログイン";
                btn.style.opacity = "1";
            }
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
            <div id="main-auth-box" style="width:320px; background:rgba(20,20,30,0.9); padding:30px; border:1px solid #333; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.8); transition:opacity 0.2s;">
                
                <div style="display:flex; margin-bottom:20px; border-bottom:1px solid #444;">
                    <button id="tab-login" style="flex:1; padding:10px; background:transparent; color:#00ffcc; border:none; border-bottom:2px solid #00ffcc; font-weight:bold; cursor:pointer; font-size:14px; transition:0.2s;">LOGIN</button>
                    <button id="tab-register" style="flex:1; padding:10px; background:transparent; color:#888; border:none; border-bottom:2px solid transparent; font-weight:bold; cursor:pointer; font-size:14px; transition:0.2s;">SIGN UP</button>
                </div>
                
                <div id="mode-login">
                    <input type="email" id="login-email" placeholder="Email Address" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #444; color:#fff; padding:12px; border-radius:6px; margin-bottom:15px; outline:none;">
                    <input type="password" id="login-pass" placeholder="Password" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #444; color:#fff; padding:12px; border-radius:6px; margin-bottom:20px; outline:none;">
                    <button id="btn-login" style="width:100%; padding:12px; background:#00ffcc; color:#000; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; margin-bottom:15px;">ログイン</button>
                </div>

                <div id="mode-register" style="display:none;">
                    <div style="font-size:11px; color:#ff00ff; margin-bottom:15px; line-height:1.4;">
                        ※パスワードは不要です。<br>入力したメールアドレスに「ログイン専用リンク」が届きます。
                    </div>
                    <input type="text" id="reg-name" placeholder="Account Name (表示名)" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #444; color:#fff; padding:12px; border-radius:6px; margin-bottom:15px; outline:none;">
                    <input type="email" id="reg-email" placeholder="Email Address" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #444; color:#fff; padding:12px; border-radius:6px; margin-bottom:20px; outline:none;">
                    <button id="btn-register" style="width:100%; padding:12px; background:#ff00ff; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; margin-bottom:15px;">認証メールを送信</button>
                </div>

                <div style="text-align:center; margin-top:10px;">
                    <button id="toggle-vip" style="background:transparent; border:none; color:#ffaa00; cursor:pointer; font-size:12px; text-decoration:underline;">VIPコードをお持ちの方はこちら</button>
                </div>
            </div>
            
            <div id="mode-vip" style="display:none; width:320px; background:rgba(20,20,30,0.9); padding:30px; border:1px solid #ffaa00; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.8); position:absolute;">
                <div style="font-size:11px; color:#ffaa00; margin-bottom:10px; text-align:center;">※Email登録不要でアクセスできます</div>
                <input type="text" id="gate-vip-code" placeholder="NEXUS-..." style="width:100%; box-sizing:border-box; background:#111; border:1px solid #ffaa00; color:#ffaa00; padding:12px; border-radius:6px; margin-bottom:20px; outline:none;">
                <button id="gate-vip-enter" style="width:100%; padding:12px; background:#ffaa00; color:#000; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; margin-bottom:15px;">コードでログイン</button>
                <div style="text-align:center;"><button id="toggle-back" style="background:transparent; border:none; color:#888; cursor:pointer; font-size:12px; text-decoration:underline;">メールログインに戻る</button></div>
            </div>
        `;

        const tabLogin = document.getElementById('tab-login');
        const tabReg = document.getElementById('tab-register');
        const modeLogin = document.getElementById('mode-login');
        const modeReg = document.getElementById('mode-register');
        const modeVip = document.getElementById('mode-vip');
        const mainBox = document.getElementById('main-auth-box');

        tabLogin.onclick = () => {
            modeLogin.style.display = 'block'; modeReg.style.display = 'none';
            tabLogin.style.color = '#00ffcc'; tabLogin.style.borderBottomColor = '#00ffcc';
            tabReg.style.color = '#888'; tabReg.style.borderBottomColor = 'transparent';
        };
        tabReg.onclick = () => {
            modeLogin.style.display = 'none'; modeReg.style.display = 'block';
            tabReg.style.color = '#ff00ff'; tabReg.style.borderBottomColor = '#ff00ff';
            tabLogin.style.color = '#888'; tabLogin.style.borderBottomColor = 'transparent';
        };

        document.getElementById('toggle-vip').onclick = () => { 
            mainBox.style.opacity = '0'; 
            setTimeout(() => { mainBox.style.display='none'; modeVip.style.display='block'; }, 200); 
        };
        document.getElementById('toggle-back').onclick = () => { 
            modeVip.style.display='none'; mainBox.style.display='block'; 
            setTimeout(() => { mainBox.style.opacity='1'; }, 50); 
        };

        document.getElementById('btn-register').onclick = async () => {
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim().toLowerCase();
            
            if(!name || !email) return alert("アカウント名とEmailを入力してください。");

            const btn = document.getElementById('btn-register');
            btn.innerText = "送信中..."; btn.disabled = true;

            const actionCodeSettings = {
                url: window.location.href,
                handleCodeInApp: true
            };

            try {
                await sendSignInLinkToEmail(auth, email, actionCodeSettings);
                window.localStorage.setItem('emailForSignIn', email);
                window.localStorage.setItem('nameForSignIn', name);
                
                alert("📩 認証メールを送信しました！\nメール内のリンクをクリックしてログインを完了してください。");
                btn.innerText = "送信完了";
            } catch(e) {
                alert(`送信エラー: ${e.message}`);
                btn.innerText = "認証メールを送信"; btn.disabled = false;
            }
        };

        document.getElementById('btn-login').onclick = async () => {
            const email = document.getElementById('login-email').value.trim().toLowerCase(); 
            const pass = document.getElementById('login-pass').value;
            if (!email || !pass) return alert("Emailとパスワードを入力してください");

            const btn = document.getElementById('btn-login');
            btn.innerText = "認証中..."; btn.disabled = true;

            try {
                const cred = await signInWithEmailAndPassword(auth, email, pass);
                const user = cred.user;
                let role = 'PRO';

                if (email === this.ADMIN_EMAIL.toLowerCase()) {
                    role = 'ADMIN';
                    await setDoc(doc(db, "users", user.uid), { role: 'ADMIN' }, { merge: true });
                } else {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists() && userDoc.data().role) {
                        role = userDoc.data().role;
                    } else {
                        await setDoc(doc(db, "users", user.uid), { role: 'PRO' }, { merge: true });
                    }
                }

                this.requestMasterKey(role, ui, resolve, false);

            } catch (error) {
                alert(`ログインエラー: パスワードが違うか、アカウントが存在しません。\n(${error.message})`);
                btn.innerText = "ログイン"; btn.disabled = false;
            }
        };

        document.getElementById('gate-vip-enter').onclick = async () => {
            const code = document.getElementById('gate-vip-code').value.trim();
            if (!code) return;
            
            const btn = document.getElementById('gate-vip-enter');
            btn.innerText = "暗解読中..."; btn.disabled = true;

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
                btn.innerText = "コードでログイン"; btn.disabled = false;
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