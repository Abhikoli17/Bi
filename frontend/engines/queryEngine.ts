export const queryRows = (rows: any[], activeFilters: string[] = []) => {
  if (!activeFilters.length) return rows;

  return rows.filter((row) =>
    activeFilters.every((fieldName) => {
      const value = row[fieldName];
      return value !== undefined && value !== null && String(value).trim() !== "";
    })
  );
};
