// src/billing/VIPInviteClient.js
// P0: フロント側はVIPコードを「作らない」「署名しない」「SECRETを持たない」。
// Cloud Functions の createVipTicket / verifyVipTicket を呼ぶだけにする。

import { getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { auth } from '../security/Auth.js';

const FUNCTIONS_REGION = 'asia-northeast1';

function getCallable(name) {
  const functions = getFunctions(getApp(), FUNCTIONS_REGION);
  return httpsCallable(functions, name);
}

export class VIPInviteClient {
  static async requireLogin() {
    const user = auth?.currentUser;
    if (!user) throw new Error('ログインが必要です。');
    return user;
  }

  static async createTicket({ tier = 'PRO', daysValid = 30, recipientName = '' } = {}) {
    await this.requireLogin();
    const fn = getCallable('createVipTicket');
    const result = await fn({ tier, daysValid, recipientName });
    return result.data;
  }

  static async verifyTicket(code) {
    await this.requireLogin();
    const fn = getCallable('verifyVipTicket');
    const result = await fn({ code });
    return result.data;
  }
}