function init() {
  applyTheme(storedTheme());
  loadData(CONFIG.DATA_URL).then(({ observations, trips, info }) => {
    const dashboard = createDashboard({ observations, trips, info });
    const tooltip = createTooltip();

    const day = s => s.split("-").reverse().join("/");

    dashboard.register(createPhaseSelector("#phase-filter", dashboard));
    dashboard.register(createDataToggle("#data-filter", dashboard));
    dashboard.register(createThemeToggle("#theme-filter", dashboard));
    dashboard.register(createActiveFilters("#active-filters", dashboard));
    dashboard.register(createDirectionSelect("#direction-filter", dashboard));
    dashboard.register(createBoxPlot(".BoxPlot", dashboard, tooltip));
    dashboard.register(createScatterPlot(".ScatterPlot", dashboard, tooltip));
    dashboard.register(createHeatMap(".HeatMap", dashboard, tooltip));
    dashboard.register(createViewSwitch("#view-switch", dashboard));
    dashboard.register(createBarChart(".BarChart", dashboard, tooltip));
    dashboard.register(createTreemap(".TreeMap", dashboard, tooltip));
  });
}
