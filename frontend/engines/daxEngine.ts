// ─────────────────────────────────────────────────────────────
// daxEngine.ts
// DAX Evaluation Engine — SUM | COUNT | AVERAGE | MIN | MAX | COUNTROWS
// ─────────────────────────────────────────────────────────────

import type {
  DataRow,
  MeasureDefinition,
  SemanticModel,
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
  code: "UNKNOWN_TABLE" | "UNKNOWN_COLUMN" | "PARSE_ERROR";
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
// §9  MODEL-LEVEL EVALUATOR
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