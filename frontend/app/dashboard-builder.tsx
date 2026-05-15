import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Layout, Responsive, WidthProvider } from "react-grid-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useAuthStore } from "../stores/authStore";
import { apiCall } from "../utils/api";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
    }
  }
}

type WidgetType = "kpi" | "bar" | "line" | "pie";

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

const ResponsiveGridLayout = WidthProvider(Responsive);

const REPORT_STAGE_STYLE = {
  width: 1040,
  minHeight: 640,
} as any;

const GRID_ITEM_STYLE = {
  height: "100%",
  cursor: "move",
} as any;

const sampleData = [
  { name: "Jan 01", value: 13 },
  { name: "Jan 02", value: 4 },
  { name: "Jan 03", value: 1 },
  { name: "Jan 04", value: 10 },
  { name: "Jan 05", value: 19 },
  { name: "Jan 06", value: 14 },
  { name: "Jan 07", value: 6 },
  { name: "Jan 08", value: 14 },
];

const fallbackFields = [
  { name: "Date" },
  { name: "Product ID" },
  { name: "Customer ID" },
  { name: "Region" },
  { name: "Quantity" },
  { name: "Unit Price" },
  { name: "Revenue" },
];

const visualButtons: Array<{
  icon: string;
  label: string;
  type: WidgetType;
}> = [
  { icon: "▥", label: "Bar", type: "bar" },
  { icon: "⌁", label: "Line", type: "line" },
  { icon: "◔", label: "Pie", type: "pie" },
  { icon: "123", label: "KPI", type: "kpi" },
];

const ribbonGroups = [
  {
    title: "Data",
    items: ["Get data", "Excel", "SQL Server", "Enter data"],
  },
  {
    title: "Queries",
    items: ["Transform data", "Refresh"],
  },
  {
    title: "Insert",
    items: ["New visual", "Text box", "More visuals"],
  },
  {
    title: "Calculations",
    items: ["New measure", "Quick measure"],
  },
  {
    title: "Share",
    items: ["Publish", "Share"],
  },
];

export default function DashboardBuilder() {
  const { token } = useAuthStore();

  const [widgets, setWidgets] = useState<Widget[]>([
    {
      id: "kpi1",
      type: "kpi",
      title: "Total Quantity",
      layout: { x: 0, y: 0, w: 3, h: 2 },
    },
    {
      id: "line1",
      type: "line",
      title: "Sales Trend",
      layout: { x: 3, y: 0, w: 5, h: 3 },
    },
    {
      id: "bar1",
      type: "bar",
      title: "Sales by Category",
      layout: { x: 0, y: 3, w: 5, h: 4 },
    },
  ]);

  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [dashboardName, setDashboardName] = useState("My Dashboard");

  const selectedFields = useMemo(() => {
    return selectedDataset?.columns?.length ? selectedDataset.columns : fallbackFields;
  }, [selectedDataset]);

  useEffect(() => {
    if (token) {
      loadDatasets();
    }
  }, [token]);

  const loadDatasets = async () => {
    try {
      if (!token) return;

      const data = await apiCall("/api/datasets", {}, token);

      setDatasets(data);

      if (data?.length > 0) {
        setSelectedDataset(data[0]);
      }
    } catch (error) {
      Alert.alert("Failed to load datasets");
    }
  };

  const createLayout = (type: WidgetType, index: number) => ({
    x: (index * 3) % 12,
    y: Infinity,
    w: type === "kpi" ? 3 : 4,
    h: type === "kpi" ? 2 : 4,
  });

  const addWidget = (type: WidgetType) => {
    const titles: Record<WidgetType, string> = {
      kpi: "Total Revenue",
      bar: "Clustered Bar Chart",
      line: "Line Chart",
      pie: "Pie Chart",
    };

    setWidgets((prev) => [
      ...prev,
      {
        id: `${type}-${Date.now()}`,
        type,
        title: titles[type],
        layout: createLayout(type, prev.length),
      },
    ]);
  };

  const onLayoutChange = (currentLayout: Layout[]) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        const item = currentLayout.find((layout) => layout.i === widget.id);

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

  const getKpiData = (index: number) => ({
    title: index === 0 ? "Total Quantity" : "Total Revenue",
    value: index === 0 ? "1,042" : "INR 8,615",
    growth: "Live",
  });

  const renderChart = (type: WidgetType) => {
    if (type === "bar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sampleData}>
            <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} />
            <Tooltip />
            <Bar dataKey="value" fill="#118dff" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === "line") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sampleData}>
            <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#107c10"
              strokeWidth={3}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={sampleData}
            dataKey="value"
            nameKey="name"
            outerRadius="78%"
          >
            {sampleData.map((_, index) => (
              <Cell
                key={index}
                fill={
                  ["#118dff", "#12239e", "#e66c37", "#6b007b", "#e044a7"][
                    index % 5
                  ]
                }
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderWidget = (widget: Widget, index: number) => {
    if (widget.type === "kpi") {
      const kpi = getKpiData(index);

      return (
        <View style={[styles.widget, styles.kpiWidget]}>
          <View style={styles.visualHeader}>
            <Text style={styles.visualTitle}>{kpi.title}</Text>
            <Text style={styles.visualMenu}>...</Text>
          </View>

          <Text style={styles.kpiValue}>{kpi.value}</Text>
          <Text style={styles.growth}>{kpi.growth}</Text>
        </View>
      );
    }

    return (
      <View style={styles.widget}>
        <View style={styles.visualHeader}>
          <Text style={styles.visualTitle}>{widget.title}</Text>
          <Text style={styles.visualMenu}>...</Text>
        </View>

        <View style={styles.fieldChips}>
          <Text style={styles.fieldChip}>X-axis: Auto</Text>
          <Text style={styles.fieldChip}>Values: Auto</Text>
        </View>

        <View pointerEvents="none" style={styles.chartArea}>
          {renderChart(widget.type)}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.page}>
      <View style={styles.titleBar}>
        <View style={styles.tabs}>
          {["File", "Home", "Insert", "Modeling", "View", "Optimize", "Help"].map(
            (tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, tab === "Home" && styles.activeTab]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "Home" && styles.activeTabText,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        <TouchableOpacity style={styles.shareButton}>
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.ribbon}>
        {ribbonGroups.map((group) => (
          <View key={group.title} style={styles.ribbonGroup}>
            <View style={styles.ribbonItems}>
              {group.items.map((item) => (
                <TouchableOpacity key={item} style={styles.ribbonButton}>
                  <View style={styles.ribbonIcon} />
                  <Text style={styles.ribbonButtonText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ribbonGroupTitle}>{group.title}</Text>
          </View>
        ))}
      </View>

      <View style={styles.workspace}>
        <View style={styles.leftRail}>
          {["Report", "Data", "Model", "DAX", "TMDL"].map((item, index) => (
            <TouchableOpacity
              key={item}
              style={[styles.railItem, index === 0 && styles.activeRailItem]}
            >
              <Text style={styles.railIcon}>{item.slice(0, 1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.reportArea}>
          <View style={styles.reportShell}>
            <View style={styles.reportCanvas}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.reportBoundary}>
                    <div style={REPORT_STAGE_STYLE}>
                      <ResponsiveGridLayout
                        className="layout"
                        layouts={{
                          lg: widgets.map((widget) => ({
                            i: widget.id,
                            x: widget.layout.x,
                            y: widget.layout.y,
                            w: widget.layout.w,
                            h: widget.layout.h,
                          })),
                        }}
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
                        rowHeight={72}
                        autoSize
                        verticalCompact={false}
                        margin={[12, 12]}
                        containerPadding={[12, 12]}
                        preventCollision={false}
                        isResizable
                        isDraggable
                        resizeHandles={["se"]}
                        onLayoutChange={onLayoutChange}
                      >
                        {widgets.map((widget, index) => (
                          <div key={widget.id} style={GRID_ITEM_STYLE}>
                            {renderWidget(widget, index)}
                          </div>
                        ))}
                      </ResponsiveGridLayout>
                    </div>
                  </View>
                </ScrollView>
              </ScrollView>
            </View>
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.pageTabs}>
              <TouchableOpacity style={styles.pageTab}>
                <Text style={styles.pageTabText}>Page 1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPageButton}>
                <Text style={styles.addPageText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.zoomControl}>
              <Text style={styles.zoomText}>-</Text>
              <View style={styles.zoomTrack}>
                <View style={styles.zoomThumb} />
              </View>
              <Text style={styles.zoomText}>68%</Text>
            </View>
          </View>
        </View>

        <View style={styles.filtersRail}>
          <Text style={styles.verticalLabel}>Filters</Text>
        </View>

        <View style={styles.sidePanel}>
          <View style={styles.panelSection}>
            <Text style={styles.panelTitle}>Visualizations</Text>
            <Text style={styles.panelSubtitle}>Build visual</Text>

            <View style={styles.visualGrid}>
              {visualButtons.map((visual) => (
                <TouchableOpacity
                  key={visual.type}
                  style={styles.visualButton}
                  onPress={() => addWidget(visual.type)}
                >
                  <Text style={styles.visualIcon}>{visual.icon}</Text>
                  <Text style={styles.visualButtonText}>{visual.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dropZone}>
              <Text style={styles.dropZoneTitle}>Values</Text>
              <Text style={styles.dropZoneText}>Add data fields here</Text>
            </View>
          </View>

          <View style={styles.panelSection}>
            <Text style={styles.panelTitle}>Data</Text>

            <TextInput
              value={dashboardName}
              onChangeText={setDashboardName}
              placeholder="Dashboard Name"
              placeholderTextColor="#777"
              style={styles.nameInput}
            />

            <ScrollView style={styles.datasetList}>
              {datasets.map((dataset: any) => (
                <TouchableOpacity
                  key={dataset._id}
                  style={[
                    styles.datasetItem,
                    selectedDataset?._id === dataset._id &&
                      styles.selectedDataset,
                  ]}
                  onPress={() => setSelectedDataset(dataset)}
                >
                  <Text style={styles.datasetText}>{dataset.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={styles.fieldsList}>
              {selectedFields.map((col: any) => (
                <View key={col.name} style={styles.fieldItem}>
                  <View style={styles.fieldCheckbox} />
                  <Text style={styles.fieldText}>{col.name}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#1f1f1f",
  },

  titleBar: {
    height: 42,
    backgroundColor: "#111111",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  tabs: {
    flexDirection: "row",
    alignItems: "center",
  },

  tab: {
    height: 42,
    paddingHorizontal: 12,
    justifyContent: "center",
  },

  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#00b294",
  },

  tabText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontWeight: "500",
  },

  activeTabText: {
    color: "#ffffff",
    fontWeight: "700",
  },

  shareButton: {
    backgroundColor: "#107c68",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 4,
  },

  shareText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  ribbon: {
    height: 98,
    backgroundColor: "#252525",
    borderBottomWidth: 1,
    borderBottomColor: "#343434",
    flexDirection: "row",
    alignItems: "stretch",
    paddingLeft: 8,
  },

  ribbonGroup: {
    minWidth: 128,
    borderRightWidth: 1,
    borderRightColor: "#3a3a3a",
    paddingHorizontal: 8,
    paddingTop: 8,
    justifyContent: "space-between",
  },

  ribbonItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  ribbonButton: {
    width: 54,
    alignItems: "center",
  },

  ribbonIcon: {
    width: 24,
    height: 22,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#777777",
    backgroundColor: "#333333",
    marginBottom: 4,
  },

  ribbonButtonText: {
    color: "#f1f1f1",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 12,
  },

  ribbonGroupTitle: {
    color: "#cfcfcf",
    fontSize: 10,
    textAlign: "center",
    marginBottom: 5,
  },

  workspace: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#202020",
  },

  leftRail: {
    width: 38,
    backgroundColor: "#171717",
    alignItems: "center",
    paddingTop: 8,
  },

  railItem: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },

  activeRailItem: {
    borderLeftColor: "#00b294",
    backgroundColor: "#232323",
  },

  railIcon: {
    color: "#f5f5f5",
    fontSize: 12,
    fontWeight: "700",
  },

  reportArea: {
    flex: 1,
    backgroundColor: "#f7f7f7",
  },

  reportShell: {
    flex: 1,
    padding: 20,
    backgroundColor: "#ffffff",
  },

  reportCanvas: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  reportBoundary: {
    minWidth: 1064,
    minHeight: 664,
    borderWidth: 1,
    borderColor: "#555555",
    borderStyle: "dotted",
    backgroundColor: "#ffffff",
  },

  bottomBar: {
    height: 38,
    backgroundColor: "#242424",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#343434",
  },

  pageTabs: {
    height: "100%",
    flexDirection: "row",
    alignItems: "stretch",
  },

  pageTab: {
    minWidth: 92,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2f2f2f",
    borderBottomWidth: 3,
    borderBottomColor: "#00b294",
  },

  pageTabText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  addPageButton: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00b294",
  },

  addPageText: {
    color: "#111111",
    fontSize: 22,
    fontWeight: "700",
  },

  zoomControl: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    gap: 10,
  },

  zoomTrack: {
    width: 86,
    height: 2,
    backgroundColor: "#bdbdbd",
    justifyContent: "center",
  },

  zoomThumb: {
    width: 4,
    height: 12,
    backgroundColor: "#ffffff",
    marginLeft: 46,
  },

  zoomText: {
    color: "#f1f1f1",
    fontSize: 12,
  },

  filtersRail: {
    width: 34,
    backgroundColor: "#ffffff",
    borderLeftWidth: 1,
    borderLeftColor: "#c9c9c9",
    borderRightWidth: 1,
    borderRightColor: "#c9c9c9",
    alignItems: "center",
    paddingTop: 12,
  },

  verticalLabel: {
    color: "#333333",
    fontWeight: "700",
    fontSize: 12,
    transform: [{ rotate: "90deg" }],
    marginTop: 34,
  },

  sidePanel: {
    width: 250,
    backgroundColor: "#181818",
    borderLeftWidth: 1,
    borderLeftColor: "#333333",
  },

  panelSection: {
    borderBottomWidth: 1,
    borderBottomColor: "#3a3a3a",
    padding: 10,
  },

  panelTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },

  panelSubtitle: {
    color: "#f1f1f1",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },

  visualGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
  },

  visualButton: {
    width: 50,
    height: 42,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#3f3f3f",
    backgroundColor: "#242424",
    alignItems: "center",
    justifyContent: "center",
  },

  visualIcon: {
    color: "#58a6ff",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },

  visualButtonText: {
    color: "#d8d8d8",
    fontSize: 9,
    fontWeight: "700",
  },

  dropZone: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#5a5a5a",
    padding: 8,
    minHeight: 52,
  },

  dropZoneTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 6,
  },

  dropZoneText: {
    color: "#d0d0d0",
    fontSize: 12,
  },

  nameInput: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#3e3e3e",
    borderRadius: 3,
    padding: 9,
    color: "#ffffff",
    marginBottom: 10,
  },

  datasetList: {
    maxHeight: 106,
    marginBottom: 10,
  },

  datasetItem: {
    backgroundColor: "#232323",
    padding: 9,
    borderRadius: 3,
    marginBottom: 6,
  },

  selectedDataset: {
    backgroundColor: "#107c68",
  },

  datasetText: {
    color: "#ffffff",
    fontSize: 12,
  },

  fieldsList: {
    maxHeight: 210,
  },

  fieldItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
  },

  fieldCheckbox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: "#9d9d9d",
    marginRight: 8,
  },

  fieldText: {
    color: "#ffffff",
    fontSize: 12,
  },

  saveButton: {
    backgroundColor: "#107c68",
    padding: 10,
    borderRadius: 3,
    marginTop: 12,
    alignItems: "center",
  },

  saveButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 12,
  },

  widget: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dedede",
    padding: 10,
    height: "100%",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },

  kpiWidget: {
    justifyContent: "space-between",
  },

  visualHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  visualTitle: {
    color: "#222222",
    fontSize: 13,
    fontWeight: "800",
  },

  visualMenu: {
    color: "#777777",
    fontSize: 15,
    fontWeight: "800",
  },

  fieldChips: {
    flexDirection: "row",
    marginBottom: 6,
    gap: 6,
  },

  fieldChip: {
    color: "#5f5f5f",
    fontSize: 11,
  },

  chartArea: {
    flex: 1,
    minHeight: 0,
  },

  kpiValue: {
    color: "#111111",
    fontSize: 30,
    fontWeight: "800",
  },

  growth: {
    color: "#107c10",
    fontSize: 12,
    fontWeight: "700",
  },
});