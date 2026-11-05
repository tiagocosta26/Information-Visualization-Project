function createHeatMap(selector, dashboard, tooltip) {
  const root = d3.select(selector).html("");
  const { W, H } = measure(root, 640, 300);
  const m = { top: 8, right: 106, bottom: 44, left: 82 };
  const MIN_TRIPS = 30;
  const svg = root.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  // diagonal stripes for "no trips"
  svg.append("defs").html('<pattern id="hm-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    '<line id="hm-hatch-line" x1="0" y1="0" x2="0" y2="6" stroke-width="1.6"/></pattern>');

  

  const days = Array.from(new Set(dashboard.getTrips().map(d => d.day))).sort();
  const dateLabel = s => s.slice(8) + "/" + s.slice(5, 7);
  const x = d3.scaleBand().domain(days).range([m.left, W - m.right]).padding(0.06);
  const y = d3.scaleBand().domain(PHASES).range([m.top, H - m.bottom]).padding(0.06);
  const CLASSES = 5;
  const cells = PHASES.flatMap(p => days.map(dy => ({ id: p + "|" + dy, phase: p, day: dy })));

  const toggleCell = c => {
    const s = dashboard.getState();
    dashboard.setState(s.phase === c.phase && s.day === c.day ? { phase: null, day: null } : { phase: c.phase, day: c.day });
  };
  const togglePhase = p => dashboard.setState({ phase: dashboard.getState().phase === p ? null : p });
  const toggleDay = dy => dashboard.setState({ day: dashboard.getState().day === dy ? null : dy });

  const rowLabels = svg.append("g").selectAll("text").data(PHASES).join("text")
    .attr("class", "lbl").attr("x", m.left - 8).attr("y", p => y(p) + y.bandwidth() / 2)
    .attr("text-anchor", "end").attr("dy", "-0.3em").on("click", (e, p) => togglePhase(p));
  rowLabels.append("tspan").text(p => phaseLabel(p));
  rowLabels.append("tspan").attr("class", "sub").attr("x", m.left - 8).attr("dy", "1.3em").text(p => PHASE_HOURS[p]);

  const colLabels = svg.append("g").selectAll("text").data(days).join("text")
    .attr("class", "lbl").attr("x", dy => x(dy) + x.bandwidth() / 2).attr("y", H - m.bottom + 16)
    .attr("text-anchor", "middle").on("click", (e, dy) => toggleDay(dy));
  colLabels.append("tspan").text((dy, i) => (x.bandwidth() >= 44 ? "Day " : "D") + (i + 1));
  colLabels.append("tspan").attr("class", "sub").attr("x", dy => x(dy) + x.bandwidth() / 2).attr("dy", "1.3em").text(dateLabel);

  const gCells = svg.append("g");

  const lx = W - m.right + 14, ly0 = m.top + 16;
  svg.append("text").attr("class", "sub").attr("x", lx).attr("y", m.top + 6).text("min (mean)");
  const legendItems = svg.append("g").selectAll("g").data(d3.range(CLASSES).reverse()).join("g")
    .attr("transform", (i, k) => `translate(${lx},${ly0 + k * 20})`);
  legendItems.append("rect").attr("width", 14).attr("height", 14).attr("rx", 3).attr("fill", i => themeColors().heat.palette[i]);
  const legendText = legendItems.append("text").attr("class", "sub").attr("x", 20).attr("y", 11);

  const noData = svg.append("g").attr("transform", `translate(${lx},${ly0 + CLASSES * 20 + 8})`);
  const noDataRect = noData.append("rect").attr("width", 14).attr("height", 14).attr("rx", 3);
  noData.append("rect").attr("width", 14).attr("height", 14).attr("rx", 3).attr("fill", "url(#hm-hatch)");
  noData.append("text").attr("class", "sub").attr("x", 20).attr("y", 11).text("no trips");

  function tip(c) {
    const label = `<b>${phaseLabel(c.phase)}, ${dateLabel(c.day)}</b>`;
    if (!c.s) return label + "<br>No trips recorded";
    return label + `<br>${fmt.int(c.s.n)} trips<br>Mean: ${fmt.one(c.s.mean)} min<br>Max: ${c.s.max} min` +
      (c.s.n < MIN_TRIPS ? "<br><i>Few trips: interpret with caution</i>" : "");
  }

  function update(state) {
    const hc = themeColors().heat;
    legendItems.select("rect").attr("fill", i => hc.palette[i]);
    noDataRect.attr("fill", hc.noFill).attr("stroke", hc.noStroke);
    const stats = d3.rollup(dashboard.getTrips(["phase", "day"]),
      g => ({ n: g.length, mean: d3.mean(g, d => d.maxDelay), max: d3.max(g, d => d.maxDelay) }), d => d.phase, d => d.day);
    cells.forEach(c => { c.s = (stats.get(c.phase) && stats.get(c.phase).get(c.day)) || null; });
    const step = d3.tickStep(0, Math.max(d3.max(cells, c => c.s ? c.s.mean : 0), 0.5), CLASSES);
    
    const classOf = v => Math.max(0, Math.min(CLASSES - 1, Math.floor(v / step))); 
    const colorOf = v => hc.palette[classOf(v)];
    const num = step < 1 ? fmt.one : fmt.int;
    legendText.text(i => i < CLASSES - 1 ? num(i * step) + " to " + num((i + 1) * step) : "≥ " + num(i * step));

    const matches = c => (!state.phase || c.phase === state.phase) && (!state.day || c.day === state.day);
    const anySel = state.phase || state.day;
    const exact = c => state.phase === c.phase && state.day === c.day;

    const gs = gCells.selectAll("g.cell").data(cells, c => c.id).join(enter => {
      const g = enter.append("g").attr("class", "cell");
      g.append("rect").attr("rx", 4).attr("x", c => x(c.day)).attr("y", c => y(c.phase))
        .attr("width", x.bandwidth()).attr("height", y.bandwidth());
      g.append("rect").attr("class", "nohatch").attr("rx", 4).attr("x", c => x(c.day)).attr("y", c => y(c.phase))
        .attr("width", x.bandwidth()).attr("height", y.bandwidth()).attr("fill", "url(#hm-hatch)").style("pointer-events", "none");
      g.append("text").attr("class", "val").attr("text-anchor", "middle").attr("dy", "0.35em")
        .style("font-size", "14px")
        .attr("x", c => x(c.day) + x.bandwidth() / 2).attr("y", c => y(c.phase) + y.bandwidth() / 2);
      return g;
    });
    gs.on("click", (e, c) => toggleCell(c))
      .on("mousemove", (e, c) => tooltip.show(tip(c), e)).on("mouseleave", () => tooltip.hide())
      .style("opacity", c => anySel && !matches(c) ? 0.35 : 1);

    gs.select("rect")
      .attr("stroke", c => exact(c) ? hc.selStroke : "none")
      .attr("stroke-width", c => exact(c) ? 2.5 : 1.2)
      .transition("fill").duration(400)
      .attr("fill", c => c.s ? colorOf(c.s.mean) : hc.noFill);
    gs.select("rect.nohatch").style("display", c => c.s ? "none" : null);
    gs.select("text.val")
      .attr("fill", c => !c.s ? hc.noText : d3.hsl(colorOf(c.s.mean)).l < 0.55 ? "#fff" : "#1b2433")
      .text(c => c.s ? fmt.one(c.s.mean) : "–");

    rowLabels.classed("sel", p => p === state.phase);
    colLabels.classed("sel", dy => dy === state.day);

    const axis = state.axis ? axisInfo(state.axis, state.type) : null;
    d3.select("#heat-sub").text(axis ? axis.label : "All axes");
  }

  return { id: "heat", update };
}