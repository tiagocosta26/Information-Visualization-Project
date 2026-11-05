function createBoxPlot(selector, dashboard, tooltip) {
  const root = d3.select(selector).html("");
  const { W, H } = measure(root, 560, 300);
  const m = { top: 12, right: 14, bottom: 50, left: 46 };
  const colorOf = t => TYPE_COLORS[t] || "#6b7a90";
  const svg = root.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const types = Array.from(d3.rollup(dashboard.getTrips(), g => d3.mean(g, d => d.maxDelay), d => d.type))
    .sort((a, b) => b[1] - a[1]).map(d => d[0]);
  const x = d3.scaleBand().domain(types).range([m.left, W - m.right]).padding(0.35);
  const y = d3.scaleLinear().range([H - m.bottom, m.top]);

  const gx = svg.append("g").attr("class", "axis xaxis").attr("transform", `translate(0,${H - m.bottom})`);
  const gy = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`);
  svg.append("text").attr("class", "axis-label").attr("transform", "rotate(-90)")
    .attr("x", -(H - m.bottom + m.top) / 2).attr("y", 12).attr("text-anchor", "middle").text("Max delay per trip (min)");
  const plot = svg.append("g");

  function stats(vals) {
    vals.sort(d3.ascending);
    const q1 = d3.quantile(vals, 0.25), med = d3.quantile(vals, 0.5), q3 = d3.quantile(vals, 0.75);
    const iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    return { n: vals.length, q1, med, q3, mean: d3.mean(vals), max: d3.max(vals),
             wLo: d3.min(vals.filter(v => v >= lo)), wHi: d3.max(vals.filter(v => v <= hi)),
             out: vals.filter(v => v < lo || v > hi) };
  }

  let activeType = null;

  function tip(d) {
    if (!d.s) return `<b>${d.type}</b><br>` + (activeType && d.type !== activeType ? "Click to switch to this type" : "No trips with this filter");
    const f = fmt.one, s = d.s;
    return `<b>${d.type}</b> (${s.n} trips)<br>Median: ${f(s.med)} min<br>Q1 to Q3: ${f(s.q1)} to ${f(s.q3)} min<br>Mean: ${f(s.mean)} min<br>Max: ${s.max} min<br>Max distance: ${fmt.int(s.maxDist)} km<br><i>Click to filter this type</i>`;
  }

  function update(state) {
    const axis = state.axis ? axisInfo(state.axis, state.type) : null;
    activeType = state.type;
    const rows = dashboard.getTrips();
    const byType = d3.group(rows, d => d.type);
    const data = types.map(t => ({ type: t, s: byType.has(t) ? { ...stats(byType.get(t).map(d => d.maxDelay)), maxDist: d3.max(byType.get(t), d => d.maxDist) } : null }));

    d3.select("#box-sub").html((axis ? `<span class="dot" style="background:${axis.color}"></span>${axis.label}` : "All axes") + ", " + (state.phase ? phaseLabel(state.phase) : "All day") + (state.day ? ", " + state.day.slice(8) + "/" + state.day.slice(5, 7) : "") + (state.origin ? ", from " + stationLabel(state.origin) : ""));

    y.domain([0, Math.max(5, d3.max(rows, d => d.maxDelay) || 0)]).nice();
    const t = d3.transition().duration(450);
    gy.transition(t).call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.left - m.right)));
    gx.call(d3.axisBottom(x).tickSizeOuter(0));
    const ticks = gx.selectAll(".tick").classed("sel", t => t === state.type)
      .style("opacity", t => state.type && t !== state.type ? 0.35 : 1)
      .on("click", (e, t) => dashboard.setState({ type: dashboard.getState().type === t ? null : t }))
      .on("mousemove", (e, t) => tooltip.show(dashboard.getState().type === t ? "Click to clear the train type filter" : "Click to filter by <b>" + t + "</b>", e))
      .on("mouseleave", () => tooltip.hide());
    ticks.selectAll("rect.tickhit").data([0]).join("rect").attr("class", "tickhit")
      .attr("x", -x.step() / 2).attr("y", 0).attr("width", x.step()).attr("height", 24).lower();

    const gs = plot.selectAll("g.bx").data(data, d => d.type).join(enter => {
      const g = enter.append("g").attr("class", "bx");
      g.append("rect").attr("class", "hit");
      g.append("path").attr("class", "whisk");
      g.append("rect").attr("class", "box");
      g.append("line").attr("class", "med");
      g.append("g").attr("class", "outs");
      g.append("path").attr("class", "mean").attr("d", d3.symbol(d3.symbolDiamond, 55)());
      g.append("text").attr("class", "nlabel").attr("text-anchor", "middle");
      return g;
    });
    gs.on("mousemove", (e, d) => tooltip.show(tip(d), e)).on("mouseleave", () => tooltip.hide())
      .on("click", (e, d) => dashboard.setState({ type: dashboard.getState().type === d.type ? null : d.type }))
      .style("opacity", d => state.type && d.type !== state.type ? 0.35 : 1);

    const bw = x.bandwidth(), cx = d => x(d.type) + bw / 2;
    const boxH = d => Math.max(2, y(d.s.q1) - y(d.s.q3));
    gs.select(".hit").attr("x", d => x(d.type)).attr("y", m.top).attr("width", bw).attr("height", H - m.bottom - m.top);
    gs.select(".nlabel").attr("x", cx).attr("y", H - m.bottom + 32).text(d => `n = ${d.s ? d.s.n : 0}`);
    gs.each(function (d) {
      d3.select(this).selectAll(".box,.med,.whisk,.mean,.outs").style("display", d.s ? null : "none");
    });

    gs.select(".box").attr("x", d => x(d.type)).attr("width", bw).attr("fill", d => colorOf(d.type)).attr("stroke", d => colorOf(d.type))
      .transition(t).attr("y", d => d.s ? y(d.s.q1) - boxH(d) : 0).attr("height", d => d.s ? boxH(d) : 0);
    gs.select(".med").attr("x1", d => x(d.type)).attr("x2", d => x(d.type) + bw)
      .transition(t).attr("y1", d => d.s ? y(d.s.med) : 0).attr("y2", d => d.s ? y(d.s.med) : 0);
    gs.select(".whisk").attr("stroke", d => colorOf(d.type)).transition(t).attr("d", d => d.s ?
      `M${cx(d)},${y(d.s.wLo)}V${y(d.s.wHi)}M${cx(d) - bw / 4},${y(d.s.wLo)}H${cx(d) + bw / 4}M${cx(d) - bw / 4},${y(d.s.wHi)}H${cx(d) + bw / 4}` : "");
    gs.select(".mean").transition(t).attr("transform", d => d.s ? `translate(${cx(d)},${y(d.s.mean)})` : "");
    gs.each(function (d) {
      d3.select(this).select(".outs").selectAll("circle").data(d.s ? d.s.out : []).join("circle")
        .attr("r", 2.4).attr("fill", colorOf(d.type)).attr("cx", (v, i) => cx(d) + (((i * 37) % 100) / 100 - 0.5) * bw * 0.6)
        .attr("cy", v => y(v));
    });
  }
  return { id: "box", update };
}
