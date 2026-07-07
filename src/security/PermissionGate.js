// src/security/PermissionGate.js
// P0: localStorage の role を「本当の権限」として信用しないための権限ゲート。
// UI表示はこのクラス経由に寄せ、最終的な保護は Firestore Rules / Custom Claims 側で行う。

import { auth, db } from './Auth.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const DEFAULT_PERMISSIONS = Object.freeze({
  role: 'RESTRICTED',
  source: 'default',
  allow3D: false,
  allowP2P: false,
  allowAI: false,
  allowVault: false,
  allowNodeEdit: false,
  allowNodeDelete: false,
  allowAdminPortal: false,
  allowVIPIssue: false,
});

const ROLE_PERMISSIONS = Object.freeze({
  ADMIN: {
    role: 'ADMIN',
    allow3D: true,
    allowP2P: true,
    allowAI: true,
    allowVault: true,
    allowNodeEdit: true,
    allowNodeDelete: true,
    allowAdminPortal: true,
    allowVIPIssue: true,
  },
  PRO: {
    role: 'PRO',
    allow3D: true,
    allowP2P: true,
    allowAI: true,
    allowVault: true,
    allowNodeEdit: true,
    allowNodeDelete: true,
    allowAdminPortal: false,
    allowVIPIssue: false,
  },
  VIP_GUEST: {
    role: 'VIP_GUEST',
    allow3D: true,
    allowP2P: true,
    allowAI: true,
    allowVault: true,
    allowNodeEdit: true,
    allowNodeDelete: true,
    allowAdminPortal: false,
    allowVIPIssue: false,
  },
  RESTRICTED: DEFAULT_PERMISSIONS,
});

export class PermissionGate {
  static cache = { ...DEFAULT_PERMISSIONS };
  static lastRefreshAt = 0;

  static normalizeRole(role) {
    const value = String(role || 'RESTRICTED').toUpperCase();
    if (value === 'GUEST_UNLOCK') return 'VIP_GUEST';
    if (value === 'VIP') return 'VIP_GUEST';
    if (ROLE_PERMISSIONS[value]) return value;
    return 'RESTRICTED';
  }

  static roleToPermissions(role, source = 'unknown') {
    const normalized = this.normalizeRole(role);
    return {
      ...DEFAULT_PERMISSIONS,
      ...ROLE_PERMISSIONS[normalized],
      role: normalized,
      source,
    };
  }

  static async refresh({ forceTokenRefresh = true } = {}) {
    const user = auth?.currentUser;

    if (!user) {
      this.cache = { ...DEFAULT_PERMISSIONS };
      this.lastRefreshAt = Date.now();
      return this.cache;
    }

    // 1. 最優先：Firebase Custom Claims
    try {
      const token = await user.getIdTokenResult(forceTokenRefresh);
      const claimRole = token?.claims?.role;
      if (claimRole) {
        this.cache = this.roleToPermissions(claimRole, 'customClaims');
        this.lastRefreshAt = Date.now();
        this.safeCacheForUIOnly(this.cache.role);
        return this.cache;
      }
    } catch (e) {
      console.warn('[PermissionGate] Custom Claims の取得に失敗:', e);
    }

    // 2. 補助：Firestore users/{uid}.role
    // Firestore Rulesで「本人がroleを自由変更できない」ことが前提。
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const firestoreRole = snap.exists() ? snap.data()?.role : null;
      if (firestoreRole) {
        this.cache = this.roleToPermissions(firestoreRole, 'firestore');
        this.lastRefreshAt = Date.now();
        this.safeCacheForUIOnly(this.cache.role);
        return this.cache;
      }
    } catch (e) {
      console.warn('[PermissionGate] Firestore role の取得に失敗:', e);
    }

    // 3. 最後：制限ユーザー
    this.cache = { ...DEFAULT_PERMISSIONS };
    this.lastRefreshAt = Date.now();
    this.safeCacheForUIOnly(this.cache.role);
    return this.cache;
  }

  static safeCacheForUIOnly(role) {
    // 既存UI互換用。これは本物の権限として信用しない。
    try {
      localStorage.setItem('universe_role', this.normalizeRole(role));
    } catch (_) {}
  }

  static get() {
    return this.cache || { ...DEFAULT_PERMISSIONS };
  }

  static getRole() {
    return this.get().role || 'RESTRICTED';
  }

  static can(permissionName) {
    return !!this.get()?.[permissionName];
  }

  static require(permissionName, message = 'この機能を利用する権限がありません。') {
    if (!this.can(permissionName)) {
      throw new Error(message);
    }
    return true;
  }
}