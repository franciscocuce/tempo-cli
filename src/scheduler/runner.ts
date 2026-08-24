import type { Database } from "better-sqlite3";
import { runHttpCheck } from "../checks/http.js";
import { readCertificate, isExpiringSoon } from "../checks/cert.js";
import { recordCheck, certAlert, type Transition } from "../incidents/state.js";
import { listChannels } from "../store/channels.js";
import { setCertExpiry, type Monitor } from "../store/monitors.js";
import { dispatch } from "../notify/index.js";
import type { Alert } from "../notify/types.js";

// si no, un certificado que vence en 14 días avisaría todos los días durante dos semanas
const CERT_ALERT_DAYS = [14, 7, 3, 1];

export async function checkMonitor(
  db: Database,
  monitor: Monitor,
  now: Date = new Date(),
): Promise<Transition> {
  const outcome = await runHttpCheck({
    url: monitor.url,
    method: monitor.method,
    expectedStatus: monitor.expectedStatus,
    keyword: monitor.keyword,
    keywordMode: monitor.keywordMode,
    timeoutMs: monitor.timeoutMs,
    followRedirects: monitor.followRedirects,
  });

  const transition = recordCheck(db, monitor, outcome, now);

  if (transition.alert !== null) {
    await notify(db, transition.alert);
  }

  return transition;
}

export async function refreshCertificate(
  db: Database,
  monitor: Monitor,
  now: Date = new Date(),
): Promise<Alert | null> {
  let info;
  try {
    info = await readCertificate(monitor.url);
  } catch {
    return null;
  }

  if (info === null) {
    setCertExpiry(db, monitor.id, null);
    return null;
  }

  setCertExpiry(db, monitor.id, info.expiresAt);

  if (!isExpiringSoon(info) || !shouldAlert(info.daysLeft)) {
    return null;
  }

  const alert = certAlert(monitor, info.daysLeft, now);
  await notify(db, alert);
  return alert;
}

function shouldAlert(daysLeft: number): boolean {
  return daysLeft <= 0 || CERT_ALERT_DAYS.includes(daysLeft);
}

async function notify(db: Database, alert: Alert): Promise<void> {
  const results = await dispatch(listChannels(db), alert);

  for (const result of results) {
    if (!result.ok) {
      console.error(`No se pudo avisar por el canal ${result.channelId}: ${result.error}`);
    }
  }
}
