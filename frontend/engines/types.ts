// ─────────────────────────────────────────────────────────────
// types.ts
// Shared type definitions for the semantic model and DAX engine.
// Both semanticModel.ts and daxEngine.ts import from here so the
// types are defined exactly once and can never drift apart.
// ─────────────────────────────────────────────────────────────

// ── Column ────────────────────────────────────────────────────

export type ColumnType = "number" | "string" | "boolean" | "date";

export interface ColumnDefinition {
  name: string;
  type?: ColumnType;
}

// ── Row ───────────────────────────────────────────────────────

/**
 * One row of data.
 * `Record<string, unknown>` accepts raw CSV objects, JSON API responses,
 * and strongly-typed shapes without forcing a cast at the call site.
 */
export type DataRow = Record<string, unknown>;

// ── Table ─────────────────────────────────────────────────────

export interface SemanticTable {
  name: string;
  /**
   * Explicit column schema.
   * When present, used for column resolution and relationship inference
   * instead of reading keys from the first row.
   */
  columns: ColumnDefinition[];
  rows: DataRow[];
}

// ── Relationship ──────────────────────────────────────────────

export interface SemanticRelationship {
  sourceTable:  string;
  sourceColumn: string;
  targetTable:  string;
  targetColumn: string;
  /** Confidence score from relationship inference (0–1). Optional. */
  confidence?:  number;
  /** Relationship cardinality, e.g. "many-to-one" | "one-to-one". Optional. */
  cardinality?: string;
}

// ── Measure ───────────────────────────────────────────────────

export interface MeasureDefinition {
  name: string;
  expression: string;
}

// ── Model ─────────────────────────────────────────────────────

export interface SemanticModel {
  name: string;
  tables: SemanticTable[];
  measures: MeasureDefinition[];
  relationships: SemanticRelationship[];
}