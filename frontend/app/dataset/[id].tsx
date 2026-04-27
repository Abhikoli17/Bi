import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { apiCall } from "../../utils/api";

const getColumnLetter = (index: number) => {
  let letter = "";
  let n = index + 1;

  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }

  return letter;
};

const parseCellRef = (ref: string) => {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;

  let colIndex = 0;
  const letters = match[1].toUpperCase();

  for (let i = 0; i < letters.length; i++) {
    colIndex = colIndex * 26 + (letters.charCodeAt(i) - 64);
  }

  return {
    colIndex: colIndex - 1,
    rowIndex: Number(match[2]) - 1,
  };
};

export default function DatasetDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuthStore();

  const [dataset, setDataset] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null);
  const [formulaValue, setFormulaValue] = useState("");
  const [copiedCell, setCopiedCell] = useState<string>("");
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: string } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: string } | null>(null);

  useEffect(() => {
    if (id && token) loadDataset();
  }, [id, token]);

  const loadDataset = async () => {
    try {
      const data = await apiCall(`/api/datasets/${id}`, {}, token);
      setDataset(data);
      setRows(data.data || []);
      setColumns(data.columns || []);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load dataset");
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((value) =>
          String(value ?? "").toLowerCase().includes(q)
        )
      );
    }

    if (sortColumn) {
      result.sort((a, b) => {
        const av = String(a[sortColumn] ?? "");
        const bv = String(b[sortColumn] ?? "");
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }

    return result;
  }, [rows, search, sortColumn, sortAsc]);

  const updateCell = (rowIndex: number, columnName: string, value: string) => {
    const actualIndex = rows.indexOf(filteredRows[rowIndex]);
    const updatedRows = [...rows];

    updatedRows[actualIndex] = {
      ...updatedRows[actualIndex],
      [columnName]: value,
    };

    setRows(updatedRows);
  };

  const addRow = () => {
    const newRow: any = {};
    columns.forEach((col) => {
      newRow[col.name] = "";
    });
    setRows([...rows, newRow]);
  };

  const deleteRow = (rowIndex: number) => {
    const actualRow = filteredRows[rowIndex];
    setRows(rows.filter((row) => row !== actualRow));
  };

  const addColumn = () => {
    const name = `Column_${columns.length + 1}`;

    const newColumn = {
      name,
      type: "text",
      sample_values: [],
    };

    setColumns([...columns, newColumn]);
    setRows(rows.map((row) => ({ ...row, [name]: "" })));
  };

  const deleteColumn = (columnName: string) => {
    setColumns(columns.filter((col) => col.name !== columnName));

    setRows(
      rows.map((row) => {
        const updated = { ...row };
        delete updated[columnName];
        return updated;
      })
    );
  };

  const sortByColumn = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(columnName);
      setSortAsc(true);
    }
  };

  const saveChanges = async () => {
    if (!token) {
      Alert.alert("Session expired", "Please login again");
      return;
    }

    try {
      setSaving(true);

      const updated = await apiCall(
        `/api/datasets/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            data: rows,
            columns,
            row_count: rows.length,
          }),
        },
        token
      );

      setDataset(updated);
      setRows(updated.data || []);
      setColumns(updated.columns || []);
      Alert.alert("Saved", "Spreadsheet updated successfully");
    } catch (error: any) {
      Alert.alert("Save Failed", error.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const calculateFormula = (formula: string) => {
  const clean = formula.trim().toUpperCase();

  const match = clean.match(/^=(SUM|AVG|COUNT)\(([A-Z]+\d+):([A-Z]+\d+)\)$/);
  if (!match) return formula;

  const [, fn, startRef, endRef] = match;

  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef);

  if (!start || !end) return formula;

  const values: number[] = [];

  for (let r = start.rowIndex; r <= end.rowIndex; r++) {
    for (let c = start.colIndex; c <= end.colIndex; c++) {
      const colName = columns[c]?.name;
      const value = Number(rows[r]?.[colName]);

      if (!Number.isNaN(value)) values.push(value);
    }
  }

  if (fn === "SUM") return String(values.reduce((a, b) => a + b, 0));
  if (fn === "AVG") return values.length
    ? String(values.reduce((a, b) => a + b, 0) / values.length)
    : "0";
  if (fn === "COUNT") return String(values.length);

  return formula;
};

const copySelectedCell = () => {
  if (!selectedCell) {
    Alert.alert("Select a cell first");
    return;
  }

  const row = filteredRows[selectedCell.row];
  const value = String(row?.[selectedCell.col] ?? "");
  setCopiedCell(value);

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(value);
  }

  Alert.alert("Copied", value);
};

const pasteToSelectedCell = async () => {
  if (!selectedCell) {
    Alert.alert("Select a cell first");
    return;
  }

  let value = copiedCell;

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    value = await navigator.clipboard.readText();
  }

  updateCell(selectedCell.row, selectedCell.col, value);
  setFormulaValue(value);
};

const isCellSelected = (rowIndex: number, colName: string) => {
  if (!selectionStart || !selectionEnd) return false;

  const startColIndex = columns.findIndex((c) => c.name === selectionStart.col);
  const endColIndex = columns.findIndex((c) => c.name === selectionEnd.col);
  const currentColIndex = columns.findIndex((c) => c.name === colName);

  const minRow = Math.min(selectionStart.row, selectionEnd.row);
  const maxRow = Math.max(selectionStart.row, selectionEnd.row);
  const minCol = Math.min(startColIndex, endColIndex);
  const maxCol = Math.max(startColIndex, endColIndex);

  return (
    rowIndex >= minRow &&
    rowIndex <= maxRow &&
    currentColIndex >= minCol &&
    currentColIndex <= maxCol
  );
};

const copySelectedRange = () => {
  if (!selectionStart || !selectionEnd) {
    Alert.alert("Select a range first");
    return;
  }

  const startColIndex = columns.findIndex((c) => c.name === selectionStart.col);
  const endColIndex = columns.findIndex((c) => c.name === selectionEnd.col);

  const minRow = Math.min(selectionStart.row, selectionEnd.row);
  const maxRow = Math.max(selectionStart.row, selectionEnd.row);
  const minCol = Math.min(startColIndex, endColIndex);
  const maxCol = Math.max(startColIndex, endColIndex);

  const selectedText = [];

  for (let r = minRow; r <= maxRow; r++) {
    const rowValues = [];

    for (let c = minCol; c <= maxCol; c++) {
      const colName = columns[c]?.name;
      rowValues.push(String(filteredRows[r]?.[colName] ?? ""));
    }

    selectedText.push(rowValues.join("\t"));
  }

  const finalText = selectedText.join("\n");

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(finalText);
  }

  Alert.alert("Copied", "Selected range copied");
};

  const exportCSV = () => {
    const headers = columns.map((col) => col.name).join(",");
    const csvRows = rows.map((row) =>
      columns
        .map((col) => {
          const value = String(row[col.name] ?? "").replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(",")
    );

    const csv = [headers, ...csvRows].join("\n");

    if (typeof window !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${dataset?.name || "dataset"}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      Alert.alert("Export", "CSV export works on web.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  if (!dataset) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Dataset not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>{dataset.name}</Text>
          <Text style={styles.meta}>
            {rows.length} rows • {columns.length} columns
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} onPress={addRow}>
            <Text style={styles.buttonText}>+ Row</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={addColumn}>
            <Text style={styles.buttonText}>+ Column</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportButton} onPress={exportCSV}>
            <Text style={styles.buttonText}>Export CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={copySelectedCell}>
            <Text style={styles.buttonText}>Copy</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={pasteToSelectedCell}>
            <Text style={styles.buttonText}>Paste</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={copySelectedRange}>
             <Text style={styles.buttonText}>Copy Range</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveChanges}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

    

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search spreadsheet..."
        placeholderTextColor="#777"
        style={styles.search}
      />

      <TextInput
          value={formulaValue}
          onChangeText={(value) => {
          setFormulaValue(value);

         if (selectedCell) {
           const finalValue = value.startsWith("=")
           ? calculateFormula(value)
           : value;

         updateCell(selectedCell.row, selectedCell.col, finalValue);
         
        }
      }}
       placeholder="fx"
       placeholderTextColor="#999"
       style={styles.formulaBar}
     />

      <ScrollView horizontal style={styles.sheetWrapper}>
        <ScrollView>
          <View>
            <View style={styles.row}>
              <Text style={[styles.headerCell, styles.rowNumber]}>#</Text>

              {columns.map((col, index) => (
                <View key={col.name} style={styles.headerCellWrapper}>
                  <TouchableOpacity onPress={() => sortByColumn(col.name)}>
                    <Text style={styles.headerText}>
                      {getColumnLetter(index)}  ({col.name})
                      {sortColumn === col.name ? (sortAsc ? " ↑" : " ↓") : ""}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => deleteColumn(col.name)}>
                    <Text style={styles.deleteText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <Text style={[styles.headerCell, styles.actionCell]}>Action</Text>
            </View>

            {filteredRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.row}>
                <Text style={[styles.cell, styles.rowNumber]}>
                  {rowIndex + 1}
                </Text>

                {columns.map((col) => (
                  <TextInput
                      key={col.name}
                      value={String(row[col.name] ?? "")}
                       onKeyPress={async (e: any) => {
                          const key = e.nativeEvent.key;
                          const currentColIndex = columns.findIndex(
                            (c) => c.name === col.name
                          );

                          

                        if (key === "ArrowRight") {
                           const next = columns[currentColIndex + 1];
                          if (next)
                             setSelectedCell({ row: rowIndex, col: next.name });
                        }

                        if (key === "ArrowLeft") {
                           const prev = columns[currentColIndex - 1];
                         if (prev)
                           setSelectedCell({ row: rowIndex, col: prev.name });
                        }

                        if (key === "ArrowDown") {
                            if (filteredRows[rowIndex + 1])
                               setSelectedCell({ row: rowIndex + 1, col: col.name });
                        }

                         if (key === "ArrowUp") {
                            if (filteredRows[rowIndex - 1])
                                 setSelectedCell({ row: rowIndex - 1, col: col.name });
                             }

                          if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "c") {
                            copySelectedCell();
                          }

                          if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "v") {
                             await pasteToSelectedCell();
                          }
                          
                      }}

                      onFocus={() => {
                      const cell = { row: rowIndex, col: col.name };
                      setSelectedCell(cell);
                      setSelectionStart(cell);
                      setSelectionEnd(cell);
                      setFormulaValue(String(row[col.name] ?? ""));
                    }}

                    
                    onChangeText={(value) => {
                    updateCell(rowIndex, col.name, value);
                    setFormulaValue(value);
                      }}

                    style={[
                    styles.inputCell,
                    isCellSelected(rowIndex, col.name) ? styles.selectedRangeCell : null,
                    selectedCell?.row === rowIndex && selectedCell?.col === col.name
                    ? styles.selectedCell
                    : null,
                   ]}
                  />
                ))}

                <TouchableOpacity
                  style={styles.deleteRowButton}
                  onPress={() => deleteRow(rowIndex)}
                >
                  <Text style={styles.deleteRowText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 16,
  },
  center: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: "#fff",
  },
  topBar: {
    gap: 12,
    marginBottom: 12,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "bold",
  },
  meta: {
    color: "#999",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: "#107c41",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exportButton: {
    backgroundColor: "#047857",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  search: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  sheetWrapper: {
  flex: 1,
  borderWidth: 1,
  borderColor: "#333",
  backgroundColor: "#0f172a",
  },
 
  row: {
    flexDirection: "row",
  },
  cell: {
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    padding: 10,
    minWidth: 180,
    minHeight: 44,
  },
  inputCell: {
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    padding: 10,
    minWidth: 180,
    minHeight: 44,
    backgroundColor: "#111",
  },
  headerCell: {
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    padding: 10,
    minWidth: 140,
    minHeight: 44,
    backgroundColor: "#1f2937",
    fontWeight: "bold",
  },
  headerCellWrapper: {
    borderWidth: 1,
    borderColor: "#333",
    minWidth: 180,
    minHeight: 44,
    backgroundColor: "#1f2937",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: {
    color: "#fff",
    fontWeight: "bold",
    flex: 1,
  },
  selectedCell: {
  borderColor: "#22c55e",
  borderWidth: 2,
  backgroundColor: "#052e16",
},
toolbar: {
  backgroundColor: "#107c41",
  padding: 10,
  flexDirection: "row",
  gap: 8,
},
formulaBar: {
  backgroundColor: "#111827",
  borderColor: "#374151",
  borderWidth: 1,
  color: "#fff",
  padding: 10,
  marginVertical: 8,
},
  deleteText: {
    color: "#f87171",
    fontSize: 20,
    fontWeight: "bold",
  },
  rowNumber: {
    minWidth: 60,
    textAlign: "center",
  },
  actionCell: {
    minWidth: 100,
  },
  deleteRowButton: {
    borderWidth: 1,
    borderColor: "#333",
    minWidth: 100,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3f1d1d",
  },
  deleteRowText: {
    color: "#f87171",
    fontWeight: "bold",
  },

  selectedRangeCell: {
  backgroundColor: "#123524",
  },
});