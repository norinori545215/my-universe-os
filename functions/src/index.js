// functions/src/index.js
// Firebase Cloud Functions: VIPコード発行・検証。
// フロント側に SECRET を置かないための本番向け土台。

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

const REGION = 'asia-northeast1';

function getVipSecret() {
  const secret = functions.config()?.vip?.secret || process.env.VIP_SECRET;

  if (!secret) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'VIP_SECRET is not configured. Run: firebase functions:config:set vip.secret="..."'
    );
  }

  return secret;
}

function assertAuthed(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。');
  }

  return context.auth;
}

async function assertAdmin(context) {
  const auth = assertAuthed(context);
  const user = await admin.auth().getUser(auth.uid);

  if (user.customClaims?.role !== 'ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'ADMIN権限が必要です。');
  }

  return user;
}

function normalizeTier(tier) {
  const value = String(tier || 'PRO').toUpperCase();

  if (value === 'GUEST_UNLOCK' || value === 'VIP') return 'VIP_GUEST';
  if (['PRO', 'VIP_GUEST', 'RESTRICTED'].includes(value)) return value;

  return 'PRO';
}

function base64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function base64urlDecode(str) {
  return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
}

function signPayload(base64Payload) {
  return crypto
    .createHmac('sha256', getVipSecret())
    .update(base64Payload)
    .digest('hex')
    .slice(0, 32);
}

exports.createVipTicket = functions.region(REGION).https.onCall(async (data, context) => {
  await assertAdmin(context);

  const tier = normalizeTier(data?.tier);
  const daysValid = Math.max(1, Math.min(Number(data?.daysValid || 30), 3650));
  const recipientName = String(data?.recipientName || '').slice(0, 80);
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Date.now() + daysValid * 24 * 60 * 60 * 1000;

  const payload = {
    t: tier,
    e: exp,
    n: recipientName,
    r: nonce,
    v: 2,
  };

  const base64 = base64urlEncode(payload);
  const signature = signPayload(base64);
  const code = `NEXUS-${base64}.${signature}`;

  await admin.firestore().collection('vip_tickets').doc(nonce).set({
    tier,
    exp,
    recipientName,
    nonce,
    usedBy: null,
    codeHash: crypto.createHash('sha256').update(code).digest('hex'),
    createdBy: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    code,
    tier,
    exp,
    recipientName,
  };
});

exports.verifyVipTicket = functions.region(REGION).https.onCall(async (data, context) => {
  const auth = assertAuthed(context);
  const code = String(data?.code || '').trim();

  if (!code.startsWith('NEXUS-')) {
    throw new functions.https.HttpsError('invalid-argument', '無効なコード形式です。');
  }

  const token = code.replace(/^NEXUS-/, '');
  const [base64, signature] = token.split('.');

  if (!base64 || !signature) {
    throw new functions.https.HttpsError('invalid-argument', 'コードが破損しています。');
  }

  const expected = signPayload(base64);

  if (signature !== expected) {
    throw new functions.https.HttpsError('permission-denied', 'コードが改ざんされています。');
  }

  let payload;

  try {
    payload = base64urlDecode(base64);
  } catch (_) {
    throw new functions.https.HttpsError('invalid-argument', 'コードを読み取れません。');
  }

  if (Date.now() > payload.e) {
    throw new functions.https.HttpsError('deadline-exceeded', 'このコードは期限切れです。');
  }

  const ref = admin.firestore().collection('vip_tickets').doc(payload.r);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'コードが存在しません。');
  }

  const ticket = snap.data();

  if (ticket.usedBy && ticket.usedBy !== auth.uid) {
    throw new functions.https.HttpsError('already-exists', 'このコードは使用済みです。');
  }

  const role = normalizeTier(payload.t);

  await ref.set({
    usedBy: auth.uid,
    usedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await admin.auth().setCustomUserClaims(auth.uid, {
    role,
  });

  await admin.firestore().doc(`users/${auth.uid}`).set({
    role,
    isVip: true,
    vipUntil: new Date(payload.e).toISOString(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    ok: true,
    role,
    exp: payload.e,
  };
});