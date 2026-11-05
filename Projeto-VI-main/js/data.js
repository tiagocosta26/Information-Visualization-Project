const MAIN_AXIS_IDS = new Set(AXES.map(a => a.id));

function loadData(path) {
  return d3.json(path).then(prepareData);
}

function prepareData(raw) {
  const observations = [];
  let removed = 0;

  raw.forEach(r => {
    const delay = +r.Atraso_Min;
    if (!Number.isFinite(delay) || delay < 0 || delay >= CONFIG.CANCELLED_DELAY) {
      removed++;
      return;
    }
    const [dd, mm, yyyy] = r.Data_Hora_Recolha.slice(0, 10).split("/");
    observations.push({
      delay: delay,
      phase: r["Fase do Dia"],
      origin: r.Origem,
      type: r.Tipo,
      axis: r.Eixo_Servico,
      axisGroup: MAIN_AXIS_IDS.has(r.Eixo_Servico) ? r.Eixo_Servico : OTHER_AXES.id,
      day: yyyy + "-" + mm + "-" + dd,
      distFromOrigin: +r.Distancia_Origem_km,
      distToDestination: +r.Distancia_Destino_km,
      trainId: r.Comboio_Num
    });
  });

  const lengths = [];
  d3.group(observations, d => d.trainId + "|" + d.day).forEach(g => {
    const len = d3.mean(g, d => d.distFromOrigin + d.distToDestination);
    g.forEach(d => { d.routeLength = len; });
    lengths.push(len);
  });
  lengths.sort(d3.ascending);
  const routeCuts = [d3.quantile(lengths, 1 / 3), d3.quantile(lengths, 2 / 3)];
  observations.forEach(d => {
    const total = d.distFromOrigin + d.distToDestination;
    d.progress = total > 0 ? d.distFromOrigin / total : 0;
    d.routeClass = d.routeLength <= routeCuts[0] ? 0 : d.routeLength <= routeCuts[1] ? 1 : 2;
  });

  const trips = buildTrips(observations);
  const [firstDay, lastDay] = d3.extent(observations, d => d.day);

  return {
    observations: observations,
    trips: trips,
    info: { observations: observations.length, trips: trips.length, removed: removed, firstDay: firstDay, lastDay: lastDay, routeCuts: routeCuts }
  };
}

function buildTrips(observations) {
  return Array.from(d3.group(observations, d => d.trainId + "|" + d.day).values(), group => {
    const peak = d3.greatest(group, d => d.delay);
    return {
      trainId: peak.trainId,
      day: peak.day,
      type: peak.type,
      axis: peak.axis,
      axisGroup: peak.axisGroup,
      phase: peak.phase,
      origin: peak.origin,
      maxDelay: peak.delay,
      maxDist: d3.max(group, d => d.distFromOrigin),
      observations: group.length
    };
  });
}
