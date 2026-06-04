export const queryRows = (
  rows: any[],
  filters: Record<string, any> = {}
) =>
  rows.filter((row) =>
    Object.entries(filters).every(([field, value]) => row[field] === value)
  );