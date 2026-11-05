# Delays on Lisbon's Rail Network

An interactive dashboard to explore train delays in Lisbon's rail network, built with D3.js v7, plain JavaScript, HTML and CSS. It combines five idioms (bar chart, treemap, box plot, scatterplot and heatmap) in four coordinated panels: selecting something in one view filters all the others.

The data covers four days (16–19 September 2026): 15,433 valid observations of 1,296 trips, from 5 train types over 20 service axes.

---

## How to open the project

The dashboard has no build step, no installation and no internet connection requirement: D3 is bundled in `lib/`, and there are no external dependencies or CDNs.

It does, however, load its data with `fetch` (`data/dataset.json`), so `index.html` must be served over HTTP. Opening the file directly (double click, `file://...`) will show an empty page, because browsers block loading local files that way.

Serve the project folder with any static server. Three options:

**1. VS Code + Live Server (pre-configured).**
Open the project folder in VS Code, right-click `index.html` and choose *Open with Live Server*. The port is already set to `5501` in `.vscode/settings.json`.

**2. Python (no extra install if Python 3 is available).**
From the project root:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

**3. Node.js.**
From the project root:

```bash
npx serve .
```

Then open the address it prints.

The first load reads a ~6 MB JSON file, so give it a moment on slower machines.

---

## What the dashboard shows

The page is organised in a header with the filters and four panels. The title of each panel also tells which filters are currently applied.

### Filters (header)

| Control | What it does |
|---|---|
| **Direction** | Chooses the direction of travel of the selected axis. It is enabled once an axis is selected in the left chart. |
| **Time of day** | All / Morning / Afternoon / Night. Morning is 6h–12h, Afternoon is 12h–20h and Night is 20h–6h. |
| **Data** | *Complete* uses every observation. *Delayed only* keeps only observations/trips with a delay above zero. |
| **Theme** | Light / Dark. The choice is remembered in the browser (`localStorage`). |
| **Active filters** | Shows each active filter as a chip that can be removed with its ×. *Clear filters* resets everything. |

### Share of each axis in delay (left panel)

Shows how the delay of each train type is distributed across the service axes (lines).

- **Overview (no train type selected):** bars grouped and colour-coded by train type. Each bar is the share (%) of the delay minutes of that type carried by one axis, so the bars of each group add up to 100%. Clicking a bar selects that axis, and this enables the *Direction* filter.
- **With a train type selected:** a treemap (one tile per axis, area proportional to its share of the delay) or the same information as bars, switched with the *Treemap / Bars* control. Axes with 0 minutes of delay are not drawn, and a note says how many were left out. *← All types* goes back to the overview.

### Distance travelled and delay (top right)

A **scatterplot** where each dot is one observation of a train along its route, coloured by train type.

- X axis: distance travelled from the origin, in km or as % of the route (toggle in the panel header).
- Y axis: delay, in minutes.
- A **linear trend line** with a 95% confidence band (hatched) shows whether delay grows along the route.
- **Brushing** (click and drag) zooms into a region and filters the other views to those observations. A minimap shows where the zoom is relative to the full view, and can be dragged anywhere inside the plot so it doesn't hide the data.
- **Previous zoom** goes back to the previous brush, and Reset zoom removes the brush. Previous zoom only appears while a brush is active and there is a zoom to go back to.

### Delay by train type (bottom left)

A **box plot** of the maximum delay per trip for each train type: the box spans the quartiles, the line is the median, the diamond is the mean, the whiskers and dots show the extremes and outliers, and *n* is the number of trips. Clicking a box, its *n* label or the train type name under it filters the whole dashboard by that type (click again to clear).

### Mean delay by time of day and day (bottom right)

A **heatmap** with the time of day (with its hours) on the rows and the four days (with their dates) on the columns. Each cell is the mean of the maximum delay per trip, coloured in five classes whose ranges adapt to the data currently shown. Cells with no trips are hatched, and cells with fewer than 30 trips show a *"Few trips: interpret with caution"* note in the tooltip. Clicking a cell filters by that time of day and day. Clicking a row label or a column label filters by only the time of day or only the day.

### Tooltips

Hovering over any bar, tile, box, dot or heatmap cell shows its exact values.

---

## Data

`data/dataset.json` is generated from `data-processing/src/Dataset_Final.csv` (semicolon-separated, one row per observation of a train). Main columns:

| Column | Meaning |
|---|---|
| `Data_Hora_Recolha` | Date and time of the observation |
| `Estacao_Consulta`, `Direcao_Recolha` | Station where the train was observed and whether it was a departure or an arrival |
| `Eixo_Servico` | Service axis (line), e.g. *Lisboa Oriente ⟷ Sintra* |
| `Comboio_Num`, `Tipo` | Train number and train type (Urbano, Regional, InterRegional, Intercidades, Alfa Pendular) |
| `Origem`, `Destino` | Origin and destination of the trip |
| `Hora_Prevista`, `Hora_Real` | Scheduled and actual time |
| `Atraso_Min` | Delay, in minutes |
| `Distancia_Origem_km`, `Distancia_Destino_km` | Distance already travelled from the origin and distance left to the destination |
| `Fase do Dia` | Time of day (Manhã / Tarde / Noite) |

How the data is prepared when the page loads (`js/data.js`):

- Rows with an invalid or negative delay, or with the cancellation marker (`9999`), are removed (13 of the 15,446 rows).
- A trip is one train on one day. Its delay is the maximum delay observed in that trip. The bar chart, treemap, box plot and heatmap use trips; the scatterplot uses individual observations.
- The progress along the route (% of route) is the distance travelled divided by the total route length.

### Regenerating the JSON (optional)

Only needed if the CSV changes. It requires Python 3 and `pandas`, and must be run from inside the `data-processing` folder (the paths in the script are relative):

```bash
cd data-processing
pip install pandas
python process-dataset.py
```

---

## Project structure

```
index.html              Page structure and script loading
style.css               Styles and the light/dark theme variables
script.js               Entry point: loads the data and builds the dashboard
js/
  config.js             Constants, axes, train type colours and the light/dark themes
  data.js               Data loading, cleaning and trip construction
  dashboard.js          Shared state, filters and the event dispatch between views
  controls.js           Header filters, view switch and theme toggle
  tooltip.js            Shared tooltip
idioms/
  barchart.js           Share of delay per axis (bars)
  treemap.js            Share of delay per axis (treemap)
  boxplot.js            Delay by train type
  scatterplot.js        Distance travelled vs delay (with minimap)
  heatmap.js            Mean delay by time of day and day
lib/d3.v7.min.js        D3 v7.9.0 (local copy)
data/dataset.json       Dataset used by the dashboard
data-processing/        CSV source and the CSV → JSON script
assets/                 Early sketches of the scatterplot and heatmap
```

All views share one state object (`js/dashboard.js`). When any filter changes, every view receives the new state and redraws itself, which is what keeps the views coordinated.
