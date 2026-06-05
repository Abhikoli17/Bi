export interface SemanticRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

export interface SemanticTable {
  name: string;
  columns: any[];
  rows: any[];
}

const normalizeColumnName = (name: string) =>
  name.toLowerCase().replace(/[\s_-]/g, "");

const isIdColumn = (name: string) => {
  const normalized = normalizeColumnName(name);
  return normalized === "id" || normalized.endsWith("id");
};

const getColumnNames = (table: SemanticTable) =>
  (table.columns ?? []).map((column: any) => String(column.name));

export const inferRelationships = (tables: SemanticTable[]): SemanticRelationship[] => {
  const relationships: SemanticRelationship[] = [];

  tables.forEach((sourceTable) => {
    tables.forEach((targetTable) => {
      if (sourceTable.name === targetTable.name) return;

      const sourceColumns = getColumnNames(sourceTable);
      const targetColumns = getColumnNames(targetTable);

      sourceColumns.forEach((sourceColumn) => {
        const normalizedSource = normalizeColumnName(sourceColumn);
        if (!isIdColumn(sourceColumn)) return;

        const exactMatch = targetColumns.find(
          (targetColumn) => normalizeColumnName(targetColumn) === normalizedSource
        );
        const idMatch = targetColumns.find((targetColumn) => {
          const normalizedTarget = normalizeColumnName(targetColumn);
          return normalizedTarget === "id" && normalizedSource.endsWith("id");
        });

        const targetColumn = exactMatch ?? idMatch;

        if (!targetColumn) return;

        const key = `${sourceTable.name}.${sourceColumn}->${targetTable.name}.${targetColumn}`;
        const exists = relationships.some(
          (relationship) =>
            `${relationship.sourceTable}.${relationship.sourceColumn}->${relationship.targetTable}.${relationship.targetColumn}` ===
            key
        );

        if (!exists) {
          relationships.push({
            sourceTable: sourceTable.name,
            sourceColumn,
            targetTable: targetTable.name,
            targetColumn,
          });
        }
      });
    });
  });

  return relationships;
};

export const createSemanticModel = (datasetOrDatasets: any) => {
  const datasets = Array.isArray(datasetOrDatasets)
    ? datasetOrDatasets
    : [datasetOrDatasets].filter(Boolean);

  const tables = datasets.map((dataset: any) => ({
    name: dataset?.name ?? "Table",
    columns: dataset?.columns ?? [],
    rows: dataset?.rows ?? [],
  }));

  return {
    name: tables[0]?.name ?? "Untitled model",
    tables,
    measures: [],
    relationships: inferRelationships(tables),
  };
};
