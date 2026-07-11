export function parseId(raw: string): number | undefined {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    console.error(`"${raw}" no es un id válido (tiene que ser un entero positivo)`);
    process.exitCode = 1;
    return undefined;
  }
  return id;
}
