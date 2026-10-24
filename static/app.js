function repeated(pattern, count) {
  return pattern.repeat(count);
}

function mutate(sequence, edits) {
  const bases = sequence.split("");
  Object.entries(edits).forEach(([position, base]) => {
    bases[Number(position) - 1] = base;
  });
  return bases.join("");
}

const ACGT_CONTROL = repeated("ACGT", 32);
const AT_CONTROL = repeated("AT", 64);
const ATG_CONTROL = repeated("ATG", 43);

const SYNTHETIC_SEQUENCES = [
  {
    id: "acgt-control",
    name: "ACGT control",
    tag: "pattern",
    description: "Stable periodic sequence",
    sequence: ACGT_CONTROL,
  },
  {
    id: "acgt-edits",
    name: "ACGT edit hunt",
    tag: "stress",
    description: "Two injected substitutions",
    sequence: mutate(ACGT_CONTROL, { 49: "C", 82: "T" }),
  },
  {
    id: "at-control",
    name: "AT guide control",
    tag: "guide",
    description: "Stable two-base guide pattern",
    sequence: AT_CONTROL,
  },
  {
    id: "at-edits",
    name: "AT guide edits",
    tag: "stress",
    description: "Two injected substitutions",
    sequence: mutate(AT_CONTROL, { 57: "G", 106: "C" }),
  },
  {
    id: "atg-edits",
    name: "ATG motif edits",
    tag: "motif",
    description: "Motif with two substitutions",
    sequence: mutate(ATG_CONTROL, { 70: "C", 101: "A" }),
  },
];

const els = {
  list: document.querySelector("#sequence-list"),
  file: document.querySelector("#sequence-file"),
  input: document.querySelector("#sequence-input"),
  inputMeta: document.querySelector("#input-meta"),
  load: document.querySelector("#load-button"),
  hunt: document.querySelector("#hunt-button"),
  title: document.querySelector("#sequence-title"),
  length: document.querySelector("#sequence-length"),
  exact: document.querySelector("#exact-sequence"),
  summary: document.querySelector("#summary"),
  results: document.querySelector("#results"),
  error: document.querySelector("#error-box"),
  context: document.querySelector("#context-size"),
  warmup: document.querySelector("#warmup-size"),
  visualizerName: document.querySelector("#visualizer-name"),
  visualizerDescription: document.querySelector("#visualizer-description"),
  visualizerLength: document.querySelector("#visualizer-length"),
  categoryPills: document.querySelector("#category-pills"),
  dnaCanvas: document.querySelector("#dna-canvas"),
};

let currentSequence = "";

const BASE_COLORS = { A: 0x8ee3ba, C: 0x85cbed, G: 0xf0d77b, T: 0xc7a8e8 };
const COMPLEMENT = { A: "T", T: "A", C: "G", G: "C" };

function createDotDnaVisualizer() {
  const dna = document.createElement("div");
  dna.className = "dna dot-dna";
  dna.setAttribute("aria-label", "DNA base-pair visualizer");
  els.dnaCanvas.replaceChildren(dna);
  let mismatchPositions = new Set();

  function color(value) {
    return `#${value.toString(16).padStart(6, "0")}`;
  }

  function update(nextSequence) {
    const maxVisibleBases = 256;
    const stride = Math.max(1, Math.ceil(nextSequence.length / maxVisibleBases));
    const visibleBases = nextSequence.split("").map((base, index) => ({ base, position: index + 1 })).filter((_, index) => index % stride === 0).slice(0, maxVisibleBases);
    dna.style.setProperty("--total", visibleBases.length);
    dna.style.width = `${Math.max(260, visibleBases.length * 5)}px`;
    dna.replaceChildren();

    visibleBases.forEach(({ base, position }, index) => {
      const element = document.createElement("div");
      const pair = COMPLEMENT[base];
      element.className = "ele";
      element.dataset.position = String(position);
      element.classList.toggle("is-mismatch", mismatchPositions.has(position));
      element.style.setProperty("--index", index + 1);
      element.style.setProperty("--delay", `${(-8 / visibleBases.length * (index + 1)).toFixed(3)}s`);
      element.style.setProperty("--dot-color1", color(BASE_COLORS[base]));
      element.style.setProperty("--dot-color2", color(BASE_COLORS[pair]));
      element.title = `${base}–${pair} base pair`;
      element.setAttribute("aria-label", `${base} paired with ${pair}`);
      dna.appendChild(element);
    });
  }

  function setMismatches(positions) {
    mismatchPositions = new Set(positions);
    dna.querySelectorAll(".ele").forEach((element) => {
      element.classList.toggle("is-mismatch", mismatchPositions.has(Number(element.dataset.position)));
    });
  }

  return { update, setMismatches };
}

function createSvgDnaVisualizer() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("dna-svg");
  svg.setAttribute("viewBox", "0 0 620 250");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "DNA double helix");
  els.dnaCanvas.replaceChildren(svg);
  let visibleBases = [];

  function hex(value) {
    return `#${value.toString(16).padStart(6, "0")}`;
  }

  function renderFrame() {
    const center = 310;
    const amplitude = 146;
    const top = 16;
    const height = 218;
    const step = visibleBases.length > 1 ? height / (visibleBases.length - 1) : height;
    const strandA = [];
    const strandB = [];
    const rungs = [];
    const nodes = [];

    visibleBases.forEach((base, index) => {
      const phase = index * 0.62;
      const y = top + index * step;
      const wave = Math.sin(phase);
      const depth = (Math.cos(phase) + 1) / 2;
      const left = { x: center + wave * amplitude, y, depth };
      const right = { x: center - wave * amplitude, y, depth: 1 - depth };
      strandA.push(left);
      strandB.push(right);
      rungs.push(`<line class="dna-rung" x1="${left.x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${right.x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${hex(BASE_COLORS[base])}" stroke-opacity="${(0.28 + depth * 0.5).toFixed(2)}" stroke-width="${(1.6 + depth * 1.3).toFixed(1)}" />`);
      nodes.push(`<circle class="dna-node" cx="${left.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(4.4 + depth * 2).toFixed(1)}" fill="${hex(BASE_COLORS[base])}" fill-opacity="${(0.55 + depth * 0.45).toFixed(2)}" /><text x="${left.x.toFixed(1)}" y="${(y + 2.5).toFixed(1)}" text-anchor="middle">${base}</text>`);
      const pair = COMPLEMENT[base];
      nodes.push(`<circle class="dna-node" cx="${right.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(4.4 + (1 - depth) * 2).toFixed(1)}" fill="${hex(BASE_COLORS[pair])}" fill-opacity="${(0.55 + (1 - depth) * 0.45).toFixed(2)}" /><text x="${right.x.toFixed(1)}" y="${(y + 2.5).toFixed(1)}" text-anchor="middle">${pair}</text>`);
    });

    const path = (points) => points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    svg.innerHTML = `<line class="dna-axis" x1="310" y1="8" x2="310" y2="242" /><g class="dna-rungs">${rungs.join("")}</g><path class="dna-backbone dna-backbone-a" d="${path(strandA)}" /><path class="dna-backbone dna-backbone-b" d="${path(strandB)}" />${nodes.join("")}`;
  }

  function update(nextSequence) {
    const maxBases = 30;
    const stride = Math.max(1, Math.ceil(nextSequence.length / maxBases));
    visibleBases = nextSequence.split("").filter((_, index) => index % stride === 0).slice(0, maxBases);
    renderFrame();
  }

  return { update };
}

function createCssDnaVisualizer() {
  const dna = document.createElement("div");
  dna.className = "dna";
  dna.setAttribute("aria-label", "DNA double helix");
  els.dnaCanvas.replaceChildren(dna);

  function createNode(base, side) {
    const node = document.createElement("div");
    node.className = `strand__node dna-node-${base.toLowerCase()} dna-node-${side}`;
    node.textContent = base;
    node.title = `${base} base`;
    node.style.setProperty("--bg", `rgb(${(BASE_COLORS[base] >> 16) & 255}, ${(BASE_COLORS[base] >> 8) & 255}, ${BASE_COLORS[base] & 255})`);
    return node;
  }

  function render(nextSequence) {
    dna.replaceChildren();
    const maxStrands = 30;
    const stride = Math.max(1, Math.ceil(nextSequence.length / maxStrands));
    const visibleBases = nextSequence.split("").filter((_, index) => index % stride === 0).slice(0, maxStrands);
    dna.style.setProperty("--total", visibleBases.length);

    visibleBases.forEach((base, index) => {
      const strand = document.createElement("div");
      strand.className = "strand";
      strand.style.setProperty("--index", index + 1);
      strand.style.setProperty("--delay", `${(-Math.sin((Math.PI / 2) * ((index + 1) / visibleBases.length)) * 1.6).toFixed(2)}s`);
      strand.append(createNode(base, "left"), createNode(COMPLEMENT[base], "right"));
      dna.appendChild(strand);
    });
  }

  return { update: render };
}

function createCanvasDnaVisualizer() {
  const canvas = document.createElement("canvas");
  canvas.className = "dna-fallback-canvas";
  els.dnaCanvas.replaceChildren(canvas);
  const context = canvas.getContext("2d");
  let sequence = "";
  let rotation = 0;
  let width = 1;
  let height = 1;
  const maxBases = 86;

  function resize() {
    const bounds = els.dnaCanvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function colorFor(base, alpha = 1) {
    const color = BASE_COLORS[base] || 0xffffff;
    const red = (color >> 16) & 255;
    const green = (color >> 8) & 255;
    const blue = color & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    rotation += 0.012;
    const visibleBases = sequence.split("").filter((_, index) => index % Math.max(1, Math.ceil(sequence.length / maxBases)) === 0).slice(0, maxBases);
    if (!visibleBases.length) {
      requestAnimationFrame(draw);
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const spacing = Math.min(13, (height - 30) / Math.max(visibleBases.length, 1));
    const radius = Math.min(112, width * 0.17);
    const firstY = centerY - ((visibleBases.length - 1) * spacing) / 2;
    const strandA = [];
    const strandB = [];

    visibleBases.forEach((base, index) => {
      const angle = index * 0.62 + rotation;
      const depthA = (Math.sin(angle) + 1) / 2;
      const depthB = (Math.sin(angle + Math.PI) + 1) / 2;
      const y = firstY + index * spacing;
      strandA.push({ x: centerX + Math.cos(angle) * radius, y, depth: depthA });
      strandB.push({ x: centerX + Math.cos(angle + Math.PI) * radius, y, depth: depthB });
    });

    function drawStrand(points) {
      context.beginPath();
      points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.strokeStyle = "rgba(174, 229, 198, .55)";
      context.lineWidth = 2;
      context.stroke();
    }

    drawStrand(strandA);
    drawStrand(strandB);
    visibleBases.forEach((base, index) => {
      const left = strandA[index];
      const right = strandB[index];
      const depth = (left.depth + right.depth) / 2;
      context.beginPath();
      context.moveTo(left.x, left.y);
      context.lineTo(right.x, right.y);
      context.strokeStyle = `rgba(188, 236, 207, ${0.18 + depth * 0.34})`;
      context.lineWidth = 1 + depth;
      context.stroke();

      [left, right].forEach((point) => {
        const size = 3.4 + point.depth * 2.2;
        context.beginPath();
        context.arc(point.x, point.y, size, 0, Math.PI * 2);
        context.fillStyle = colorFor(base, 0.45 + point.depth * 0.55);
        context.shadowColor = colorFor(base, 0.7);
        context.shadowBlur = 12;
        context.fill();
        context.shadowBlur = 0;
      });
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
  return { update(nextSequence) { sequence = nextSequence; } };
}

function createDnaVisualizer() {
  if (!window.THREE || !els.dnaCanvas) {
    return createCanvasDnaVisualizer();
  }

  const { THREE } = window;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10.5);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return createCanvasDnaVisualizer();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  els.dnaCanvas.appendChild(renderer.domElement);

  const light = new THREE.HemisphereLight(0xe9fff2, 0x14221f, 2.5);
  scene.add(light);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(3, 5, 5);
  scene.add(keyLight);

  const helix = new THREE.Group();
  scene.add(helix);
  const sphereGeometry = new THREE.SphereGeometry(0.105, 12, 12);

  function cylinderBetween(start, end, color) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const geometry = new THREE.CylinderGeometry(0.022, 0.022, direction.length(), 6);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
    const cylinder = new THREE.Mesh(geometry, material);
    cylinder.position.copy(start).add(end).multiplyScalar(0.5);
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return cylinder;
  }

  function renderHelix(sequence) {
    helix.clear();
    const maxVisualBases = 86;
    const stride = Math.max(1, Math.ceil(sequence.length / maxVisualBases));
    const visibleBases = sequence.split("").filter((_, index) => index % stride === 0).slice(0, maxVisualBases);
    const strandA = [];
    const strandB = [];
    const radius = 1.28;
    const spacing = 0.145;
    const center = (visibleBases.length - 1) / 2;

    visibleBases.forEach((base, index) => {
      const angle = index * 0.62;
      const y = (index - center) * spacing;
      const a = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const b = new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius);
      strandA.push(a);
      strandB.push(b);
      const color = BASE_COLORS[base] || 0xffffff;
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.16 });
      const left = new THREE.Mesh(sphereGeometry, material);
      const right = new THREE.Mesh(sphereGeometry, material.clone());
      left.position.copy(a);
      right.position.copy(b);
      helix.add(left, right, cylinderBetween(a, b, color));
    });

    if (strandA.length > 1) {
      const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x8ab7a4, roughness: 0.4, metalness: 0.1 });
      helix.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strandA), 100, 0.035, 8, false), lineMaterial));
      helix.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strandB), 100, 0.035, 8, false), lineMaterial.clone()));
    }
    helix.rotation.x = -0.08;
  }

  function resize() {
    const bounds = els.dnaCanvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    helix.rotation.y += 0.0035;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  resize();
  animate();
  return { update: renderHelix };
}

const dnaVisualizer = createDotDnaVisualizer();

function escapeSequence(raw) {
  const withoutHeaders = raw.replace(/^>[^\r\n]*[\r\n]?/gm, "");
  return withoutHeaders.replace(/\s+/g, "").toUpperCase();
}

function validateSequence(sequence) {
  if (!sequence) return "The sequence is empty.";
  const invalid = [...new Set(sequence.split("").filter((base) => !"ACGT".includes(base)))];
  return invalid.length ? `Only A, C, G, and T are supported. Invalid: ${invalid.join(", ")}` : "";
}

function clearError() {
  els.error.hidden = true;
  els.error.textContent = "";
}

function showError(message) {
  els.error.hidden = false;
  els.error.textContent = message;
}

function baseClass(base) {
  return `base-${base.toLowerCase()}`;
}

function renderSequence(sequence) {
  els.exact.classList.remove("empty-state");
  els.exact.replaceChildren();
  const fragment = document.createDocumentFragment();
  sequence.split("").forEach((base, index) => {
    const cell = document.createElement("span");
    cell.className = `sequence-base ${baseClass(base)}`;
    cell.textContent = base;
    cell.title = `Position ${index + 1}: ${base}`;
    cell.dataset.position = String(index + 1);
    fragment.appendChild(cell);
  });
  els.exact.appendChild(fragment);
  els.length.textContent = `${sequence.length.toLocaleString()} bases`;
}

function selectSynthetic(item) {
  document.querySelectorAll(".sequence-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.id === item.id);
  });
  if (els.input) els.input.value = item.sequence;
  if (els.inputMeta) els.inputMeta.textContent = `${item.sequence.length} bases ready`;
  els.visualizerName.textContent = item.name;
  els.visualizerDescription.textContent = item.description;
  els.visualizerLength.textContent = `${item.sequence.length.toLocaleString()} bases`;
  dnaVisualizer.update(item.sequence);
  document.querySelectorAll(".category-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.id === item.id);
  });
  loadSequence(item.sequence, item.name);
}

function renderCategoryPills() {
  els.categoryPills.replaceChildren();
  SYNTHETIC_SEQUENCES.forEach((item, index) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "category-pill sequence-pill";
    pill.dataset.id = item.id;
    pill.innerHTML = `<span class="sequence-pill-index">0${index + 1}</span><span class="sequence-pill-copy"><strong>${item.name}</strong><small>${item.tag} · ${item.description}</small></span>`;
    pill.addEventListener("click", () => selectSynthetic(item));
    els.categoryPills.appendChild(pill);
  });
}

function renderSyntheticList() {
  if (!els.list) return;
  els.list.replaceChildren();
  SYNTHETIC_SEQUENCES.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = "sequence-card";
    button.type = "button";
    button.dataset.id = item.id;
    button.innerHTML = `<span class="card-index">0${index + 1}</span><span class="card-copy"><strong>${item.name}</strong><small>${item.description}</small></span><span class="card-tag">${item.tag}</span>`;
    button.addEventListener("click", () => selectSynthetic(item));
    els.list.appendChild(button);
  });
}

function loadSequence(raw, name = "Custom sequence") {
  clearError();
  const sequence = escapeSequence(raw);
  const error = validateSequence(sequence);
  if (error) {
    showError(error);
    return;
  }
  currentSequence = sequence;
  dnaVisualizer.setMismatches([]);
  els.title.textContent = name;
  if (els.inputMeta) els.inputMeta.textContent = `${sequence.length.toLocaleString()} bases ready`;
  els.hunt.disabled = false;
  renderSequence(sequence);
  els.summary.hidden = true;
  els.summary.replaceChildren();
  els.results.className = "results empty-state";
  els.results.textContent = "Run Hunt to see the causal prediction map.";
}

function makeSummary(result) {
  const cards = [
    ["Signal candidates", result.flagged_count, "mismatch or low confidence"],
    ["Top-base mismatches", result.mismatch_count, "model chose another base"],
    ["Low confidence", result.low_confidence_count, `observed P < ${Math.round(result.threshold * 100)}%`],
    ["Warm-up window", `${result.warmup_window} bases`, "context only; not scored"],
  ];
  els.summary.hidden = false;
  els.summary.replaceChildren();
  cards.forEach(([label, value, detail]) => {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `<span>${label}</span><strong>${value}</strong><small>${detail}</small>`;
    els.summary.appendChild(card);
  });
}

function probabilityBar(base, value, observed) {
  const row = document.createElement("div");
  row.className = "prob-row";
  row.innerHTML = `<span class="prob-label ${baseClass(base)}">${base}</span><span class="prob-track"><span class="prob-fill ${baseClass(base)}" style="width:${Math.max(2, value * 100)}%"></span></span><span class="prob-value">${(value * 100).toFixed(1)}%</span>${observed ? '<span class="observed-mark">observed</span>' : ""}`;
  return row;
}

function renderResults(result) {
  dnaVisualizer.setMismatches(result.positions.filter((item) => item.mismatch).map((item) => item.position));
  makeSummary(result);
  els.context.textContent = result.context;
  if (els.warmup) els.warmup.textContent = result.warmup_window;
  els.results.className = "results";
  els.results.replaceChildren();

  const header = document.createElement("div");
  header.className = "results-header";
  header.innerHTML = `<span>POSITION</span><span>OBSERVED</span><span>MODEL NEXT</span><span>OBSERVED PROBABILITY</span><span>STATUS</span>`;
  els.results.appendChild(header);

  const list = document.createElement("div");
  list.className = "result-list";
  result.positions.forEach((item) => {
    const row = document.createElement("article");
    row.className = `result-row ${item.flagged ? "is-flagged" : ""} ${item.status}`;

    const position = document.createElement("span");
    position.className = "position-cell";
    position.innerHTML = `<small>#</small><strong>${item.position}</strong>`;

    const observed = document.createElement("span");
    observed.className = `base-chip ${baseClass(item.observed)}`;
    observed.textContent = item.observed;

    const predicted = document.createElement("span");
    predicted.className = "predicted-cell";
    if (item.status === "warmup") {
      predicted.innerHTML = `<strong class="anchor-chip">warm-up</strong><small>context building</small>`;
    } else {
      predicted.innerHTML = item.predicted ? `<strong class="base-chip ${baseClass(item.predicted)}">${item.predicted}</strong><small>${item.mismatch ? "differs" : "agrees"}</small>` : `<strong class="anchor-chip">anchor</strong><small>no prior base</small>`;
    }

    const probability = document.createElement("div");
    probability.className = "probability-cell";
    if (item.probabilities) {
      Object.entries(item.probabilities).forEach(([base, value]) => {
        probability.appendChild(probabilityBar(base, value, base === item.observed));
      });
    } else {
      probability.innerHTML = '<span class="muted">not scored</span>';
    }

    const status = document.createElement("span");
    status.className = `status-chip ${item.status}`;
    status.textContent = item.status === "anchor" ? "anchor" : item.status.replace("-", " ");

    row.append(position, observed, predicted, probability, status);
    list.appendChild(row);
  });
  els.results.appendChild(list);
}

async function hunt() {
  if (!currentSequence) return;
  clearError();
  els.hunt.disabled = true;
  els.hunt.classList.add("loading");
  els.hunt.innerHTML = '<span class="spinner"></span> Hunting…';
  try {
    const response = await fetch("/api/hunt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence: currentSequence }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The sequence could not be analyzed.");
    renderResults(payload);
  } catch (error) {
    showError(error.message);
  } finally {
    els.hunt.disabled = false;
    els.hunt.classList.remove("loading");
    els.hunt.innerHTML = '<span class="button-icon">⌁</span> Hunt';
  }
}

els.load?.addEventListener("click", () => loadSequence(els.input.value));
els.hunt?.addEventListener("click", hunt);
els.input?.addEventListener("input", () => {
  const sequence = escapeSequence(els.input.value);
  els.inputMeta.textContent = sequence ? `${sequence.length.toLocaleString()} bases in editor` : "Select a sequence to begin";
});
els.file?.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  els.input.value = await file.text();
  els.inputMeta.textContent = `${file.name} loaded`;
  loadSequence(els.input.value, file.name.replace(/\.[^.]+$/, ""));
});

renderSyntheticList();
renderCategoryPills();
selectSynthetic(SYNTHETIC_SEQUENCES[0]);
