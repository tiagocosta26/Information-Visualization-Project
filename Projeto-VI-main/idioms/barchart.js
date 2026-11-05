function createBarChart(selector, dashboard, tooltip) {
  const root = d3.select(selector).html("");
  const { W, H } = measure(root, 520, 640);
  const colorOf = t => TYPE_COLORS[t] || "#6b7a90";
  const m = { top: 6, right: 52, bottom: 6, left: 8 };
  const GROUP_GAP = 10;      // gap between types in the overview
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const svg = root.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const gRows = svg.append("g");
  const empty = svg.append("text").attr("class", "empty").attr("text-anchor", "middle")
    .attr("x", W / 2).attr("y", H / 2).style("display", "none").text("No delays with this filter");

  // Type order matches the boxplot, plus the axes each type runs on
  const allTrips = dashboard.getTrips();
  const types = Array.from(d3.rollup(allTrips, g => d3.mean(g, d => d.maxDelay), d => d.type))
    .sort((a, b) => b[1] - a[1]).map(d => d[0]);
  const axesByType = d3.rollup(allTrips, g => Array.from(new Set(g.map(d => d.axis))), d => d.type);

  function tipHtml(d, overview) {
    return `<b>${d.label}</b> (${d.type})<br>${fmt.pct1(d.share)} of the delay minutes of ${d.type}<br>` +
      `${fmt.int(d.value)} min (max delay of trips)<br>${fmt.int(d.trips)} trips<br>` +
      `<i>${overview ? "Click to see only this type and filter this axis" : "Click to filter this axis"}</i>`;
  }

  function update(state) {
    const overview = !state.type;
    const visible = overview || state.view === "bars";
    root.style("display", visible ? null : "none");
    if (!visible) return;
    d3.select("#bar-sub").html(overview
      ? "All axes"
      : `<span class="dot" style="background:${colorOf(state.type)}"></span>${state.type} · max per trip`);

    const trips = dashboard.getTrips(["axis", "origin"]);
    const sums = d3.rollup(trips, g => d3.sum(g, d => d.maxDelay), d => d.type, d => d.axis);
    const counts = d3.rollup(trips, g => g.length, d => d.type, d => d.axis);
    const get = (map, t, id) => (map.get(t) && map.get(t).get(id)) || 0;

    const groups = (overview ? types : [state.type]).map(t => {
      const items = (axesByType.get(t) || []).map(id => {
        const info = axisInfo(id, t);
        return { key: t + "|" + id, type: t, id, label: info.label, short: info.short, value: get(sums, t, id), trips: get(counts, t, id) };
      });
      const total = d3.sum(items, d => d.value);
      items.forEach(d => { d.share = total ? d.value / total : 0; });
      items.sort((a, b) => b.value - a.value || d3.ascending(a.label, b.label));
      return { type: t, total, items };
    });
    const rows = groups.flatMap(g => g.items);
    const maxShare = Math.max(d3.max(rows, d => d.share) || 0, 0.01);
    empty.style("display", d3.sum(groups, g => g.total) ? "none" : null);

    let rowH, barH, barY, x0, fontSize, labelOf, labelY, valY, dy;
    if (overview) {
      const avail = H - m.top - m.bottom - (groups.length - 1) * GROUP_GAP;
      rowH = Math.min(30, avail / rows.length);
      fontSize = clamp(rowH * 0.62, 8.5, 12);
      const need = f => d3.max(rows, d => f(d).length) * fontSize * 0.5 + 6;
      const useShort = need(d => d.label) > (W - m.left - m.right) * 0.58;
      labelOf = useShort ? (d => d.short) : (d => d.label);
      x0 = m.left + need(labelOf) + 6;
      barH = clamp(rowH * 0.62, 4, 16);
      barY = (rowH - barH) / 2; labelY = rowH / 2; valY = rowH / 2; dy = "0.35em";
      let y = m.top;
      groups.forEach((g, gi) => {
        g.items.forEach(d => { d.y = y; y += rowH; });
        if (gi < groups.length - 1) y += GROUP_GAP;
      });
    } else {
      rowH = Math.min(78, (H - m.top - m.bottom) / Math.max(rows.length, 1));
      fontSize = 12; labelOf = d => d.label; x0 = m.left;
      barH = clamp(rowH * 0.34, 14, 26); labelY = 13; barY = 20; valY = barY + barH / 2; dy = "0.35em";
      rows.forEach((d, i) => { d.y = m.top + i * rowH; });
    }
    const x = d3.scaleLinear().domain([0, maxShare]).range([x0, W - m.right]);

    const focus = state.hover || state.axis;
    const t = d3.transition().duration(400);

    const gs = gRows.selectAll("g.row").data(rows, d => d.key).join(enter => {
      const g = enter.append("g").attr("class", "row").attr("transform", d => `translate(0,${d.y})`);
      g.append("text").attr("class", "lbl");
      g.append("rect").attr("class", "bar").attr("rx", 3).attr("width", 0);
      g.append("text").attr("class", "val");
      g.append("rect").attr("class", "hit");
      return g;
    });

    gs.on("mouseenter", (e, d) => dashboard.setState({ hover: d.id }))
      .on("mousemove", (e, d) => tooltip.show(tipHtml(d, overview), e))
      .on("mouseleave", () => { dashboard.setState({ hover: null }); tooltip.hide(); })
      .on("click", (e, d) => {
        if (overview) dashboard.setState({ type: d.type, axis: d.id });
        else dashboard.setState({ axis: dashboard.getState().axis === d.id ? null : d.id });
      });

    gs.classed("dim", d => focus && d.id !== focus).classed("sel", d => d.id === state.axis);
    gs.transition(t).attr("transform", d => `translate(0,${d.y})`);
    gs.select(".hit").attr("x", 0).attr("y", 0).attr("width", W).attr("height", rowH);
    gs.select(".lbl").attr("x", m.left).attr("y", labelY).attr("dy", dy)
      .style("font-size", fontSize + "px").text(labelOf);
    gs.select(".bar").attr("x", x0).attr("y", barY).attr("height", barH).attr("fill", d => colorOf(d.type))
      .classed("sel", d => d.id === state.axis).classed("dim", d => focus && d.id !== focus)
      .transition(t).attr("width", d => Math.max(0, x(d.share) - x0));
    gs.select(".val").attr("y", valY).attr("dy", dy).style("font-size", Math.max(fontSize, 11) + "px")
      .text(d => fmt.pct1(d.share))
      .transition(t).attr("x", d => x(d.share) + 6);
  }

  return { id: "bars", update };
}
