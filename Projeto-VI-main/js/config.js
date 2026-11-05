const CONFIG = {
  DATA_URL: "./data/dataset.json",
  CANCELLED_DELAY: 9999
};

const AXES = [
  { id: "Lisboa Oriente ⟷ Sintra", label: "Lisboa Oriente – Sintra", color: "#2F80ED" },
  { id: "Lisboa Rossio ⟷ Sintra", label: "Lisboa Rossio – Sintra", color: "#F2994A" },
  { id: "Alverca ⟷ Sintra", label: "Alverca – Sintra", color: "#27AE60" },
  { id: "Alcantara - Terra ⟷ Castanheira do Ribatejo", label: "Alcântara-Terra – Castanheira do Ribatejo", color: "#EB5757" }
];

const OTHER_AXES = { id: "Other axes", label: "Other axes", color: "#8D99A8" };

const PHASES = ["Manhã", "Tarde", "Noite"];
const PHASE_LABELS = { "Manhã": "Morning", "Tarde": "Afternoon", "Noite": "Night" };
const PHASE_HOURS = { "Manhã": "6h - 12h", "Tarde": "12h - 20h", "Noite": "20h - 6h" };
const phaseLabel = p => PHASE_LABELS[p] || p;
const STATION_LABELS = { "Alcantara - Terra": "Alcântara-Terra" };
const stationLabel = id => STATION_LABELS[id] || id;


function measure(node, fallbackW, fallbackH) {
  const w = node.node().clientWidth, h = node.node().clientHeight;
  return { W: w > 150 ? w : fallbackW, H: h > 120 ? h : fallbackH };
}

const STATION_SHORT = {
  "Lisboa Santa Apolonia": "Santa Apolónia", "Lisboa Oriente": "Oriente", "Lisboa Rossio": "Rossio",
  "Alcantara - Terra": "Alcântara", "Castanheira do Ribatejo": "Castanheira do Ribatejo", "Porto Campanha": "Porto Campanhã",
  "Mira Sintra - Melecas": "Mira Sintra - Meleças", "Mouriscas - A": "Mouriscas - A",
  "Entroncamento": "Entroncamento", "Evora": "Évora", "Valenca": "Valença", "Guimaraes": "Guimarães"
};

function axisInfo(id, type) {
  const short = id.split(" ⟷ ").map(s => STATION_SHORT[s] || s).join(" – ");
  const main = AXES.find(a => a.id === id);
  if (main) return { ...main, short };
  return {
    id: id,
    label: id.split(" ⟷ ").map(stationLabel).join(" – "),
    short,
    color: TYPE_COLORS[type] || OTHER_AXES.color
  };
}

const TYPE_COLORS = {
  "Intercidades":  "#4CC38A",
  "Alfa Pendular": "#9DAABB",
  "Regional":      "#E0A94A",
  "Urbano":        "#F06A6A",
  "InterRegional": "#5B93E8"
};

const THEME_KEY = "projeto-vi-theme";
const THEMES = {
  dark: {
    types: { "Intercidades": "#4CC38A", "Alfa Pendular": "#9DAABB", "Regional": "#E0A94A", "Urbano": "#F06A6A", "InterRegional": "#5B93E8" },
    other: "#8D99A8",
    heat: {
      palette: ["#1e1f3a", "#3b3b7a", "#6b519d", "#9f63ab", "#f188b8"], // low -> high
      noFill: "#2a3140", noStroke: "#3b4659", noText: "#93a1b5", selStroke: "#e6ebf2"
    },
    mini: { dots: "rgba(147,161,181,0.35)", picked: "#e6ebf2", fill: "rgba(230,235,242,0.12)", stroke: "#e6ebf2" }
  },
  light: {
    types: { "Intercidades": "#2E7D4F", "Alfa Pendular": "#7A8794", "Regional": "#A67C3B", "Urbano": "#B23A3A", "InterRegional": "#2B5BA8" },
    other: "#6B7785",
    heat: {
      palette: [0.1, 0.32, 0.55, 0.77, 1].map(t => d3.interpolatePurples(0.1 + 0.9 * t)),
      noFill: "#cccccc", noStroke: "#b3b3b3", noText: "#1b2433", selStroke: "#1b2433"
    },
    mini: { dots: "rgba(93,107,126,0.28)", picked: "#1b2433", fill: "rgba(27,36,51,0.10)", stroke: "#1b2433" }
  }
};
let themeName = "dark";
const themeColors = () => THEMES[themeName];
function storedTheme() {
  try { const t = localStorage.getItem(THEME_KEY); if (t in THEMES) return t; } catch (e) {}
  return "dark";
}
function applyTheme(name) {
  themeName = name in THEMES ? name : "dark";
  Object.assign(TYPE_COLORS, THEMES[themeName].types);
  OTHER_AXES.color = THEMES[themeName].other;
  document.documentElement.setAttribute("data-theme", themeName);
  try { localStorage.setItem(THEME_KEY, themeName); } catch (e) {}
}

const fmt = {
  int: d3.format(",d"),
  one: d3.format(".1f"),
  two: d3.format(".2f"),
  pct0: d3.format(".0%"),
  pct1: d3.format(".1%")
};

const X_ACCESSORS = {
  km: d => d.distFromOrigin,
  pct: d => d.progress * 100
};

function inBrush(d, b) {
  const v = X_ACCESSORS[b.unit](d);
  return v >= b.x0 && v <= b.x1 && d.delay >= b.y0 && d.delay <= b.y1;
}
