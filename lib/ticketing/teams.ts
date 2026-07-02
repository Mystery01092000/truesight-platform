import "server-only";

import type { AccessTicket } from "@/db/schema";
import { TOOL_LABELS, STATUS_LABELS, type ApprovalRole } from "@/lib/ticketing/types";

/**
 * Microsoft Teams incoming-webhook integration for the access-ticket approval
 * flow. Posts an Adaptive Card to a Teams channel webhook. Gracefully no-ops
 * when no webhook URL is configured — the ticket still records, just without the
 * Teams nudge.
 */

export type TeamsCard = {
  type: "message";
  attachments: {
    contentType: "application/vnd.microsoft.card.adaptive";
    content: Record<string, unknown>;
  }[];
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";

function ticketUrl(id: string): string {
  return `${APP_URL}/tickets/${id}`;
}

function toolsList(tools: string[]): string {
  return tools.map((t) => TOOL_LABELS[t as keyof typeof TOOL_LABELS] ?? t).join(" · ");
}

function mention(role: ApprovalRole): string {
  return `@${role}`;
}

/** Build the Adaptive Card body for a freshly raised request (first review → @peeyush). */
export function buildRequestCard(ticket: AccessTicket): TeamsCard {
  const body = [
    {
      type: "TextBlock",
      text: `${mention("peeyush")} — new developer-tools access request`,
      weight: "Bolder",
      size: "Medium",
      wrap: true,
    },
    {
      type: "FactSet",
      facts: [
        { title: "Requester", value: `${ticket.requesterName} (${ticket.requesterEmail})` },
        { title: "Team", value: ticket.team },
        { title: "Project", value: ticket.project },
        { title: "Reporting Manager", value: ticket.reportingManager },
        { title: "Tools", value: toolsList(ticket.tools) },
        { title: "Timeline", value: ticket.timelineCustom ? `${ticket.timeline} (${ticket.timelineCustom})` : ticket.timeline },
        { title: "Manager approved", value: ticket.managerApproved ? "Yes" : "No" },
      ],
    },
    {
      type: "ActionSet",
      actions: [
        {
          type: "Action.OpenUrl",
          title: "Approve",
          url: `${ticketUrl(ticket.id)}?decision=approved`,
        },
        {
          type: "Action.OpenUrl",
          title: "Need more info",
          url: `${ticketUrl(ticket.id)}?decision=need_more_info`,
        },
        {
          type: "Action.OpenUrl",
          title: "Decline",
          url: `${ticketUrl(ticket.id)}?decision=declined`,
        },
      ],
    },
  ];

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body,
        },
      },
    ],
  };
}

/** Build the Adaptive Card for the second approval stage (→ @kamal). */
export function buildApprovalCard(ticket: AccessTicket, approver: ApprovalRole): TeamsCard {
  const body = [
    {
      type: "TextBlock",
      text: `${mention(approver)} — access request ready for your review`,
      weight: "Bolder",
      size: "Medium",
      wrap: true,
    },
    {
      type: "FactSet",
      facts: [
        { title: "Requester", value: `${ticket.requesterName} (${ticket.requesterEmail})` },
        { title: "Team", value: ticket.team },
        { title: "Project", value: ticket.project },
        { title: "Tools", value: toolsList(ticket.tools) },
        { title: "Status", value: STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] ?? ticket.status },
      ],
    },
    {
      type: "ActionSet",
      actions: [
        {
          type: "Action.OpenUrl",
          title: "Approve",
          url: `${ticketUrl(ticket.id)}?decision=approved`,
        },
        {
          type: "Action.OpenUrl",
          title: "Decline",
          url: `${ticketUrl(ticket.id)}?decision=declined`,
        },
      ],
    },
  ];

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body,
        },
      },
    ],
  };
}

/** POST an Adaptive Card to a Teams incoming webhook. */
export async function sendTeamsNotification(
  webhookUrl: string,
  card: TeamsCard,
): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!res.ok) {
      console.error(
        `[ticketing/teams] webhook responded ${res.status}: ${await res.text()}`,
      );
    }
  } catch (err) {
    console.error("[ticketing/teams] failed to post notification:", err);
  }
}

/**
 * Notify Teams about a ticket if a webhook is configured. Reads the webhook URL
 * from `TEAMS_WEBHOOK_URL` at call time and no-ops gracefully when unset so the
 * ticket flow still completes in environments without Teams wiring.
 */
export async function notifyTeams(card: TeamsCard): Promise<void> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.info("[ticketing/teams] TEAMS_WEBHOOK_URL not set — skipping notification.");
    return;
  }
  await sendTeamsNotification(webhookUrl, card);
}
