const EXACT = /^\d{3}$/;
const CLASS = /^[1-5]xx$/i;
const RANGE = /^(\d{3})-(\d{3})$/;

export function isValidStatusSpec(spec: string): boolean {
  const parts = spec.split(",").map((part) => part.trim());

  return (
    parts.length > 0 &&
    parts.every((part) => {
      const range = RANGE.exec(part);
      if (range !== null) {
        return Number(range[1]) <= Number(range[2]);
      }
      return EXACT.test(part) || CLASS.test(part);
    })
  );
}

export function statusMatches(spec: string, status: number): boolean {
  return spec.split(",").some((part) => partMatches(part.trim(), status));
}

function partMatches(part: string, status: number): boolean {
  if (EXACT.test(part)) {
    return Number(part) === status;
  }

  if (CLASS.test(part)) {
    return Math.floor(status / 100) === Number(part[0]);
  }

  const range = RANGE.exec(part);
  if (range !== null) {
    return status >= Number(range[1]) && status <= Number(range[2]);
  }

  return false;
}
