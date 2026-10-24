"use strict";

const crypto = require("node:crypto");
const config = require("./config");
const { get, run, nowIso, transaction, logActivity } = require("./db");

const MP_API = "https://api.mercadopago.com";

function paymentsConfigured() {
  return Boolean(config.payments.mpAccessToken);
}

async function createPreference({ order, course, user }) {
  if (!paymentsConfigured()) return { configured: false };
  const body = {
    items: [
      {
        id: String(course.id),
        title: `${course.title} — BrasilTec Educação`,
        description: "Matrícula em curso EAD. Conteúdo de demonstração.",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number((order.total_cents / 100).toFixed(2)),
      },
    ],
    payer: {
      name: user.name,
      email: user.email,
    },
    external_reference: order.code,
    statement_descriptor: "BRASILTEC",
    notification_url: `${config.appUrl}/api/payments/mercadopago/webhook`,
    back_urls: {
      success: `${config.appUrl}/checkout/${order.code}?status=success`,
      pending: `${config.appUrl}/checkout/${order.code}?status=pending`,
      failure: `${config.appUrl}/checkout/${order.code}?status=failure`,
    },
    auto_return: "approved",
  };
  const response = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.payments.mpAccessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `order-${order.code}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[payments] Falha ao criar preferência Mercado Pago:", response.status, text.slice(0, 300));
    return { configured: true, error: "Não foi possível iniciar o pagamento online." };
  }
  const data = await response.json();
  const checkoutUrl = data.init_point || data.sandbox_init_point || "";
  await run(
    "UPDATE orders SET provider = 'mercadopago', provider_ref = ?, checkout_url = ?, updated_at = ? WHERE id = ?",
    String(data.id || ""),
    checkoutUrl,
    nowIso(),
    order.id
  );
  return { configured: true, checkoutUrl, preferenceId: data.id };
}

function verifyWebhookSignature({ headers, dataId }) {
  const secret = config.payments.mpWebhookSecret;
  if (!secret) return false;
  const signature = headers["x-signature"];
  const requestId = headers["x-request-id"] || "";
  if (!signature) return false;
  const parts = Object.fromEntries(
    String(signature)
      .split(",")
      .map((part) => part.split("=").map((v) => v.trim()))
      .filter((pair) => pair.length === 2)
  );
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  } catch {
    return false;
  }
}

async function fetchPayment(paymentId) {
  const response = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${config.payments.mpAccessToken}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function approveOrderByCode(orderCode, { provider, providerRef, method } = {}) {
  const order = await get("SELECT * FROM orders WHERE code = ?", orderCode);
  if (!order) return { error: "Pedido não encontrado.", status: 404 };
  if (order.status === "approved") return { order, already: true };
  if (!["pending", "refused"].includes(order.status)) {
    return { error: "Este pedido não pode ser aprovado no estado atual.", status: 409 };
  }
  const result = await transaction(async (tx) => {
    await tx.run(
      "UPDATE orders SET status = 'approved', provider = COALESCE(?, provider), provider_ref = COALESCE(?, provider_ref), payment_method = COALESCE(?, payment_method), paid_at = ?, updated_at = ? WHERE id = ?",
      provider || null,
      providerRef || null,
      method || null,
      nowIso(),
      nowIso(),
      order.id
    );
    await tx.run(
      "INSERT INTO payments (order_id, status, method, amount_cents, provider, provider_ref, created_at) VALUES (?, 'approved', ?, ?, ?, ?, ?)",
      order.id,
      method || order.payment_method || "pix",
      order.total_cents,
      provider || order.provider || "manual",
      providerRef || null,
      nowIso()
    );
    if (order.coupon_id) {
      await tx.run("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", order.coupon_id);
    }
    const existing = await tx.get(
      "SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?",
      order.user_id,
      order.course_id
    );
    if (existing) {
      await tx.run(
        "UPDATE enrollments SET status = 'active', updated_at = ? WHERE id = ? AND status IN ('cancelled','blocked')",
        nowIso(),
        existing.id
      );
    } else {
      await tx.run(
        "INSERT INTO enrollments (user_id, course_id, status, source, progress_percent, enrolled_at, updated_at) VALUES (?, ?, 'active', 'purchase', 0, ?, ?)",
        order.user_id,
        order.course_id,
        nowIso(),
        nowIso()
      );
    }
    return { order: await tx.get("SELECT * FROM orders WHERE id = ?", order.id) };
  });
  await logActivity(
    order.user_id,
    "order.approved",
    "order",
    order.id,
    `Pagamento confirmado para o pedido ${order.code}.`
  );
  return result;
}

async function refundOrder(orderId, actorId) {
  const order = await get("SELECT * FROM orders WHERE id = ?", orderId);
  if (!order) return { error: "Pedido não encontrado.", status: 404 };
  if (order.status !== "approved") return { error: "Apenas pedidos aprovados podem ser reembolsados.", status: 409 };
  const result = await transaction(async (tx) => {
    await tx.run("UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?", nowIso(), orderId);
    await tx.run(
      "INSERT INTO payments (order_id, status, method, amount_cents, provider, provider_ref, created_at) VALUES (?, 'refunded', ?, ?, ?, ?, ?)",
      orderId,
      order.payment_method || "pix",
      order.total_cents,
      order.provider || "manual",
      order.provider_ref || null,
      nowIso()
    );
    await tx.run(
      "UPDATE enrollments SET status = 'cancelled', updated_at = ? WHERE user_id = ? AND course_id = ? AND status = 'active'",
      nowIso(),
      order.user_id,
      order.course_id
    );
    return { order: await tx.get("SELECT * FROM orders WHERE id = ?", orderId) };
  });
  await logActivity(actorId, "order.refunded", "order", orderId, `Pedido ${order.code} reembolsado.`);
  return result;
}

module.exports = {
  paymentsConfigured,
  createPreference,
  verifyWebhookSignature,
  fetchPayment,
  approveOrderByCode,
  refundOrder,
};
