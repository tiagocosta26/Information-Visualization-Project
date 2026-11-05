function createScatterPlot(selector, dashboard, tooltip) {
  const root = d3.select(selector).html("");
  const { W, H } = measure(root, 640, 300);
  const m = { top: 10, right: 16, bottom: 40, left: 46 };
  const svg = root.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const x = d3.scaleLinear().range([m.left, W - m.right]);
  const y = d3.scaleLinear().range([H - m.bottom, m.top]);

  let unit = "km";
  let quadtree = null, currentFit = null, lastKey = null, alpha = 0.25, baseSub = "", lastRows = [], full = { x: [0, 1], y: [0, 1] };
  const xOf = d => unit === "km" ? d.distFromOrigin : d.progress * 100;
  const typeColor = t => TYPE_COLORS[t] || "#6b7a90";
  const axisLabel = id => axisInfo(id).label;

  svg.append("defs").html(
    '<clipPath id="sc-clip"><rect x="' + m.left + '" y="' + m.top + '" width="' + (W - m.left - m.right) +
    '" height="' + (H - m.top - m.bottom) + '"/></clipPath>' +
    '<pattern id="sc-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    '<line x1="0" y1="0" x2="0" y2="5" stroke-width="1.2"/></pattern>');

  const gx = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.bottom})`);
  const gy = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`);
  function drawAxes() {
    gx.call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
    gy.call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.left - m.right)));
  }
  const xLabel = svg.append("text").attr("class", "axis-label").attr("x", (m.left + W - m.right) / 2).attr("y", H - 6)
    .attr("text-anchor", "middle");
  svg.append("text").attr("class", "axis-label").attr("transform", "rotate(-90)")
    .attr("x", -(H - m.bottom + m.top) / 2).attr("y", 12).attr("text-anchor", "middle").text("Delay (min)");

  const gPoints = svg.append("g").attr("clip-path", "url(#sc-clip)");
  const gFit = svg.append("g").attr("clip-path", "url(#sc-clip)");
  const band = gFit.append("path").attr("class", "band");
  const line = gFit.append("path").attr("class", "trend");
  const ring = svg.append("circle").attr("class", "ring").attr("r", 5).style("display", "none");
  const brush = d3.brush().extent([[m.left, m.top], [W - m.right, H - m.bottom]]);
  const brushG = svg.append("g").attr("class", "brush").call(brush);
  const overlay = brushG.select(".overlay");
  overlay.append("title").text("Drag to zoom; click to reset the zoom");
  const tools = d3.select("#scatter-tools").html("");

  const brushHistory = [];
  let lastBrush = null, restoring = false;
  const prevBtn = tools.append("button").attr("type", "button").attr("class", "prev-zoom")
    .attr("title", "Go back to the previous selection")
    .style("display", "none").text("↶ Previous zoom")
    .on("click", () => {
      const prev = brushHistory.pop();
      if (!prev) return;
      restoring = true;
      dashboard.setState({ brush: prev });
      restoring = false;
      update(dashboard.getState());
    });
  const resetBtn = tools.append("button").attr("type", "button").attr("class", "reset-zoom")
    .style("display", "none").text("Reset zoom").on("click", () => dashboard.setState({ brush: null }));

  const modes = [{ id: "km", label: "Distance (km)" }, { id: "pct", label: "% of route" }];
  const toggle = tools.append("div").attr("class", "scatter-mode seg");
  toggle.selectAll("button").data(modes).join("button")
    .attr("type", "button").text(d => d.label)
    .on("click", (e, d) => { unit = d.id; brushHistory.length = 0; dashboard.setState({ brush: null }); update(dashboard.getState()); });

  function fit(rows) {
    const n = rows.length;
    if (n < 30) return null;
    let sx = 0, sy = 0, sxx0 = 0;
    rows.forEach(d => { const v = xOf(d); sx += v; sy += d.delay; sxx0 += v * v; });
    const mx = sx / n, my = sy / n;
    let sxx = 0, sxy = 0, syy = 0;
    rows.forEach(d => {
      const dx = xOf(d) - mx, dy = d.delay - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    });
    if (sxx === 0) return null;
    const b = sxy / sxx, a = my - b * mx, r = syy ? sxy / Math.sqrt(sxx * syy) : 0;

    const clusters = new Map();
    rows.forEach(d => {
      const u = d.delay - (a + b * xOf(d));
      const k = d.trainId + "|" + d.day;
      const s = clusters.get(k) || [0, 0];
      s[0] += u; s[1] += u * xOf(d);
      clusters.set(k, s);
    });
    const G = clusters.size;
    let m00 = 0, m01 = 0, m11 = 0;
    clusters.forEach(s => { m00 += s[0] * s[0]; m01 += s[0] * s[1]; m11 += s[1] * s[1]; });
    const det = n * sxx0 - sx * sx;
    const i00 = sxx0 / det, i01 = -sx / det, i11 = n / det;
    const t00 = i00 * m00 + i01 * m01, t01 = i00 * m01 + i01 * m11;
    const t10 = i01 * m00 + i11 * m01, t11 = i01 * m01 + i11 * m11;
    const v00 = t00 * i00 + t01 * i01, v01 = t00 * i01 + t01 * i11, v11 = t10 * i01 + t11 * i11;
    const factor = G / (G - 1);
    const se = xv => Math.sqrt(Math.max(0, factor * (v00 + 2 * xv * v01 + xv * xv * v11)));
    return { a, b, r, n, G, se: G >= 30 ? se : null };
  }

  function drawFit(rows) {
    currentFit = fit(rows);
    const f = currentFit;
    const sub = d3.select("#scatter-sub").text("");
    if (!f) {
      band.attr("d", null); line.attr("d", null);
      sub.text(rows.length ? "too few data to fit a trend" : "no observations");
      return;
    }
    const [x0, x1] = d3.extent(rows, xOf);
    const grid = d3.range(60).map(i => x0 + (x1 - x0) * i / 59);
    const yhat = xv => f.a + f.b * xv;
    line.attr("d", d3.line().x(xv => x(xv)).y(xv => y(yhat(xv)))(grid));
    if (f.se) {
      band.attr("d", d3.area().x(xv => x(xv))
        .y0(xv => y(yhat(xv) - 1.96 * f.se(xv)))
        .y1(xv => y(yhat(xv) + 1.96 * f.se(xv)))(grid));
    } else {
      band.attr("d", null);
    }
  }

  function draw(state) {
    const rows = dashboard.getObservations(["brush"]);
    lastRows = rows;
    const z = state.brush && state.brush.unit === unit ? state.brush : null;
    full = {
      x: d3.scaleLinear().domain([0, unit === "km" ? (d3.max(rows, xOf) || 1) : 100]).nice().domain(),
      y: d3.scaleLinear().domain([0, Math.max(3, d3.max(rows, d => d.delay) || 0)]).nice().domain()
    };
    x.domain(z ? [z.x0, z.x1] : full.x);
    y.domain(z ? [z.y0, z.y1] : full.y);
    drawAxes();
    xLabel.text(unit === "km" ? "Distance travelled from origin (km)" : "Route completed (0% = origin, 100% = destination)");
    alpha = Math.max(0.15, Math.min(0.6, 600 / Math.pow(Math.max(rows.length, 1), 0.8)));

    gPoints.selectAll("circle").data(rows).join("circle")
      .attr("r", 2.3)
      .attr("cx", d => x(xOf(d)))
      .attr("cy", d => y(d.delay))
      .attr("fill", d => typeColor(d.type));
    quadtree = d3.quadtree().x(d => x(xOf(d))).y(d => y(d.delay)).addAll(rows);
    drawFit(rows);
    baseSub = d3.select("#scatter-sub").text();
  }

  function paint(state, brushOverride) {
    const b = brushOverride === undefined ? state.brush : brushOverride;
    gPoints.selectAll("circle").attr("fill-opacity", d => {
      const inSel = !b || inBrush(d, b);
      const inHover = !state.hover || d.axis === state.hover;
      if (!inSel || !inHover) return 0.04;
      return b || state.hover ? Math.min(0.85, alpha * 2.5) : alpha;
    });
  }

  function toExtent(sel) {
    return { unit, x0: x.invert(sel[0][0]), x1: x.invert(sel[1][0]), y0: Math.max(0, y.invert(sel[1][1])), y1: y.invert(sel[0][1]) };
  }

  brush.on("brush end", event => {
    if (!event.sourceEvent) return;
    let sel = event.selection;
    if (sel && (sel[1][0] - sel[0][0] < 4 || sel[1][1] - sel[0][1] < 4)) sel = null;
    if (event.type === "brush") { paint(dashboard.getState(), sel ? toExtent(sel) : null); return; }
    dashboard.setState({ brush: sel ? toExtent(sel) : null });
  });

  function syncBrush() {
    if (d3.brushSelection(brushG.node())) brushG.call(brush.move, null);
  }

  overlay.on("mousemove", event => {
    const [px, py] = d3.pointer(event, svg.node());
    
    if (currentFit && lastRows.length) {
      const xv = x.invert(px);
      const [minX, maxX] = d3.extent(lastRows, xOf);
      
      if (xv >= minX && xv <= maxX) {
        const yv = currentFit.a + currentFit.b * xv;
        const linePy = y(yv);
        
        if (Math.abs(py - linePy) < 15) {
          ring.style("display", "none");
          const u = unit === "km" ? "km" : "%";
          const deltaNum = currentFit.b;
          const delta = deltaNum > 0 ? "+" + fmt.one(deltaNum) : fmt.one(deltaNum);
          
          let html = `<b>Trend (Linear Fit)</b><br>` +
                     `At ${fmt.int(xv)} ${u}<br>` +
                     `Expected delay: <b>${fmt.one(yv)} min</b><br>` +
                     `<span style="color:#a7b4c7; font-size:0.9em;">&Delta; Rate: ${delta} min/${u}</span>`;
                     
          if (currentFit.se) {
            html += `<br><span style="color:#a7b4c7; font-size:0.85em;">Margin (95% CI): &plusmn;${fmt.one(1.96 * currentFit.se(xv))} min</span>`;
          }
          
          tooltip.show(html, event);
          return; 
        }
      }
    }

    const d = quadtree && quadtree.find(px, py, 10);
    const visible = d && x(xOf(d)) >= m.left && x(xOf(d)) <= W - m.right && y(d.delay) >= m.top && y(d.delay) <= H - m.bottom;
    if (!visible) { ring.style("display", "none"); tooltip.hide(); return; }
    ring.style("display", null).attr("cx", x(xOf(d))).attr("cy", y(d.delay));
    tooltip.show("<b>" + d.trainId + "</b> (" + d.type + ")<br>" + axisLabel(d.axis) + "<br>" +
      fmt.one(d.distFromOrigin) + " km from origin (" + fmt.int(d.progress * 100) + "% of route)<br>Delay: " + d.delay + " min<br>" +
      phaseLabel(d.phase) + ", " + d.day.slice(8) + "/" + d.day.slice(5, 7), event);
  }).on("mouseleave", () => { ring.style("display", "none"); tooltip.hide(); });

  const MW = 204, MH = 108, MPAD = 4;
  const mini = root.append("div").attr("class", "minimap").style("display", "none");
  mini.append("div").attr("class", "minimap-title").text("Full view (where the zoom is)");
  const dpr = window.devicePixelRatio || 1;
  const miniCanvas = mini.append("canvas").attr("width", MW * dpr).attr("height", MH * dpr)
    .style("width", MW + "px").style("height", MH + "px");
  const mctx = miniCanvas.node().getContext("2d");
  mctx.scale(dpr, dpr);
  const miniRange = mini.append("div").attr("class", "minimap-range");

  (function makeDraggable() {
    const el = mini.node();
    let drag = null;
    mini.attr("title", "Drag to move");
    el.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      const r = el.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      el.setPointerCapture(e.pointerId);
      el.classList.add("dragging");
      tooltip.hide();
      e.preventDefault();
    });
    el.addEventListener("pointermove", e => {
      if (!drag) return;
      const host = el.offsetParent.getBoundingClientRect();
      const left = Math.max(0, Math.min(host.width - el.offsetWidth, e.clientX - host.left - drag.dx));
      const top = Math.max(0, Math.min(host.height - el.offsetHeight, e.clientY - host.top - drag.dy));
      el.style.left = left + "px";
      el.style.top = top + "px";
      el.style.right = "auto";
    });
    const end = () => { drag = null; el.classList.remove("dragging"); };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  })();

  function drawMinimap(state) {
    const b = state.brush && state.brush.unit === unit ? state.brush : null;
    mini.style("display", b ? null : "none");
    if (!b) return;
    const mx = d3.scaleLinear().domain(full.x).range([MPAD, MW - MPAD]);
    const my = d3.scaleLinear().domain(full.y).range([MH - MPAD, MPAD]);
    mctx.clearRect(0, 0, MW, MH);
    const dot = d => mctx.fillRect(mx(xOf(d)) - 0.75, my(d.delay) - 0.75, 1.5, 1.5);
    const mc = themeColors().mini;
    mctx.fillStyle = mc.dots;
    lastRows.forEach(d => { if (!inBrush(d, b)) dot(d); });
    mctx.fillStyle = mc.picked;
    lastRows.forEach(d => { if (inBrush(d, b)) dot(d); });
    const rx = mx(b.x0), ry = my(b.y1);
    const rw = Math.max(3, mx(b.x1) - mx(b.x0)), rh = Math.max(3, my(b.y0) - my(b.y1));
    mctx.fillStyle = mc.fill;
    mctx.fillRect(rx, ry, rw, rh);
    mctx.strokeStyle = mc.stroke;
    mctx.lineWidth = 1.4;
    mctx.setLineDash([3, 2]);
    mctx.strokeRect(rx, ry, rw, rh);
    mctx.setLineDash([]);
    miniRange.text(fmt.int(b.x0) + "–" + fmt.int(b.x1) + (unit === "km" ? " km" : "% of route") + ", " + fmt.one(b.y0) + "–" + fmt.one(b.y1) + " min");
  }

  function update(state) {

    if (JSON.stringify(state.brush) !== JSON.stringify(lastBrush)) {
      if (!state.brush) brushHistory.length = 0;
      else if (!restoring && lastBrush && lastBrush.unit === unit) {
        brushHistory.push(lastBrush);
        if (brushHistory.length > 20) brushHistory.shift();
      }
      lastBrush = state.brush;
    }
    prevBtn.style("display", state.brush && brushHistory.length ? null : "none");
    toggle.selectAll("button").attr("aria-pressed", d => String(d.id === unit));
    const key = [state.phase, state.day, state.axis, state.type, state.origin, state.onlyDelayed, state.theme, unit, JSON.stringify(state.brush)].join("|");
    const redrawn = key !== lastKey;
    if (redrawn) { lastKey = key; draw(state); }
    syncBrush();
    if (redrawn || !state.brush) drawMinimap(state);
    resetBtn.style("display", state.brush ? null : "none");
    paint(state);
    d3.select("#scatter-sub").text(baseSub);
  }

  return { id: "scatter", update };
}