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

import {
  Responsive,
  WidthProvider,
} from "react-grid-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useAuthStore } from "../stores/authStore";
import { apiCall } from "../utils/api";

const ResponsiveGridLayout =
  WidthProvider(Responsive);

export default function DashboardBuilder() {
  const { token } = useAuthStore();

  const [widgets, setWidgets] = useState<any[]>([
    {
      id: "kpi1",
      type: "kpi",
      layout: { x: 0, y: 0, w: 3, h: 2 },
    },
    {
      id: "kpi2",
      type: "kpi",
      layout: { x: 3, y: 0, w: 3, h: 2 },
    },
    {
      id: "bar1",
      type: "bar",
      layout: { x: 0, y: 2, w: 6, h: 5 },
    },
    {
      id: "line1",
      type: "line",
      layout: { x: 6, y: 0, w: 4, h: 4 },
    },
  ]);

  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] =
    useState<any>(null);

  const [dashboardName, setDashboardName] =
    useState("My Dashboard");

  useEffect(() => {
    if (token) {
      loadDatasets();
    }
  }, [token]);

  const sampleData = [
    { name: "2025-01-01", value: 13 },
    { name: "2025-01-02", value: 4 },
    { name: "2025-01-03", value: 1 },
    { name: "2025-01-04", value: 10 },
    { name: "2025-01-05", value: 19 },
    { name: "2025-01-06", value: 14 },
    { name: "2025-01-07", value: 6 },
    { name: "2025-01-08", value: 14 },
  ];

  const loadDatasets = async () => {
    try {
      if (!token) return;

      const data = await apiCall(
        "/api/datasets",
        {},
        token
      );

      setDatasets(data);

      if (data?.length > 0) {
        setSelectedDataset(data[0]);
      }
    } catch (error) {
      Alert.alert("Failed to load datasets");
    }
  };

  const createLayout = (
    type: string,
    index: number
  ) => {
    return {
      x: (index * 3) % 12,
      y: 999,
      w: type === "kpi" ? 3 : 6,
      h: type === "kpi" ? 2 : 5,
    };
  };

  const addKpi = () => {
    setWidgets((prev) => [
      ...prev,
      {
        id: `kpi-${Date.now()}`,
        type: "kpi",
        layout: createLayout("kpi", prev.length),
      },
    ]);
  };

  const addSpecificChart = (type: string) => {
    setWidgets((prev) => [
      ...prev,
      {
        id: `${type}-${Date.now()}`,
        type,
        layout: createLayout(type, prev.length),
      },
    ]);
  };

  const onLayoutChange = (layout: any[]) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        const item = layout.find(
          (l) => l.i === widget.id
        );

        if (!item) return widget;

        return {
          ...widget,
          layout: {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          },
        };
      })
    );
  };

  const getChartData = () => {
    return sampleData;
  };

  const getKpiData = (index: number) => {
    return {
      title:
        index === 0
          ? "Total Quantity"
          : "Total Unit Price",

      value:
        index === 0 ? "1,042" : "8,615",

      growth: "Live",
    };
  };

  const renderWidget = (
    widget: any,
    index: number
  ) => {
    if (widget.type === "kpi") {
      const kpi = getKpiData(index);

      return (
        <View
          style={[
            styles.widget,
            styles.kpiWidget,
          ]}
        >
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetMenu}>
              ⚙
            </Text>
          </View>

          <Text style={styles.widgetTitle}>
            {kpi.title}
          </Text>

          <Text style={styles.kpiValue}>
            {kpi.value}
          </Text>

          <Text style={styles.growth}>
            {kpi.growth}
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.widget,
          styles.chartWidget,
        ]}
      >
        <View style={styles.dragHandle}>
          <Text style={styles.dragText}>
            Drag Widget
          </Text>

          <Text style={styles.widgetMenu}>
            ⚙
          </Text>
        </View>

        <Text style={styles.widgetTitle}>
          Sales by Category
        </Text>

        <View style={styles.chartMeta}>
          <Text style={styles.metaText}>
            X: Auto
          </Text>

          <Text style={styles.metaText}>
            Metric: Auto
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {widget.type === "bar" && (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart data={getChartData()}>
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                />

                <YAxis stroke="#94a3b8" />

                <Tooltip />

                <Bar
                  dataKey="value"
                  fill="#3b82f6"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}

          {widget.type === "line" && (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart data={getChartData()}>
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                />

                <YAxis stroke="#94a3b8" />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#22c55e"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {widget.type === "pie" && (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={getChartData()}
                  dataKey="value"
                  outerRadius={100}
                >
                  {getChartData().map(
                    (_: any, index: number) => (
                      <Cell
                        key={index}
                        fill={
                          [
                            "#3b82f6",
                            "#22c55e",
                            "#f59e0b",
                            "#ef4444",
                          ][index % 4]
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
    );
  };

  return (
    <View style={styles.page}>
      {/* TOP NAVBAR */}
      <View style={styles.topNavbar}>
        <Text style={styles.navTitle}>
          Dashboard Builder
        </Text>

        <View style={styles.topButtons}>
          <TouchableOpacity
            style={styles.navButton}
          >
            <Text style={styles.buttonText}>
              Insert
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
          >
            <Text style={styles.buttonText}>
              Visual
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
          >
            <Text style={styles.buttonText}>
              Model
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainLayout}>
        {/* LEFT SIDEBAR */}
        <View style={styles.leftSidebar}>
          <Text style={styles.sidebarTitle}>
            Datasets
          </Text>

          <ScrollView>
            {datasets.map((dataset: any) => (
              <TouchableOpacity
                key={dataset._id}
                style={[
                  styles.fieldItem,
                  selectedDataset?._id ===
                    dataset._id && {
                    backgroundColor: "#2563eb",
                  },
                ]}
                onPress={() =>
                  setSelectedDataset(dataset)
                }
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
            placeholder="Dashboard Name"
            placeholderTextColor="#777"
            style={styles.nameInput}
          />

          <TouchableOpacity
            style={styles.saveButton}
          >
            <Text style={styles.buttonText}>
              Save Dashboard
            </Text>
          </TouchableOpacity>

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
              Add Bar Chart
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addSpecificChart("line")
            }
          >
            <Text style={styles.buttonText}>
              Add Line Chart
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addSpecificChart("pie")
            }
          >
            <Text style={styles.buttonText}>
              Add Pie Chart
            </Text>
          </TouchableOpacity>
        </View>

        {/* CENTER DASHBOARD */}
        <View style={styles.centerCanvas}>
          <View style={styles.dashboardSurface}>
            <ResponsiveGridLayout
              className="layout"
              breakpoints={{
                lg: 1200,
                md: 996,
                sm: 768,
                xs: 480,
              }}
              cols={{
                lg: 12,
                md: 10,
                sm: 6,
                xs: 2,
              }}
              rowHeight={80}
              margin={[12, 12]}
              containerPadding={[0, 0]}
              draggableHandle=".dragHandle"
              compactType="vertical"
              preventCollision={false}
              isResizable={true}
              isDraggable={true}
              resizeHandles={["se"]}
              onLayoutChange={
                onLayoutChange
              }
            >
              {widgets.map(
                (widget, index) => (
                  <View
                    key={widget.id}
                    data-grid={{
                      i: widget.id,
                      x:
                        widget.layout?.x || 0,
                      y:
                        widget.layout?.y || 0,
                      w:
                        widget.layout?.w || 4,
                      h:
                        widget.layout?.h || 4,
                      minW: 2,
                      minH: 2,
                    }}
                  >
                    {renderWidget(
                      widget,
                      index
                    )}
                  </View>
                )
              )}
            </ResponsiveGridLayout>
          </View>
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
                  <Text style={styles.fieldText}>
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
    backgroundColor: "#020617",
  },

  topNavbar: {
    height: 60,
    backgroundColor: "#0b1220",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  navTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  topButtons: {
    flexDirection: "row",
  },

  navButton: {
    marginLeft: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },

  mainLayout: {
    flex: 1,
    flexDirection: "row",
  },

  leftSidebar: {
    width: 180,
    backgroundColor: "#0f172a",
    padding: 12,
  },

  centerCanvas: {
    flex: 1,
    backgroundColor: "#111827",
    padding: 16,
    overflow: "hidden",
  },

  dashboardSurface: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
    overflow: "hidden",
  },

  rightSidebar: {
    width: 180,
    backgroundColor: "#0f172a",
    padding: 12,
  },

  widget: {
    backgroundColor: "#0b1220",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 12,
    height: "100%",
    overflow: "hidden",
  },

  kpiWidget: {
    justifyContent: "center",
  },

  chartWidget: {
    flex: 1,
  },

  widgetHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  widgetMenu: {
    color: "#94a3b8",
    fontSize: 12,
  },

  widgetTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },

  chartMeta: {
    flexDirection: "row",
    marginBottom: 10,
  },

  metaText: {
    color: "#94a3b8",
    marginRight: 14,
    fontSize: 12,
  },

  kpiValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
  },

  growth: {
    color: "#22c55e",
    marginTop: 8,
  },

  dragHandle: {
    backgroundColor: "#182235",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dragText: {
    color: "#94a3b8",
    fontSize: 12,
  },

  sidebarTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 14,
  },

  button: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },

  saveButton: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

  fieldItem: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },

  fieldText: {
    color: "#fff",
  },

  nameInput: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    marginBottom: 12,
  },
});