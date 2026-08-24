import { connect, type PeerCertificate } from "node:tls";
import { assertAllowedTarget } from "./guard.js";

export const CERT_WARNING_DAYS = 14;

const DEFAULT_TIMEOUT_MS = 10_000;
const HTTPS_PORT = 443;

export interface CertInfo {
  expiresAt: string;
  daysLeft: number;
  issuer: string | null;
}

export function certInfo(cert: Partial<PeerCertificate>, now: Date = new Date()): CertInfo | null {
  if (cert.valid_to === undefined) {
    return null;
  }

  const expiresAt = new Date(cert.valid_to);
  if (Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  return {
    expiresAt: expiresAt.toISOString(),
    daysLeft: Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000),
    issuer: firstValue(cert.issuer?.O) ?? firstValue(cert.issuer?.CN),
  };
}

// según la CA, estos campos vienen como string o como lista de strings
function firstValue(value: string | string[] | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function isExpiringSoon(info: CertInfo, days: number = CERT_WARNING_DAYS): boolean {
  return info.daysLeft <= days;
}

export async function readCertificate(
  rawUrl: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<CertInfo | null> {
  const url = await assertAllowedTarget(rawUrl);

  if (url.protocol !== "https:") {
    return null;
  }

  const cert = await fetchPeerCertificate(url, timeoutMs);
  return certInfo(cert);
}

function fetchPeerCertificate(url: URL, timeoutMs: number): Promise<PeerCertificate> {
  const host = url.hostname.replace(/^\[|\]$/g, "");

  return new Promise((resolve, reject) => {
    const socket = connect(
      {
        host,
        port: url.port === "" ? HTTPS_PORT : Number(url.port),
        servername: host,
        // un certificado vencido igual queremos leerlo: de eso se trata el chequeo.
        // que la cadena sea válida ya lo verifica el chequeo http normal
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (cert === null || Object.keys(cert).length === 0) {
          reject(new Error(`${host} no devolvió un certificado`));
          return;
        }
        resolve(cert);
      },
    );

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error(`${host} no respondió el saludo TLS en ${timeoutMs / 1000}s`));
    });

    socket.once("error", (err: Error) => {
      socket.destroy();
      reject(err);
    });
  });
}
