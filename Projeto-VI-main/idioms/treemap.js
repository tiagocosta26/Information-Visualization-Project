function createTreemap(selector, dashboard, tooltip) {
  const root = d3.select(selector).html("").style("display", "none");
  const colorOf = t => TYPE_COLORS[t] || "#6b7a90";

  const svg = root.append("svg");
  const gTiles = svg.append("g");
  const note = svg.append("text").attr("class", "tm-note");
  const empty = svg.append("text").attr("class", "empty").attr("text-anchor", "middle")
    .style("display", "none").text("No delays with this filter");

  const allTrips = dashboard.getTrips();
  const axesByType = d3.rollup(allTrips, g => Array.from(new Set(g.map(d => d.axis))), d => d.type);

  const luminance = c => {
    const { r, g, b } = d3.rgb(c);
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const textOn = c => (luminance(c) + 0.05) / 0.067 > 1.05 / (luminance(c) + 0.05) ? "#1b2433" : "#ffffff";

  function tipHtml(d) {
    return `<b>${d.label}</b> (${d.type})<br>${fmt.pct1(d.share)} of the delay minutes of ${d.type}<br>` +
      `${fmt.int(d.value)} min (max delay of trips)<br>${fmt.int(d.trips)} trips<br><i>Click to filter this axis</i>`;
  }

  function labelLines(d, w, h) {
    const pct = fmt.pct1(d.share);
    if (w < 46 || h < 24) return [];
    const fit = (s, fs) => s.length * fs * 0.55 <= w - 12;
    let nameLines = null;
    [d.label, d.short].forEach(n => { if (!nameLines && fit(n, 11.5)) nameLines = [n]; });
    if (!nameLines) {
      [d.label, d.short].forEach(n => {
        const p = n.split(" – ");
        if (!nameLines && p.length === 2 && fit(p[0] + " –", 11.5) && fit(p[1], 11.5)) nameLines = [p[0] + " –", p[1]];
      });
    }
    if (nameLines && h - 10 >= nameLines.length * 15 + 20) return nameLines.concat(pct);
    return [pct];
  }

  function update(state) {
    const visible = !!state.type && state.view === "treemap";
    root.style("display", visible ? "block" : "none");
    if (!visible) return;

    const { W, H } = measure(root, 520, 640);
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    const type = state.type;
    d3.select("#bar-sub").html(`<span class="dot" style="background:${colorOf(type)}"></span>${type}`);

    const trips = dashboard.getTrips(["axis", "origin"]).filter(d => d.type === type);
    const sums = d3.rollup(trips, g => d3.sum(g, d => d.maxDelay), d => d.axis);
    const counts = d3.rollup(trips, g => g.length, d => d.axis);
    const items = (axesByType.get(type) || []).map(id => {
      const info = axisInfo(id, type);
      return { id, type, label: info.label, short: info.short, value: sums.get(id) || 0, trips: counts.get(id) || 0 };
    });
    const total = d3.sum(items, d => d.value);
    items.forEach(d => { d.share = total ? d.value / total : 0; });
    const shown = items.filter(d => d.value > 0);
    const hidden = items.length - shown.length;

    empty.attr("x", W / 2).attr("y", H / 2).style("display", total ? "none" : null);
    note.attr("x", 4).attr("y", H - 4).text(total && hidden ? `${hidden} axis${hidden > 1 ? "es" : ""} with 0 min not shown` : "");
    const noteH = total && hidden ? 20 : 0;

    const tree = d3.hierarchy({ children: shown }).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
    d3.treemap().size([W, H - noteH]).paddingInner(3).round(true)(tree);
    const leaves = total ? tree.leaves() : [];

    const focus = state.hover || state.axis;
    const tiles = gTiles.selectAll("g.tile").data(leaves, d => d.data.id).join(enter => {
      const g = enter.append("g").attr("class", "tile");
      g.append("rect").attr("rx", 4);
      g.append("text").attr("class", "tm-label").attr("text-anchor", "middle");
      return g;
    });

    tiles.on("mouseenter", (e, d) => dashboard.setState({ hover: d.data.id }))
      .on("mousemove", (e, d) => tooltip.show(tipHtml(d.data), e))
      .on("mouseleave", () => { dashboard.setState({ hover: null }); tooltip.hide(); })
      .on("click", (e, d) => dashboard.setState({ axis: dashboard.getState().axis === d.data.id ? null : d.data.id }));
    tiles.classed("dim", d => focus && d.data.id !== focus).classed("sel", d => d.data.id === state.axis);

    tiles.select("rect")
      .attr("x", d => d.x0).attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
      .attr("fill", colorOf(type));

    tiles.select("text").each(function (d) {
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      const lines = labelLines(d.data, w, h);
      const text = d3.select(this).attr("fill", textOn(colorOf(type)))
        .attr("transform", `translate(${d.x0 + w / 2},${d.y0 + h / 2})`);
      text.selectAll("tspan").data(lines).join("tspan")
        .attr("x", 0)
        .attr("dy", (l, i) => i === 0 ? `${0.35 - (lines.length - 1) * 0.575}em` : "1.15em")
        .attr("class", (l, i) => i === lines.length - 1 ? "tm-pct" : "tm-name")
        .text(l => l);
    });
  }

  return { id: "treemap", update };
}
