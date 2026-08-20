import { assertAllowedTarget } from "../checks/guard.js";
import type { Alert, AlertKind } from "./types.js";

const TIMEOUT_MS = 10_000;

const COLORS: Record<AlertKind, number> = {
  down: 0xe5484d,
  up: 0x30a46c,
  cert: 0xf5a524,
};

export function buildPayload(alert: Alert): unknown {
  return {
    username: "tempo",
    embeds: [
      {
        title: title(alert),
        description: alert.detail,
        url: alert.url,
        color: COLORS[alert.kind],
        timestamp: alert.at.toISOString(),
        footer: { text: alert.url },
      },
    ],
  };
}

function title(alert: Alert): string {
  switch (alert.kind) {
    case "down":
      return `🔴 ${alert.monitorName} está caído`;
    case "up":
      return `🟢 ${alert.monitorName} volvió`;
    case "cert":
      return `🟡 El certificado de ${alert.monitorName} vence pronto`;
  }
}

export async function sendDiscord(webhook: string, alert: Alert): Promise<void> {
  const url = await assertAllowedTarget(webhook);

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildPayload(alert)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  await response.body?.cancel().catch(() => {});

  if (!response.ok) {
    throw new Error(`Discord respondió ${response.status}`);
  }
}
