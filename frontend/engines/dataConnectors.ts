import * as XLSX from "xlsx";

export const parseSpreadsheetFile = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const columnNames = Array.from(
    rows.reduce((columns, row) => {
      Object.keys(row).forEach((key) => columns.add(key));
      return columns;
    }, new Set<string>())
  );

  return {
    _id: `uploaded-${Date.now()}`,
    name: file.name.replace(/\.[^.]+$/, "") || "Uploaded data",
    columns: columnNames.map((name) => ({ name })),
    rows,
  };
};
