const crypto = require("crypto");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

const db = admin.firestore();
const VIP_SECRET = defineSecret("VIP_SECRET");
const REGION = "asia-northeast1";

function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Login is required.");
  }

  return request.auth.uid;
}

function normalizeRole(role) {
  const value = String(role || "RESTRICTED").toUpperCase();

  if (value === "ADMIN") return "ADMIN";
  if (value === "PRO") return "PRO";
  if (value === "VIP") return "VIP_GUEST";
  if (value === "VIP_GUEST") return "VIP_GUEST";
  if (value === "GUEST_UNLOCK") return "VIP_GUEST";

  return "RESTRICTED";
}

function normalizeTicketRole(role) {
  const value = normalizeRole(role);

  if (value === "ADMIN") {
    throw new HttpsError("invalid-argument", "ADMIN tickets are not allowed.");
  }

  if (value !== "PRO" && value !== "VIP_GUEST") {
    throw new HttpsError("invalid-argument", "Invalid ticket role.");
  }

  return value;
}

async function getRequesterRole(request, uid) {
  const tokenRole = normalizeRole(request.auth?.token?.role);

  if (tokenRole === "ADMIN") {
    return "ADMIN";
  }

  const snap = await db.collection("users").doc(uid).get();

  if (snap.exists) {
    return normalizeRole(snap.data().role);
  }

  return "RESTRICTED";
}

function getSecretValue() {
  const secret = VIP_SECRET.value();

  if (!secret || secret.length < 32) {
    throw new HttpsError(
      "failed-precondition",
      "VIP_SECRET is not configured or too short."
    );
  }

  return secret;
}

function base64urlEncodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function base64urlDecodeJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signTicketBody(body) {
  return crypto
    .createHmac("sha256", getSecretValue())
    .update(body)
    .digest("base64url");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function parseTicket(code) {
  const raw = String(code || "").trim();

  if (!raw.startsWith("NEXUS-")) {
    throw new HttpsError("invalid-argument", "Invalid VIP code format.");
  }

  const token = raw.slice("NEXUS-".length);
  const parts = token.split(".");

  if (parts.length !== 2) {
    throw new HttpsError("invalid-argument", "Invalid VIP code format.");
  }

  const [body, signature] = parts;
  const expectedSignature = signTicketBody(body);

  if (!safeEqual(signature, expectedSignature)) {
    throw new HttpsError("permission-denied", "Invalid VIP code signature.");
  }

  let payload;

  try {
    payload = base64urlDecodeJson(body);
  } catch (error) {
    throw new HttpsError("invalid-argument", "Invalid VIP code payload.");
  }

  if (!payload || !payload.n || !payload.t || !payload.exp) {
    throw new HttpsError("invalid-argument", "Invalid VIP code payload.");
  }

  return {
    raw,
    body,
    signature,
    payload
  };
}

exports.createVipTicket = onCall(
  {
    region: REGION,
    secrets: [VIP_SECRET]
  },
  async (request) => {
    const uid = requireAuth(request);
    const requesterRole = await getRequesterRole(request, uid);

    if (requesterRole !== "ADMIN") {
      throw new HttpsError("permission-denied", "ADMIN permission is required.");
    }

    const data = request.data || {};
    const role = normalizeTicketRole(data.tier || data.role || "PRO");

    const daysValid = Math.max(
      1,
      Math.min(36500, Number(data.daysValid || data.days || 30))
    );

    const recipientName = String(data.recipientName || data.memo || "").slice(0, 200);
    const now = Date.now();
    const exp = now + daysValid * 24 * 60 * 60 * 1000;
    const nonce = crypto.randomBytes(16).toString("hex");

    const payload = {
      t: role,
      exp,
      iat: now,
      n: nonce
    };

    const body = base64urlEncodeJson(payload);
    const signature = signTicketBody(body);
    const code = `NEXUS-${body}.${signature}`;
    const codeHash = sha256(code);

    await db.collection("vip_tickets").doc(nonce).set({
      role,
      codeHash,
      recipientName,
      createdBy: uid,
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(exp)
    });

    return {
      ok: true,
      code,
      role,
      exp
    };
  }
);

exports.verifyVipTicket = onCall(
  {
    region: REGION,
    secrets: [VIP_SECRET]
  },
  async (request) => {
    const uid = requireAuth(request);
    const data = request.data || {};
    const code = String(data.code || "").trim();

    if (!code) {
      throw new HttpsError("invalid-argument", "VIP code is required.");
    }

    const parsed = parseTicket(code);
    const payload = parsed.payload;

    const role = normalizeTicketRole(payload.t);
    const exp = Number(payload.exp);
    const nonce = String(payload.n);

    if (!Number.isFinite(exp) || exp < Date.now()) {
      throw new HttpsError("deadline-exceeded", "VIP code has expired.");
    }

    const codeHash = sha256(parsed.raw);
    const ticketRef = db.collection("vip_tickets").doc(nonce);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ticketRef);

      if (!snap.exists) {
        throw new HttpsError("not-found", "VIP code was not found.");
      }

      const ticket = snap.data();

      if (ticket.codeHash !== codeHash) {
        throw new HttpsError("permission-denied", "VIP code hash mismatch.");
      }

      if (ticket.used && ticket.usedBy !== uid) {
        throw new HttpsError("already-exists", "VIP code has already been used.");
      }

      tx.set(
        ticketRef,
        {
          used: true,
          usedBy: uid,
          usedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );
    });

    const userRecord = await admin.auth().getUser(uid);
    const currentClaims = userRecord.customClaims || {};

    await admin.auth().setCustomUserClaims(uid, {
      ...currentClaims,
      role,
      vipUntil: exp
    });

    await db.collection("users").doc(uid).set(
      {
        role,
        isVip: true,
        vipUntil: admin.firestore.Timestamp.fromMillis(exp),
        lastVipUnlockAt: admin.firestore.FieldValue.serverTimestamp(),
        vipCodeHash: codeHash
      },
      {
        merge: true
      }
    );

    return {
      ok: true,
      role,
      exp
    };
  }
);
