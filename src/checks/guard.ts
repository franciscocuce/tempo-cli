import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class BlockedTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedTargetError";
  }
}

// rangos que nunca deberían salir de la máquina: loopback, redes privadas, link-local
// (169.254.169.254 es la metadata de AWS/GCP/Azure) y reservados varios
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function allowsPrivateTargets(): boolean {
  return process.env.TEMPO_ALLOW_PRIVATE_TARGETS === "1";
}

export function parseTargetUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedTargetError(`"${raw}" no es una URL válida`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedTargetError(`Solo se permiten URLs http y https, no ${url.protocol}`);
  }

  return url;
}

// versión sincrónica y sin DNS: solo mira la IP cuando la URL ya trae una literal.
// Existe para poder avisar al guardar el monitor y no recién en el primer chequeo.
// NO reemplaza a assertAllowedTarget: un dominio puede resolver a una dirección privada,
// y puede pasar a resolver a una después de guardado (DNS rebinding). El chequeo real
// sigue siendo el de abajo, que corre cada vez
export function blockedLiteralAddress(url: URL): string | null {
  if (allowsPrivateTargets()) {
    return null;
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) === 0) {
    return null;
  }

  return isBlockedAddress(host) ? host : null;
}

export async function assertAllowedTarget(raw: string): Promise<URL> {
  const url = parseTargetUrl(raw);

  if (allowsPrivateTargets()) {
    return url;
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  for (const address of await resolveAddresses(host)) {
    if (isBlockedAddress(address)) {
      throw new BlockedTargetError(
        `${url.hostname} apunta a una dirección privada o reservada (${address}). ` +
          "Si es a propósito, arrancá tempo con TEMPO_ALLOW_PRIVATE_TARGETS=1",
      );
    }
  }

  return url;
}

async function resolveAddresses(host: string): Promise<string[]> {
  if (isIP(host) !== 0) {
    return [host];
  }

  try {
    const results = await lookup(host, { all: true });
    return results.map((r) => r.address);
  } catch {
    throw new BlockedTargetError(`No se pudo resolver el dominio ${host}`);
  }
}

export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    return isBlockedV4(address);
  }
  if (version === 6) {
    return isBlockedV6(address);
  }

  return true;
}

function isBlockedV4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (value === null) {
    return true;
  }
  if (value === 0xffffffff) {
    return true;
  }

  return BLOCKED_V4.some(([base, bits]) => {
    const baseValue = ipv4ToInt(base);
    return baseValue !== null && inCidr(value, baseValue, bits);
  });
}

function isBlockedV6(address: string): boolean {
  const bytes = parseIPv6(address);
  if (bytes === null) {
    return true;
  }

  // ::ffff:a.b.c.d es una IPv4 disfrazada, se chequea como tal
  const mapped = bytes.slice(0, 12);
  if (mapped.every((b, i) => (i < 10 ? b === 0 : b === 0xff))) {
    return isBlockedV4(bytes.slice(12).join("."));
  }

  if (bytes.every((b) => b === 0)) {
    return true;
  }
  if (bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1) {
    return true;
  }
  if ((bytes[0] & 0xfe) === 0xfc) {
    return true;
  }
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) {
    return true;
  }
  if (bytes[0] === 0xff) {
    return true;
  }

  return false;
}

function ipv4ToInt(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }

  return value;
}

function inCidr(value: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) >>> 0 === (base & mask) >>> 0;
}

function parseIPv6(address: string): number[] | null {
  const withoutZone = address.split("%")[0];
  const halves = withoutZone.split("::");
  if (halves.length > 2) {
    return null;
  }

  const head = groupsToBytes(halves[0]);
  const tail = halves.length === 2 ? groupsToBytes(halves[1]) : [];
  if (head === null || tail === null) {
    return null;
  }

  if (halves.length === 1) {
    return head.length === 16 ? head : null;
  }

  const gap = 16 - head.length - tail.length;
  if (gap < 0) {
    return null;
  }

  return [...head, ...new Array<number>(gap).fill(0), ...tail];
}

function groupsToBytes(part: string): number[] | null {
  if (part === "") {
    return [];
  }

  const bytes: number[] = [];

  for (const group of part.split(":")) {
    if (group.includes(".")) {
      const value = ipv4ToInt(group);
      if (value === null) {
        return null;
      }
      bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
      continue;
    }

    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
      return null;
    }
    const value = parseInt(group, 16);
    bytes.push((value >> 8) & 0xff, value & 0xff);
  }

  return bytes;
}
