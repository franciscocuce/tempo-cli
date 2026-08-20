export const CHANNEL_TYPES = ["discord"] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number];

export interface Channel {
  id: number;
  type: ChannelType;
  label: string;
  target: string;
  enabled: boolean;
}

export type AlertKind = "down" | "up" | "cert";

export interface Alert {
  kind: AlertKind;
  monitorName: string;
  url: string;
  detail: string;
  at: Date;
}

export interface DeliveryResult {
  channelId: number;
  ok: boolean;
  error: string | null;
}
