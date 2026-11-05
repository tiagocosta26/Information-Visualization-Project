function createDashboard({ observations, trips, info }) {
  const dispatch = d3.dispatch("change");

  const state = {
    phase: null,
    day: null,
    origin: null,
    axis: null,
    type: null,
    onlyDelayed: false,
    view: "treemap",
    brush: null,
    hover: null,
    theme: themeName
  };

  let brushCache = { sig: null, keys: null };

  const filters = {
    phase: (d, v) => v === null || d.phase === v,
    day: (d, v) => v === null || d.day === v,
    origin: (d, v) => v === null || d.origin === v,
    axis: (d, v) => v === null || d.axis === v,
    type: (d, v) => v === null || d.type === v,
    onlyDelayed: (d, v) => !v || ("maxDelay" in d ? d.maxDelay : d.delay) > 0
  };

  function getState() {
    return { ...state };
  }

  const tripKey = d => d.trainId + "|" + d.day;

  function brushKeys(ignore) {
    const sig = JSON.stringify({ ...state, hover: null }) + "|" + ignore.join(",");
    if (brushCache.sig !== sig) {
      const hits = select(observations, ignore.concat("brush"), false).filter(d => inBrush(d, state.brush));
      brushCache = { sig, keys: new Set(hits.map(tripKey)) };
    }
    return brushCache.keys;
  }

  function select(rows, ignore, isTrip) {
    const active = Object.keys(filters).filter(k => !ignore.includes(k));
    const useBrush = state.brush !== null && !ignore.includes("brush");
    const keys = useBrush && isTrip ? brushKeys(ignore) : null;
    return rows.filter(d => active.every(k => filters[k](d, state[k])) &&
      (!useBrush || (isTrip ? keys.has(tripKey(d)) : inBrush(d, state.brush))));
  }

  function setState(patch) {
    if ("type" in patch && patch.type !== state.type && !("axis" in patch)) patch = { ...patch, axis: null };
    if ("axis" in patch && patch.axis !== state.axis && !("origin" in patch)) patch = { ...patch, origin: null };
    const before = JSON.stringify(state);
    Object.assign(state, patch);
    if (JSON.stringify(state) !== before) {
      dispatch.call("change", null, getState());
    }
  }

  function register(view) {
    dispatch.on("change." + view.id, s => view.update(s));
    view.update(getState());
    return view;
  }

  function reset() {
    setState({ phase: null, day: null, axis: null, type: null, origin: null, onlyDelayed: false, brush: null, hover: null });
  }

  return {
    info,
    getState,
    reset,
    setState,
    register,
    getTrips: (ignore = []) => select(trips, ignore, true),
    getObservations: (ignore = []) => select(observations, ignore, false)
  };
}
