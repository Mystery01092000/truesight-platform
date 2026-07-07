import "server-only";
import nodemailer from "nodemailer";

import type { AccessTicket } from "@/db/schema";
import { TOOL_LABELS } from "@/lib/ticketing/types";

/**
 * SMTP email integration for the access-ticket flow. When DevOps completes a
 * ticket (status → done), an email with the granted access details is sent to
 * the requester. Reads SMTP_* env vars at call time and no-ops gracefully when
 * SMTP isn't configured, so the flow completes in any environment.
 */

export type AccessDetail = {
  tool: string;
  accessMode: string;
  detail?: string;
};

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function toolsList(tools: string[]): string {
  return tools.map((t) => TOOL_LABELS[t as keyof typeof TOOL_LABELS] ?? t).join(", ");
}

function buildHtml(ticket: AccessTicket, accessDetails: AccessDetail[]): string {
  const rows = accessDetails
    .map(
      (d) =>
        `<tr><td style="padding:6px 12px;border:1px solid #e5e5e5;">${
          TOOL_LABELS[d.tool as keyof typeof TOOL_LABELS] ?? d.tool
        }</td><td style="padding:6px 12px;border:1px solid #e5e5e5;">${d.accessMode}</td><td style="padding:6px 12px;border:1px solid #e5e5e5;">${
          d.detail ?? "—"
        }</td></tr>`,
    )
    .join("");

  return `
    <div style="font-family:-apple-system,system-ui,sans-serif;color:#111;max-width:560px;">
      <h2 style="margin:0 0 8px;">Your developer-tools access is ready</h2>
      <p style="margin:0 0 16px;color:#555;">Hi ${ticket.requesterName},</p>
      <p style="margin:0 0 16px;color:#333;">
        Your access request for <strong>${toolsList(ticket.tools)}</strong> has been fulfilled.
        Details of the granted access are below.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin:0 0 16px;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:6px 12px;border:1px solid #e5e5e5;text-align:left;">Tool</th>
            <th style="padding:6px 12px;border:1px solid #e5e5e5;text-align:left;">Access mode</th>
            <th style="padding:6px 12px;border:1px solid #e5e5e5;text-align:left;">Details</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:0;color:#555;">
        Reference: <code>${ticket.id}</code><br/>
        Team: ${ticket.team} · Project: ${ticket.project}
      </p>
      <p style="margin:16px 0 0;color:#888;font-size:12px;">
        — Truesight · Arcane DevOps
      </p>
    </div>
  `;
}

/**
 * Send the access-details email to a requester once their ticket is done.
 * No-ops when SMTP_* env vars are not configured.
 */
export async function sendAccessDetailsEmail(
  to: string,
  ticket: AccessTicket,
  accessDetails: AccessDetail[],
): Promise<void> {
  if (!smtpConfigured()) {
    console.info("[ticketing/smtp] SMTP_* not configured — skipping access-details email.");
    return;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "Truesight <no-reply@truesight.local>";
  const text =
    `Your developer-tools access request (${ticket.id}) is ready.\n\n` +
    accessDetails
      .map(
        (d) =>
          `- ${TOOL_LABELS[d.tool as keyof typeof TOOL_LABELS] ?? d.tool}: ${d.accessMode}${
            d.detail ? ` — ${d.detail}` : ""
          }`,
      )
      .join("\n");

  try {
    await transporter().sendMail({
      from,
      to,
      subject: `[Truesight] Access ready — ${toolsList(ticket.tools)}`,
      text,
      html: buildHtml(ticket, accessDetails),
    });
    console.info(`[ticketing/smtp] access-details email sent to ${to} for ticket ${ticket.id}`);
  } catch (err) {
    console.error("[ticketing/smtp] failed to send access-details email:", err);
  }
}
