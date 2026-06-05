type AggregateFunction = "SUM" | "COUNT" | "AVERAGE" | "MIN" | "MAX" | "COUNTROWS";

const toNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const getFieldValues = (rows: any[], field: string) =>
  rows.map((row) => row[field]).filter((value) => value !== undefined && value !== null);

export const sumMeasure = (rows: any[], field: string) =>
  rows.reduce((sum, row) => {
    const value = Number(row[field] ?? 0);
    return sum + (Number.isNaN(value) ? 0 : value);
  }, 0);

export const countRows = (rows: any[]) => rows.length;

export const countMeasure = (rows: any[], field?: string) => {
  if (!field) return countRows(rows);
  return getFieldValues(rows, field).filter((value) => String(value).trim() !== "").length;
};

export const averageMeasure = (rows: any[], field: string) => {
  const values = getFieldValues(rows, field).map(toNumber);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const minMeasure = (rows: any[], field: string) => {
  const values = getFieldValues(rows, field).map(toNumber);
  return values.length ? Math.min(...values) : 0;
};

export const maxMeasure = (rows: any[], field: string) => {
  const values = getFieldValues(rows, field).map(toNumber);
  return values.length ? Math.max(...values) : 0;
};

export const normalizeDaxFieldName = (fieldExpression = "") =>
  fieldExpression
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/.*\[/, "")
    .replace(/\]$/, "")
    .trim();

export const evaluateDaxExpression = (expression: string, rows: any[]) => {
  const match = expression
    .trim()
    .match(/^(SUM|COUNT|AVERAGE|MIN|MAX|COUNTROWS)\s*\((.*?)\)$/i);

  if (!match) {
    throw new Error(`Unsupported DAX expression: ${expression}`);
  }

  const fn = match[1].toUpperCase() as AggregateFunction;
  const field = normalizeDaxFieldName(match[2]);

  if (fn === "COUNTROWS") return countRows(rows);
  if (fn === "COUNT") return countMeasure(rows, field || undefined);

  if (!field) {
    throw new Error(`${fn} requires a field name.`);
  }

  const evaluators: Record<Exclude<AggregateFunction, "COUNT" | "COUNTROWS">, () => number> = {
    SUM: () => sumMeasure(rows, field),
    AVERAGE: () => averageMeasure(rows, field),
    MIN: () => minMeasure(rows, field),
    MAX: () => maxMeasure(rows, field),
  };

  return evaluators[fn as Exclude<AggregateFunction, "COUNT" | "COUNTROWS">]();
};

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);
