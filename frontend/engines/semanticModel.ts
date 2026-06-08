// ─────────────────────────────────────────────────────────────
// semanticModel.ts
// Enterprise Semantic Model Engine
// ─────────────────────────────────────────────────────────────

import type {
  ColumnDefinition,
  DataRow,
  SemanticModel,
  SemanticRelationship,
  SemanticTable,
} from "./types.js";

export type {
  ColumnDefinition,
  DataRow,
  MeasureDefinition,
  SemanticModel,
  SemanticRelationship,
  SemanticTable,
} from "./types.js";

// ─────────────────────────────────────────────────────────────
// Column Helpers
// ─────────────────────────────────────────────────────────────

const normalizeColumnName = (name: string): string =>
  name.toLowerCase().replace(/[\s_-]/g, "");

const normalizeTableName = (name: string): string =>
  name.toLowerCase().replace(/[\s_-]/g, "");

const isIdColumn = (name: string): boolean =>
  /^id$/i.test(name) ||
  /[_\-\s]id$/i.test(name) ||
  /[a-zA-Z]I[dD]$/.test(name);

const getColumnNames = (
  table: SemanticTable
): string[] =>
  table.columns.map((c) => c.name);

// ─────────────────────────────────────────────────────────────
// Column Normalization
// ─────────────────────────────────────────────────────────────

function normalizeColumns(
  raw: unknown[]
): ColumnDefinition[] {

  return raw
    .map(
      (
        col
      ): ColumnDefinition | null => {

        if (
          typeof col === "string" &&
          col.trim()
        ) {
          return {
            name: col.trim(),
          };
        }

        if (
          typeof col === "object" &&
          col !== null
        ) {

          const c =
            col as Record<
              string,
              unknown
            >;

          const name =
            String(
              c.name ??
              c.field ??
              c.key ??
              ""
            ).trim();

          if (!name) {
            return null;
          }

          const type =
            c.type as
              | ColumnDefinition["type"]
              | undefined;

          return type
            ? {
                name,
                type,
              }
            : {
                name,
              };
        }

        return null;
      }
    )
    .filter(
      (
        c
      ): c is ColumnDefinition =>
        c !== null
    );
}

// ─────────────────────────────────────────────────────────────
// Confidence Score
// ─────────────────────────────────────────────────────────────

const calculateConfidence = (
  sourceColumn: string,
  targetTable: string,
  targetColumn: string
): number => {

  const source =
    normalizeColumnName(
      sourceColumn
    );

  const table =
    normalizeTableName(
      targetTable
    );

  const target =
    normalizeColumnName(
      targetColumn
    );

  if (
    source === `${table}id` &&
    target === "id"
  ) {
    return 0.99;
  }

  if (
    source === target
  ) {
    return 0.95;
  }

  return 0.80;
};

// ─────────────────────────────────────────────────────────────
// Cardinality Detection
// ─────────────────────────────────────────────────────────────

const detectCardinality = (
  sourceRows: DataRow[],
  sourceColumn: string,
  targetRows: DataRow[],
  targetColumn: string
):
  | "OneToOne"
  | "OneToMany"
  | "ManyToOne"
  | "ManyToMany" => {

  const sourceUnique =
    new Set(
      sourceRows.map(
        (row) =>
          row[sourceColumn]
      )
    ).size;

  const targetUnique =
    new Set(
      targetRows.map(
        (row) =>
          row[targetColumn]
      )
    ).size;

  const sourceMany =
    sourceRows.length >
    sourceUnique;

  const targetMany =
    targetRows.length >
    targetUnique;

  if (
    !sourceMany &&
    !targetMany
  ) {
    return "OneToOne";
  }

  if (
    sourceMany &&
    !targetMany
  ) {
    return "ManyToOne";
  }

  if (
    !sourceMany &&
    targetMany
  ) {
    return "OneToMany";
  }

  return "ManyToMany";
};

// ─────────────────────────────────────────────────────────────
// Relationship Inference
// ─────────────────────────────────────────────────────────────

export const inferRelationships = (
  tables: SemanticTable[]
): SemanticRelationship[] => {

  const relationships: SemanticRelationship[] = [];

  const seen =
    new Set<string>();

  for (
    const sourceTable of tables
  ) {

    for (
      const targetTable of tables
    ) {

      if (
        sourceTable.name ===
        targetTable.name
      ) {
        continue;
      }

      const sourceColumns =
        getColumnNames(
          sourceTable
        );

      const targetColumns =
        getColumnNames(
          targetTable
        );

      for (
        const sourceColumn of sourceColumns
      ) {

        if (
          !isIdColumn(
            sourceColumn
          )
        ) {
          continue;
        }

        const normalizedSource =
          normalizeColumnName(
            sourceColumn
          );

        const sourceEntity =
          normalizedSource.replace(
            /id$/,
            ""
          );

        const exactMatch =
          targetColumns.find(
            (tc) =>
              normalizeColumnName(
                tc
              ) ===
              normalizedSource
          );

        const semanticPkMatch =
          !exactMatch &&
          targetColumns.find(
            (tc) =>
              normalizeColumnName(
                tc
              ) === "id"
          ) &&
          normalizeTableName(
            targetTable.name
          ).startsWith(
            sourceEntity
          );

        const targetColumn =
          exactMatch ??
          (
            semanticPkMatch
              ? "Id"
              : undefined
          );

        if (
          !targetColumn
        ) {
          continue;
        }

        const key =
          `${sourceTable.name}.${sourceColumn}->${targetTable.name}.${targetColumn}`;

        if (
          seen.has(key)
        ) {
          continue;
        }

        seen.add(key);

        relationships.push({
          sourceTable:
            sourceTable.name,

          sourceColumn,

          targetTable:
            targetTable.name,

          targetColumn,

          confidence:
            calculateConfidence(
              sourceColumn,
              targetTable.name,
              targetColumn
            ),

          cardinality:
            detectCardinality(
              sourceTable.rows,
              sourceColumn,
              targetTable.rows,
              targetColumn
            ),
        });
      }
    }
  }

  return relationships;
};

// ─────────────────────────────────────────────────────────────
// Semantic Model Factory
// ─────────────────────────────────────────────────────────────

export const createSemanticModel = (
  datasetOrDatasets: unknown
): SemanticModel => {

  const datasets =
    (
      Array.isArray(
        datasetOrDatasets
      )
        ? datasetOrDatasets
        : [
            datasetOrDatasets,
          ]
    ).filter(
      Boolean
    ) as Record<
      string,
      unknown
    >[];

  const tables: SemanticTable[] =
    datasets.map(
      (dataset) => ({

        name: String(
          dataset.name ??
          "Table"
        ),

        columns:
          normalizeColumns(
            (
              dataset.columns as unknown[]
            ) ?? []
          ),

        rows:
          (
            dataset.rows as DataRow[]
          ) ?? [],
      })
    );

  return {
    name:
      tables[0]?.name ??
      "Untitled Model",

    tables,

    measures: [],

    relationships:
      inferRelationships(
        tables
      ),
  };
};









/*export interface SemanticRelationship {
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
};*/
