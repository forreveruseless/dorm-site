const SUPABASE_URL = "https://hfebhndlidsavyqfoefg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YEoNohmYRLLmfTb-qug_SQ_CpuYBk2D";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

const levels = [
  { level: "1.5", block: 1, type: "half" },
  { level: "2", block: 2, type: "full" },
  { level: "2.5", block: 3, type: "half" },
  { level: "3", block: 4, type: "full" },
  { level: "3.5", block: 5, type: "half" },
  { level: "4", block: 6, type: "full" },
  { level: "4.5", block: 7, type: "half" },
  { level: "5", block: 8, type: "full" },
  { level: "5.5", block: 9, type: "half" },
  { level: "6", block: 10, type: "full" },
  { level: "6.5", block: 11, type: "half" },
  { level: "7", block: 12, type: "full" },
  { level: "7.5", block: 13, type: "half" },
  { level: "8", block: 14, type: "full" },
  { level: "8.5", block: 15, type: "half" },
  { level: "9", block: 16, type: "full" }
];

const wingNames = {
  left: { full: "Левое крыло", short: "Левое", code: "L", upper: "ЛЕВОЕ КРЫЛО" },
  right: { full: "Правое крыло", short: "Правое", code: "R", upper: "ПРАВОЕ КРЫЛО" }
};

const state = {
  section: "dorm",
  screen: "home",
  wing: null,
  selectedIndex: 0,
  selectedRoom: null,
  highlightedRoom: null,
  calendarDate: new Date(),
  roomCache: new Map(),
  calendarEvents: [],
  roomLinks: [],
  linksDbReady: false,
  graphSimulation: null,
  graphZoom: null,
  connectionDraft: {
    source: null,
    target: null,
    type: "close",
    pickerWing: "left",
    pickerIndex: 0
  }
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const screens = {
  home: $("#homeScreen"),
  wing: $("#wingScreen"),
  floor: $("#floorScreen")
};

function currentLevel() {
  return levels[state.selectedIndex];
}

function roomCacheKey(wing, block, room) {
  return `${wing}:${block}:${room}`;
}

function setSyncStatus(mode, text) {
  const indicator = $("#syncIndicator");
  const label = $("#syncText");
  if (!indicator || !label) return;

  indicator.classList.remove("is-ok", "is-error", "is-loading");
  indicator.classList.add(`is-${mode}`);
  label.textContent = text;
}

function showDbError(error, fallbackText = "Ошибка общей базы") {
  console.error(error);
  const detail = error?.message ? `: ${error.message}` : "";
  setSyncStatus("error", fallbackText);
  return detail;
}

async function testDatabaseConnection() {
  setSyncStatus("loading", "Подключение к общей базе…");

  const { error } = await db
    .from("room_data")
    .select("wing")
    .limit(1);

  if (error) {
    showDbError(error, "База не подключена");
    return false;
  }

  setSyncStatus("ok", "Общая база подключена");
  return true;
}

function showSection(section) {
  state.section = section;

  const dorm = section === "dorm";
  const calendar = section === "calendar";
  const relations = section === "relations";

  $("#dormApp").style.display = dorm ? "block" : "none";
  $("#calendarScreen").classList.toggle("is-active", calendar);
  $("#relationsScreen").classList.toggle("is-active", relations);

  $("#dormTab").classList.toggle("is-active", dorm);
  $("#calendarTab").classList.toggle("is-active", calendar);
  $("#relationsTab").classList.toggle("is-active", relations);

  $(".breadcrumbs").style.visibility = dorm ? "visible" : "hidden";

  if (dorm) {
    showScreen(state.screen);
  } else if (calendar) {
    renderCalendar();
    void refreshCalendarEvents();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (relations) {
    renderRelationsGraph();
    void refreshRoomLinks();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function showScreen(name) {
  state.screen = name;
  Object.entries(screens).forEach(([key, el]) => el.classList.toggle("is-active", key === name));

  $("#crumbHome").classList.toggle("is-active", name === "home");
  $("#crumbWing").classList.toggle("is-active", name === "wing");
  $("#crumbBlock").classList.toggle("is-active", name === "floor");

  $("#crumbWing").disabled = !state.wing;
  $("#crumbBlock").disabled = !state.wing;

  if (name === "floor" && state.wing) {
    void refreshCurrentBlockRoomData();
  }

  if (state.section === "dorm") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function selectWing(wing) {
  state.wing = wing;
  state.selectedIndex = 0;
  state.highlightedRoom = null;
  renderWingScreen();
  renderFloorScreen();
  showScreen("wing");
}

function renderWingScreen() {
  if (!state.wing) return;

  const info = wingNames[state.wing];
  $("#wingHeading").textContent = info.full;
  $("#wingBadge").textContent = info.upper;

  const fullFloors = levels.filter(item => item.type === "full");
  const halfFloors = levels.filter(item => item.type === "half");

  $("#fullFloors").innerHTML = fullFloors.map(item => {
    const index = levels.findIndex(x => x.block === item.block);
    return `
      <button class="floor-pill floor-pill--full ${index === state.selectedIndex ? "is-active" : ""}"
              style="top:${getTopPosition(index)}%"
              data-index="${index}">
        <span class="pill-level">${item.level}</span>
        <span class="pill-meta">блок ${item.block}</span>
      </button>
    `;
  }).join("");

  $("#halfFloors").innerHTML = halfFloors.map(item => {
    const index = levels.findIndex(x => x.block === item.block);
    return `
      <button class="floor-pill floor-pill--half ${index === state.selectedIndex ? "is-active" : ""}"
              style="top:${getTopPosition(index)}%"
              data-index="${index}">
        <span class="pill-level">${item.level}</span>
        <span class="pill-meta">блок ${item.block}</span>
      </button>
    `;
  }).join("");

  $$("[data-index]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedIndex = Number(btn.dataset.index);
      state.highlightedRoom = null;
      renderWingScreen();
      renderFloorScreen();
      showScreen("floor");
    });
  });
}

function getTopPosition(index) {
  const totalSteps = levels.length - 1;
  const reversed = totalSteps - index;
  return reversed * (100 / levels.length) + 1.2;
}

function roomCode(roomNum) {
  const wingCode = wingNames[state.wing].code;
  const block = String(currentLevel().block).padStart(2, "0");
  return `${wingCode}${block}-${roomNum}`;
}

function calendarRoomLabel(wing, level, roomNum) {
  const wingCode = wingNames[wing].code;
  return `${wingCode}-${level}-${roomNum}`;
}

function renderFloorScreen() {
  if (!state.wing) return;

  const info = wingNames[state.wing];
  const item = currentLevel();

  $("#floorHeading").textContent = `${info.full} · блок ${item.block}`;
  $("#floorSubheading").textContent = `Этаж ${item.level} · 8 комнат`;
  $("#blockChip").textContent = `Блок ${item.block}`;

  $("#miniBlocks").innerHTML = levels.map((levelItem, index) => `
    <button class="mini-block-btn ${index === state.selectedIndex ? "is-active" : ""}" data-mini-index="${index}">
      <span class="mini-floor-main">${levelItem.level} этаж</span>
      <span class="mini-block-secondary">блок ${levelItem.block}</span>
    </button>
  `).join("");

  $$("[data-mini-index]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedIndex = Number(btn.dataset.miniIndex);
      state.highlightedRoom = null;
      renderFloorScreen();
      renderWingScreen();
      void refreshCurrentBlockRoomData();
    });
  });

  updateRoomVisuals();

  $$("[data-room]").forEach(btn => {
    btn.onclick = () => void openRoom(Number(btn.dataset.room));
  });
}

function getCachedRoomData(roomNum) {
  if (!state.wing) return { notes: "", colorValue: 0 };

  const key = roomCacheKey(state.wing, currentLevel().block, roomNum);
  return state.roomCache.get(key) || { notes: "", colorValue: 0 };
}

async function refreshCurrentBlockRoomData() {
  if (!state.wing) return false;

  const wing = state.wing;
  const item = currentLevel();
  const block = item.block;

  setSyncStatus("loading", "Обновляю данные комнат…");

  const { data, error } = await db
    .from("room_data")
    .select("wing, block, level, room, notes, color_value")
    .eq("wing", wing)
    .eq("block", block)
    .order("room", { ascending: true });

  if (error) {
    showDbError(error, "Не удалось загрузить комнаты");
    return false;
  }

  for (let room = 1; room <= 8; room++) {
    state.roomCache.set(
      roomCacheKey(wing, block, room),
      { notes: "", colorValue: 0 }
    );
  }

  for (const row of data || []) {
    state.roomCache.set(
      roomCacheKey(row.wing, Number(row.block), Number(row.room)),
      {
        notes: row.notes || "",
        colorValue: Number(row.color_value || 0)
      }
    );
  }

  if (state.wing === wing && currentLevel().block === block) {
    updateRoomVisuals();
  }

  setSyncStatus("ok", "Данные синхронизированы");
  return true;
}

async function saveRoomData(roomNum, roomData) {
  const item = currentLevel();
  const payload = {
    wing: state.wing,
    block: item.block,
    level: String(item.level),
    room: roomNum,
    notes: roomData.notes || "",
    color_value: Number(roomData.colorValue || 0),
    updated_at: new Date().toISOString()
  };

  const { error } = await db
    .from("room_data")
    .upsert(payload, { onConflict: "wing,block,room" });

  if (error) {
    throw error;
  }

  state.roomCache.set(
    roomCacheKey(state.wing, item.block, roomNum),
    {
      notes: payload.notes,
      colorValue: payload.color_value
    }
  );
}

function colorFromValue(value) {
  const hue = 120 - (Number(value) * 1.2);
  return `hsl(${hue} 66% 56%)`;
}

function updateRoomVisuals() {
  $$("[data-room]").forEach(btn => {
    const roomNum = Number(btn.dataset.room);
    const data = getCachedRoomData(roomNum);
    const color = colorFromValue(data.colorValue ?? 0);
    const hasCustom = Boolean(data.notes) || Number(data.colorValue) !== 0;

    btn.style.setProperty("--room-color", color);
    btn.classList.toggle("has-color", hasCustom);
    btn.classList.toggle(
      "calendar-highlight",
      Number(btn.dataset.room) === Number(state.highlightedRoom)
    );

    const stateLabel = btn.querySelector(".room-state");
    if (!stateLabel) return;

    if (data.notes && Number(data.colorValue) !== 0) {
      stateLabel.textContent = "есть заметка и цвет";
    } else if (data.notes) {
      stateLabel.textContent = "есть заметка";
    } else if (Number(data.colorValue) !== 0) {
      stateLabel.textContent = "цвет изменён";
    } else {
      stateLabel.textContent = "без отметки";
    }
  });
}

async function openRoom(roomNum) {
  state.selectedRoom = roomNum;
  state.highlightedRoom = null;
  updateRoomVisuals();

  await refreshCurrentBlockRoomData();

  const info = wingNames[state.wing];
  const item = currentLevel();
  const data = getCachedRoomData(roomNum);

  $("#dialogRoomCode").textContent = roomCode(roomNum);
  $("#dialogMeta").textContent = `${info.full} · блок ${item.block} · этаж ${item.level}`;
  $("#roomNotes").value = data.notes || "";
  $("#roomColor").value = data.colorValue ?? 0;

  $("#bookingDate").value = "";
  $("#bookingStart").value = "";
  $("#bookingEnd").value = "";
  $("#dialogMessage").textContent = "";
  $("#dialogMessage").className = "dialog-message";

  updateColorPreview();
  updateBookingPreview();

  $("#roomDialog").showModal();
}

function updateColorPreview() {
  $("#colorPreview").style.background = colorFromValue($("#roomColor").value);
}

/* События общего календаря */

function compactTime(value) {
  return String(value || "").slice(0, 5);
}

function normalizeCalendarEvent(row) {
  return {
    id: String(row.id),
    date: row.event_date,
    start: compactTime(row.start_time),
    end: compactTime(row.end_time),
    wing: row.wing,
    wingName: wingNames[row.wing]?.full || row.wing,
    level: String(row.level),
    block: Number(row.block),
    room: Number(row.room),
    calendarLabel: calendarRoomLabel(row.wing, row.level, row.room)
  };
}

async function refreshCalendarEvents() {
  setSyncStatus("loading", "Обновляю общий календарь…");

  const { data, error } = await db
    .from("calendar_events")
    .select("id, event_date, start_time, end_time, wing, block, level, room")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    showDbError(error, "Не удалось загрузить календарь");
    return false;
  }

  state.calendarEvents = (data || []).map(normalizeCalendarEvent);
  renderCalendar();
  setSyncStatus("ok", "Календарь синхронизирован");
  return true;
}

async function addCalendarEvent(event) {
  const payload = {
    event_date: event.date,
    start_time: event.start,
    end_time: event.end,
    wing: event.wing,
    block: event.block,
    level: String(event.level),
    room: event.room
  };

  const { data, error } = await db
    .from("calendar_events")
    .insert(payload)
    .select("id, event_date, start_time, end_time, wing, block, level, room")
    .single();

  if (error) {
    throw error;
  }

  state.calendarEvents.push(normalizeCalendarEvent(data));
  state.calendarEvents.sort((a, b) => {
    const aKey = `${a.date}T${a.start}`;
    const bKey = `${b.date}T${b.start}`;
    return aKey.localeCompare(bKey);
  });
}

function eventsForDate(dateKey) {
  return state.calendarEvents.filter(event => event.date === dateKey);
}

function dateKeyLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateRu(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

function updateBookingPreview() {
  const date = $("#bookingDate").value;
  const start = $("#bookingStart").value;
  const end = $("#bookingEnd").value;
  const preview = $("#bookingPreview");

  if (date && start && end && state.selectedRoom !== null) {
    preview.textContent =
      `${formatDateRu(date)} · ${start}–${end} · ` +
      `${calendarRoomLabel(state.wing, currentLevel().level, state.selectedRoom)}`;
    preview.classList.add("is-ready");
  } else {
    preview.textContent = "Выбери дату и время — запись появится в общем календаре.";
    preview.classList.remove("is-ready");
  }
}


/* ============================================================
   СВЯЗИ КОМНАТ
   ============================================================ */

const relationTypes = {
  close: {
    label: "Близкие",
    color: "#58dc76",
    width: 4.6,
    distance: 62,
    strength: 0.88
  },
  friends: {
    label: "Друзья",
    color: "#e8c94e",
    width: 2.9,
    distance: 98,
    strength: 0.58
  },
  acquaintances: {
    label: "Знакомые",
    color: "#ef664f",
    width: 1.55,
    distance: 145,
    strength: 0.34
  }
};

function relationRoomKey(wing, level, room) {
  return `${wing}|${level}|${room}`;
}

function parseRelationRoomKey(key) {
  const [wing, level, roomRaw] = String(key).split("|");
  const index = levels.findIndex(item => String(item.level) === String(level));
  const levelItem = index >= 0 ? levels[index] : null;

  return {
    key,
    wing,
    level: String(level),
    room: Number(roomRaw),
    block: levelItem ? levelItem.block : null,
    index
  };
}

function relationRoomLabel(roomLike) {
  const room = typeof roomLike === "string"
    ? parseRelationRoomKey(roomLike)
    : roomLike;

  const wingCode = wingNames[room.wing]?.code || "?";
  return `${wingCode}-${room.level}-${room.room}`;
}

function roomDescriptor(wing, level, room) {
  const index = levels.findIndex(item => String(item.level) === String(level));
  return {
    wing,
    level: String(level),
    room: Number(room),
    block: index >= 0 ? levels[index].block : null,
    index
  };
}

function canonicalRelationPair(source, target) {
  const sourceKey = relationRoomKey(source.wing, source.level, source.room);
  const targetKey = relationRoomKey(target.wing, target.level, target.room);
  return [sourceKey, targetKey].sort((a, b) => a.localeCompare(b));
}

async function testLinksTable() {
  const { error } = await db
    .from("room_links")
    .select("room_a")
    .limit(1);

  state.linksDbReady = !error;

  const notice = $("#relationsSetupNotice");
  if (notice) notice.hidden = state.linksDbReady;

  return state.linksDbReady;
}

async function refreshRoomLinks() {
  const loading = $("#graphLoading");
  if (loading) loading.classList.remove("is-hidden");

  if (!state.linksDbReady) {
    const ready = await testLinksTable();
    if (!ready) {
      state.roomLinks = [];
      renderRelationsGraph();
      if (loading) loading.classList.add("is-hidden");
      return false;
    }
  }

  const { data, error } = await db
    .from("room_links")
    .select("room_a, room_b, relation_type, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    state.linksDbReady = false;
    const notice = $("#relationsSetupNotice");
    if (notice) notice.hidden = false;
    if (loading) loading.classList.add("is-hidden");
    return false;
  }

  state.roomLinks = (data || []).map(row => ({
    source: row.room_a,
    target: row.room_b,
    type: row.relation_type
  }));

  $("#relationsLinksCount").textContent = state.roomLinks.length;
  if (loading) loading.classList.add("is-hidden");

  if (state.section === "relations") {
    renderRelationsGraph();
  }
  return true;
}

async function saveRoomLink(source, target, relationType) {
  if (!state.linksDbReady) {
    const ready = await testLinksTable();
    if (!ready) throw new Error("room_links table is not configured");
  }

  const [roomA, roomB] = canonicalRelationPair(source, target);
  if (roomA === roomB) throw new Error("Нельзя связать комнату саму с собой.");

  const payload = {
    room_a: roomA,
    room_b: roomB,
    relation_type: relationType,
    updated_at: new Date().toISOString()
  };

  const { error } = await db
    .from("room_links")
    .upsert(payload, { onConflict: "room_a,room_b" });

  if (error) throw error;

  await refreshRoomLinks();
}

function allRelationNodes() {
  const nodes = [];

  ["left", "right"].forEach((wing, wingIndex) => {
    levels.forEach((levelItem, levelIndex) => {
      for (let room = 1; room <= 8; room++) {
        nodes.push({
          id: relationRoomKey(wing, levelItem.level, room),
          wing,
          level: String(levelItem.level),
          levelIndex,
          block: levelItem.block,
          room,
          degree: 0,
          radius: 4.3,
          x: wingIndex === 0 ? 360 + room * 4 : 760 + room * 4,
          y: 90 + levelIndex * 32 + (room % 4) * 5
        });
      }
    });
  });

  return nodes;
}

function graphPath(link) {
  const sx = link.source.x;
  const sy = link.source.y;
  const tx = link.target.x;
  const ty = link.target.y;
  const dx = tx - sx;
  const dy = ty - sy;
  const dr = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / dr;
  const ny = dx / dr;
  const bend =
    link.type === "close" ? 7 :
    link.type === "friends" ? 12 : 18;

  const mx = (sx + tx) / 2 + nx * bend;
  const my = (sy + ty) / 2 + ny * bend;
  return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
}

function renderRelationsGraph(resetTransform = false) {
  const svgEl = $("#relationsGraph");
  const stage = $("#relationsGraphStage");
  if (!svgEl || !stage || !window.d3) return;

  const loading = $("#graphLoading");
  if (loading) loading.classList.add("is-hidden");

  if (state.graphSimulation) {
    state.graphSimulation.stop();
    state.graphSimulation = null;
  }

  const rect = stage.getBoundingClientRect();
  const width = Math.max(760, rect.width || 1050);
  const height = Math.max(560, rect.height || 680);

  const nodes = allRelationNodes();
  const nodeById = new Map(nodes.map(node => [node.id, node]));

  const links = state.roomLinks
    .filter(link => nodeById.has(link.source) && nodeById.has(link.target))
    .map(link => ({ ...link }));

  links.forEach(link => {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    if (source) source.degree += 1;
    if (target) target.degree += 1;
  });

  nodes.forEach(node => {
    node.radius = node.degree > 0
      ? Math.min(10.5, 5.8 + Math.sqrt(node.degree) * 1.35)
      : 3.7;
  });

  $("#relationsRoomsCount").textContent = nodes.length;
  $("#relationsLinksCount").textContent = links.length;

  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const viewport = svg.append("g").attr("class", "graph-viewport");

  const linkSelection = viewport
    .append("g")
    .attr("class", "graph-links")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "graph-link")
    .attr("stroke", d => relationTypes[d.type]?.color || "#718096")
    .attr("stroke-width", d => relationTypes[d.type]?.width || 1.5)
    .attr("stroke-opacity", d => d.type === "close" ? .76 : d.type === "friends" ? .64 : .48);

  const nodeGroup = viewport
    .append("g")
    .attr("class", "graph-nodes")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "graph-node");

  nodeGroup
    .append("circle")
    .attr("class", "graph-node-halo")
    .attr("r", d => d.radius + 3.5);

  nodeGroup
    .append("circle")
    .attr("r", d => d.radius)
    .attr("fill", d => {
      if (d.degree === 0) return "#425168";
      return d.wing === "left" ? "#d7e7f3" : "#c8d5e4";
    })
    .attr("stroke", d => d.degree > 0 ? "#0b1119" : "#263246")
    .attr("stroke-width", d => d.degree > 0 ? 1.5 : 1);

  nodeGroup.on("click", (event, node) => {
    event.stopPropagation();
    openConnectionDialog(node);
  });

  const tooltip = $("#graphTooltip");

  nodeGroup
    .on("mouseenter", (event, node) => {
      if (!tooltip) return;
      tooltip.textContent =
        `${relationRoomLabel(node)} · ${wingNames[node.wing].full} · блок ${node.block}`;
      tooltip.classList.add("is-visible");
    })
    .on("mousemove", (event) => {
      if (!tooltip) return;
      const bounds = stage.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - bounds.left}px`;
      tooltip.style.top = `${event.clientY - bounds.top}px`;
    })
    .on("mouseleave", () => {
      if (tooltip) tooltip.classList.remove("is-visible");
    });

  const zoom = d3.zoom()
    .scaleExtent([0.28, 3.4])
    .on("zoom", (event) => viewport.attr("transform", event.transform));

  svg.call(zoom);
  state.graphZoom = { svg, zoom };

  if (resetTransform) {
    svg.call(zoom.transform, d3.zoomIdentity);
  }

  const simulation = d3.forceSimulation(nodes)
    .alphaDecay(0.026)
    .velocityDecay(0.34)
    .force(
      "link",
      d3.forceLink(links)
        .id(d => d.id)
        .distance(d => relationTypes[d.type]?.distance || 120)
        .strength(d => relationTypes[d.type]?.strength || .4)
    )
    .force(
      "charge",
      d3.forceManyBody().strength(d => d.degree > 0 ? -54 : -12)
    )
    .force(
      "collide",
      d3.forceCollide().radius(d => d.radius + (d.degree > 0 ? 5 : 2.2)).iterations(2)
    )
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force(
      "x",
      d3.forceX(d => d.wing === "left" ? width * .42 : width * .58)
        .strength(d => d.degree > 0 ? .012 : .035)
    )
    .force(
      "y",
      d3.forceY(d => {
        const levelRatio = d.levelIndex / Math.max(1, levels.length - 1);
        return height * .18 + levelRatio * height * .64;
      }).strength(d => d.degree > 0 ? .004 : .024)
    )
    .on("tick", () => {
      linkSelection.attr("d", graphPath);
      nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });

  state.graphSimulation = simulation;

  const drag = d3.drag()
    .on("start", (event, d) => {
      if (!event.active) simulation.alphaTarget(.22).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });

  nodeGroup.call(drag);
}

function resetRelationsView() {
  if (state.graphZoom?.svg && state.graphZoom?.zoom) {
    state.graphZoom.svg
      .transition()
      .duration(260)
      .call(state.graphZoom.zoom.transform, d3.zoomIdentity);
  }
  if (state.graphSimulation) {
    state.graphSimulation.alpha(.65).restart();
  }
}

function openConnectionDialog(source) {
  const sourceRoom = roomDescriptor(source.wing, source.level, source.room);
  if (sourceRoom.index < 0) return;

  state.connectionDraft = {
    source: sourceRoom,
    target: null,
    type: "close",
    pickerWing: sourceRoom.wing,
    pickerIndex: sourceRoom.index
  };

  $("#connectionSourceLabel").textContent = relationRoomLabel(sourceRoom);
  $("#connectionTargetLabel").textContent = "не выбрана";
  $("#connectionTargetLabel").classList.remove("is-selected");
  $("#connectionMessage").textContent = "";
  $("#connectionSaveBtn").disabled = true;

  $$("[data-relation-type]").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.relationType === "close");
  });

  renderConnectionPicker();

  if ($("#roomDialog").open) $("#roomDialog").close();
  $("#connectionDialog").showModal();
}

function renderConnectionPicker() {
  const draft = state.connectionDraft;
  const levelItem = levels[draft.pickerIndex];

  $$("[data-picker-wing]").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.pickerWing === draft.pickerWing);
  });

  $("#connectionFloorList").innerHTML = levels.map((item, index) => `
    <button
      class="connection-floor-btn ${index === draft.pickerIndex ? "is-active" : ""}"
      data-connection-floor="${index}"
    >
      ${item.level}
    </button>
  `).join("");

  $$("[data-connection-floor]").forEach(btn => {
    btn.addEventListener("click", () => {
      draft.pickerIndex = Number(btn.dataset.connectionFloor);
      draft.target = null;
      updateConnectionTargetUI();
      renderConnectionPicker();
    });
  });

  const roomButton = room => {
    const candidate = roomDescriptor(
      draft.pickerWing,
      levelItem.level,
      room
    );

    const sameAsSource =
      candidate.wing === draft.source.wing &&
      String(candidate.level) === String(draft.source.level) &&
      candidate.room === draft.source.room;

    const selected =
      draft.target &&
      candidate.wing === draft.target.wing &&
      String(candidate.level) === String(draft.target.level) &&
      candidate.room === draft.target.room;

    return `
      <button
        class="connection-room-btn ${sameAsSource ? "is-source" : ""} ${selected ? "is-selected" : ""}"
        data-connection-room="${room}"
        ${sameAsSource ? "disabled" : ""}
      >
        ${relationRoomLabel(candidate)}
      </button>
    `;
  };

  $("#connectionRoomsTop").innerHTML = [1,2,3,4].map(roomButton).join("");
  $("#connectionRoomsBottom").innerHTML = [8,7,6,5].map(roomButton).join("");

  $$("[data-connection-room]").forEach(btn => {
    btn.addEventListener("click", () => {
      const room = Number(btn.dataset.connectionRoom);
      draft.target = roomDescriptor(
        draft.pickerWing,
        levels[draft.pickerIndex].level,
        room
      );
      updateConnectionTargetUI();
      renderConnectionPicker();
    });
  });
}

function updateConnectionTargetUI() {
  const target = state.connectionDraft.target;
  const label = $("#connectionTargetLabel");
  const save = $("#connectionSaveBtn");

  if (target) {
    label.textContent = relationRoomLabel(target);
    label.classList.add("is-selected");
    save.disabled = false;
  } else {
    label.textContent = "не выбрана";
    label.classList.remove("is-selected");
    save.disabled = true;
  }
}


/* Календарь */

const monthNames = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
];

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function renderCalendar() {
  const view = state.calendarDate;
  const year = view.getFullYear();
  const month = view.getMonth();

  $("#monthTitle").textContent = `${monthNames[month]} ${year}`;
  $("#yearTitle").textContent = year;

  const first = new Date(year, month, 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayIndex);

  const today = new Date();
  const cells = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const otherMonth = d.getMonth() !== month;
    const isToday = sameDate(d, today);
    const dateKey = dateKeyLocal(d);
    const dayEvents = eventsForDate(dateKey);

    const eventMarkup = dayEvents.map(event => `
      <button
        class="calendar-event"
        data-calendar-event-id="${event.id}"
        title="${event.wingName} · этаж ${event.level} · блок ${event.block} · комната ${event.room}"
      >
        <span class="calendar-event-time">${event.start}–${event.end}</span>
        <span class="calendar-event-room">${event.calendarLabel}</span>
      </button>
    `).join("");

    cells.push(`
      <div class="calendar-day ${otherMonth ? "other-month" : ""} ${isToday ? "today" : ""}">
        <span class="day-number">${d.getDate()}</span>
        ${isToday ? '<span class="today-badge">сегодня</span>' : ''}
        <div class="calendar-events">${eventMarkup}</div>
      </div>
    `);
  }

  $("#calendarGrid").innerHTML = cells.join("");

  $$("[data-calendar-event-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const event = state.calendarEvents.find(
        item => item.id === btn.dataset.calendarEventId
      );
      if (!event) return;
      openCalendarEvent(event);
    });
  });
}

function openCalendarEvent(event) {
  const levelIndex = levels.findIndex(item =>
    String(item.level) === String(event.level) &&
    Number(item.block) === Number(event.block)
  );

  if (levelIndex < 0 || !wingNames[event.wing]) return;

  state.wing = event.wing;
  state.selectedIndex = levelIndex;
  state.selectedRoom = null;
  state.highlightedRoom = Number(event.room);

  renderWingScreen();
  renderFloorScreen();
  showSection("dorm");
  showScreen("floor");

  requestAnimationFrame(() => {
    const room = document.querySelector(`[data-room="${event.room}"]`);
    if (room) {
      room.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

function setSaveBusy(busy) {
  const button = $("#dialogSave");
  if (!button) return;

  button.disabled = busy;
  button.textContent = busy ? "Сохраняю…" : "Сохранить";
}

$("#roomColor").addEventListener("input", updateColorPreview);
$("#bookingDate").addEventListener("input", updateBookingPreview);
$("#bookingStart").addEventListener("input", updateBookingPreview);
$("#bookingEnd").addEventListener("input", updateBookingPreview);

$("#dialogSave").addEventListener("click", async () => {
  if (state.selectedRoom === null) return;

  const date = $("#bookingDate").value;
  const start = $("#bookingStart").value;
  const end = $("#bookingEnd").value;
  const hasAnyBookingField = Boolean(date || start || end);

  $("#dialogMessage").textContent = "";
  $("#dialogMessage").className = "dialog-message";

  if (hasAnyBookingField) {
    if (!date || !start || !end) {
      $("#dialogMessage").textContent =
        "Для календаря выбери дату, время начала и время окончания.";
      $("#dialogMessage").className = "dialog-message is-error";
      return;
    }

    if (end <= start) {
      $("#dialogMessage").textContent =
        "Время окончания должно быть позже времени начала.";
      $("#dialogMessage").className = "dialog-message is-error";
      return;
    }
  }

  setSaveBusy(true);
  setSyncStatus("loading", "Сохраняю в общую базу…");

  try {
    const selectedRoom = state.selectedRoom;
    const item = currentLevel();
    const wing = state.wing;

    await saveRoomData(selectedRoom, {
      notes: $("#roomNotes").value.trim(),
      colorValue: Number($("#roomColor").value)
    });

    if (hasAnyBookingField) {
      await addCalendarEvent({
        date,
        start,
        end,
        wing,
        level: item.level,
        block: item.block,
        room: selectedRoom
      });

      const [year, month] = date.split("-").map(Number);
      state.calendarDate = new Date(year, month - 1, 1);
      renderCalendar();
    }

    updateRoomVisuals();
    setSyncStatus("ok", "Изменения сохранены для всех");
    $("#roomDialog").close();
  } catch (error) {
    console.error(error);
    $("#dialogMessage").textContent =
      "Не получилось сохранить в общую базу. Проверь подключение Supabase.";
    $("#dialogMessage").className = "dialog-message is-error";
    setSyncStatus("error", "Ошибка сохранения");
  } finally {
    setSaveBusy(false);
  }
});

$$("[data-wing]").forEach(btn =>
  btn.addEventListener("click", () => selectWing(btn.dataset.wing))
);

$("#homeBtn").addEventListener("click", () => {
  showSection("dorm");
  showScreen("home");
});

$("#dormTab").addEventListener("click", () => showSection("dorm"));
$("#calendarTab").addEventListener("click", () => showSection("calendar"));
$("#relationsTab").addEventListener("click", () => showSection("relations"));

$("#crumbHome").addEventListener("click", () => showScreen("home"));
$("#crumbWing").addEventListener("click", () => state.wing && showScreen("wing"));
$("#crumbBlock").addEventListener("click", () => state.wing && showScreen("floor"));

$("#changeWingBtn").addEventListener("click", () => showScreen("home"));
$("#backToBuildingBtn").addEventListener("click", () => showScreen("wing"));
$("#goHomeBtn").addEventListener("click", () => showScreen("home"));


$("#newRelationBtn").addEventListener("click", () => {
  if (!state.wing || state.selectedRoom === null) return;
  const item = currentLevel();
  openConnectionDialog({
    wing: state.wing,
    level: item.level,
    room: state.selectedRoom
  });
});

$("#connectionDialogClose").addEventListener("click", () => {
  $("#connectionDialog").close();
});

$$("[data-relation-type]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.connectionDraft.type = btn.dataset.relationType;
    $$("[data-relation-type]").forEach(item => {
      item.classList.toggle("is-active", item === btn);
    });
  });
});

$$("[data-picker-wing]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.connectionDraft.pickerWing = btn.dataset.pickerWing;
    state.connectionDraft.target = null;
    updateConnectionTargetUI();
    renderConnectionPicker();
  });
});

$("#connectionSaveBtn").addEventListener("click", async () => {
  const draft = state.connectionDraft;
  const message = $("#connectionMessage");
  if (!draft.source || !draft.target) return;

  message.textContent = "";
  $("#connectionSaveBtn").disabled = true;
  $("#connectionSaveBtn").textContent = "Сохраняю…";
  setSyncStatus("loading", "Сохраняю связь…");

  try {
    await saveRoomLink(draft.source, draft.target, draft.type);
    setSyncStatus("ok", "Связь сохранена для всех");
    $("#connectionDialog").close();

    if (state.section === "relations") {
      renderRelationsGraph();
    }
  } catch (error) {
    console.error(error);
    if (!state.linksDbReady) {
      message.textContent =
        "Таблица связей ещё не создана в Supabase. Запусти SUPABASE_RELATIONS_SETUP.sql.";
    } else {
      message.textContent = "Не получилось сохранить связь. Попробуй ещё раз.";
    }
    setSyncStatus("error", "Ошибка сохранения связи");
  } finally {
    $("#connectionSaveBtn").textContent = "Создать связь";
    $("#connectionSaveBtn").disabled = !state.connectionDraft.target;
  }
});

$("#relationsRefreshBtn").addEventListener("click", () => void refreshRoomLinks());
$("#relationsResetViewBtn").addEventListener("click", resetRelationsView);

$("#connectionDialog").addEventListener("click", (e) => {
  const rect = $("#connectionDialog").getBoundingClientRect();
  const isInside =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom;

  if (!isInside) $("#connectionDialog").close();
});


$("#dialogClose").addEventListener("click", () => $("#roomDialog").close());

$("#roomDialog").addEventListener("click", (e) => {
  const rect = $("#roomDialog").getBoundingClientRect();
  const isInside =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom;

  if (!isInside) $("#roomDialog").close();
});

$("#prevMonth").addEventListener("click", () => {
  state.calendarDate = new Date(
    state.calendarDate.getFullYear(),
    state.calendarDate.getMonth() - 1,
    1
  );
  renderCalendar();
  void refreshCalendarEvents();
});

$("#nextMonth").addEventListener("click", () => {
  state.calendarDate = new Date(
    state.calendarDate.getFullYear(),
    state.calendarDate.getMonth() + 1,
    1
  );
  renderCalendar();
  void refreshCalendarEvents();
});

$("#todayBtn").addEventListener("click", () => {
  state.calendarDate = new Date();
  renderCalendar();
  void refreshCalendarEvents();
});

/* Автообновление общей базы, чтобы изменения других людей подтягивались без F5 */
setInterval(() => {
  if (document.visibilityState !== "visible") return;

  if (state.section === "calendar") {
    void refreshCalendarEvents();
  } else if (state.section === "relations") {
    void refreshRoomLinks();
  } else if (state.section === "dorm" && state.screen === "floor" && state.wing) {
    void refreshCurrentBlockRoomData();
  }
}, 20000);

async function bootstrap() {
  renderCalendar();

  const connected = await testDatabaseConnection();
  if (!connected) return;

  await refreshCalendarEvents();
  await testLinksTable();
  if (state.linksDbReady) {
    await refreshRoomLinks();
  } else {
    renderRelationsGraph();
  }
}

void bootstrap();
