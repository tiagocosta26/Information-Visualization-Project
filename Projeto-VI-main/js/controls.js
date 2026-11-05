function createDirectionSelect(selector, dashboard) {
  const root = d3.select(selector).html("");
  const select = root.append("select")
    .attr("aria-label", "Train direction")
    .on("change", function () { dashboard.setState({ origin: this.value === "" ? null : this.value }); });
  let builtFor = undefined;

  return {
    id: "direction",
    update(state) {
      const ends = state.axis ? state.axis.split(" ⟷ ") : null;
      if (builtFor !== state.axis) {
        builtFor = state.axis;
        const options = ends
          ? [{ v: "", t: "Both directions" },
             { v: ends[0], t: stationLabel(ends[0]) + " → " + stationLabel(ends[1]) },
             { v: ends[1], t: stationLabel(ends[1]) + " → " + stationLabel(ends[0]) }]
          : [{ v: "", t: "Select an axis" }];
        select.selectAll("option").data(options).join("option").attr("value", d => d.v).text(d => d.t);
      }
      select.property("disabled", !ends)
        .property("value", state.origin === null ? "" : state.origin)
        .attr("title", ends ? null : "Select an axis in the left chart to choose the direction");
    }
  };
}

function createPhaseSelector(selector, dashboard) {
  const options = [null].concat(PHASES);
  const root = d3.select(selector).html("")
    .attr("role", "group")
    .attr("aria-label", "Time of day");

  root.selectAll("button")
    .data(options)
    .join("button")
    .attr("type", "button")
    .text(d => d === null ? "All" : phaseLabel(d))
    .on("click", (event, d) => dashboard.setState({ phase: d }));

  return {
    id: "phase",
    update(state) {
      root.selectAll("button").attr("aria-pressed", d => String(d === state.phase));
    }
  };
}

function createActiveFilters(selector, dashboard) {
  const root = d3.select(selector).html("");
  root.append("span").attr("class", "active-label").text("Active filters:");
  const list = root.append("span").attr("class", "chips");
  const clear = root.append("button").attr("type", "button").attr("class", "clear")
    .text("Clear filters").on("click", () => dashboard.reset());

  const dayLabel = s => s.slice(8) + "/" + s.slice(5, 7);

  function describe(state) {
    const items = [];
    if (state.phase) items.push({ label: "Time of day: " + phaseLabel(state.phase), remove: { phase: null } });
    if (state.day) items.push({ label: "Day: " + dayLabel(state.day), remove: { day: null } });
    if (state.axis) {
      items.push({ label: "Axis: " + axisInfo(state.axis, state.type).label, remove: { axis: null } });
    }
    if (state.type) items.push({ label: "Type: " + state.type, remove: { type: null } });
    if (state.onlyDelayed) items.push({ label: "Data: delayed only", remove: { onlyDelayed: false } });
    if (state.brush) {
      const b = state.brush;
      const xs = fmt.int(b.x0) + "–" + fmt.int(b.x1) + (b.unit === "km" ? " km" : "% of route");
      items.push({ label: "Zoom: " + xs + ", " + fmt.one(b.y0) + "–" + fmt.one(b.y1) + " min", remove: { brush: null } });
    }
    if (state.origin) {
      const other = state.axis ? state.axis.split(" ⟷ ").find(x => x !== state.origin) : null;
      items.push({ label: "Direction: " + stationLabel(state.origin) + (other ? " → " + stationLabel(other) : ""), remove: { origin: null } });
    }
    return items;
  }

  return {
    id: "active-filters",
    update(state) {
      const items = describe(state);
      list.html("");
      if (items.length === 0) list.append("span").attr("class", "none").text("none");
      items.forEach(item => {
        const chip = list.append("span").attr("class", "chip");
        chip.append("span").text(item.label);
        chip.append("button").attr("type", "button").attr("aria-label", "Remove filter: " + item.label)
          .text("×").on("click", () => dashboard.setState(item.remove));
      });
      clear.property("disabled", items.length === 0);
    }
  };
}

function createDataToggle(selector, dashboard) {
  const options = [{ v: false, t: "Complete" }, { v: true, t: "Delayed only" }];
  const root = d3.select(selector).html("")
    .attr("role", "group")
    .attr("aria-label", "Data to show");

  root.selectAll("button")
    .data(options)
    .join("button")
    .attr("type", "button")
    .text(d => d.t)
    .on("click", (event, d) => dashboard.setState({ onlyDelayed: d.v }));

  return {
    id: "data-toggle",
    update(state) {
      root.selectAll("button").attr("aria-pressed", d => String(d.v === state.onlyDelayed));
    }
  };
}

function createThemeToggle(selector, dashboard) {
  const options = [{ v: "light", t: "Light" }, { v: "dark", t: "Dark" }];
  const root = d3.select(selector).html("")
    .attr("role", "group")
    .attr("aria-label", "Color theme");

  root.selectAll("button")
    .data(options)
    .join("button")
    .attr("type", "button")
    .text(d => d.t)
    .on("click", (event, d) => { applyTheme(d.v); dashboard.setState({ theme: d.v }); });

  return {
    id: "theme-toggle",
    update(state) {
      root.selectAll("button").attr("aria-pressed", d => String(d.v === state.theme));
    }
  };
}

function createViewSwitch(selector, dashboard) {
  const root = d3.select(selector).html("");
  const group = root.append("div").attr("class", "seg seg-small")
    .attr("role", "group").attr("aria-label", "Chart type");
  const options = [{ v: "treemap", t: "Treemap" }, { v: "bars", t: "Bars" }];
  group.selectAll("button").data(options).join("button")
    .attr("type", "button").text(d => d.t)
    .on("click", (event, d) => dashboard.setState({ view: d.v }));
  const back = root.append("button").attr("type", "button").attr("class", "back-link")
    .text("← All types").on("click", () => dashboard.setState({ type: null }));

  return {
    id: "view-switch",
    update(state) {
      const on = !!state.type;
      group.style("display", on ? null : "none"); // the Treemap/Bars switch only exists once a train type is selected
      group.selectAll("button")
        .property("disabled", !on)
        .attr("aria-pressed", d => String(on ? d.v === state.view : d.v === "bars"))
        .attr("title", on ? null : "Select a train type to switch views");
      back.style("display", on ? null : "none");
    }
  };
}
