// ─────────────────────────────────────────────────────────────
// daxEngine.ts
// DAX Evaluation Engine — SUM | COUNT | AVERAGE | MIN | MAX | COUNTROWS
// ─────────────────────────────────────────────────────────────

import type {
  DataRow,
  MeasureDefinition,
  SemanticModel,
  SemanticRelationship,
  SemanticTable,
} from "./types.js";

// Re-export shared types so consumers need only one import.
export type {
  ColumnDefinition,
  ColumnType,
  DataRow,
  MeasureDefinition,
  SemanticModel,
  SemanticRelationship,
  SemanticTable,
} from "./types.js";

// ─────────────────────────────────────────────────────────────
// §1  DAX-SPECIFIC TYPES
// ─────────────────────────────────────────────────────────────

export type AggregateFunction =
  | "SUM"
  | "COUNT"
  | "AVERAGE"
  | "MIN"
  | "MAX"
  | "COUNTROWS";

/** Primitive scalar a DAX expression can return. */
export type DaxScalar = number | string | boolean | null;

// ── Filter context ─────────────────────────────────────────────

export interface FilterPredicate {
  table: string;
  column: string;
  operator: "=" | "!=" | "<" | "<=" | ">" | ">=";
  value: DaxScalar;
}

export interface FilterContext {
  predicates: FilterPredicate[];
}

export const EMPTY_FILTER: FilterContext = { predicates: [] };

// ── Result types ───────────────────────────────────────────────

export interface DaxResult {
  value: DaxScalar;
  /** Wall-clock evaluation time in ms. */
  elapsedMs: number;
}

export interface DaxError {
  code: "UNKNOWN_TABLE" | "UNKNOWN_COLUMN" | "PARSE_ERROR" | "NO_RELATIONSHIP";
  message: string;
  expression?: string;
}

/** Discriminated union — `evaluate()` never throws. */
export type DaxEvalResult =
  | { ok: true;  result: DaxResult }
  | { ok: false; error:  DaxError  };

export interface BatchResult {
  measure: string;
  result:  DaxEvalResult;
}

export interface QueryPlan {
  expression:    string;
  fn:            AggregateFunction | null;
  field:         string | null;
  tableName:     string | null;
  parseError:    string | null;
  activeFilters: FilterPredicate[];
  /** Row count after the filter context is applied. `null` if parse failed. */
  estimatedRows: number | null;
}

// ─────────────────────────────────────────────────────────────
// §2  PRIMITIVE HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Coerce any value to a finite number.
 * `null` / `undefined` / `NaN` / `Infinity` → `0`.
 */
export const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Non-null, non-undefined cell values (blank strings included). */
const presentValues = (rows: DataRow[], field: string): unknown[] =>
  rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined);

/**
 * Strictly numeric cell values.
 * Blank strings, non-numeric strings, null, undefined, and non-finite
 * numbers are excluded — matching DAX behaviour for AVERAGE / MIN / MAX.
 */
const numericValues = (rows: DataRow[], field: string): number[] =>
  presentValues(rows, field)
    .filter((v) => {
      if (typeof v === "number") return Number.isFinite(v);
      if (typeof v === "string") return v.trim() !== "" && Number.isFinite(Number(v));
      return false;
    })
    .map(toNumber);

// ─────────────────────────────────────────────────────────────
// §3  AGGREGATION FUNCTIONS
//     Pure functions over rows — exported so the Query Engine and
//     Report Engine can call them directly without a model round-trip.
// ─────────────────────────────────────────────────────────────

/** Sum a numeric field; non-numeric values coerce to 0. */
export const sumMeasure = (rows: DataRow[], field: string): number =>
  rows.reduce((acc, row) => acc + toNumber(row[field]), 0);

/** Total row count. */
export const countRows = (rows: DataRow[]): number => rows.length;

/**
 * Non-null, non-blank value count for a field.
 * Without a field, identical to `countRows`.
 * Blank strings (`""`) are excluded — consistent with CSV/Excel source data.
 */
export const countMeasure = (rows: DataRow[], field?: string): number => {
  if (!field) return countRows(rows);
  return presentValues(rows, field).filter((v) => String(v).trim() !== "").length;
};

/** Arithmetic mean of numeric values; returns 0 for an empty set. */
export const averageMeasure = (rows: DataRow[], field: string): number => {
  const nums = numericValues(rows, field);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
};

/** Minimum numeric value; returns 0 for an empty set. */
export const minMeasure = (rows: DataRow[], field: string): number => {
  const nums = numericValues(rows, field);
  return nums.length ? Math.min(...nums) : 0;
};

/** Maximum numeric value; returns 0 for an empty set. */
export const maxMeasure = (rows: DataRow[], field: string): number => {
  const nums = numericValues(rows, field);
  return nums.length ? Math.max(...nums) : 0;
};

// ─────────────────────────────────────────────────────────────
// §4  FIELD NAME NORMALISER
// ─────────────────────────────────────────────────────────────

/**
 * Extract a bare column name from any DAX field expression form:
 *
 *   `Sales[Amount]`    → `"Amount"`
 *   `'Sales'[Amount]`  → `"Amount"`
 *   `[Amount]`         → `"Amount"`   (implicit table reference)
 *   `Amount`           → `"Amount"`   (bare name)
 */
export const normalizeDaxFieldName = (fieldExpression = ""): string =>
  fieldExpression
    .trim()
    .replace(/^['"]|['"]$/g, "")  // strip wrapping quotes
    .replace(/.*\[/, "")           // drop everything up to and including '['
    .replace(/\]$/, "")            // drop trailing ']'
    .trim();

// ─────────────────────────────────────────────────────────────
// §5  EXPRESSION PARSER
// ─────────────────────────────────────────────────────────────

const EXPRESSION_RE = /^(SUM|COUNT|AVERAGE|MIN|MAX|COUNTROWS)\s*\((.*?)\)$/i;

// Captures the table name from  Table[Column]  or  'Table'[Column]
const TABLE_NAME_RE = /\(\s*'?([^'\[\]()]+?)'?\s*\[/;

interface ParsedExpression {
  fn:        AggregateFunction;
  /** Normalised column name. Empty string for COUNTROWS / bare COUNT. */
  field:     string;
  /** Table name inferred from the expression. Empty string when absent. */
  tableName: string;
}

function parseExpression(expression: string): ParsedExpression | DaxError {
  const match = expression.trim().match(EXPRESSION_RE);
  if (!match) {
    return {
      code: "PARSE_ERROR",
      message:
        `Unsupported DAX expression: "${expression}". ` +
        `Supported: SUM | COUNT | AVERAGE | MIN | MAX | COUNTROWS.`,
    };
  }

  const fn        = match[1].toUpperCase() as AggregateFunction;
  const field     = normalizeDaxFieldName(match[2]);
  const tableName = expression.trim().match(TABLE_NAME_RE)?.[1]?.trim() ?? "";

  if (fn !== "COUNTROWS" && fn !== "COUNT" && !field) {
    return {
      code: "PARSE_ERROR",
      message: `${fn} requires a field name — e.g. ${fn}(TableName[ColumnName]).`,
    };
  }

  return { fn, field, tableName };
}

// ─────────────────────────────────────────────────────────────
// §6  ROW-LEVEL EVALUATOR  (flat — no model, no filter context)
//     Use when the caller has already resolved and filtered rows.
//     Throws on parse failure so call-sites stay concise.
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate a DAX expression against a pre-filtered row array.
 *
 * @throws {Error} on unsupported or malformed expressions.
 * @example
 * evaluateDaxExpression("SUM(Sales[Amount])", rows) // → 42000
 */
export const evaluateDaxExpression = (
  expression: string,
  rows: DataRow[]
): number => {
  const parsed = parseExpression(expression);
  if ("code" in parsed) throw new Error(parsed.message);

  const { fn, field } = parsed;
  switch (fn) {
    case "COUNTROWS": return countRows(rows);
    case "COUNT":     return countMeasure(rows, field || undefined);
    case "SUM":       return sumMeasure(rows, field);
    case "AVERAGE":   return averageMeasure(rows, field);
    case "MIN":       return minMeasure(rows, field);
    case "MAX":       return maxMeasure(rows, field);
  }
};

// ─────────────────────────────────────────────────────────────
// §7  FILTER CONTEXT
// ─────────────────────────────────────────────────────────────

function compareValues(
  cellValue:   unknown,
  op:          FilterPredicate["operator"],
  filterValue: DaxScalar
): boolean {
  if (cellValue === null || cellValue === undefined || filterValue === null) return false;
  switch (op) {
    case "=":  return cellValue === filterValue;
    case "!=": return cellValue !== filterValue;
    case "<":  return toNumber(cellValue) <  toNumber(filterValue);
    case "<=": return toNumber(cellValue) <= toNumber(filterValue);
    case ">":  return toNumber(cellValue) >  toNumber(filterValue);
    case ">=": return toNumber(cellValue) >= toNumber(filterValue);
  }
}

function applyFilter(
  rows:      DataRow[],
  tableName: string,
  filter:    FilterContext
): DataRow[] {
  const applicable = filter.predicates.filter(
    (p) => p.table.toLowerCase() === tableName.toLowerCase()
  );
  if (!applicable.length) return rows;

  return rows.filter((row) =>
    applicable.every((pred) => {
      const key = Object.keys(row).find(
        (k) => k.toLowerCase() === pred.column.toLowerCase()
      );
      // Predicate on a missing column is a no-op (doesn't exclude the row).
      return key === undefined || compareValues(row[key], pred.operator, pred.value);
    })
  );
}

// ─────────────────────────────────────────────────────────────
// §8  TABLE & COLUMN RESOLUTION
//     Both use SemanticTable[] (array) — the shape that
//     createSemanticModel produces — and fall back to first-row
//     key inspection only when table.columns is empty.
// ─────────────────────────────────────────────────────────────

interface Resolved {
  table:     SemanticTable;
  /** Exact-cased name as it exists in the column schema or row keys. */
  columnKey: string;
}

function tableNames(model: SemanticModel): string {
  return model.tables.map((t) => t.name).join(", ");
}

function findTable(
  model:     SemanticModel,
  tableName: string
): SemanticTable | undefined {
  return model.tables.find(
    (t) => t.name.toLowerCase() === tableName.toLowerCase()
  );
}

function resolveTable(
  model:     SemanticModel,
  tableName: string
): SemanticTable | DaxError {
  const table = findTable(model, tableName);
  return table ?? {
    code:    "UNKNOWN_TABLE",
    message: `Table "${tableName}" not found. Available: ${tableNames(model)}.`,
  };
}

function resolveColumn(
  model:      SemanticModel,
  tableName:  string,
  columnName: string
): Resolved | DaxError {
  const table = findTable(model, tableName);
  if (!table) {
    return {
      code:    "UNKNOWN_TABLE",
      message: `Table "${tableName}" not found. Available: ${tableNames(model)}.`,
    };
  }

  // Prefer the explicit column schema; fall back to first-row key inspection.
  const allColumnNames: string[] =
    table.columns.length > 0
      ? table.columns.map((c) => c.name)
      : Object.keys(table.rows[0] ?? {});

  // No schema and no rows — cannot validate; proceed with the name as given.
  if (!allColumnNames.length) return { table, columnKey: columnName };

  const columnKey = allColumnNames.find(
    (c) => c.toLowerCase() === columnName.toLowerCase()
  );
  if (!columnKey) {
    return {
      code:    "UNKNOWN_COLUMN",
      message: `Column "${columnName}" not found in "${table.name}". Available: ${allColumnNames.join(", ")}.`,
    };
  }

  return { table, columnKey };
}

// ─────────────────────────────────────────────────────────────
// §8b  RELATIONSHIP RESOLUTION  (RELATED)
//
//  Three public-facing capabilities built here:
//
//  1. relatedValue(model, sourceTable, sourceRow, targetTable, col)
//     Row-level scalar lookup — the equivalent of DAX's RELATED().
//     Traverses one relationship hop and returns a single cell value.
//
//  2. expandRowsWithRelated(model, sourceTable, rows, neededRefs)
//     Used by runSummarizeColumns to join related dimension columns
//     onto every source row before grouping — the foundation that lets
//     SUMMARIZECOLUMNS(Products[Name], "Total", SUM(Sales[Amount]))
//     work across tables without needing an explicit JOIN syntax.
//
//  3. findRelationship(model, sourceTable, targetTable)
//     Internal utility — locates a relationship by source/target name,
//     case-insensitively, trying both directions.
// ─────────────────────────────────────────────────────────────

/**
 * Find a relationship between two tables, trying both directions.
 * Returns the relationship in normalised form (sourceTable → targetTable)
 * regardless of which direction it was originally stored.
 */
function findRelationship(
  model:       SemanticModel,
  tableA:      string,
  tableB:      string
): SemanticRelationship | null {
  const a = tableA.toLowerCase();
  const b = tableB.toLowerCase();

  for (const rel of model.relationships) {
    const src = rel.sourceTable.toLowerCase();
    const tgt = rel.targetTable.toLowerCase();

    if (src === a && tgt === b) return rel;
    if (src === b && tgt === a) {
      // Flip to normalise direction: always return sourceTable = tableA
      return {
        sourceTable:  rel.targetTable,
        sourceColumn: rel.targetColumn,
        targetTable:  rel.sourceTable,
        targetColumn: rel.sourceColumn,
      };
    }
  }
  return null;
}

/**
 * Look up a single column value from a related table for one source row.
 *
 * Equivalent to DAX's RELATED() function.
 *
 * @param model         The semantic model (must include relationships[]).
 * @param sourceTableName  Name of the table containing `sourceRow`.
 * @param sourceRow     The fact-table row to look up from.
 * @param targetTableName  Name of the related (dimension) table.
 * @param targetColumnName Column on the target table whose value to return.
 * @returns             The cell value, null if no match, or a DaxError.
 *
 * @example
 * // Given Sales[ProductID] → Products[ProductID] relationship:
 * relatedValue(model, "Sales", salesRow, "Products", "Name")
 * // → "Widget A"
 */
export function relatedValue(
  model:            SemanticModel,
  sourceTableName:  string,
  sourceRow:        DataRow,
  targetTableName:  string,
  targetColumnName: string
): DaxScalar | DaxError {
  // Validate source table
  const sourceTable = resolveTable(model, sourceTableName);
  if ("code" in sourceTable) return sourceTable;

  // Find the relationship (either direction)
  const rel = findRelationship(model, sourceTableName, targetTableName);
  if (!rel) {
    return {
      code:    "NO_RELATIONSHIP",
      message:
        `No relationship found between "${sourceTableName}" and "${targetTableName}". ` +
        `Define one in model.relationships.`,
    };
  }

  // Validate target table
  const targetTable = resolveTable(model, rel.targetTable);
  if ("code" in targetTable) return targetTable;

  // Resolve the join key on the source row
  const srcJoinCol = resolveColumn(model, sourceTable.name, rel.sourceColumn);
  if ("code" in srcJoinCol) return srcJoinCol;

  // Resolve the join key on the target table
  const tgtJoinCol = resolveColumn(model, targetTable.name, rel.targetColumn);
  if ("code" in tgtJoinCol) return tgtJoinCol;

  // Resolve the output column on the target table
  const tgtOutputCol = resolveColumn(model, targetTable.name, targetColumnName);
  if ("code" in tgtOutputCol) return tgtOutputCol;

  // Match rows
  const srcValue = sourceRow[srcJoinCol.columnKey];
  const matchedRow = targetTable.rows.find(
    (r) =>
      JSON.stringify(r[tgtJoinCol.columnKey] ?? null) ===
      JSON.stringify(srcValue ?? null)
  );

  return (matchedRow?.[tgtOutputCol.columnKey] ?? null) as DaxScalar;
}

/**
 * Describes one related column that needs to be joined onto source rows.
 * Built by runSummarizeColumns when it detects a group-by column that
 * belongs to a different table than the source fact table.
 */
interface RelatedRef {
  /** The dimension table to join from. */
  targetTableName:  string;
  /** The exact-cased column key on the target table to read. */
  targetColKey:     string;
  /** The key this value will be written under on the expanded row. */
  writeKey:         string;
  /** Resolved join columns, pre-computed once for all rows. */
  srcJoinKey:       string;
  tgtJoinKey:       string;
  targetTable:      SemanticTable;
}

/**
 * Join related dimension columns onto every source row, returning a new
 * expanded row array. Only the columns listed in `neededRefs` are joined —
 * we never load more than necessary.
 *
 * Unmatched rows get `null` for related columns (left-join semantics —
 * Power BI drops unmatched fact rows in SUMMARIZECOLUMNS, but keeping them
 * here prevents silent data loss and matches BLANK() semantics for measures).
 */
function expandRowsWithRelated(
  rows:       DataRow[],
  refs:       RelatedRef[]
): DataRow[] {
  if (refs.length === 0) return rows;

  // Build a lookup map per target table for O(1) row matching
  const lookups = new Map<string, Map<string, DataRow>>();
  for (const ref of refs) {
    if (!lookups.has(ref.targetTableName)) {
      const map = new Map<string, DataRow>();
      for (const row of ref.targetTable.rows) {
        const key = JSON.stringify(row[ref.tgtJoinKey] ?? null);
        if (!map.has(key)) map.set(key, row); // first match wins (PK semantics)
      }
      lookups.set(ref.targetTableName, map);
    }
  }

  return rows.map((row) => {
    const expanded: DataRow = { ...row };
    for (const ref of refs) {
      const lookup     = lookups.get(ref.targetTableName)!;
      const joinVal    = JSON.stringify(row[ref.srcJoinKey] ?? null);
      const matchedRow = lookup.get(joinVal);
      expanded[ref.writeKey] = (matchedRow?.[ref.targetColKey] ?? null) as DaxScalar;
    }
    return expanded;
  });
}

// ─────────────────────────────────────────────────────────────

//     Resolves table + column, applies filter context, then calls
//     aggregators directly. Never throws — returns DaxEvalResult.
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate a DAX expression against the semantic model.
 *
 * @example
 * const r = evaluate(
 *   "SUM(Sales[Amount])",
 *   model,
 *   filterContext().where("Sales", "Region", "=", "North").build()
 * );
 * if (r.ok) console.log(r.result.value); // → 1750
 */
export function evaluate(
  expression: string,
  model:      SemanticModel,
  filter:     FilterContext = EMPTY_FILTER
): DaxEvalResult {
  const t0      = performance.now();
  const elapsed = () => performance.now() - t0;
  const fail    = (error: DaxError): DaxEvalResult => ({ ok: false, error });
  const ok      = (value: number):  DaxEvalResult  => ({ ok: true,  result: { value, elapsedMs: elapsed() } });

  try {
    const parsed = parseExpression(expression);
    if ("code" in parsed) return fail({ ...parsed, expression });

    const { fn, field, tableName } = parsed;

    // ── COUNTROWS(TableName) ─────────────────────────────────
    if (fn === "COUNTROWS") {
      const nameArg = field || tableName;
      if (!nameArg) return fail({
        code: "PARSE_ERROR",
        message: "COUNTROWS requires a table name — e.g. COUNTROWS(Sales).",
        expression,
      });
      const t = resolveTable(model, nameArg);
      if ("code" in t) return fail({ ...t, expression });
      return ok(countRows(applyFilter(t.rows, t.name, filter)));
    }

    // ── COUNT() with no column — COUNTROWS semantics ─────────
    if (fn === "COUNT" && !field) {
      if (!tableName) return fail({
        code: "PARSE_ERROR",
        message: "COUNT() with no column needs a table reference — e.g. COUNT(Sales[OrderID]).",
        expression,
      });
      const t = resolveTable(model, tableName);
      if ("code" in t) return fail({ ...t, expression });
      return ok(countRows(applyFilter(t.rows, t.name, filter)));
    }

    // ── All other functions need Table[Column] ───────────────
    if (!tableName) return fail({
      code: "PARSE_ERROR",
      message:
        `Could not infer a table name from "${expression}". ` +
        `Use Table[Column] format — e.g. ${fn}(Sales[Amount]).`,
      expression,
    });

    const resolved = resolveColumn(model, tableName, field);
    if ("code" in resolved) return fail({ ...resolved, expression });

    const { table, columnKey } = resolved;
    const rows = applyFilter(table.rows, table.name, filter);

    switch (fn) {
      case "SUM":     return ok(sumMeasure(rows, columnKey));
      case "COUNT":   return ok(countMeasure(rows, columnKey));
      case "AVERAGE": return ok(averageMeasure(rows, columnKey));
      case "MIN":     return ok(minMeasure(rows, columnKey));
      case "MAX":     return ok(maxMeasure(rows, columnKey));
    }

  } catch (e) {
    return fail({
      code:    "PARSE_ERROR",
      message: `Unexpected engine error: ${(e as Error).message}`,
      expression,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// §10  BATCH EVALUATION
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate a named list of measures in one call.
 * Each measure fails independently — one bad expression won't abort the batch.
 *
 * @example
 * evaluateBatch([
 *   { name: "Total Sales", expression: "SUM(Sales[Amount])" },
 *   { name: "Order Count", expression: "COUNTROWS(Sales)"   },
 * ], model);
 */
export function evaluateBatch(
  measures: MeasureDefinition[],
  model:    SemanticModel,
  filter:   FilterContext = EMPTY_FILTER
): BatchResult[] {
  return measures.map((m) => ({
    measure: m.name,
    result:  evaluate(m.expression, model, filter),
  }));
}

// ─────────────────────────────────────────────────────────────
// §11  FILTER CONTEXT BUILDER
// ─────────────────────────────────────────────────────────────

/**
 * Fluent builder for filter contexts.
 *
 * @example
 * const ctx = filterContext()
 *   .where("Sales", "Region", "=",  "North")
 *   .where("Sales", "Year",   ">=", 2024)
 *   .build();
 */
export function filterContext(): FilterContextBuilder {
  return new FilterContextBuilder();
}

class FilterContextBuilder {
  private predicates: FilterPredicate[] = [];

  where(
    table:    string,
    column:   string,
    operator: FilterPredicate["operator"],
    value:    DaxScalar
  ): this {
    this.predicates.push({ table, column, operator, value });
    return this;
  }

  build(): FilterContext {
    return { predicates: [...this.predicates] };
  }
}

// ─────────────────────────────────────────────────────────────
// §12  QUERY PLAN
// ─────────────────────────────────────────────────────────────

/**
 * Return a query plan without executing the aggregation.
 * Useful for the Model View debug panel and NLQ layer previews.
 */
export function explain(
  expression: string,
  model:      SemanticModel,
  filter:     FilterContext = EMPTY_FILTER
): QueryPlan {
  const plan: QueryPlan = {
    expression,
    fn:            null,
    field:         null,
    tableName:     null,
    parseError:    null,
    activeFilters: filter.predicates,
    estimatedRows: null,
  };

  const parsed = parseExpression(expression);
  if ("code" in parsed) {
    plan.parseError = parsed.message;
    return plan;
  }

  plan.fn        = parsed.fn;
  plan.field     = parsed.field;
  plan.tableName = parsed.tableName;

  const nameToLook = parsed.tableName || parsed.field;
  const table      = findTable(model, nameToLook);
  if (table) {
    plan.estimatedRows = applyFilter(table.rows, table.name, filter).length;
  }

  return plan;
}

// ─────────────────────────────────────────────────────────────
// §13  FORMATTING
// ─────────────────────────────────────────────────────────────

/**
 * Format a number using the Indian numbering system (en-IN).
 * Decimal places are dropped for whole-number display.
 *
 * @example
 * formatNumber(1234567) // → "12,34,567"
 */
export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);

/**
 * Format a `DaxEvalResult` for display.
 * Returns `"—"` on error; formats numbers via `formatNumber`.
 */
export const formatResult = (r: DaxEvalResult): string => {
  if (!r.ok) return "—";
  if (typeof r.result.value === "number") return formatNumber(r.result.value);
  return String(r.result.value ?? "—");
};

// ─────────────────────────────────────────────────────────────
// §14  TYPE GUARDS & HELPERS
// ─────────────────────────────────────────────────────────────

export function isNumericResult(
  r: DaxEvalResult
): r is { ok: true; result: DaxResult & { value: number } } {
  return r.ok && typeof r.result.value === "number";
}

export function unwrapOrDefault(
  r:        DaxEvalResult,
  fallback: DaxScalar = null
): DaxScalar {
  return r.ok ? r.result.value : fallback;
}

// ─────────────────────────────────────────────────────────────
// §15  TABLE RESULT TYPES
// ─────────────────────────────────────────────────────────────

/** A table-valued result returned by EVALUATE / SUMMARIZECOLUMNS. */
export interface DaxTableResult {
  /** Ordered column names matching each DataRow's keys. */
  columns:   string[];
  rows:      DataRow[];
  elapsedMs: number;
}

export type DaxTableEvalResult =
  | { ok: true;  table: DaxTableResult }
  | { ok: false; error: DaxError };

// ─────────────────────────────────────────────────────────────
// §16  ARGUMENT SPLITTER
//      Split a comma-delimited string respecting:
//        • Nested parentheses   SUM(Sales[Amount])
//        • Double-quoted labels "My Measure"
//        • Single-quoted tables 'My Table'[Col]
// ─────────────────────────────────────────────────────────────

function splitArgs(src: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inStr = false;
  let strCh = "";
  let cur   = "";

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      cur += ch;
      if (ch === strCh) inStr = false;
    } else if (ch === '"' || ch === "'") {
      inStr = true; strCh = ch; cur += ch;
    } else if (ch === "(") {
      depth++; cur += ch;
    } else if (ch === ")") {
      depth--; cur += ch;
    } else if (ch === "," && depth === 0) {
      const t = cur.trim();
      if (t) args.push(t);
      cur = "";
    } else {
      cur += ch;
    }
  }
  const t = cur.trim();
  if (t) args.push(t);
  return args;
}

// ─────────────────────────────────────────────────────────────
// §17  ARGUMENT CLASSIFIER
// ─────────────────────────────────────────────────────────────

/** Table[Column]  or  'Quoted Table'[Column] */
const COL_REF_RE       = /^'?[^'"\[\]()][^"\[\]()]*'?\[[^\]]+\]$/;
/** "double-quoted string" */
const STR_LIT_RE       = /^"([^"]*)"$/;
/** Any aggregate function call */
const AGGREGATE_HEAD_RE = /^(SUM|COUNT|AVERAGE|MIN|MAX|COUNTROWS)\s*\(/i;

type ArgKind = "colRef" | "strLit" | "aggregate" | "unknownFn";

/** Looks like a function call but is not a known aggregate — e.g. BOGUS(...) */
const FN_CALL_RE = /^[A-Za-z_]\w*\s*\(/;

function classifyArg(arg: string): ArgKind {
  if (COL_REF_RE.test(arg))        return "colRef";
  if (STR_LIT_RE.test(arg))        return "strLit";
  if (AGGREGATE_HEAD_RE.test(arg)) return "aggregate";
  if (FN_CALL_RE.test(arg))        return "unknownFn";
  return "strLit";
}

const stripDblQuotes = (s: string) => s.replace(/^"|"$/g, "").trim();

/**
 * Extract the table name from a  Table[Column]  or  'Table Name'[Column]  ref.
 */
function tableFromColRef(colRef: string): string {
  return colRef
    .trim()
    .replace(/^'/, "")           // opening single-quote
    .replace(/'?\[[^\]]*\]$/, "") // '[Column]' with optional leading quote
    .trim();
}

// ─────────────────────────────────────────────────────────────
// §18  SUMMARIZECOLUMNS ARGUMENT PARSER
// ─────────────────────────────────────────────────────────────

interface GroupByCol {
  tableName:  string;
  columnName: string;
  /** Key used in result DataRow: "TableName[ColumnName]" */
  displayKey: string;
}

interface SummarizeMeasure {
  name:       string; // result column name
  expression: string; // raw DAX expression evaluated per group
}

interface ParsedSummarize {
  /** Optional table name gleaned from a bare string arg: "TableName" */
  tableContext: string | null;
  groupByCols:  GroupByCol[];
  measures:     SummarizeMeasure[];
}

function parseSummarizeColumns(inner: string): ParsedSummarize | DaxError {
  const args = splitArgs(inner);

  const result: ParsedSummarize = {
    tableContext: null,
    groupByCols:  [],
    measures:     [],
  };

  let i = 0;
  while (i < args.length) {
    const arg  = args[i];
    const kind = classifyArg(arg);

    if (kind === "colRef") {
      // Sales[Region]  →  group-by column
      result.groupByCols.push({
        tableName:  tableFromColRef(arg),
        columnName: normalizeDaxFieldName(arg),
        displayKey: `${tableFromColRef(arg)}[${normalizeDaxFieldName(arg)}]`,
      });
      i++;

    } else if (kind === "strLit") {
      const name = stripDblQuotes(arg);
      const next = args[i + 1];

      const nextKind = next ? classifyArg(next) : null;

      if (nextKind === "aggregate") {
        // "MeasureName", AggExpr  →  measure pair
        result.measures.push({ name, expression: next });
        i += 2;
      } else if (nextKind === "unknownFn") {
        // Looks like a measure pair but the function is not supported
        return {
          code:    "PARSE_ERROR",
          message: `Unsupported measure expression: "${next}". Supported: SUM | COUNT | AVERAGE | MIN | MAX | COUNTROWS.`,
        };
      } else {
        // Bare string — table context hint:
        // "Car Sales Data 2025" in SUMMARIZECOLUMNS("Car Sales Data 2025", "Rows", COUNTROWS())
        if (!result.tableContext) result.tableContext = name;
        i++;
      }

    } else {
      // Bare aggregate with no label — use expression itself as the column name
      result.measures.push({ name: arg, expression: arg });
      i++;
    }
  }

  if (result.groupByCols.length === 0 && result.measures.length === 0) {
    return {
      code:    "PARSE_ERROR",
      message: "SUMMARIZECOLUMNS requires at least one group-by column or one measure.",
    };
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// §19  BALANCED FUNCTION-CALL EXTRACTOR
//      Locate a named function call (e.g. SUMMARIZECOLUMNS, TOPN)
//      and return its inner argument string plus the index right
//      after its closing paren — so callers can inspect whatever
//      text follows (an ORDER BY clause, in our case).
//      Respects nested parens and both quote styles.
// ─────────────────────────────────────────────────────────────

interface BalancedCall {
  inner:      string;
  /** Index in `body` of the function name match. */
  matchStart: number;
  /** Index in `body` of the character right after the closing ')'. */
  afterIndex: number;
}

function extractBalancedCall(body: string, fnName: string): BalancedCall | null {
  const re      = new RegExp(`${fnName}\\s*\\(`, "i");
  const fnMatch = body.match(re);
  if (!fnMatch || fnMatch.index === undefined) return null;

  let i     = fnMatch.index + fnMatch[0].length;
  let depth = 1;
  let inStr = false;
  let strCh = "";

  while (i < body.length && depth > 0) {
    const ch = body[i];
    if (inStr) {
      if (ch === strCh) inStr = false;
    } else if (ch === '"' || ch === "'") {
      inStr = true; strCh = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    }
    i++;
  }

  if (depth !== 0) return null; // unclosed parenthesis

  const contentStart = fnMatch.index + fnMatch[0].length;
  return {
    inner:      body.slice(contentStart, i - 1).trim(),
    matchStart: fnMatch.index,
    afterIndex: i,
  };
}

// ─────────────────────────────────────────────────────────────
// §20  GROUP BY ENGINE
// ─────────────────────────────────────────────────────────────

/**
 * Partition rows into groups by a composite key derived from the
 * given column keys.  No columns → single group containing all rows.
 * Uses JSON.stringify per cell so numbers, strings, and nulls all
 * produce distinct keys.
 */
function groupRowsByColumns(
  rows:    DataRow[],
  colKeys: string[]
): Map<string, DataRow[]> {
  if (colKeys.length === 0) return new Map([["__all__", rows]]);

  const groups = new Map<string, DataRow[]>();
  for (const row of rows) {
    const key    = colKeys.map((k) => JSON.stringify(row[k] ?? null)).join("\x00");
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

// ─────────────────────────────────────────────────────────────
// §21  SUMMARIZECOLUMNS CORE EVALUATOR
//      Resolves the source table, group-by columns (local + related),
//      and measures, then builds one result row per group.
//      Cross-table group-bys are handled by joining related dimension
//      columns onto the source rows before partitioning.
// ─────────────────────────────────────────────────────────────

interface TableCore {
  columns: string[];
  rows:    DataRow[];
}

type TableCoreResult =
  | { ok: true;  table: TableCore }
  | { ok: false; error: DaxError };

function runSummarizeColumns(
  inner:  string,
  model:  SemanticModel,
  filter: FilterContext
): TableCoreResult {
  const parsed = parseSummarizeColumns(inner);
  if ("code" in parsed) return { ok: false, error: parsed };

  const { tableContext, groupByCols, measures } = parsed;

  // ── Determine source (fact) table ─────────────────────────
  // Priority order:
  //   1. A group-by column on the source table itself
  //   2. A bare table-context string arg: "Sales"
  //   3. A Table[Column] reference inside a measure
  //   4. A bare COUNTROWS(Table) — has no '[' so TABLE_NAME_RE won't match
  //
  // We can't rely on groupByCols[0].tableName here because that column
  // might be from a *related* dimension table (e.g. Products[Name]).
  // We'll determine which tables are related after we have a candidate.

  let sourceTableName: string | null = tableContext ?? null;

  if (!sourceTableName) {
    // TABLE_NAME_RE matches Table[Column] style — covers SUM/AVERAGE/MIN/MAX
    const COUNTROWS_ONLY_RE = /^COUNTROWS\s*\(\s*([A-Za-z_][\w\s]*)\s*\)$/i;
    for (const m of measures) {
      const bracketMatch = m.expression.match(TABLE_NAME_RE);
      if (bracketMatch) { sourceTableName = bracketMatch[1].trim(); break; }
      const countrowsMatch = m.expression.match(COUNTROWS_ONLY_RE);
      if (countrowsMatch) { sourceTableName = countrowsMatch[1].trim(); break; }
    }
  }

  if (!sourceTableName && groupByCols.length > 0) {
    // Last resort: use the first group-by column's table. This is only
    // correct when all group-bys are on the same (fact) table.
    sourceTableName = groupByCols[0].tableName;
  }

  if (!sourceTableName) {
    return {
      ok: false,
      error: {
        code:    "PARSE_ERROR",
        message:
          "Cannot determine source table. " +
          "Add a Table[Column] group-by, a table context string, or use Table[Column] in measures.",
      },
    };
  }

  const tableOrErr = resolveTable(model, sourceTableName);
  if ("code" in tableOrErr) return { ok: false, error: tableOrErr };
  const sourceTable = tableOrErr;

  // ── Classify group-by columns: local vs related ───────────
  // A group-by column is "local" if its table matches the source table.
  // It is "related" if there is a relationship from the source table to
  // that column's table. Anything else is an error.

  const localGroupBy:   Array<{ colKey: string; displayKey: string }> = [];
  const relatedGroupBy: Array<{ ref: RelatedRef; displayKey: string }> = [];

  for (const col of groupByCols) {
    const isLocal =
      col.tableName.toLowerCase() === sourceTable.name.toLowerCase();

    if (isLocal) {
      const r = resolveColumn(model, sourceTable.name, col.columnName);
      if ("code" in r) return { ok: false, error: r };
      localGroupBy.push({ colKey: r.columnKey, displayKey: col.displayKey });
    } else {
      // Cross-table — find the relationship
      const rel = findRelationship(model, sourceTable.name, col.tableName);
      if (!rel) {
        return {
          ok: false,
          error: {
            code:    "NO_RELATIONSHIP",
            message:
              `No relationship found between "${sourceTable.name}" and "${col.tableName}". ` +
              `Define one in model.relationships, or check table names.`,
          },
        };
      }

      // Resolve all three columns we need:
      //  srcJoinKey  — source table's FK (e.g. Sales.ProductID)
      //  tgtJoinKey  — target table's PK (e.g. Products.ProductID)
      //  targetColKey — target column requested for grouping (e.g. Products.Name)
      const tgtTable = resolveTable(model, rel.targetTable);
      if ("code" in tgtTable) return { ok: false, error: tgtTable };

      const srcJoin = resolveColumn(model, sourceTable.name, rel.sourceColumn);
      if ("code" in srcJoin) return { ok: false, error: srcJoin };

      const tgtJoin = resolveColumn(model, tgtTable.name, rel.targetColumn);
      if ("code" in tgtJoin) return { ok: false, error: tgtJoin };

      const tgtCol = resolveColumn(model, tgtTable.name, col.columnName);
      if ("code" in tgtCol) return { ok: false, error: tgtCol };

      // writeKey is a synthetic column key on the expanded row
      const writeKey = `__related__${tgtTable.name}__${tgtCol.columnKey}`;

      relatedGroupBy.push({
        displayKey: col.displayKey,
        ref: {
          targetTableName: tgtTable.name,
          targetColKey:    tgtCol.columnKey,
          writeKey,
          srcJoinKey:      srcJoin.columnKey,
          tgtJoinKey:      tgtJoin.columnKey,
          targetTable:     tgtTable,
        },
      });
    }
  }

  // ── Apply outer filter context then expand related columns ─
  const filteredRows = applyFilter(sourceTable.rows, sourceTable.name, filter);
  const expanded     = expandRowsWithRelated(
    filteredRows,
    relatedGroupBy.map((r) => r.ref)
  );

  // ── Build composite group-by key list ─────────────────────
  // Combines local column keys and related write keys in declaration order.
  const allGroupByKeys: Array<{ readKey: string; displayKey: string }> = [
    ...localGroupBy.map((c) => ({ readKey: c.colKey,      displayKey: c.displayKey })),
    ...relatedGroupBy.map((r) => ({ readKey: r.ref.writeKey, displayKey: r.displayKey })),
  ];

  // Re-sort to match original declaration order
  const orderedKeys = groupByCols.map((col) => {
    const local   = localGroupBy.find((c) => c.displayKey === col.displayKey);
    const related = relatedGroupBy.find((r) => r.displayKey === col.displayKey);
    if (local)   return { readKey: local.colKey,        displayKey: local.displayKey };
    if (related) return { readKey: related.ref.writeKey, displayKey: related.displayKey };
    return { readKey: col.columnName, displayKey: col.displayKey };
  });

  // ── Partition expanded rows into groups ───────────────────
  const colReadKeys = orderedKeys.map((k) => k.readKey);
  const groups      = groupRowsByColumns(expanded, colReadKeys);

  // ── Build one result row per group ────────────────────────
  const resultRows: DataRow[] = [];

  for (const [, groupRows] of groups) {
    const row: DataRow = {};

    // Group-by values: read from the first row of each group
    for (const key of orderedKeys) {
      row[key.displayKey] = groupRows[0]?.[key.readKey] ?? null;
    }

    // Measures: evaluated against the original (un-expanded) source rows
    // for the group — the expansion was only needed for grouping.
    // We re-filter from `expanded` (which has the write keys) but use
    // evaluateDaxExpression with the underlying source column names,
    // so the measure sees the same DataRow shape as always.
    for (const measure of measures) {
      if (/^COUNTROWS\s*\(\s*\)$/i.test(measure.expression)) {
        row[measure.name] = groupRows.length;
      } else {
        // Strip synthetic __related__ keys before passing to the evaluator
        // so column lookups in the measure still work correctly.
        const cleanRows = groupRows.map((r) => {
          const clean: DataRow = {};
          for (const [k, v] of Object.entries(r)) {
            if (!k.startsWith("__related__")) clean[k] = v;
          }
          return clean;
        });
        row[measure.name] = evaluateDaxExpression(measure.expression, cleanRows);
      }
    }

    resultRows.push(row);
  }

  // ── Default sort: ascending by group-by display keys ─────
  if (orderedKeys.length > 0) {
    resultRows.sort((a, b) => {
      for (const key of orderedKeys) {
        const av = String(a[key.displayKey] ?? "");
        const bv = String(b[key.displayKey] ?? "");
        if (av < bv) return -1;
        if (av > bv) return  1;
      }
      return 0;
    });
  }

  return {
    ok: true,
    table: {
      columns: [...orderedKeys.map((k) => k.displayKey), ...measures.map((m) => m.name)],
      rows:    resultRows,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// §22  ORDER BY / TOPN SUPPORT
//      Shared sorting + column-reference resolution used by both
//      the ORDER BY clause (evaluateTable) and TOPN's ranking args.
// ─────────────────────────────────────────────────────────────

type SortDirection = "ASC" | "DESC";

interface SortSpec {
  key:       string;
  direction: SortDirection;
}

/**
 * Compare two cell values for sorting.
 * Nulls/undefined sort last regardless of direction.
 * Numbers compare numerically; everything else compares as strings.
 */
function compareForSort(a: unknown, b: unknown): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function sortRowsBySpecs(rows: DataRow[], specs: SortSpec[]): DataRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const spec of specs) {
      const cmp = compareForSort(a[spec.key], b[spec.key]);
      if (cmp !== 0) return spec.direction === "DESC" ? -cmp : cmp;
    }
    return 0;
  });
  return sorted;
}

/**
 * Normalise an ORDER BY / TOPN column reference to the form used as
 * result column keys:
 *
 *   `[Total]`          → `"Total"`            (bracket-only measure ref)
 *   `Sales[Region]`     → `"Sales[Region]"`     (already canonical)
 *   `'My Table'[Col]`   → `"My Table[Col]"`     (quoted table name)
 *   `Total`             → `"Total"`            (bare name)
 */
function normalizeOrderByRef(ref: string): string {
  const trimmed = ref.trim();

  const bracketOnly = trimmed.match(/^\[(.+)\]$/);
  if (bracketOnly) return bracketOnly[1].trim();

  if (COL_REF_RE.test(trimmed)) {
    return `${tableFromColRef(trimmed)}[${normalizeDaxFieldName(trimmed)}]`;
  }

  return trimmed.replace(/^['"]|['"]$/g, "").trim();
}

/** Resolve a normalised ref against the actual result columns, case-insensitively. */
function resolveOrderByColumn(ref: string, columns: string[]): string | null {
  const normalized = normalizeOrderByRef(ref);
  return columns.find((c) => c.toLowerCase() === normalized.toLowerCase()) ?? null;
}

const DIRECTION_TOKEN_RE = /^(ASC|DESC|0|1|TRUE|FALSE)$/i;

/** Convert an ASC/DESC/0/1/TRUE/FALSE token to a SortDirection. */
function toDirection(token: string): SortDirection {
  const t = token.toUpperCase();
  return (t === "ASC" || t === "1" || t === "TRUE") ? "ASC" : "DESC";
}

/**
 * Parse a DAX `ORDER BY col1 [ASC|DESC], col2 [ASC|DESC], ...` clause body
 * (the text after the `ORDER BY` keyword) into sort specs.
 * Default direction when omitted is ASC — matching DAX's ORDER BY semantics.
 */
function parseOrderBySpecs(text: string, columns: string[]): SortSpec[] | DaxError {
  const entries = splitArgs(text);
  const specs: SortSpec[] = [];

  for (const entry of entries) {
    const trimmed  = entry.trim();
    const dirMatch = trimmed.match(/^(.*\S)\s+(ASC|DESC)$/i);
    const refRaw   = dirMatch ? dirMatch[1] : trimmed;
    const direction: SortDirection = dirMatch
      ? (dirMatch[2].toUpperCase() as SortDirection)
      : "ASC";

    const key = resolveOrderByColumn(refRaw, columns);
    if (key === null) {
      return {
        code:    "UNKNOWN_COLUMN",
        message: `ORDER BY reference "${refRaw}" does not match any result column. Available: ${columns.join(", ")}.`,
      };
    }
    specs.push({ key, direction });
  }

  return specs;
}

/**
 * Evaluate a `TOPN(n, SUMMARIZECOLUMNS(...), orderByExpr [, order] [, ...])` call.
 *
 * `n`              — number of rows to keep (0 or more).
 * `orderByExpr`    — a result column reference: `[MeasureName]`, `Table[Column]`, or bare name.
 * `order`          — optional: ASC | DESC | 0 | 1 | TRUE | FALSE. Default: DESC
 *                     (matches DAX's TOPN convention — highest values first).
 * Multiple orderByExpr/order pairs are supported for tie-breaking.
 */
function runTopN(
  inner:  string,
  model:  SemanticModel,
  filter: FilterContext
): TableCoreResult {
  const args = splitArgs(inner);
  if (args.length < 3) {
    return {
      ok: false,
      error: {
        code:    "PARSE_ERROR",
        message: "TOPN requires at least 3 arguments: TOPN(n, table, orderBy_expression).",
      },
    };
  }

  const nArg = args[0].trim();
  const n    = Number(nArg);
  if (!Number.isFinite(n) || n < 0) {
    return {
      ok: false,
      error: {
        code:    "PARSE_ERROR",
        message: `TOPN's first argument must be a non-negative number, got "${nArg}".`,
      },
    };
  }

  const tableExpr = args[1].trim();
  const innerCall = extractBalancedCall(tableExpr, "SUMMARIZECOLUMNS");
  if (!innerCall) {
    return {
      ok: false,
      error: {
        code:    "PARSE_ERROR",
        message: `TOPN's table argument must be a SUMMARIZECOLUMNS(...) expression. Got: "${tableExpr.slice(0, 60)}"`,
      },
    };
  }

  const core = runSummarizeColumns(innerCall.inner, model, filter);
  if ("error" in core) return core;

  const { columns, rows } = core.table;

  // ── Parse orderByExpr [, order] pairs ─────────────────────
  const orderArgs = args.slice(2);
  const specs: SortSpec[] = [];

  let i = 0;
  while (i < orderArgs.length) {
    const refRaw = orderArgs[i].trim();
    const key    = resolveOrderByColumn(refRaw, columns);
    if (key === null) {
      return {
        ok: false,
        error: {
          code:    "UNKNOWN_COLUMN",
          message: `TOPN orderBy reference "${refRaw}" does not match any result column. Available: ${columns.join(", ")}.`,
        },
      };
    }

    const next = orderArgs[i + 1]?.trim();
    let direction: SortDirection = "DESC"; // TOPN default: highest first
    let consumed = 1;
    if (next !== undefined && DIRECTION_TOKEN_RE.test(next)) {
      direction = toDirection(next);
      consumed  = 2;
    }
    specs.push({ key, direction });
    i += consumed;
  }

  if (specs.length === 0) {
    return {
      ok: false,
      error: {
        code:    "PARSE_ERROR",
        message: "TOPN requires at least one orderBy_expression argument.",
      },
    };
  }

  const sorted  = sortRowsBySpecs(rows, specs);
  const limited = n === 0 ? [] : sorted.slice(0, n);

  return { ok: true, table: { columns, rows: limited } };
}

// ─────────────────────────────────────────────────────────────
// §23  evaluateTable  —  PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Execute a DAX table-valued query against the semantic model.
 *
 * Supports:
 *   EVALUATE SUMMARIZECOLUMNS(...)
 *   EVALUATE SUMMARIZECOLUMNS(...) ORDER BY col [ASC|DESC], ...
 *   EVALUATE TOPN(n, SUMMARIZECOLUMNS(...), orderByExpr [, order], ...)
 *   EVALUATE TOPN(...) ORDER BY ...   (re-sorts TOPN's output deterministically)
 *
 * The `EVALUATE` keyword is optional in all forms.
 * Never throws — returns a `DaxTableEvalResult` discriminated union.
 *
 * @example
 * // Sales by region — matches Power BI's DAX query view output
 * evaluateTable(`
 *   EVALUATE
 *   SUMMARIZECOLUMNS(
 *     Sales[Region],
 *     "Total Sales", SUM(Sales[Amount]),
 *     "Orders",      COUNTROWS(Sales)
 *   )
 *   ORDER BY [Total Sales] DESC
 * `, model)
 *
 * @example
 * // Top 3 regions by total sales
 * evaluateTable(`
 *   EVALUATE
 *   TOPN(
 *     3,
 *     SUMMARIZECOLUMNS(Sales[Region], "Total", SUM(Sales[Amount])),
 *     [Total], DESC
 *   )
 * `, model)
 */
export function evaluateTable(
  query:  string,
  model:  SemanticModel,
  filter: FilterContext = EMPTY_FILTER
): DaxTableEvalResult {
  const t0      = performance.now();
  const elapsed = () => performance.now() - t0;
  const fail    = (error: DaxError): DaxTableEvalResult => ({ ok: false, error });

  try {
    // ── Strip optional EVALUATE keyword ──────────────────────
    const body = query.trim().replace(/^EVALUATE\s+/i, "").trim();

    // ── Locate the top-level table expression: TOPN(...) or SUMMARIZECOLUMNS(...) ──
    let core:       TableCoreResult;
    let afterIndex: number;

    if (/^TOPN\s*\(/i.test(body)) {
      const call = extractBalancedCall(body, "TOPN");
      if (!call) {
        return fail({
          code:       "PARSE_ERROR",
          message:    `Malformed TOPN(...) call in: "${body.slice(0, 60)}"`,
          expression: query,
        });
      }
      core       = runTopN(call.inner, model, filter);
      afterIndex = call.afterIndex;

    } else {
      const call = extractBalancedCall(body, "SUMMARIZECOLUMNS");
      if (!call) {
        return fail({
          code:       "PARSE_ERROR",
          message:    `Expected SUMMARIZECOLUMNS(...) or TOPN(...). Got: "${body.slice(0, 60)}"`,
          expression: query,
        });
      }
      core       = runSummarizeColumns(call.inner, model, filter);
      afterIndex = call.afterIndex;
    }

    if ("error" in core) return fail({ ...core.error, expression: query });

    let { columns, rows } = core.table;

    // ── Optional trailing ORDER BY clause ─────────────────────
    const remainder    = body.slice(afterIndex).trim();
    const orderByMatch = remainder.match(/^ORDER\s+BY\s+(.+)$/is);
    if (orderByMatch) {
      const specs = parseOrderBySpecs(orderByMatch[1], columns);
      if (!Array.isArray(specs)) return fail({ ...specs, expression: query });
      rows = sortRowsBySpecs(rows, specs);
    }

    return {
      ok: true,
      table: { columns, rows, elapsedMs: elapsed() },
    };

  } catch (e) {
    return fail({
      code:       "PARSE_ERROR",
      message:    `Unexpected engine error: ${(e as Error).message}`,
      expression: query,
    });
  }
}








/*type AggregateFunction = "SUM" | "COUNT" | "AVERAGE" | "MIN" | "MAX" | "COUNTROWS";

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
*/