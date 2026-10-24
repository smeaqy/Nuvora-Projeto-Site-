"use strict";

const config = require("../config");
const { get, run, nowIso, logActivity } = require("../db");
const {
  createRouter,
  bad,
  text,
} = require("./helpers");
const {
  verifyWebhookSignature,
  fetchPayment,
  approveOrderByCode,
  paymentsConfigured,
} = require("../payments");
const publicApi = require("./public");
const authApi = require("./auth");
const studentApi = require("./student");
const adminApi = require("./admin");

function createApiRouter() {
  const router = createRouter();

  publicApi.register(router);
  authApi.register(router);
  studentApi.register(router);
  adminApi.register(router);

  /* --------------------------- Pagamentos (webhook) -------------------------- */
  /**
   * O retorno do navegador nunca é usado como confirmação. O status é sempre
   * consultado diretamente na API do provedor com o access token do servidor.
   */
  router.add("POST", "/api/payments/mercadopago/webhook", async (ctx) => {
    if (!paymentsConfigured()) bad("Pagamento online não configurado.", 503);

    const dataId =
      ctx.query["data.id"] ||
      ctx.query.data_id ||
      (ctx.body && ctx.body.data && ctx.body.data.id) ||
      (ctx.body && ctx.body.id) ||
      "";
    const type = ctx.body?.type || ctx.query.type || "";

    if (config.payments.mpWebhookSecret) {
      const valid = verifyWebhookSignature({
        headers: ctx.headers,
        dataId: String(dataId),
      });
      if (!valid) {
        await logActivity(null, "payment.webhook_rejected", "order", null, "Assinatura de webhook inválida.");
        bad("Assinatura inválida.", 401);
      }
    }

    if (type && type !== "payment") return { body: { received: true, ignored: true } };
    if (!dataId) bad("Notificação sem identificador de pagamento.", 400);

    const payment = await fetchPayment(String(dataId));
    if (!payment) return { body: { received: true, pending: true } };

    const reference = String(payment.external_reference || "");
    if (!reference) return { body: { received: true, ignored: true } };

    if (payment.status === "approved") {
      const result = await approveOrderByCode(reference, {
        provider: "mercadopago",
        providerRef: String(payment.id || dataId),
        method: payment.payment_method_id || payment.payment_type_id || "mercadopago",
      });
      if (result.error && result.status !== 409) {
        console.error("[webhook] Falha ao aprovar pedido:", result.error);
      }
      if (!result.already) {
        await logActivity(
          result.order?.user_id || null,
          "payment.webhook_approved",
          "order",
          result.order?.id || null,
          `Pagamento aprovado pelo Mercado Pago (${payment.id}).`
        );
      }
      return { body: { received: true } };
    }

    if (["refunded", "charged_back"].includes(payment.status)) {
      const order = await get("SELECT * FROM orders WHERE code = ?", reference);
      if (order && order.status === "approved") {
        await run("UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?", nowIso(), order.id);
        await run(
          "INSERT INTO payments (order_id, status, method, amount_cents, provider, provider_ref, created_at) VALUES (?, 'refunded', ?, ?, 'mercadopago', ?, ?)",
          order.id,
          payment.payment_method_id || "mercadopago",
          order.total_cents,
          String(payment.id || dataId),
          nowIso()
        );
        await run(
          "UPDATE enrollments SET status = 'cancelled', updated_at = ? WHERE user_id = ? AND course_id = ? AND status = 'active'",
          nowIso(),
          order.user_id,
          order.course_id
        );
        await logActivity(order.user_id, "order.refunded", "order", order.id, "Estorno confirmado pelo Mercado Pago.");
      }
      return { body: { received: true } };
    }

    return { body: { received: true, status: payment.status } };
  });

  return router;
}

module.exports = { createApiRouter };
