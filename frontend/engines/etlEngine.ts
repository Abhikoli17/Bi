export const isNumericValue = (value: unknown) =>
  typeof value === "number" || (!Number.isNaN(Number(value)) && value !== "");

export const normalizeRows = (rows: any[]) =>
  rows.filter((row) =>
    Object.values(row).some((value) => value !== null && value !== undefined && value !== "")
  );

export const inferColumns = (rows: any[]) => {
  if (!rows.length) return [];

  return Object.keys(rows[0]).map((name) => ({
    name,
  }));
};