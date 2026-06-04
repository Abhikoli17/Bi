import { apiCall } from "../utils/api";

export const saveDashboard = async (
  token: string,
  dashboard: any
) => {
  return apiCall(
    "/api/dashboards",
    {
      method: "POST",
      body: JSON.stringify(dashboard),
    },
    token
  );
};

export const loadDashboards = async (token: string) => {
  return apiCall("/api/dashboards", {}, token);
};

export const deleteDashboard = async (
  token: string,
  dashboardId: string
) => {
  return apiCall(
    `/api/dashboards/${dashboardId}`,
    {
      method: "DELETE",
    },
    token
  );
};