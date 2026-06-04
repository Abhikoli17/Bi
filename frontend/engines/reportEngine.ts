export const createPage = (index: number) => ({
  id: `page-${Date.now()}`,
  name: `Page ${index}`,
});

export const getPageVisuals = (widgets: any[], pageId: string) =>
  widgets.filter((widget) => widget.pageId === pageId);

export const deletePageVisuals = (widgets: any[], pageId: string) =>
  widgets.filter((widget) => widget.pageId !== pageId);