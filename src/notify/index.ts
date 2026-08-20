import { sendDiscord } from "./discord.js";
import type { Alert, Channel, DeliveryResult } from "./types.js";

export async function send(channel: Channel, alert: Alert): Promise<void> {
  switch (channel.type) {
    case "discord":
      await sendDiscord(channel.target, alert);
  }
}

export async function dispatch(channels: Channel[], alert: Alert): Promise<DeliveryResult[]> {
  const targets = channels.filter((channel) => channel.enabled);

  // que un canal roto no impida avisar por los demás
  return Promise.all(
    targets.map(async (channel): Promise<DeliveryResult> => {
      try {
        await send(channel, alert);
        return { channelId: channel.id, ok: true, error: null };
      } catch (err) {
        return {
          channelId: channel.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );
}

export { buildPayload } from "./discord.js";
export { CHANNEL_TYPES } from "./types.js";
export type { Alert, AlertKind, Channel, ChannelType, DeliveryResult } from "./types.js";
