function createTooltip() {
  const el = d3.select("body")
    .selectAll("div.tooltip")
    .data([0])
    .join("div")
    .attr("class", "tooltip")
    .attr("role", "tooltip");

  function move(event) {
    const gap = 14;
    const w = el.node().offsetWidth;
    const h = el.node().offsetHeight;
    let x = event.clientX + gap;
    let y = event.clientY + gap;
    if (x + w > window.innerWidth - 8) x = event.clientX - w - gap;
    if (y + h > window.innerHeight - 8) y = event.clientY - h - gap;
    el.style("left", x + "px").style("top", y + "px");
  }

  function show(html, event) {
    el.html(html).classed("visible", true);
    move(event);
  }

  function hide() {
    el.classed("visible", false);
  }

  return { show, move, hide };
}
