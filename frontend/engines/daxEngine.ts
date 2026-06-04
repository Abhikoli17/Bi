export const sumMeasure = (rows: any[], field: string) =>
  rows.reduce((sum, row) => {
    const value = Number(row[field] ?? 0);
    return sum + (Number.isNaN(value) ? 0 : value);
  }, 0);

export const countRows = (rows: any[]) => rows.length;

export const averageMeasure = (rows: any[], field: string) => {
  if (!rows.length) return 0;
  return sumMeasure(rows, field) / rows.length;
};

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);