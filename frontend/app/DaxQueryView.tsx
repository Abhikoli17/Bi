import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  evaluateTable,
  type DaxTableEvalResult,
  type SemanticModel,
} from "../engines/daxEngine";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Build the default starter query for a model — mirrors the
 * Power BI "DAX query view" default: a single-row row-count query.
 */
function buildDefaultQuery(model: SemanticModel): string {
  const tableName = model.tables[0]?.name ?? "Table";
  return [
    "EVALUATE",
    "SUMMARIZECOLUMNS(",
    `  "${tableName}",`,
    `  "Rows", COUNTROWS()`,
    ")",
  ].join("\n");
}

/** Format a single cell value for display. */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString("en-IN")
      : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  return String(value);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface DaxQueryViewProps {
  model: SemanticModel;
  hasWorkingDataset: boolean;
}

export default function DaxQueryView({ model, hasWorkingDataset }: DaxQueryViewProps) {
  const [query, setQuery] = useState<string>(() => buildDefaultQuery(model));
  const [result, setResult] = useState<DaxTableEvalResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const runQuery = () => {
    const r = evaluateTable(query, model);
    setResult(r);
    setHasRun(true);
  };

  const resetQuery = () => {
    const q = buildDefaultQuery(model);
    setQuery(q);
    setResult(null);
    setHasRun(false);
  };

  if (!hasWorkingDataset) {
    return (
      <View style={styles.editorWrap}>
        <View style={styles.placeholderQueryBlock}>
          <Text style={styles.placeholderQueryText}>-- Load data first</Text>
          <Text style={styles.placeholderQueryText}>-- Use Get data, Excel, Text/CSV, or Use sample data.</Text>
          <Text style={styles.placeholderQueryText}>-- Your DAX query surface will appear here after a dataset is active.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Query editor ─────────────────────────────────────── */}
      <View style={styles.editorWrap}>
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.runButton} onPress={runQuery}>
            <MaterialCommunityIcons name={"play" as any} size={14} color="#ffffff" />
            <Text style={styles.runButtonText}>Run</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetButton} onPress={resetQuery}>
            <MaterialCommunityIcons name={"refresh" as any} size={14} color="#d8d8d8" />
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          {result?.ok && (
            <Text style={styles.elapsedText}>
              {result.table.rows.length} row{result.table.rows.length === 1 ? "" : "s"}
              {"  •  "}
              {result.table.elapsedMs.toFixed(2)} ms
            </Text>
          )}
        </View>

        <TextInput
          style={styles.queryInput}
          value={query}
          onChangeText={setQuery}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder="EVALUATE SUMMARIZECOLUMNS(...)"
          placeholderTextColor="#777777"
        />
      </View>

      {/* ── Results ──────────────────────────────────────────── */}
      <View style={styles.resultsWrap}>
        {renderResults(hasRun, result)}
      </View>
    </View>
  );
}

/**
 * Render the results pane.
 * Pulled out into a plain function so the discriminated union on
 * `result` (ok: true | false) narrows correctly via `if`/`else` —
 * TS narrowing inside chained JSX `&&` expressions is unreliable.
 */
function renderResults(hasRun: boolean, result: DaxTableEvalResult | null) {
  if (!hasRun || result === null) {
    return (
      <View style={styles.placeholderWrap}>
        <MaterialCommunityIcons name={"play-circle-outline" as any} size={28} color="#5a5a5a" />
        <Text style={styles.placeholderText}>
          Press Run to execute the query and see results.
        </Text>
      </View>
    );
  }

  if ("error" in result) {
    const { code, message } = result.error;
    return (
      <View style={styles.errorWrap}>
        <MaterialCommunityIcons name={"alert-circle-outline" as any} size={20} color="#e66c37" />
        <View style={styles.errorTextWrap}>
          <Text style={styles.errorCode}>{code}</Text>
          <Text style={styles.errorMessage}>{message}</Text>
        </View>
      </View>
    );
  }

  if (!("table" in result)) {
    // Defensive fallback — should be unreachable given DaxTableEvalResult's shape.
    return null;
  }

  const { columns, rows } = result.table;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        {/* Header row */}
        <View style={styles.resultRow}>
          {columns.map((col) => (
            <Text key={col} style={[styles.resultCell, styles.resultHeaderCell]}>
              {col}
            </Text>
          ))}
        </View>

        {/* Data rows */}
        {rows.length === 0 ? (
          <View style={styles.resultRow}>
            <Text style={[styles.resultCell, styles.emptyResultCell]}>
              No rows returned.
            </Text>
          </View>
        ) : (
          rows.map((row, i) => (
            <View key={i} style={styles.resultRow}>
              {columns.map((col) => (
                <Text key={col} style={styles.resultCell}>
                  {formatCell(row[col])}
                </Text>
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },

  // ── Editor ──────────────────────────────────────────────────
  editorWrap: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#333333",
  },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },

  runButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#107c68",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 3,
  },

  runButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 3,
  },

  resetButtonText: {
    color: "#d8d8d8",
    fontSize: 12,
    fontWeight: "700",
  },

  elapsedText: {
    color: "#9d9d9d",
    fontSize: 11,
    marginLeft: "auto",
  },

  queryInput: {
    minHeight: 140,
    color: "#d8d8d8",
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 22,
    padding: 16,
  },

  placeholderQueryBlock: {
    minHeight: 140,
    padding: 16,
  },

  placeholderQueryText: {
    color: "#777777",
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 22,
  },

  // ── Results ─────────────────────────────────────────────────
  resultsWrap: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d0d0d0",
  },

  placeholderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },

  placeholderText: {
    color: "#777777",
    fontSize: 12,
    textAlign: "center",
  },

  errorWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    backgroundColor: "#fdf2ed",
  },

  errorTextWrap: {
    flex: 1,
  },

  errorCode: {
    color: "#b3441f",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3,
  },

  errorMessage: {
    color: "#7a3517",
    fontSize: 12,
    lineHeight: 18,
  },

  resultRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },

  resultCell: {
    minWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: "#eeeeee",
    color: "#2a2a2a",
    fontSize: 12,
    fontFamily: "monospace",
  },

  resultHeaderCell: {
    backgroundColor: "#f3f3f3",
    color: "#111111",
    fontWeight: "800",
  },

  emptyResultCell: {
    color: "#888888",
    fontStyle: "italic",
    minWidth: 0,
    borderRightWidth: 0,
  },
});
