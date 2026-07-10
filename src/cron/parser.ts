export interface CronField {
  values: number[];
  restricted: boolean;
}

export interface CronSchedule {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

interface FieldSpec {
  name: string;
  min: number;
  max: number;
}

const FIELD_SPECS: FieldSpec[] = [
  { name: "minuto", min: 0, max: 59 },
  { name: "hora", min: 0, max: 23 },
  { name: "día del mes", min: 1, max: 31 },
  { name: "mes", min: 1, max: 12 },
  { name: "día de la semana", min: 0, max: 6 },
];

export function parseExpression(expr: string): CronSchedule {
  const fields = expr.trim().split(/\s+/);

  if (expr.trim() === "" || fields.length !== 5) {
    throw new Error(
      `Se esperaban 5 campos separados por espacios, se recibieron ${
        expr.trim() === "" ? 0 : fields.length
      }: "${expr}"`
    );
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields.map((field, i) =>
    parseField(field, FIELD_SPECS[i])
  );

  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

function parseField(field: string, spec: FieldSpec): CronField {
  const totalRange = spec.max - spec.min + 1;
  const collected = new Set<number>();

  for (const part of field.split(",")) {
    for (const value of parsePart(part, spec)) {
      collected.add(value);
    }
  }

  const values = [...collected].sort((a, b) => a - b);

  return { values, restricted: values.length < totalRange };
}

function parsePart(part: string, spec: FieldSpec): number[] {
  const [rangePart, stepPart, ...rest] = part.split("/");

  if (rest.length > 0) {
    throw new Error(`Paso inválido en "${part}" (${spec.name})`);
  }

  let step = 1;
  if (stepPart !== undefined) {
    step = Number(stepPart);
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`El paso debe ser un entero positivo en "${part}" (${spec.name})`);
    }
  }

  let start: number;
  let end: number;

  if (rangePart === "*") {
    start = spec.min;
    end = spec.max;
  } else if (rangePart.includes("-")) {
    const [from, to, ...extra] = rangePart.split("-");
    if (extra.length > 0) {
      throw new Error(`Rango inválido en "${part}" (${spec.name})`);
    }
    start = parseNumber(from, spec);
    end = parseNumber(to, spec);
    if (start > end) {
      throw new Error(`Rango invertido "${rangePart}" (${spec.name})`);
    }
  } else {
    start = parseNumber(rangePart, spec);
    end = stepPart !== undefined ? spec.max : start;
  }

  const values: number[] = [];
  for (let value = start; value <= end; value += step) {
    values.push(normalize(value, spec));
  }
  return values;
}

function parseNumber(token: string, spec: FieldSpec): number {
  if (!/^\d+$/.test(token)) {
    throw new Error(`Valor inválido "${token}" (${spec.name})`);
  }
  const value = Number(token);
  const upper = spec.name === "día de la semana" ? 7 : spec.max;
  if (value < spec.min || value > upper) {
    throw new Error(
      `Valor "${value}" fuera de rango ${spec.min}-${spec.max} (${spec.name})`
    );
  }
  return value;
}

function normalize(value: number, spec: FieldSpec): number {
  if (spec.name === "día de la semana" && value === 7) {
    return 0;
  }
  return value;
}
