"use strict";

const config = require("./config");

async function sendMail({ to, subject, text, html }) {
  if (!config.mail.resendKey) {
    console.info(`[mail] E-mail não enviado (RESEND_API_KEY ausente): ${subject} -> ${to}`);
    return { sent: false, reason: "mail_not_configured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.mail.resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.mail.from,
        to: [to],
        subject,
        text,
        html,
      }),
    });
    if (!response.ok) {
      console.error("[mail] Falha no envio:", response.status, (await response.text()).slice(0, 300));
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (error) {
    console.error("[mail] Erro de rede:", error.message);
    return { sent: false, reason: "network_error" };
  }
}

module.exports = { sendMail };
