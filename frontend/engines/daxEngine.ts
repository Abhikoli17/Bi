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
// §19  SUMMARIZECOLUMNS INNER EXTRACTOR  (paren-balanced)
//      Safely extracts the content inside SUMMARIZECOLUMNS(...)
//      regardless of nested function calls or string literals.
// ─────────────────────────────────────────────────────────────

function extractSummarizeInner(body: string): string | null {
  const fnMatch = body.match(/SUMMARIZECOLUMNS\s*\(/i);
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
  return body.slice(contentStart, i - 1).trim();
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
// §21  evaluateTable  —  PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Execute an `EVALUATE SUMMARIZECOLUMNS(...)` query against the semantic model.
 *
 * The `EVALUATE` keyword is optional — the function accepts a bare
 * `SUMMARIZECOLUMNS(...)` expression too.
 *
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
 * `, model)
 * // → {
 * //   ok: true,
 * //   table: {
 * //     columns: ["Sales[Region]", "Total Sales", "Orders"],
 * //     rows: [
 * //       { "Sales[Region]": "East",  "Total Sales": 500,  "Orders": 1 },
 * //       { "Sales[Region]": "North", "Total Sales": 1750, "Orders": 3 },
 * //       { "Sales[Region]": "South", "Total Sales": 5500, "Orders": 2 },
 * //       { "Sales[Region]": "West",  "Total Sales": 0,    "Orders": 1 },
 * //     ]
 * //   }
 * // }
 *
 * @example
 * // Screenshot query (table context string for COUNTROWS with no arg)
 * evaluateTable(`
 *   EVALUATE
 *   SUMMARIZECOLUMNS(
 *     "Sales",
 *     "Rows", COUNTROWS()
 *   )
 * `, model)
 * // → { ok: true, table: { columns: ["Rows"], rows: [{ Rows: 7 }] } }
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

    // ── Paren-balanced extraction of SUMMARIZECOLUMNS body ───
    const inner = extractSummarizeInner(body);
    if (inner === null) {
      return fail({
        code:       "PARSE_ERROR",
        message:    `Expected SUMMARIZECOLUMNS(...). Got: "${body.slice(0, 60)}"`,
        expression: query,
      });
    }

    // ── Parse group-by columns and measure pairs ──────────────
    const parsed = parseSummarizeColumns(inner);
    if ("code" in parsed) return fail({ ...parsed, expression: query });

    const { tableContext, groupByCols, measures } = parsed;

    // ── Determine source table ────────────────────────────────
    // Priority: groupBy col's table → tableContext string → inferred from measures
    let sourceTableName: string | null =
      groupByCols[0]?.tableName
      ?? tableContext
      ?? null;

    if (!sourceTableName) {
      for (const m of measures) {
        const match = m.expression.match(TABLE_NAME_RE);
        if (match) { sourceTableName = match[1].trim(); break; }
      }
    }

    if (!sourceTableName) {
      return fail({
        code:       "PARSE_ERROR",
        message:
          "Cannot determine source table. " +
          "Add a Table[Column] group-by, a table context string, or use Table[Column] in measures.",
        expression: query,
      });
    }

    const tableOrErr = resolveTable(model, sourceTableName);
    if ("code" in tableOrErr) return fail({ ...tableOrErr, expression: query });
    const sourceTable = tableOrErr;

    // ── Resolve group-by columns (case-insensitive) ───────────
    const resolvedGroupBy: Array<{ colKey: string; displayKey: string }> = [];
    for (const col of groupByCols) {
      const r = resolveColumn(model, col.tableName, col.columnName);
      if ("code" in r) return fail({ ...r, expression: query });
      resolvedGroupBy.push({ colKey: r.columnKey, displayKey: col.displayKey });
    }

    // ── Apply outer filter context ────────────────────────────
    const filteredRows = applyFilter(sourceTable.rows, sourceTable.name, filter);

    // ── Partition rows into groups ────────────────────────────
    const colKeys = resolvedGroupBy.map((c) => c.colKey);
    const groups  = groupRowsByColumns(filteredRows, colKeys);

    // ── Build one result row per group ────────────────────────
    const resultRows: DataRow[] = [];

    for (const [, groupRows] of groups) {
      const row: DataRow = {};

      // Group-by column values (constant within a group — read from first row)
      for (const col of resolvedGroupBy) {
        row[col.displayKey] = groupRows[0]?.[col.colKey] ?? null;
      }

      // Measure values — each evaluated over the current group's row set
      for (const measure of measures) {
        // COUNTROWS() with no argument → row count of the current group.
        // This matches Power BI behaviour: the "current row context" table.
        if (/^COUNTROWS\s*\(\s*\)$/i.test(measure.expression)) {
          row[measure.name] = groupRows.length;
        } else {
          // evaluateDaxExpression operates on the group's rows, so
          // COUNTROWS(Sales), SUM(Sales[Amount]), etc. all see only the group.
          row[measure.name] = evaluateDaxExpression(measure.expression, groupRows);
        }
      }

      resultRows.push(row);
    }

    // ── Sort by group-by column values (stable, ascending) ────
    if (resolvedGroupBy.length > 0) {
      resultRows.sort((a, b) => {
        for (const col of resolvedGroupBy) {
          const av = String(a[col.displayKey] ?? "");
          const bv = String(b[col.displayKey] ?? "");
          if (av < bv) return -1;
          if (av > bv) return  1;
        }
        return 0;
      });
    }

    return {
      ok: true,
      table: {
        columns:   [...resolvedGroupBy.map((c) => c.displayKey), ...measures.map((m) => m.name)],
        rows:      resultRows,
        elapsedMs: elapsed(),
      },
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