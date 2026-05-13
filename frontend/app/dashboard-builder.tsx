import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { useAuthStore } from "../stores/authStore";
import { apiCall } from "../utils/api";

export default function DashboardBuilder() {
  const { token } = useAuthStore();

  const [widgets, setWidgets] = useState<any[]>([
    {
      id: "kpi1",
      type: "kpi",
    },
    {
      id: "kpi2",
      type: "kpi",
    },
    {
      id: "bar1",
      type: "bar",
      config: {
        xAxis: "",
        metric: "",
        aggregation: "SUM",
      },
    },
  ]);

  const [savedDashboards, setSavedDashboards] =
    useState<any[]>([]);

  const [dashboardName, setDashboardName] =
    useState("My Dashboard");

  const [currentDashboardId, setCurrentDashboardId] =
    useState<string | null>(null);

  const [datasets, setDatasets] = useState<any[]>([]);

  const [selectedDataset, setSelectedDataset] =
    useState<any>(null);

  const sampleData = [
    { name: "Jan", value: 400 },
    { name: "Feb", value: 800 },
    { name: "Mar", value: 650 },
    { name: "Apr", value: 1200 },
    { name: "May", value: 900 },
  ];

  useEffect(() => {
    if (token) {
      loadSavedDashboards();
      loadDatasets();
    }
  }, [token]);

  const addKpi = () => {
    setWidgets((prev) => [
      ...prev,
      {
        id: `kpi-${Date.now()}`,
        type: "kpi",
      },
    ]);
  };

  const addSpecificChart = (type: string) => {
    setWidgets((prev) => [
      ...prev,
      {
        id: `${type}-${Date.now()}`,
        type,
        config: {
          xAxis: "",
          metric: "",
          aggregation: "SUM",
        },
      },
    ]);
  };

  const getChartData = (widget: any) => {
    if (!selectedDataset?.columns || !selectedDataset?.data) {
      return sampleData;
    }

    const xAxis =
      widget.config?.xAxis ||
      selectedDataset.columns[0]?.name;

    const metric =
      widget.config?.metric ||
      selectedDataset.columns.find((col: any) =>
        selectedDataset.data.some(
          (row: any) =>
            row[col.name] !== "" &&
            !isNaN(Number(row[col.name]))
        )
      )?.name;

    const aggregation =
      widget.config?.aggregation || "SUM";

    const grouped: any = {};

    selectedDataset.data.forEach((row: any) => {
      const key = row[xAxis] || "Unknown";

      if (!grouped[key]) {
        grouped[key] = [];
      }

      const num = parseFloat(row[metric]);

      grouped[key].push(isNaN(num) ? 0 : num);
    });

    return Object.keys(grouped)
      .slice(0, 8)
      .map((key) => {
        const values = grouped[key];

        let value = 0;

        if (aggregation === "SUM") {
          value = values.reduce(
            (a: number, b: number) => a + b,
            0
          );
        }

        if (aggregation === "AVG") {
          value =
            values.reduce(
              (a: number, b: number) => a + b,
              0
            ) / values.length;
        }

        if (aggregation === "COUNT") {
          value = values.length;
        }

        return {
          name: key,
          value: Number(value.toFixed(2)),
        };
      });
  };

  const getKpiData = (index: number) => {
    if (!selectedDataset?.data || !selectedDataset?.columns) {
      return {
        title: "Revenue",
        value: "₹48,544",
        growth: "Live",
      };
    }

    const numericCols =
      selectedDataset.columns.filter((col: any) =>
        selectedDataset.data.some(
          (row: any) =>
            row[col.name] !== "" &&
            !isNaN(Number(row[col.name]))
        )
      );

    if (numericCols.length === 0) {
      return {
        title: "Rows",
        value: String(selectedDataset.data.length),
        growth: "Live",
      };
    }

    const col =
      numericCols[index % numericCols.length];

    const total = selectedDataset.data.reduce(
      (sum: number, row: any) => {
        const val = parseFloat(row[col.name]);

        return sum + (isNaN(val) ? 0 : val);
      },
      0
    );

    return {
      title: `Total ${col.name}`,
      value: total.toLocaleString(),
      growth: "Live",
    };
  };

  const loadDatasets = async () => {
    if (!token) return;

    const data = await apiCall(
      "/api/datasets",
      {},
      token
    );

    setDatasets(data);

    if (data.length > 0 && !selectedDataset) {
      setSelectedDataset(data[0]);
    }
  };

  const loadSavedDashboards = async () => {
    if (!token) return;

    const data = await apiCall(
      "/api/dashboard-layouts",
      {},
      token
    );

    setSavedDashboards(data);
  };

  const saveDashboard = async () => {
    if (!token) {
      Alert.alert("Login required");
      return;
    }

    const payload = {
      name: dashboardName,
      layout: widgets,
      widgets,
    };

    if (currentDashboardId) {
      await apiCall(
        `/api/dashboard-layouts/${currentDashboardId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        token
      );

      Alert.alert("Dashboard Updated");
      return;
    }

    const created = await apiCall(
      "/api/dashboard-layouts",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );

    setCurrentDashboardId(created._id);

    Alert.alert("Dashboard Saved");
  };

  const openDashboard = (dashboard: any) => {
    setDashboardName(dashboard.name);

    setWidgets(
      dashboard.layout ||
        dashboard.widgets ||
        []
    );

    setCurrentDashboardId(dashboard._id);
  };

  const deleteDashboard = async (
    dashboardId: string
  ) => {
    if (!token) return;

    await apiCall(
      `/api/dashboard-layouts/${dashboardId}`,
      {
        method: "DELETE",
      },
      token
    );

    setSavedDashboards((prev) =>
      prev.filter((d) => d._id !== dashboardId)
    );

    if (currentDashboardId === dashboardId) {
      setCurrentDashboardId(null);
    }
  };

  return (
    <View style={styles.page}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Dashboard Builder
        </Text>

        <Text style={styles.subtitle}>
          Drag, resize, and arrange visuals
          like Power BI
        </Text>
      </View>

      {/* MAIN LAYOUT */}
      <View style={styles.mainLayout}>
        {/* LEFT SIDEBAR */}
        <View style={styles.leftSidebar}>
          <Text style={styles.sidebarTitle}>
            Datasets
          </Text>

          <ScrollView style={{ maxHeight: 120 }}>
             {datasets.map((dataset: any) => (
                <TouchableOpacity
                   key={dataset._id}
                   style={[
                    styles.fieldItem,
                    selectedDataset?._id === dataset._id && {
                       backgroundColor: "#2563eb",
                  },
                ]}
                onPress={() => setSelectedDataset(dataset)}
           >
            <Text style={styles.fieldText}>
               {dataset.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>


          <TextInput
            value={dashboardName}
            onChangeText={setDashboardName}
            placeholder="Dashboard name"
            placeholderTextColor="#777"
            style={styles.nameInput}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveDashboard}
          >
            <Text style={styles.buttonText}>
              Save Dashboard
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>
            Saved Dashboards
          </Text>

          <ScrollView style={{ maxHeight: 180 }}>
            {savedDashboards.map((dash) => (
              <View
                key={dash._id}
                style={styles.savedItem}
              >
                <TouchableOpacity
                  onPress={() =>
                    openDashboard(dash)
                  }
                >
                  <Text style={styles.savedText}>
                    {dash.name}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    deleteDashboard(dash._id)
                  }
                >
                  <Text style={styles.deleteText}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.button}
            onPress={addKpi}
          >
            <Text style={styles.buttonText}>
              Add KPI
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addSpecificChart("bar")
            }
          >
            <Text style={styles.buttonText}>
              Bar Chart
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addSpecificChart("line")
            }
          >
            <Text style={styles.buttonText}>
              Line Chart
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addSpecificChart("pie")
            }
          >
            <Text style={styles.buttonText}>
              Pie Chart
            </Text>
          </TouchableOpacity>
        </View>

        {/* CENTER */}
        <View style={styles.centerCanvas}>
          {/* TOOLBAR */}
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={styles.button}
              onPress={() =>
                addSpecificChart("bar")
              }
            >
              <Text style={styles.buttonText}>
                Add Chart
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveDashboard}
            >
              <Text style={styles.buttonText}>
                Save Layout
              </Text>
            </TouchableOpacity>
          </View>

          {/* SCROLLABLE CANVAS */}
          <ScrollView
            showsVerticalScrollIndicator
            horizontal={false}
            contentContainerStyle= {{
              paddingBottom: 120,
            }}
          >
            <View style={styles.canvas}>
              {/* KPI ROW */}
              <View style={styles.kpiRow}>
                {widgets
                  .filter(
                    (w) => w.type === "kpi"
                  )
                  .map((widget, index) => {
                    const kpi =
                      getKpiData(index);

                    return (
                      <View
                        key={widget.id}
                        style={[
                          styles.widget,
                          styles.kpiWidget,
                        ]}
                      >
                        <Text
                          style={
                            styles.widgetTitle
                          }
                        >
                          {kpi.title}
                        </Text>

                        <Text
                          style={styles.kpiValue}
                          numberOfLines={1}
                        >
                          {kpi.value}
                        </Text>

                        <Text
                          style={styles.growth}
                        >
                          {kpi.growth}
                        </Text>
                      </View>
                    );
                  })}
              </View>

              {/* CHART GRID */}
              <View style={styles.chartGrid}>
                {widgets
                  .filter(
                    (w) => w.type !== "kpi"
                  )
                  .map((widget) => (
                    <View
                      key={widget.id}
                      style={[
                        styles.widget,
                        styles.chartWidget,
                      ]}
                    >
                      <Text
                        style={
                          styles.widgetTitle
                        }
                      >
                        {widget.type.toUpperCase()}{" "}
                        CHART
                      </Text>

                      <View
                        style={{ flex: 1,
                          minHeight: 300,
                         }}
                      >
                        {widget.type ===
                          "bar" && (
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                          >
                            <BarChart
                              data={getChartData(
                                widget
                              )}
                            >
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />

                              <Bar
                                dataKey="value"
                                fill="#3b82f6"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        )}

                        {widget.type ===
                          "line" && (
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                          >
                            <LineChart
                              data={getChartData(
                                widget
                              )}
                            >
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />

                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#22c55e"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        )}

                        {widget.type ===
                          "pie" && (
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                          >
                            <PieChart>
                              <Pie
                                data={getChartData(
                                  widget
                                )}
                                dataKey="value"
                                outerRadius={100}
                              >
                                {getChartData(
                                  widget
                                ).map(
                                  (
                                    _: any,
                                    index: number
                                  ) => (
                                    <Cell
                                      key={index}
                                      fill={
                                        [
                                          "#3b82f6",
                                          "#22c55e",
                                          "#f59e0b",
                                          "#ef4444",
                                        ][
                                          index % 4
                                        ]
                                      }
                                    />
                                  )
                                )}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </View>
                    </View>
                  ))}
              </View>
            </View>
          </ScrollView>
        </View>

        {/* RIGHT SIDEBAR */}
        <View style={styles.rightSidebar}>
          <Text style={styles.sidebarTitle}>
            Fields
          </Text>

          <ScrollView>
            {selectedDataset?.columns?.map(
              (col: any) => (
                <View
                  key={col.name}
                  style={styles.fieldItem}
                >
                  <Text
                    style={styles.fieldText}
                  >
                    {col.name}
                  </Text>
                </View>
              )
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },

  header: {
    padding: 16,
  },

  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },

  subtitle: {
    color: "#999",
    marginTop: 4,
  },

  mainLayout: {
    flex: 1,
    flexDirection: "row",
  },

  leftSidebar: {
    width: 220,
    backgroundColor: "#0f172a",
    padding: 12,
  },

  centerCanvas: {
    flex: 1,
    padding: 12,
    backgroundColor: "#0a0a0a",
  },

  rightSidebar: {
    width: 220,
    backgroundColor: "#0f172a",
    padding: 12,
  },

  canvas: {
    paddingTop: 40,
    paddingHorizontal: 12,
    paddingBottom: 12,
    minWidth: 1000,
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },

  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 24,
    marginBottom: 24,
  },

  chartGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 24,
  },

  widget: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },

  kpiWidget: {
    width: 280,
    height: 140,
    justifyContent: "center",
  },

  chartWidget: {
    width: "48%",
    height: 420,
  },

  widgetTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },

  kpiValue: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "bold",
  },

  growth: {
    color: "#22c55e",
    marginTop: 8,
    fontWeight: "bold",
  },

  button: {
    backgroundColor: "#1f2937",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },

  saveButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

  sidebarTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginVertical: 12,
  },

  nameInput: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    marginBottom: 12,
  },

  savedItem: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },

  savedText: {
    color: "#fff",
  },

  deleteText: {
    color: "#ef4444",
    fontWeight: "bold",
    marginTop: 6,
  },

  fieldItem: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },

  fieldText: {
    color: "#fff",
  },

  toolbar: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
});