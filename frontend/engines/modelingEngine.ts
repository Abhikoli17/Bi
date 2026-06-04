import { isNumericValue } from "./etlEngine";

export const getNumericFields = (columns: any[], rows: any[]) =>
  columns
    .filter((field) => rows.some((row) => isNumericValue(row[field.name])))
    .map((field) => field.name);

export const getCategoryFields = (columns: any[], numericFields: string[]) =>
  columns
    .filter((field) => !numericFields.includes(field.name))
    .map((field) => field.name);

export const groupRowsByField = (
  rows: any[],
  xField: string,
  valueField: string
) => {
  const grouped = rows.reduce((acc: Record<string, number>, row) => {
    const key = String(row[xField] ?? "Blank");
    const value = Number(row[valueField] ?? 0);

    acc[key] = (acc[key] ?? 0) + (Number.isNaN(value) ? 0 : value);
    return acc;
  }, {});

  return Object.entries(grouped).map(([name, value]) => ({
    name,
    value,
  }));
};