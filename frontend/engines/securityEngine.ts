export const canEditDashboard = (user: any) =>
  Boolean(user?.role === "admin" || user?.role === "editor");

export const canViewDashboard = (user: any) =>
  Boolean(user);