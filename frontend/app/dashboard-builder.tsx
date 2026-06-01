import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  Area,
  AreaChart,
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
import * as XLSX from "xlsx";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useAuthStore } from "../stores/authStore";
import { apiCall } from "../utils/api";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      input: any;
    }
  }
}

type WidgetType =
  | "stacked-bar"
  | "stacked-column"
  | "area"
  | "clustered-bar"
  | "clustered-column"
  | "hundred-bar"
  | "hundred-column"
  | "line"
  | "stacked-area"
  | "hundred-area"
  | "line-stacked-column"
  | "line-clustered-column"
  | "ribbon"
  | "waterfall"
  | "funnel"
  | "scatter"
  | "pie"
  | "donut"
  | "treemap"
  | "map"
  | "filled-map"
  | "shape-map"
  | "card"
  | "kpi"
  | "slicer"
  | "table"
  | "matrix"
  | "decomposition-tree";

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

const REPORT_MIN_HEIGHT = 540;

const MIN_ZOOM = 50;
const MAX_ZOOM = 150;
const ZOOM_STEP = 10;
const SAVED_DATASETS_KEY = "dashboardBuilder.savedDatasets";

const GRID_ITEM_STYLE = {
  height: "100%",
  cursor: "move",
} as any;

const VISUAL_TOOLTIP_WRAP_STYLE = {
  display: "block",
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
  { icon: "SB", label: "Stacked bar", type: "stacked-bar" },
  { icon: "SC", label: "Stacked column", type: "stacked-column" },
  { icon: "AR", label: "Area", type: "area" },
  { icon: "CB", label: "Clustered bar", type: "clustered-bar" },
  { icon: "CC", label: "Clustered column", type: "clustered-column" },
  { icon: "100B", label: "100% bar", type: "hundred-bar" },
  { icon: "100C", label: "100% column", type: "hundred-column" },
  { icon: "LIN", label: "Line", type: "line" },
  { icon: "SA", label: "Stacked area", type: "stacked-area" },
  { icon: "100A", label: "100% area", type: "hundred-area" },
  { icon: "LSC", label: "Line + stacked", type: "line-stacked-column" },
  { icon: "LCC", label: "Line + column", type: "line-clustered-column" },
  { icon: "RIB", label: "Ribbon", type: "ribbon" },
  { icon: "WF", label: "Waterfall", type: "waterfall" },
  { icon: "FUN", label: "Funnel", type: "funnel" },
  { icon: "SCT", label: "Scatter", type: "scatter" },
  { icon: "PIE", label: "Pie", type: "pie" },
  { icon: "DON", label: "Donut", type: "donut" },
  { icon: "TRE", label: "Treemap", type: "treemap" },
  { icon: "MAP", label: "Map", type: "map" },
  { icon: "FM", label: "Filled map", type: "filled-map" },
  { icon: "SM", label: "Shape map", type: "shape-map" },
  { icon: "123", label: "Card", type: "card" },
  { icon: "KPI", label: "KPI", type: "kpi" },
  { icon: "SLC", label: "Slicer", type: "slicer" },
  { icon: "TBL", label: "Table", type: "table" },
  { icon: "MAT", label: "Matrix", type: "matrix" },
  { icon: "DEC", label: "Decomposition", type: "decomposition-tree" },
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
  { label: "Report view", value: "Report", icon: "chart-box-outline" },
  { label: "Table view", value: "Data", icon: "table" },
  { label: "Model view", value: "Model", icon: "relation-many-to-many" },
  { label: "DAX query view", value: "DAX", icon: "file-code-outline" },
  { label: "TMDL view", value: "TMDL", icon: "file-document-edit-outline" },
];

const visualTitles: Record<WidgetType, string> = {
  "stacked-bar": "Stacked Bar Chart",
  "stacked-column": "Stacked Column Chart",
  area: "Area Chart",
  "clustered-bar": "Clustered Bar Chart",
  "clustered-column": "Clustered Column Chart",
  "hundred-bar": "100% Clustered Bar Chart",
  "hundred-column": "100% Clustered Column Chart",
  line: "Line Chart",
  "stacked-area": "Stacked Area Chart",
  "hundred-area": "100% Stacked Area Chart",
  "line-stacked-column": "Line and Stacked Column Chart",
  "line-clustered-column": "Line and Clustered Column Chart",
  ribbon: "Ribbon Chart",
  waterfall: "Waterfall Chart",
  funnel: "Funnel",
  scatter: "Scatter Chart",
  pie: "Pie Chart",
  donut: "Donut Chart",
  treemap: "Treemap",
  map: "Map",
  "filled-map": "Filled Map",
  "shape-map": "Shape Map",
  card: "Card",
  kpi: "KPI",
  slicer: "Slicer",
  table: "Table",
  matrix: "Matrix",
  "decomposition-tree": "Decomposition Tree",
};

const kpiVisualTypes: WidgetType[] = ["kpi", "card"];
const areaVisualTypes: WidgetType[] = ["area", "stacked-area", "hundred-area"];
const lineVisualTypes: WidgetType[] = ["line"];
const pieVisualTypes: WidgetType[] = ["pie", "donut"];
const mapVisualTypes: WidgetType[] = ["map", "filled-map", "shape-map"];
const tableVisualTypes: WidgetType[] = ["table", "matrix", "slicer", "decomposition-tree"];

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

const getRibbonIcon = (label: string) => {
  const icons: Record<string, string> = {
    "Get data": "database-plus-outline",
    Excel: "microsoft-excel",
    "SQL Server": "database-cog-outline",
    "Enter data": "table-plus",
    "Transform data": "table-edit",
    Refresh: "refresh",
    "New visual": "chart-bar",
    "Text box": "format-textbox",
    "More visuals": "chart-box-plus-outline",
    "New measure": "calculator-variant-outline",
    "Quick measure": "lightning-bolt-outline",
    Publish: "upload-outline",
    Share: "share-variant",
    Save: "content-save-outline",
    Export: "export-variant",
    Open: "folder-open-outline",
    "New report": "file-chart-outline",
  };

  return icons[label] ?? "square-rounded-outline";
};

const getVisualIcon = (type: WidgetType) => {
  const icons: Record<WidgetType, string> = {
    "stacked-bar": "chart-bar-stacked",
    "stacked-column": "chart-bar-stacked",
    area: "chart-areaspline",
    "clustered-bar": "chart-bar",
    "clustered-column": "chart-bar",
    "hundred-bar": "chart-bar-stacked",
    "hundred-column": "chart-bar-stacked",
    line: "chart-line",
    "stacked-area": "chart-areaspline",
    "hundred-area": "chart-areaspline",
    "line-stacked-column": "chart-line-variant",
    "line-clustered-column": "chart-line",
    ribbon: "chart-timeline-variant",
    waterfall: "chart-waterfall",
    funnel: "filter-variant",
    scatter: "scatter-plot",
    pie: "chart-pie",
    donut: "chart-donut",
    treemap: "view-grid-outline",
    map: "map-marker-radius-outline",
    "filled-map": "map",
    "shape-map": "shape-outline",
    card: "card-text-outline",
    kpi: "speedometer",
    slicer: "filter-cog-outline",
    table: "table",
    matrix: "table-large",
    "decomposition-tree": "file-tree-outline",
  };

  return icons[type];
};

const isNumericValue = (value: unknown) =>
  typeof value === "number" || (!Number.isNaN(Number(value)) && value !== "");

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);

export default function DashboardBuilder() {
  const { token } = useAuthStore();
  const { width: windowWidth } = useWindowDimensions();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
      type: "clustered-column",
      title: "Sales by Category",
      xField: "Region",
      valueField: "Revenue",
      layout: { x: 0, y: 3, w: 6, h: 3 },
    },
  ]);

  const [datasets, setDatasets] = useState<any[]>(demoDatasets);
  const [selectedDataset, setSelectedDataset] = useState<any>(demoDatasets[0]);
  const [dashboardName] = useState("My Dashboard");
  const [activeRail, setActiveRail] = useState("Report");
  const [dataSearch, setDataSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [pageFilterFields, setPageFilterFields] = useState<string[]>([]);
  const [allPageFilterFields, setAllPageFilterFields] = useState<string[]>([]);
  const [savedDatasetIds, setSavedDatasetIds] = useState<string[]>([]);

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
  const uploadedDatasets = useMemo(
    () => datasets.filter((dataset: any) => String(dataset._id).startsWith("uploaded-")),
    [datasets]
  );
  const filteredUploadedDatasets = useMemo(
    () =>
      uploadedDatasets.filter((dataset: any) =>
        dataset.name.toLowerCase().includes(dataSearch.trim().toLowerCase())
      ),
    [dataSearch, uploadedDatasets]
  );
  const selectedDatasetIsUploaded =
    selectedDataset?._id && String(selectedDataset._id).startsWith("uploaded-");
  const selectedDatasetIsSaved =
    selectedDataset?._id && savedDatasetIds.includes(selectedDataset._id);
  const visibleFields = useMemo(
    () =>
      selectedDatasetIsUploaded
        ? selectedFields.filter((field: any) =>
            field.name.toLowerCase().includes(dataSearch.trim().toLowerCase())
          )
        : [],
    [dataSearch, selectedDatasetIsUploaded, selectedFields]
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
  const filtersPaneWidth = filtersCollapsed ? 36 : 190;
  const rightPaneWidth =
    visualsCollapsed && dataCollapsed
      ? 72
      : visualsCollapsed !== dataCollapsed
        ? 210
        : 330;
  const reportStageWidth = Math.max(
    760,
    Math.floor(windowWidth - 38 - filtersPaneWidth - rightPaneWidth - 12)
  );
  const reportBoundaryStyle = {
    width: reportStageWidth,
    minHeight: REPORT_MIN_HEIGHT,
  };
  const zoomScale = zoomPercent / 100;
  const zoomThumbOffset = ((zoomPercent - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 86;
  const zoomFrameStyle = {
    width: reportStageWidth * zoomScale,
    minHeight: REPORT_MIN_HEIGHT * zoomScale,
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
    try {
      const saved = window.localStorage.getItem(SAVED_DATASETS_KEY);

      if (!saved) return;

      const savedDatasets = JSON.parse(saved);

      if (!Array.isArray(savedDatasets) || !savedDatasets.length) return;

      setDatasets((prev) => {
        const existingIds = new Set(prev.map((dataset: any) => dataset._id));
        const restored = savedDatasets.filter(
          (dataset: any) => dataset?._id && !existingIds.has(dataset._id)
        );

        return [...restored, ...prev];
      });
      setSavedDatasetIds(savedDatasets.map((dataset: any) => dataset._id));
      setSelectedDataset(savedDatasets[0]);
    } catch {
      window.localStorage.removeItem(SAVED_DATASETS_KEY);
    }
  }, []);

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
    const id = `${type}-${Date.now()}`;
    const isKpiLike = kpiVisualTypes.includes(type);

    setWidgets((prev) => [
      ...prev,
      {
        id,
        pageId: activePageId,
        type,
        title: visualTitles[type],
        xField: isKpiLike ? undefined : defaultXField,
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

        if (kpiVisualTypes.includes(widget.type)) {
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

  const persistSavedDatasets = (nextSavedIds: string[], nextDatasets = datasets) => {
    const savedDatasets = nextDatasets.filter((dataset: any) =>
      nextSavedIds.includes(dataset._id)
    );

    window.localStorage.setItem(SAVED_DATASETS_KEY, JSON.stringify(savedDatasets));
    setSavedDatasetIds(nextSavedIds);
  };

  const saveSelectedDataset = () => {
    if (!selectedDatasetIsUploaded) {
      Alert.alert("Select uploaded data", "Upload or select a file before saving data.");
      return;
    }

    const nextSavedIds = savedDatasetIds.includes(selectedDataset._id)
      ? savedDatasetIds
      : [...savedDatasetIds, selectedDataset._id];

    persistSavedDatasets(nextSavedIds);
    Alert.alert("Data saved", `${selectedDataset.name} will be restored next time.`);
  };

  const deleteSelectedDataset = () => {
    if (!selectedDatasetIsUploaded) {
      Alert.alert("Select uploaded data", "Only uploaded datasets can be deleted here.");
      return;
    }

    const nextDatasets = datasets.filter(
      (dataset: any) => dataset._id !== selectedDataset._id
    );
    const nextSavedIds = savedDatasetIds.filter((id) => id !== selectedDataset._id);
    const nextUploadedDataset = nextDatasets.find((dataset: any) =>
      String(dataset._id).startsWith("uploaded-")
    );

    setDatasets(nextDatasets);
    setSelectedDataset(nextUploadedDataset ?? demoDatasets[0]);
    setPageFilterFields([]);
    setAllPageFilterFields([]);
    persistSavedDatasets(nextSavedIds, nextDatasets);
    Alert.alert("Data deleted", `${selectedDataset.name} was removed from the Data pane.`);
  };

  const resetDemoData = () => {
    setDatasets(demoDatasets);
    setSelectedDataset(demoDatasets[0]);
    Alert.alert("Demo data loaded", "The sample datasets are ready to use.");
  };

  const openFilePicker = () => {
    setDataMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      if (!rows.length) {
        Alert.alert("No data found", "The selected file does not contain rows.");
        return;
      }

      const columnNames = Array.from(
        rows.reduce((columns, row) => {
          Object.keys(row).forEach((key) => columns.add(key));
          return columns;
        }, new Set<string>())
      );

      const uploadedDataset = {
        _id: `uploaded-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, "") || "Uploaded data",
        columns: columnNames.map((name) => ({ name })),
        rows,
      };

      setDatasets((prev) => [uploadedDataset, ...prev]);
      setSelectedDataset(uploadedDataset);
      setDataCollapsed(false);
      setPageFilterFields([]);
      setAllPageFilterFields([]);
      setDataSearch("");
      Alert.alert(
        "Data loaded",
        `${file.name} was added to the Data pane. Save it if you want it restored later.`
      );
    } catch {
      Alert.alert("Upload failed", "Please choose a valid Excel or CSV file.");
    } finally {
      event.target.value = "";
    }
  };

  const selectDataSource = (source: string) => {
    if (source === "Excel workbook" || source === "Text/CSV") {
      openFilePicker();
      return;
    }

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
        type: "card",
        title: `Total ${defaultValueField}`,
        valueField: defaultValueField,
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: `ai-bar-${prefix}`,
        pageId: activePageId,
        type: "clustered-column",
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
    }
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
      Excel: openFilePicker,
      "SQL Server": resetDemoData,
      "Enter data": resetDemoData,
      "Transform data": () =>
        Alert.alert("Transform data", "Demo mode: fields are ready in the Data pane."),
      Refresh: loadDatasets,
      "New visual": () => addWidget("clustered-column"),
      "Bar chart": () => addWidget("clustered-bar"),
      "Line chart": () => addWidget("line"),
      "Pie chart": () => addWidget("pie"),
      "Text box": () => addWidget("card"),
      "More visuals": () => addWidget("pie"),
      "Key influencers": () => addWidget("decomposition-tree"),
      "Decomposition tree": () => addWidget("decomposition-tree"),
      Narrative: () => addWidget("card"),
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

    if (tableVisualTypes.includes(widget.type)) {
      return (
        <View style={styles.tableVisual}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>{widget.xField ?? defaultXField}</Text>
            <Text style={styles.tableHeaderText}>{widget.valueField ?? defaultValueField}</Text>
          </View>
          {data.slice(0, 6).map((row: { name: string; value: number }) => (
            <View key={row.name} style={styles.tableRow}>
              <Text style={styles.tableCellText}>{row.name}</Text>
              <Text style={styles.tableCellText}>{formatNumber(row.value)}</Text>
            </View>
          ))}
        </View>
      );
    }

    if (areaVisualTypes.includes(widget.type)) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#118dff"
              fill="#118dff"
              fillOpacity={widget.type === "hundred-area" ? 0.85 : 0.35}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (lineVisualTypes.includes(widget.type)) {
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

    if (pieVisualTypes.includes(widget.type)) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={widget.type === "donut" ? "45%" : 0}
              outerRadius="78%"
            >
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
    }

    if (mapVisualTypes.includes(widget.type)) {
      return (
        <View style={styles.mapVisual}>
          <View style={styles.mapSurface}>
            {data.slice(0, 7).map((row, index) => (
              <View
                key={row.name}
                style={[
                  styles.mapBubble,
                  {
                    left: `${12 + ((index * 23) % 68)}%`,
                    top: `${18 + ((index * 17) % 58)}%`,
                    width: 30 + Math.min(34, Number(row.value) / 8),
                    height: 30 + Math.min(34, Number(row.value) / 8),
                  },
                ]}
              >
                <Text style={styles.mapBubbleText}>{row.name.slice(0, 8)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.mapCaption}>
            {widget.type === "filled-map"
              ? "Filled map"
              : widget.type === "shape-map"
                ? "Shape map"
                : "Map"}{" "}
            by {widget.xField ?? defaultXField}
          </Text>
        </View>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
          <YAxis stroke="#6b7280" fontSize={11} />
          <Tooltip />
          <Bar
            dataKey="value"
            fill={widget.type === "waterfall" ? "#e66c37" : "#118dff"}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );

  };

  const renderWidget = (widget: Widget, index: number) => {
    const isSelected = selectedWidget?.id === widget.id;

    if (kpiVisualTypes.includes(widget.type)) {
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

  const renderRailWorkspace = () => {
    if (activeRail === "Data") {
      const previewRows = filteredRows.slice(0, 20);

      return (
        <View style={styles.modeWorkspace}>
          <View style={styles.modeHeader}>
            <MaterialCommunityIcons name={"table" as any} size={22} color="#00b294" />
            <Text style={styles.modeTitle}>Table view</Text>
            <Text style={styles.modeSubtitle}>{selectedDataset?.name ?? "No dataset selected"}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.dataTable}>
              <View style={styles.dataTableRow}>
                {selectedFields.map((field: any) => (
                  <Text key={field.name} style={[styles.dataTableCell, styles.dataTableHeaderCell]}>
                    {field.name}
                  </Text>
                ))}
              </View>
              {previewRows.map((row: any, rowIndex: number) => (
                <View key={rowIndex} style={styles.dataTableRow}>
                  {selectedFields.map((field: any) => (
                    <Text key={field.name} style={styles.dataTableCell}>
                      {String(row[field.name] ?? "")}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      );
    }

    if (activeRail === "Model") {
      return (
        <View style={styles.modeWorkspace}>
          <View style={styles.modeHeader}>
            <MaterialCommunityIcons name={"relation-many-to-many" as any} size={22} color="#00b294" />
            <Text style={styles.modeTitle}>Model view</Text>
            <Text style={styles.modeSubtitle}>Tables and relationships</Text>
          </View>

          <View style={styles.modelCanvas}>
            {datasets.slice(0, 4).map((dataset: any) => (
              <View key={dataset._id} style={styles.modelTable}>
                <Text style={styles.modelTableTitle}>{dataset.name}</Text>
                {(dataset.columns ?? []).slice(0, 6).map((field: any) => (
                  <Text key={field.name} style={styles.modelField}>
                    {field.name}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (activeRail === "DAX") {
      return (
        <View style={styles.modeWorkspace}>
          <View style={styles.modeHeader}>
            <MaterialCommunityIcons name={"file-code-outline" as any} size={22} color="#00b294" />
            <Text style={styles.modeTitle}>DAX query view</Text>
            <Text style={styles.modeSubtitle}>Prototype query surface</Text>
          </View>
          <View style={styles.queryEditor}>
            <Text style={styles.queryText}>EVALUATE</Text>
            <Text style={styles.queryText}>SUMMARIZECOLUMNS(</Text>
            <Text style={styles.queryText}>  "{selectedDataset?.name ?? "Dataset"}",</Text>
            <Text style={styles.queryText}>  "Rows", COUNTROWS()</Text>
            <Text style={styles.queryText}>)</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.modeWorkspace}>
        <View style={styles.modeHeader}>
          <MaterialCommunityIcons name={"file-document-edit-outline" as any} size={22} color="#00b294" />
          <Text style={styles.modeTitle}>TMDL view</Text>
          <Text style={styles.modeSubtitle}>Semantic model definition preview</Text>
        </View>
        <View style={styles.queryEditor}>
          <Text style={styles.queryText}>model {`{`}</Text>
          <Text style={styles.queryText}>  culture: en-US</Text>
          <Text style={styles.queryText}>  table {selectedDataset?.name ?? "Dataset"} {`{`}</Text>
          <Text style={styles.queryText}>    column {selectedFields[0]?.name ?? "Column"}</Text>
          <Text style={styles.queryText}>  {`}`}</Text>
          <Text style={styles.queryText}>{`}`}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.page}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

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
            <MaterialCommunityIcons name={"creation" as any} size={14} color="#111111" />
            <Text style={styles.askAiText}>Ask AI</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton} onPress={saveDashboard}>
            <MaterialCommunityIcons name={"share-variant" as any} size={14} color="#ffffff" />
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
                    <MaterialCommunityIcons
                      name={getRibbonIcon(item) as any}
                      size={17}
                      color="#dcecff"
                    />
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
                <MaterialCommunityIcons
                  name={getRibbonIcon(source) as any}
                  size={16}
                  color="#dcecff"
                />
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
                      <View style={[styles.reportBoundary, reportBoundaryStyle]}>
                        <ResponsiveGridLayout
                          className="layout"
                          width={reportStageWidth}
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
                            md: 12,
                            sm: 12,
                            xs: 12,
                          }}
                          rowHeight={56}
                          autoSize
                          verticalCompact={false}
                          margin={[12, 12]}
                          containerPadding={[12, 12]}
                          compactType={null}
                          preventCollision
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
            <ScrollView
              style={styles.visualPaneScroll}
              contentContainerStyle={styles.visualPaneContent}
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity
                style={styles.darkPanelHeader}
                onPress={() => setVisualsCollapsed(true)}
              >
                <Text style={styles.panelTitle}>Visualizations</Text>
                <Text style={styles.panelChevron}>{">"}</Text>
              </TouchableOpacity>
              <Text style={styles.panelSubtitle}>Build visual</Text>

              <View style={styles.visualModeRow}>
                <View style={styles.activeBuildMode}>
                  <MaterialCommunityIcons
                    name={"view-dashboard-outline" as any}
                    size={30}
                    color="#00b294"
                  />
                </View>
                <View style={styles.buildModeButton}>
                  <MaterialCommunityIcons
                    name={"format-paint" as any}
                    size={28}
                    color="#d8d8d8"
                  />
                </View>
              </View>

              <View style={styles.visualGrid}>
                {visualButtons.map((visual) => (
                  <div
                    key={visual.type}
                    title={visual.label}
                    style={VISUAL_TOOLTIP_WRAP_STYLE}
                  >
                    <TouchableOpacity
                      accessibilityLabel={visual.label}
                      style={[
                        styles.visualButton,
                        selectedWidget?.type === visual.type && styles.activeVisualButton,
                      ]}
                      onPress={() => addVisualFromPane(visual.type)}
                    >
                      <MaterialCommunityIcons
                        name={getVisualIcon(visual.type) as any}
                        size={23}
                        color="#58a6ff"
                      />
                    </TouchableOpacity>
                  </div>
                ))}
              </View>

              <View style={styles.valuesSection}>
                <Text style={styles.dropZoneTitle}>Values</Text>
                <TouchableOpacity style={styles.valuesDropZone}>
                  <Text style={styles.dropZoneText}>
                    {selectedWidget?.valueField ?? "Add data fields here"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.drillSection}>
                <Text style={styles.dropZoneTitle}>Drill through</Text>
                <View style={styles.toggleRow}>
                  <Text style={styles.dropZoneText}>Cross-report</Text>
                  <View style={styles.toggleOff}>
                    <Text style={styles.toggleText}>Off</Text>
                  </View>
                </View>
                <View style={styles.toggleRow}>
                  <Text style={styles.dropZoneText}>Keep all filters</Text>
                  <View style={styles.toggleOn}>
                    <Text style={styles.toggleText}>On</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.valuesDropZone}>
                  <Text style={styles.dropZoneText}>Add drill-through fields here</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.visualActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={duplicateSelectedVisual}
                >
                  <MaterialCommunityIcons name={"content-copy" as any} size={13} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Duplicate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={deleteSelectedVisual}
                >
                  <MaterialCommunityIcons name={"delete-outline" as any} size={13} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
              value={dataSearch}
              onChangeText={setDataSearch}
              style={styles.dataSearch}
            />

            <ScrollView style={styles.datasetList}>
              {filteredUploadedDatasets.length ? (
                filteredUploadedDatasets.map((dataset: any) => (
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
                    {savedDatasetIds.includes(dataset._id) && (
                      <Text style={styles.savedBadge}>Saved</Text>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyDataText}>
                  Upload Excel or CSV data from Get data.
                </Text>
              )}
            </ScrollView>

            {selectedDatasetIsUploaded && (
              <>
                <ScrollView style={styles.fieldsList}>
                  {visibleFields.map((col: any) => (
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

                <View style={styles.dataActions}>
                  <TouchableOpacity
                    style={[
                      styles.dataActionButton,
                      selectedDatasetIsSaved && styles.savedDataButton,
                    ]}
                    onPress={saveSelectedDataset}
                  >
                    <MaterialCommunityIcons
                      name={"content-save-outline" as any}
                      size={13}
                      color="#ffffff"
                    />
                    <Text style={styles.dataActionText}>
                      {selectedDatasetIsSaved ? "Saved" : "Save Data"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dataActionButton, styles.deleteDataButton]}
                    onPress={deleteSelectedDataset}
                  >
                    <MaterialCommunityIcons
                      name={"delete-outline" as any}
                      size={13}
                      color="#ffffff"
                    />
                    <Text style={styles.dataActionText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.saveButton} onPress={saveDashboard}>
              <MaterialCommunityIcons
                name={"content-save-outline" as any}
                size={14}
                color="#ffffff"
              />
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    width: 28,
    height: 26,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#5f6b77",
    backgroundColor: "#2a3138",
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
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: "#5f6b77",
    backgroundColor: "#2a3138",
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
    width: 190,
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
    width: 330,
    flexDirection: "row",
    backgroundColor: "#181818",
    borderLeftWidth: 1,
    borderLeftColor: "#333333",
  },

  rightPanesCollapsed: {
    width: 72,
  },

  rightPanesOneCollapsed: {
    width: 210,
  },

  visualPane: {
    width: 176,
    borderRightWidth: 1,
    borderRightColor: "#4a4a4a",
  },

  visualPaneScroll: {
    flex: 1,
  },

  visualPaneContent: {
    padding: 8,
    paddingBottom: 14,
  },

  dataPane: {
    flex: 1,
    padding: 8,
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

  visualModeRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    paddingBottom: 8,
    marginBottom: 8,
    gap: 18,
  },

  activeBuildMode: {
    width: 46,
    height: 40,
    borderBottomWidth: 2,
    borderBottomColor: "#00b294",
    alignItems: "center",
    justifyContent: "center",
  },

  buildModeButton: {
    width: 46,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  visualGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },

  visualButton: {
    width: 26,
    height: 26,
    borderRadius: 3,
    borderWidth: 0,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },

  activeVisualButton: {
    borderWidth: 1,
    borderColor: "#00b294",
    backgroundColor: "#123c37",
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

  valuesSection: {
    borderTopWidth: 1,
    borderTopColor: "#5a5a5a",
    paddingTop: 10,
    marginTop: 6,
  },

  valuesDropZone: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#5a5a5a",
    padding: 8,
    minHeight: 32,
    justifyContent: "center",
  },

  drillSection: {
    borderTopWidth: 1,
    borderTopColor: "#2f2f2f",
    paddingTop: 10,
    marginTop: 10,
    gap: 8,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  toggleOff: {
    minWidth: 34,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#404040",
    alignItems: "center",
  },

  toggleOn: {
    minWidth: 34,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#00b294",
    alignItems: "center",
  },

  toggleText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
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
    paddingBottom: 4,
  },

  actionButton: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 3,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectedDataset: {
    backgroundColor: "#107c68",
  },

  datasetText: {
    color: "#ffffff",
    fontSize: 12,
    flex: 1,
  },

  savedBadge: {
    color: "#9ff5df",
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 8,
  },

  emptyDataText: {
    color: "#8f8f8f",
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 12,
  },

  dataActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  dataActionButton: {
    flex: 1,
    backgroundColor: "#107c68",
    paddingVertical: 8,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },

  savedDataButton: {
    backgroundColor: "#24524a",
  },

  deleteDataButton: {
    backgroundColor: "#5a1f1f",
  },

  dataActionText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
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
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
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

  tableVisual: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },

  tableHeaderText: {
    flex: 1,
    color: "#111111",
    fontSize: 11,
    fontWeight: "800",
    padding: 6,
  },

  tableCellText: {
    flex: 1,
    color: "#333333",
    fontSize: 11,
    padding: 6,
  },

  mapVisual: {
    flex: 1,
    minHeight: 0,
  },

  mapSurface: {
    flex: 1,
    position: "relative",
    backgroundColor: "#eef6fb",
    borderWidth: 1,
    borderColor: "#d6e3ea",
    overflow: "hidden",
  },

  mapBubble: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(17, 141, 255, 0.72)",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },

  mapBubbleText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "800",
  },

  mapCaption: {
    color: "#4b5563",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5,
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
