import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  pageId: string;
  type: WidgetType;
  title: string;
  xField?: string;
  valueField?: string;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface ReportPage {
  id: string;
  name: string;
}

const ResponsiveGridLayout = WidthProvider(Responsive);

const REPORT_STAGE_STYLE = {
  width: 1060,
  minHeight: 540,
} as any;

const MIN_ZOOM = 50;
const MAX_ZOOM = 150;
const ZOOM_STEP = 10;

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

const teaSalesRows = [
  { Date: "Jan 01", "Product ID": "T-100", "Customer ID": "C-001", Region: "North", Quantity: 13, "Unit Price": 6, Revenue: 78 },
  { Date: "Jan 02", "Product ID": "T-101", "Customer ID": "C-002", Region: "South", Quantity: 4, "Unit Price": 8, Revenue: 32 },
  { Date: "Jan 03", "Product ID": "T-102", "Customer ID": "C-003", Region: "East", Quantity: 1, "Unit Price": 10, Revenue: 10 },
  { Date: "Jan 04", "Product ID": "T-103", "Customer ID": "C-004", Region: "West", Quantity: 10, "Unit Price": 7, Revenue: 70 },
  { Date: "Jan 05", "Product ID": "T-104", "Customer ID": "C-005", Region: "North", Quantity: 19, "Unit Price": 9, Revenue: 171 },
  { Date: "Jan 06", "Product ID": "T-105", "Customer ID": "C-006", Region: "South", Quantity: 14, "Unit Price": 8, Revenue: 112 },
  { Date: "Jan 07", "Product ID": "T-106", "Customer ID": "C-007", Region: "East", Quantity: 6, "Unit Price": 6, Revenue: 36 },
  { Date: "Jan 08", "Product ID": "T-107", "Customer ID": "C-008", Region: "West", Quantity: 14, "Unit Price": 7, Revenue: 98 },
];

const demoDatasets = [
  {
    _id: "demo-car-sales",
    name: "Global Car Sales Data",
    columns: [
      { name: "Sale ID" },
      { name: "Date" },
      { name: "Make" },
      { name: "Model" },
      { name: "Year" },
      { name: "Country" },
      { name: "Price_USD" },
      { name: "Fuel_Type" },
      { name: "Transmission" },
      { name: "Color" },
    ],
    rows: [
      { "Sale ID": "S-001", Date: "Jan 01", Make: "Toyota", Model: "Corolla", Year: 2024, Country: "India", Price_USD: 22000, Fuel_Type: "Petrol", Transmission: "Auto", Color: "White" },
      { "Sale ID": "S-002", Date: "Jan 02", Make: "Honda", Model: "Civic", Year: 2023, Country: "USA", Price_USD: 26500, Fuel_Type: "Petrol", Transmission: "Manual", Color: "Blue" },
      { "Sale ID": "S-003", Date: "Jan 03", Make: "Tesla", Model: "Model 3", Year: 2025, Country: "USA", Price_USD: 41000, Fuel_Type: "Electric", Transmission: "Auto", Color: "Black" },
      { "Sale ID": "S-004", Date: "Jan 04", Make: "Hyundai", Model: "Creta", Year: 2024, Country: "India", Price_USD: 18000, Fuel_Type: "Diesel", Transmission: "Auto", Color: "Red" },
    ],
  },
  {
    _id: "demo-tea-sales",
    name: "tea_sales_data",
    columns: fallbackFields,
    rows: teaSalesRows,
  },
  {
    _id: "demo-spreadsheet",
    name: "spreadsheet",
    columns: [
      { name: "Date" },
      { name: "Category" },
      { name: "Sales" },
      { name: "Profit" },
      { name: "Region" },
    ],
    rows: [
      { Date: "Jan 01", Category: "Tea", Sales: 120, Profit: 35, Region: "North" },
      { Date: "Jan 02", Category: "Coffee", Sales: 90, Profit: 24, Region: "South" },
      { Date: "Jan 03", Category: "Snacks", Sales: 140, Profit: 42, Region: "East" },
      { Date: "Jan 04", Category: "Tea", Sales: 180, Profit: 58, Region: "West" },
    ],
  },
];

const visualButtons: {
  icon: string;
  label: string;
  type: WidgetType;
}[] = [
  { icon: "BAR", label: "Bar", type: "bar" },
  { icon: "LIN", label: "Line", type: "line" },
  { icon: "PIE", label: "Pie", type: "pie" },
  { icon: "123", label: "KPI", type: "kpi" },
  { icon: "COL", label: "Column", type: "bar" },
  { icon: "STK", label: "Stack", type: "bar" },
  { icon: "ARE", label: "Area", type: "line" },
  { icon: "DON", label: "Donut", type: "pie" },
  { icon: "TBL", label: "Table", type: "kpi" },
  { icon: "MAP", label: "Map", type: "pie" },
  { icon: "SC", label: "Scatter", type: "bar" },
  { icon: "R", label: "R", type: "line" },
];

const dataSourceOptions = [
  "Excel workbook",
  "Power BI semantic models",
  "Dataflows",
  "Dataverse",
  "SQL Server",
  "Analysis Services",
  "Text/CSV",
  "Web",
  "OData feed",
  "Blank query",
  "Power BI Template Apps",
  "More...",
];

const leftRailItems = [
  { label: "Report", icon: "R" },
  { label: "Data", icon: "D" },
  { label: "Model", icon: "M" },
  { label: "DAX", icon: "DAX" },
  { label: "TMDL", icon: "TMDL" },
];

const ribbonTabs: Record<string, { title: string; items: string[] }[]> = {
  File: [
    { title: "File", items: ["New report", "Open", "Save", "Export"] },
  ],
  Home: [
    { title: "Data", items: ["Get data", "Excel", "SQL Server", "Enter data"] },
    { title: "Queries", items: ["Transform data", "Refresh"] },
    { title: "Insert", items: ["New visual", "Text box", "More visuals"] },
    { title: "Calculations", items: ["New measure", "Quick measure"] },
    { title: "Share", items: ["Publish", "Share"] },
  ],
  Insert: [
    { title: "Pages", items: ["New page"] },
    { title: "Visuals", items: ["New visual", "Bar chart", "Line chart", "Pie chart"] },
    { title: "AI visuals", items: ["Key influencers", "Decomposition tree", "Narrative"] },
    { title: "Elements", items: ["Text box", "Buttons", "Shapes", "Image"] },
  ],
  Modeling: [
    { title: "Relationships", items: ["Manage relationships"] },
    { title: "Calculations", items: ["New measure", "Quick measure", "New column", "New table"] },
    { title: "Parameters", items: ["New parameter"] },
    { title: "Security", items: ["Manage roles", "View as"] },
  ],
  View: [
    { title: "Themes", items: ["Theme 1", "Theme 2", "Theme 3", "Theme 4"] },
    { title: "Page options", items: ["Page view", "Mobile layout", "Gridlines", "Snap to grid"] },
    { title: "Show panes", items: ["Filters", "Bookmarks", "Selection"] },
    { title: "Analyze", items: ["Performance analyzer", "Sync slicers"] },
  ],
  Optimize: [
    { title: "Queries", items: ["Pause visuals", "Refresh visuals"] },
    { title: "Report", items: ["Optimization presets"] },
    { title: "Review", items: ["Performance analyzer"] },
    { title: "Apply", items: ["Apply all slicers"] },
  ],
  Help: [
    { title: "Help", items: ["Learn", "Documentation", "About"] },
  ],
};

const getRibbonInitials = (label: string) =>
  label
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const isNumericValue = (value: unknown) =>
  typeof value === "number" || (!Number.isNaN(Number(value)) && value !== "");

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);

export default function DashboardBuilder() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState("Home");
  const [selectedWidgetId, setSelectedWidgetId] = useState("kpi1");
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [visualsCollapsed, setVisualsCollapsed] = useState(false);
  const [dataCollapsed, setDataCollapsed] = useState(false);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [pages, setPages] = useState<ReportPage[]>([
    { id: "page-1", name: "Page 1" },
  ]);
  const [activePageId, setActivePageId] = useState("page-1");
  const [zoomPercent, setZoomPercent] = useState(68);

  const [widgets, setWidgets] = useState<Widget[]>([
    {
      id: "kpi1",
      pageId: "page-1",
      type: "kpi",
      title: "Total Quantity",
      valueField: "Quantity",
      layout: { x: 0, y: 0, w: 4, h: 2 },
    },
    {
      id: "line1",
      pageId: "page-1",
      type: "line",
      title: "Sales Trend",
      xField: "Date",
      valueField: "Revenue",
      layout: { x: 4, y: 0, w: 6, h: 3 },
    },
    {
      id: "bar1",
      pageId: "page-1",
      type: "bar",
      title: "Sales by Category",
      xField: "Region",
      valueField: "Revenue",
      layout: { x: 0, y: 3, w: 6, h: 3 },
    },
  ]);

  const [datasets, setDatasets] = useState<any[]>(demoDatasets);
  const [selectedDataset, setSelectedDataset] = useState<any>(demoDatasets[0]);
  const [dashboardName, setDashboardName] = useState("My Dashboard");
  const [activeRail, setActiveRail] = useState("Report");
  const [dataSearch, setDataSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [pageFilterFields, setPageFilterFields] = useState<string[]>([]);
  const [allPageFilterFields, setAllPageFilterFields] = useState<string[]>([]);

  const selectedFields = useMemo(
    () => (selectedDataset?.columns?.length ? selectedDataset.columns : fallbackFields),
    [selectedDataset]
  );

  const activePageWidgets = useMemo(
    () => widgets.filter((widget) => widget.pageId === activePageId),
    [activePageId, widgets]
  );

  const selectedWidget = useMemo(
    () =>
      activePageWidgets.find((widget) => widget.id === selectedWidgetId) ??
      activePageWidgets[0],
    [activePageWidgets, selectedWidgetId]
  );

  const datasetRows = useMemo(
    () => (selectedDataset?.rows?.length ? selectedDataset.rows : teaSalesRows),
    [selectedDataset]
  );

  const numericFields = useMemo(
    () =>
      selectedFields
        .filter((field: any) =>
          datasetRows.some((row: any) => isNumericValue(row[field.name]))
        )
        .map((field: any) => field.name),
    [datasetRows, selectedFields]
  );

  const categoryFields = useMemo(
    () =>
      selectedFields
        .filter((field: any) => !numericFields.includes(field.name))
        .map((field: any) => field.name),
    [numericFields, selectedFields]
  );

  const defaultValueField = numericFields[0] ?? "Revenue";
  const defaultXField = categoryFields[0] ?? selectedFields[0]?.name ?? "Date";
  const filteredDatasets = useMemo(
    () =>
      datasets.filter((dataset: any) =>
        dataset.name.toLowerCase().includes(dataSearch.trim().toLowerCase())
      ),
    [dataSearch, datasets]
  );
  const visibleFields = useMemo(
    () =>
      selectedFields.filter((field: any) =>
        field.name.toLowerCase().includes(dataSearch.trim().toLowerCase())
      ),
    [dataSearch, selectedFields]
  );
  const filteredRows = useMemo(() => {
    const activeFilters = [...pageFilterFields, ...allPageFilterFields];

    if (!activeFilters.length) return datasetRows;

    return datasetRows.filter((row: any) =>
      activeFilters.every((fieldName) => {
        const value = row[fieldName];
        return value !== undefined && value !== null && String(value).trim() !== "";
      })
    );
  }, [allPageFilterFields, datasetRows, pageFilterFields]);
  const zoomScale = zoomPercent / 100;
  const zoomThumbOffset = ((zoomPercent - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 86;
  const zoomFrameStyle = {
    width: REPORT_STAGE_STYLE.width * zoomScale,
    minHeight: REPORT_STAGE_STYLE.minHeight * zoomScale,
  } as any;
  const zoomStageStyle = {
    transform: `scale(${zoomScale})`,
    transformOrigin: "top left",
  } as any;

  const loadDatasets = useCallback(async () => {
    try {
      if (!token) return;

      const data = await apiCall("/api/datasets", {}, token);

      if (!data?.length) return;

      setDatasets(data);
      setSelectedDataset(data[0]);
    } catch {
      setDatasets(demoDatasets);
      setSelectedDataset(demoDatasets[0]);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadDatasets();
    }
  }, [loadDatasets, token]);

  useEffect(() => {
    if (selectedWidget?.pageId === activePageId) return;

    setSelectedWidgetId(activePageWidgets[0]?.id ?? "");
  }, [activePageId, activePageWidgets, selectedWidget]);

  const createLayout = (type: WidgetType, index: number) => ({
    x: (index * 3) % 12,
    y: Infinity,
    w: type === "kpi" ? 3 : 4,
    h: type === "kpi" ? 2 : 4,
  });

  const addPage = () => {
    const nextPageNumber = pages.length + 1;
    const id = `page-${Date.now()}`;

    setPages((prev) => [
      ...prev,
      {
        id,
        name: `Page ${nextPageNumber}`,
      },
    ]);
    setActivePageId(id);
    setSelectedWidgetId("");
  };

  const changeZoom = (nextZoom: number) => {
    setZoomPercent(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)));
  };

  const addWidget = (type: WidgetType) => {
    const titles: Record<WidgetType, string> = {
      kpi: "Total Revenue",
      bar: "Clustered Bar Chart",
      line: "Line Chart",
      pie: "Pie Chart",
    };
    const id = `${type}-${Date.now()}`;

    setWidgets((prev) => [
      ...prev,
      {
        id,
        pageId: activePageId,
        type,
        title: titles[type],
        xField: type === "kpi" ? undefined : defaultXField,
        valueField: defaultValueField,
        layout: createLayout(type, activePageWidgets.length),
      },
    ]);

    setSelectedWidgetId(id);
  };

  const addVisualFromPane = (type: WidgetType) => {
    addWidget(type);
  };

  const duplicateSelectedVisual = () => {
    if (!selectedWidget) return;

    const id = `${selectedWidget.type}-${Date.now()}`;
    setWidgets((prev) => [
      ...prev,
      {
        ...selectedWidget,
        id,
        title: `${selectedWidget.title} Copy`,
        layout: {
          ...selectedWidget.layout,
          x: Math.min(selectedWidget.layout.x + 1, 8),
          y: selectedWidget.layout.y + 1,
        },
      },
    ]);
    setSelectedWidgetId(id);
  };

  const deleteSelectedVisual = () => {
    if (!selectedWidget) return;

    setWidgets((prev) => prev.filter((widget) => widget.id !== selectedWidget.id));
    setSelectedWidgetId(
      activePageWidgets.find((widget) => widget.id !== selectedWidget.id)?.id ?? ""
    );
  };

  const assignFieldToSelectedVisual = (fieldName: string) => {
    if (!selectedWidget) return;

    const isNumeric = numericFields.includes(fieldName);

    setWidgets((prev) =>
      prev.map((widget) => {
        if (widget.id !== selectedWidget.id) return widget;

        if (widget.type === "kpi") {
          return {
            ...widget,
            valueField: isNumeric ? fieldName : widget.valueField ?? defaultValueField,
            title: isNumeric ? `Total ${fieldName}` : widget.title,
          };
        }

        return {
          ...widget,
          xField: isNumeric ? widget.xField ?? defaultXField : fieldName,
          valueField: isNumeric ? fieldName : widget.valueField ?? defaultValueField,
          title: isNumeric ? `${fieldName} by ${widget.xField ?? defaultXField}` : widget.title,
        };
      })
    );
  };

  const saveDashboard = () => {
    Alert.alert(
      "Dashboard saved",
      `${dashboardName || "Untitled dashboard"} has ${pages.length} page${
        pages.length === 1 ? "" : "s"
      } and ${widgets.length} visual${widgets.length === 1 ? "" : "s"}.`
    );
  };

  const resetDemoData = () => {
    setDatasets(demoDatasets);
    setSelectedDataset(demoDatasets[0]);
    Alert.alert("Demo data loaded", "The sample datasets are ready to use.");
  };

  const selectDataSource = (source: string) => {
    if (source === "More...") {
      setDataMenuOpen(false);
      setDataCollapsed(false);
      Alert.alert("More data sources", "Demo sources are available in the Data pane.");
      return;
    }

    const sourceDataset =
      source === "Excel workbook" || source === "Text/CSV"
        ? demoDatasets[2]
        : source === "SQL Server" || source === "Analysis Services"
          ? demoDatasets[0]
          : demoDatasets[1];

    setDatasets(demoDatasets);
    setSelectedDataset(sourceDataset);
    setPageFilterFields([]);
    setAllPageFilterFields([]);
    setDataMenuOpen(false);
    Alert.alert(source, `${sourceDataset.name} is loaded in the Data pane.`);
  };

  const askAi = () => {
    const prefix = Date.now();
    const aiWidgets: Widget[] = [
      {
        id: `ai-kpi-${prefix}`,
        pageId: activePageId,
        type: "kpi",
        title: `Total ${defaultValueField}`,
        valueField: defaultValueField,
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: `ai-bar-${prefix}`,
        pageId: activePageId,
        type: "bar",
        title: `${defaultValueField} by ${defaultXField}`,
        xField: defaultXField,
        valueField: defaultValueField,
        layout: { x: 3, y: 0, w: 5, h: 3 },
      },
      {
        id: `ai-line-${prefix}`,
        pageId: activePageId,
        type: "line",
        title: `${defaultValueField} Trend`,
        xField: categoryFields.includes("Date") ? "Date" : defaultXField,
        valueField: defaultValueField,
        layout: { x: 0, y: 3, w: 5, h: 3 },
      },
      {
        id: `ai-pie-${prefix}`,
        pageId: activePageId,
        type: "pie",
        title: `${defaultValueField} Share`,
        xField: defaultXField,
        valueField: defaultValueField,
        layout: { x: 5, y: 3, w: 4, h: 3 },
      },
    ];

    setWidgets((prev) => [
      ...prev.filter((widget) => widget.pageId !== activePageId),
      ...aiWidgets,
    ]);
    setSelectedWidgetId(aiWidgets[0].id);
    setVisualsCollapsed(false);
    Alert.alert("Ask AI", "A starter report has been created for this page.");
  };

  const addFilterField = (scope: "page" | "all") => {
    const fieldName =
      selectedWidget?.xField ?? selectedWidget?.valueField ?? defaultXField ?? defaultValueField;

    if (!fieldName) return;

    if (scope === "page") {
      setPageFilterFields((prev) => (prev.includes(fieldName) ? prev : [...prev, fieldName]));
      return;
    }

    setAllPageFilterFields((prev) => (prev.includes(fieldName) ? prev : [...prev, fieldName]));
  };

  const removeFilterField = (scope: "page" | "all", fieldName: string) => {
    if (scope === "page") {
      setPageFilterFields((prev) => prev.filter((field) => field !== fieldName));
      return;
    }

    setAllPageFilterFields((prev) => prev.filter((field) => field !== fieldName));
  };

  const handleRailPress = (rail: string) => {
    setActiveRail(rail);

    if (rail === "Report") return;
    if (rail === "Data") {
      setDataCollapsed(false);
      return;
    }
    if (rail === "Model") {
      setActiveTab("Modeling");
      return;
    }

    Alert.alert(rail, `${rail} view is available as a prototype panel.`);
  };

  const handleRibbonAction = (item: string) => {
    const actions: Record<string, () => void> = {
      "New report": () => {
        setWidgets([]);
        setSelectedWidgetId("");
        setPages([{ id: "page-1", name: "Page 1" }]);
        setActivePageId("page-1");
      },
      Open: resetDemoData,
      Save: saveDashboard,
      Export: saveDashboard,
      "Get data": () => setDataMenuOpen((open) => !open),
      Excel: resetDemoData,
      "SQL Server": resetDemoData,
      "Enter data": resetDemoData,
      "Transform data": () =>
        Alert.alert("Transform data", "Demo mode: fields are ready in the Data pane."),
      Refresh: loadDatasets,
      "New visual": () => addWidget("bar"),
      "Bar chart": () => addWidget("bar"),
      "Line chart": () => addWidget("line"),
      "Pie chart": () => addWidget("pie"),
      "Text box": () => addWidget("kpi"),
      "More visuals": () => addWidget("pie"),
      "Key influencers": () => addWidget("bar"),
      "Decomposition tree": () => addWidget("pie"),
      Narrative: () => addWidget("kpi"),
      Buttons: () => Alert.alert("Button added", "Demo mode: button controls can be mocked here."),
      Shapes: () => Alert.alert("Shape added", "Demo mode: shape controls can be mocked here."),
      Image: () => Alert.alert("Image added", "Demo mode: image controls can be mocked here."),
      "New page": addPage,
      "New measure": () => addWidget("kpi"),
      "Quick measure": () => addWidget("line"),
      "New column": () => Alert.alert("New column", "Demo mode: calculated column created."),
      "New table": resetDemoData,
      "New parameter": () => Alert.alert("Parameter", "Demo mode: parameter created."),
      "Manage relationships": () =>
        Alert.alert("Relationships", "Demo datasets are already related for this prototype."),
      "Manage roles": () => Alert.alert("Security", "Demo mode: roles panel opened."),
      "View as": () => Alert.alert("Security", "Demo mode: viewing as report user."),
      "Theme 1": () => setActiveTab("View"),
      "Theme 2": () => setActiveTab("View"),
      "Theme 3": () => setActiveTab("View"),
      "Theme 4": () => setActiveTab("View"),
      "Page view": () => Alert.alert("Page view", "Canvas is set to fit-to-width demo mode."),
      "Mobile layout": () => Alert.alert("Mobile layout", "Demo mode: mobile layout preview."),
      Gridlines: () => Alert.alert("Gridlines", "The dotted report boundary is enabled."),
      "Snap to grid": () => Alert.alert("Snap to grid", "Grid snapping is enabled."),
      Filters: () => setFiltersCollapsed((collapsed) => !collapsed),
      Bookmarks: () => Alert.alert("Bookmarks", "Demo mode: bookmarks pane opened."),
      Selection: () => setVisualsCollapsed(false),
      "Performance analyzer": () =>
        Alert.alert("Performance analyzer", `${activePageWidgets.length} visuals rendered.`),
      "Sync slicers": () => Alert.alert("Sync slicers", "Demo mode: slicers synced."),
      "Pause visuals": () => Alert.alert("Pause visuals", "Demo mode: visual updates paused."),
      "Refresh visuals": loadDatasets,
      "Optimization presets": () =>
        Alert.alert("Optimization", "Demo mode: optimized for fewer visuals and simpler queries."),
      "Apply all slicers": () => Alert.alert("Slicers", "All demo slicers applied."),
      Learn: () => Alert.alert("Help", "Select a visual, then click fields to bind data."),
      Documentation: () => Alert.alert("Help", "This is a Power BI-style dashboard prototype."),
      About: () => Alert.alert("About", "InsightEngine dashboard builder demo."),
      Publish: saveDashboard,
      Share: saveDashboard,
    };

    actions[item]?.();
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

  const getVisualData = (widget: Widget) => {
    const fieldNames = selectedFields.map((field: any) => field.name);
    const xField =
      widget.xField && fieldNames.includes(widget.xField) ? widget.xField : defaultXField;
    const valueField =
      widget.valueField && fieldNames.includes(widget.valueField)
        ? widget.valueField
        : defaultValueField;

    if (!xField || !valueField) return sampleData;

    const grouped = filteredRows.reduce((acc: Record<string, number>, row: any) => {
      const key = String(row[xField] ?? "Blank");
      const value = Number(row[valueField] ?? 0);
      acc[key] = (acc[key] ?? 0) + (Number.isNaN(value) ? 0 : value);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value,
    }));
  };

  const getKpiData = (widget: Widget, index: number) => {
    const fieldNames = selectedFields.map((field: any) => field.name);
    const valueField =
      widget.valueField && fieldNames.includes(widget.valueField)
        ? widget.valueField
        : defaultValueField;
    const total = filteredRows.reduce((sum: number, row: any) => {
      const value = Number(row[valueField] ?? 0);
      return sum + (Number.isNaN(value) ? 0 : value);
    }, 0);

    return {
      title: widget.title || (index === 0 ? "Total Quantity" : `Total ${valueField}`),
      value: formatNumber(total),
      growth: "Live",
    };
  };

  const renderChart = (widget: Widget) => {
    const data = getVisualData(widget);

    if (widget.type === "bar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} />
            <Tooltip />
            <Bar dataKey="value" fill="#118dff" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (widget.type === "line") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
          <Pie data={data} dataKey="value" nameKey="name" outerRadius="78%">
            {data.map((_, index) => (
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
    const isSelected = selectedWidget?.id === widget.id;

    if (widget.type === "kpi") {
      const kpi = getKpiData(widget, index);

      return (
        <View style={[styles.widget, styles.kpiWidget, isSelected && styles.selectedWidget]}>
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
      <View style={[styles.widget, isSelected && styles.selectedWidget]}>
        <View style={styles.visualHeader}>
          <Text style={styles.visualTitle}>{widget.title}</Text>
          <Text style={styles.visualMenu}>...</Text>
        </View>

        <View style={styles.fieldChips}>
          <Text style={styles.fieldChip}>X-axis: {widget.xField ?? defaultXField}</Text>
          <Text style={styles.fieldChip}>Values: {widget.valueField ?? defaultValueField}</Text>
        </View>

        <View pointerEvents="none" style={styles.chartArea}>
          {renderChart(widget)}
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
                style={[styles.tab, tab === activeTab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === activeTab && styles.activeTabText,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        <View style={styles.titleActions}>
          <TouchableOpacity style={styles.askAiButton} onPress={askAi}>
            <Text style={styles.askAiText}>Ask AI</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton} onPress={saveDashboard}>
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.ribbon}>
        {(ribbonTabs[activeTab] ?? ribbonTabs.Home).map((group) => (
          <View key={group.title} style={styles.ribbonGroup}>
            <View style={styles.ribbonItems}>
              {group.items.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.ribbonButton}
                  onPress={() => handleRibbonAction(item)}
                >
                  <View
                    style={[
                      styles.ribbonIcon,
                      activeTab === "View" && item.startsWith("Theme") && styles.themeIcon,
                    ]}
                  >
                    <Text style={styles.ribbonIconText}>
                      {getRibbonInitials(item)}
                    </Text>
                  </View>
                  <Text style={styles.ribbonButtonText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ribbonGroupTitle}>{group.title}</Text>
          </View>
        ))}
      </View>

      {dataMenuOpen && (
        <View style={styles.dataSourceMenu}>
          <Text style={styles.dataSourceMenuTitle}>Common data sources</Text>

          {dataSourceOptions.map((source) => (
            <TouchableOpacity
              key={source}
              style={styles.dataSourceItem}
              onPress={() => selectDataSource(source)}
            >
              <View style={styles.dataSourceIcon}>
                <Text style={styles.dataSourceIconText}>
                  {getRibbonInitials(source)}
                </Text>
              </View>
              <Text style={styles.dataSourceText}>{source}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>Tab: {activeTab}</Text>
        <Text style={styles.statusText}>Dataset: {selectedDataset?.name}</Text>
        <Text style={styles.statusText}>Visuals: {activePageWidgets.length}</Text>
      </View>

      <View style={styles.workspace}>
        <View style={styles.leftRail}>
          {leftRailItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.railItem,
                activeRail === item.label && styles.activeRailItem,
              ]}
              onPress={() => handleRailPress(item.label)}
            >
              <Text
                style={[
                  styles.railIcon,
                  item.icon.length > 1 && styles.railLongIcon,
                ]}
              >
                {item.icon}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.reportArea}>
          <View style={styles.reportShell}>
            <View style={styles.reportCanvas}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <div style={zoomFrameStyle}>
                    <div style={zoomStageStyle}>
                      <View style={styles.reportBoundary}>
                        <div style={REPORT_STAGE_STYLE}>
                          <ResponsiveGridLayout
                            className="layout"
                            layouts={{
                              lg: activePageWidgets.map((widget) => ({
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
                            rowHeight={56}
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
                            {activePageWidgets.map((widget, index) => (
                              <div
                                key={widget.id}
                                style={GRID_ITEM_STYLE}
                                onClick={() => setSelectedWidgetId(widget.id)}
                              >
                                {renderWidget(widget, index)}
                              </div>
                            ))}
                          </ResponsiveGridLayout>
                        </div>
                      </View>
                    </div>
                  </div>
                </ScrollView>
              </ScrollView>
            </View>
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.pageTabs}>
              {pages.map((page) => (
                <TouchableOpacity
                  key={page.id}
                  style={[
                    styles.pageTab,
                    activePageId === page.id && styles.activePageTab,
                  ]}
                  onPress={() => setActivePageId(page.id)}
                >
                  <Text style={styles.pageTabText}>{page.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addPageButton} onPress={addPage}>
                <Text style={styles.addPageText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.zoomControl}>
              <TouchableOpacity
                style={styles.zoomButton}
                onPress={() => changeZoom(zoomPercent - ZOOM_STEP)}
              >
                <Text style={styles.zoomText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.zoomTrack}
                onPress={() => changeZoom(zoomPercent + ZOOM_STEP)}
              >
                <View
                  style={[
                    styles.zoomThumb,
                    { marginLeft: Math.max(0, Math.min(82, zoomThumbOffset)) },
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.zoomButton}
                onPress={() => changeZoom(zoomPercent + ZOOM_STEP)}
              >
                <Text style={styles.zoomText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.zoomPercentText}>{zoomPercent}%</Text>
            </View>
          </View>
        </View>

        {filtersCollapsed ? (
          <TouchableOpacity
            style={[styles.collapsedPane, styles.collapsedLightPane]}
            onPress={() => setFiltersCollapsed(false)}
          >
            <Text style={styles.collapsedLightChevron}>{"<"}</Text>
            <Text style={styles.collapsedLightText}>Filters</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.filtersPanel}>
            <TouchableOpacity
              style={styles.filtersHeader}
              onPress={() => setFiltersCollapsed(true)}
            >
              <Text style={styles.filtersTitle}>Filters</Text>
              <Text style={styles.lightPanelChevron}>{">"}</Text>
            </TouchableOpacity>

            <TextInput
              placeholder="Search"
              placeholderTextColor="#555555"
              value={filterSearch}
              onChangeText={setFilterSearch}
              style={styles.filterSearch}
            />

            <View style={styles.filterBlock}>
              <View style={styles.filterBlockHeader}>
                <Text style={styles.filterBlockTitle}>Filters on this page</Text>
                <Text style={styles.filterDots}>...</Text>
              </View>
              <TouchableOpacity
                style={styles.filterDropZone}
                onPress={() => addFilterField("page")}
              >
                {pageFilterFields.length ? (
                  pageFilterFields
                    .filter((field) =>
                      field.toLowerCase().includes(filterSearch.trim().toLowerCase())
                    )
                    .map((field) => (
                      <TouchableOpacity
                        key={field}
                        style={styles.filterChip}
                        onPress={() => removeFilterField("page", field)}
                      >
                        <Text style={styles.filterChipText}>{field} x</Text>
                      </TouchableOpacity>
                    ))
                ) : (
                  <Text style={styles.filterDropText}>Add data fields here</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.filterBlock}>
              <View style={styles.filterBlockHeader}>
                <Text style={styles.filterBlockTitle}>Filters on all pages</Text>
                <Text style={styles.filterDots}>...</Text>
              </View>
              <TouchableOpacity
                style={styles.filterDropZone}
                onPress={() => addFilterField("all")}
              >
                {allPageFilterFields.length ? (
                  allPageFilterFields
                    .filter((field) =>
                      field.toLowerCase().includes(filterSearch.trim().toLowerCase())
                    )
                    .map((field) => (
                      <TouchableOpacity
                        key={field}
                        style={styles.filterChip}
                        onPress={() => removeFilterField("all", field)}
                      >
                        <Text style={styles.filterChipText}>{field} x</Text>
                      </TouchableOpacity>
                    ))
                ) : (
                  <Text style={styles.filterDropText}>Add data fields here</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View
          style={[
            styles.rightPanes,
            visualsCollapsed !== dataCollapsed && styles.rightPanesOneCollapsed,
            visualsCollapsed && dataCollapsed && styles.rightPanesCollapsed,
          ]}
        >
          {visualsCollapsed ? (
            <TouchableOpacity
              style={styles.collapsedPane}
              onPress={() => setVisualsCollapsed(false)}
            >
              <Text style={styles.collapsedChevron}>{"<"}</Text>
              <Text style={styles.collapsedPaneText}>Visualizations</Text>
            </TouchableOpacity>
          ) : (
          <View style={styles.visualPane}>
            <TouchableOpacity
              style={styles.darkPanelHeader}
              onPress={() => setVisualsCollapsed(true)}
            >
              <Text style={styles.panelTitle}>Visualizations</Text>
              <Text style={styles.panelChevron}>{">"}</Text>
            </TouchableOpacity>
            <Text style={styles.panelSubtitle}>Build visual</Text>

            <View style={styles.visualGrid}>
              {visualButtons.map((visual) => (
                <TouchableOpacity
                  key={visual.type}
                  style={[
                    styles.visualButton,
                    selectedWidget?.type === visual.type && styles.activeVisualButton,
                  ]}
                  onPress={() => addVisualFromPane(visual.type)}
                >
                  <Text style={styles.visualIcon}>{visual.icon}</Text>
                  <Text style={styles.visualButtonText}>{visual.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.visualHint}>
              Click a visual icon to add it to this page.
            </Text>

            <View style={styles.dropZone}>
              <Text style={styles.dropZoneTitle}>Selected visual</Text>
              <Text style={styles.dropZoneText}>
                {selectedWidget?.title ?? "Select a visual"}
              </Text>
              <Text style={styles.dropZoneText}>
                Axis: {selectedWidget?.xField ?? "None"}
              </Text>
              <Text style={styles.dropZoneText}>
                Values: {selectedWidget?.valueField ?? "None"}
              </Text>
            </View>

            <View style={styles.visualActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={duplicateSelectedVisual}
              >
                <Text style={styles.actionButtonText}>Duplicate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={deleteSelectedVisual}
              >
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
          )}

          {dataCollapsed ? (
            <TouchableOpacity
              style={styles.collapsedPane}
              onPress={() => setDataCollapsed(false)}
            >
              <Text style={styles.collapsedChevron}>{"<"}</Text>
              <Text style={styles.collapsedPaneText}>Data</Text>
            </TouchableOpacity>
          ) : (
          <View style={styles.dataPane}>
            <TouchableOpacity
              style={styles.darkPanelHeader}
              onPress={() => setDataCollapsed(true)}
            >
              <Text style={styles.panelTitle}>Data</Text>
              <Text style={styles.panelChevron}>{">"}</Text>
            </TouchableOpacity>

            <TextInput
              placeholder="Search"
              placeholderTextColor="#888888"
              style={styles.dataSearch}
            />

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
                <TouchableOpacity
                  key={col.name}
                  style={styles.fieldItem}
                  onPress={() => assignFieldToSelectedVisual(col.name)}
                >
                  <View
                    style={[
                      styles.fieldCheckbox,
                      (selectedWidget?.xField === col.name ||
                        selectedWidget?.valueField === col.name) &&
                        styles.checkedField,
                    ]}
                  />
                  <Text style={styles.fieldText}>{col.name}</Text>
                  <Text style={styles.fieldType}>
                    {numericFields.includes(col.name) ? "123" : "abc"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.saveButton} onPress={saveDashboard}>
              <Text style={styles.saveButtonText}>Save Dashboard</Text>
            </TouchableOpacity>
          </View>
          )}
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

  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  askAiButton: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9,
  },

  askAiText: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "800",
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
    minWidth: 132,
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
    width: 58,
    alignItems: "center",
  },

  ribbonIcon: {
    width: 24,
    height: 22,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#777777",
    backgroundColor: "#2b2b2b",
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  ribbonIconText: {
    color: "#dcecff",
    fontSize: 8,
    fontWeight: "800",
  },

  themeIcon: {
    width: 54,
    backgroundColor: "#f8f8f8",
    borderColor: "#8f8f8f",
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

  dataSourceMenu: {
    position: "absolute",
    top: 140,
    left: 168,
    width: 250,
    backgroundColor: "#252525",
    borderWidth: 1,
    borderColor: "#343434",
    paddingVertical: 10,
    zIndex: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  dataSourceMenuTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  dataSourceItem: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  dataSourceIcon: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: "#5c5c5c",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  dataSourceIconText: {
    color: "#dcecff",
    fontSize: 8,
    fontWeight: "800",
  },

  dataSourceText: {
    color: "#f2f2f2",
    fontSize: 12,
  },

  workspace: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#202020",
  },

  statusBar: {
    height: 26,
    backgroundColor: "#191919",
    borderBottomWidth: 1,
    borderBottomColor: "#303030",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },

  statusText: {
    color: "#cfcfcf",
    fontSize: 11,
    fontWeight: "600",
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

  railLongIcon: {
    fontSize: 8,
  },

  reportArea: {
    flex: 1,
    backgroundColor: "#f7f7f7",
  },

  reportShell: {
    flex: 1,
    padding: 12,
    backgroundColor: "#ffffff",
  },

  reportCanvas: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  reportBoundary: {
    minWidth: 1084,
    minHeight: 564,
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
    borderRightWidth: 1,
    borderRightColor: "#1c1c1c",
    borderBottomColor: "transparent",
  },

  activePageTab: {
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
    gap: 8,
  },

  zoomButton: {
    width: 20,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
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
  },

  zoomPercentText: {
    color: "#f1f1f1",
    fontSize: 12,
    minWidth: 34,
  },

  zoomText: {
    color: "#f1f1f1",
    fontSize: 12,
  },

  filtersPanel: {
    width: 220,
    backgroundColor: "#ffffff",
    borderLeftWidth: 1,
    borderLeftColor: "#c8c8c8",
    padding: 10,
  },

  filtersHeader: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  filtersTitle: {
    color: "#222222",
    fontSize: 16,
    fontWeight: "800",
  },

  filterSearch: {
    height: 34,
    borderWidth: 1,
    borderColor: "#bcbcbc",
    paddingHorizontal: 10,
    color: "#111111",
    marginBottom: 16,
  },

  filterBlock: {
    marginBottom: 18,
  },

  filterBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  filterBlockTitle: {
    color: "#333333",
    fontSize: 12,
  },

  filterDots: {
    color: "#777777",
    fontWeight: "800",
  },

  filterDropZone: {
    height: 46,
    borderWidth: 1,
    borderColor: "#333333",
    alignItems: "center",
    justifyContent: "center",
  },

  filterDropText: {
    color: "#555555",
    fontSize: 12,
  },

  filterChip: {
    backgroundColor: "#efefef",
    borderWidth: 1,
    borderColor: "#bdbdbd",
    paddingHorizontal: 8,
    paddingVertical: 5,
    margin: 3,
  },

  filterChipText: {
    color: "#222222",
    fontSize: 11,
    fontWeight: "700",
  },

  rightPanes: {
    width: 360,
    flexDirection: "row",
    backgroundColor: "#181818",
    borderLeftWidth: 1,
    borderLeftColor: "#333333",
  },

  rightPanesCollapsed: {
    width: 72,
  },

  rightPanesOneCollapsed: {
    width: 216,
  },

  visualPane: {
    width: 180,
    borderRightWidth: 1,
    borderRightColor: "#4a4a4a",
    padding: 8,
  },

  dataPane: {
    flex: 1,
    padding: 10,
  },

  darkPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  panelChevron: {
    color: "#d8d8d8",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 24,
  },

  lightPanelChevron: {
    color: "#777777",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 24,
  },

  collapsedPane: {
    width: 36,
    backgroundColor: "#111111",
    borderRightWidth: 1,
    borderRightColor: "#3a3a3a",
    alignItems: "center",
    paddingTop: 8,
  },

  collapsedLightPane: {
    backgroundColor: "#ffffff",
    borderLeftWidth: 1,
    borderLeftColor: "#c8c8c8",
    borderRightColor: "#c8c8c8",
  },

  collapsedChevron: {
    color: "#d8d8d8",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
    marginBottom: 12,
  },

  collapsedLightChevron: {
    color: "#555555",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
    marginBottom: 12,
  },

  collapsedPaneText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    transform: [{ rotate: "90deg" }],
    width: 130,
    marginTop: 52,
  },

  collapsedLightText: {
    color: "#222222",
    fontSize: 14,
    fontWeight: "800",
    transform: [{ rotate: "90deg" }],
    width: 80,
    marginTop: 30,
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
    gap: 5,
    marginBottom: 12,
  },

  visualButton: {
    width: 36,
    height: 32,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#3f3f3f",
    backgroundColor: "#242424",
    alignItems: "center",
    justifyContent: "center",
  },

  activeVisualButton: {
    borderColor: "#00b294",
    backgroundColor: "#123c37",
  },

  visualIcon: {
    color: "#58a6ff",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },

  visualButtonText: {
    color: "#d8d8d8",
    fontSize: 8,
    fontWeight: "700",
  },

  visualHint: {
    color: "#bdbdbd",
    fontSize: 11,
    marginBottom: 10,
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
    marginTop: 2,
  },

  visualActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  actionButton: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 3,
    paddingVertical: 8,
    alignItems: "center",
  },

  deleteButton: {
    backgroundColor: "#4a1f1f",
    borderColor: "#6b2b2b",
  },

  actionButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
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

  dataSearch: {
    height: 28,
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 3,
    paddingHorizontal: 8,
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
    maxHeight: 260,
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

  checkedField: {
    backgroundColor: "#00b294",
    borderColor: "#00b294",
  },

  fieldText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 12,
  },

  fieldType: {
    color: "#8f8f8f",
    fontSize: 10,
    fontWeight: "800",
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

  selectedWidget: {
    borderColor: "#00b294",
    borderWidth: 2,
  },

  kpiWidget: {
    justifyContent: "space-between",
    paddingVertical: 12,
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
    fontSize: 28,
    fontWeight: "800",
  },

  growth: {
    color: "#107c10",
    fontSize: 12,
    fontWeight: "700",
  },
});
