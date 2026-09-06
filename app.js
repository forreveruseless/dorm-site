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
  calendarDate: new Date()
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

function storageKey(roomNum) {
  return `dorm:${state.wing}:block${currentLevel().block}:room${roomNum}`;
}

function showSection(section) {
  state.section = section;
  const dorm = section === "dorm";

  $("#dormApp").style.display = dorm ? "block" : "none";
  $("#calendarScreen").classList.toggle("is-active", !dorm);
  $("#dormTab").classList.toggle("is-active", dorm);
  $("#calendarTab").classList.toggle("is-active", !dorm);
  $(".breadcrumbs").style.visibility = dorm ? "visible" : "hidden";

  if (dorm) {
    showScreen(state.screen);
  } else {
    renderCalendar();
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

  if (state.section === "dorm") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function selectWing(wing) {
  state.wing = wing;
  state.selectedIndex = 0;
  renderWingScreen();
  renderFloorScreen();
  showScreen("wing");
}

function renderWingScreen() {
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
      renderFloorScreen();
      renderWingScreen();
    });
  });

  updateRoomVisuals();

  $$("[data-room]").forEach(btn => {
    btn.onclick = () => openRoom(Number(btn.dataset.room));
  });
}

function loadRoomData(roomNum) {
  try {
    const saved = localStorage.getItem(storageKey(roomNum));
    return saved ? JSON.parse(saved) : { notes: "", colorValue: 0 };
  } catch {
    return { notes: "", colorValue: 0 };
  }
}

function saveRoomData(roomNum, data) {
  localStorage.setItem(storageKey(roomNum), JSON.stringify(data));
}

function colorFromValue(value) {
  const hue = 120 - (Number(value) * 1.2);
  return `hsl(${hue} 66% 56%)`;
}

function updateRoomVisuals() {
  $$("[data-room]").forEach(btn => {
    const roomNum = Number(btn.dataset.room);
    const data = loadRoomData(roomNum);
    const color = colorFromValue(data.colorValue ?? 0);
    const hasCustom = Boolean(data.notes) || Number(data.colorValue) !== 0;

    btn.style.setProperty("--room-color", color);
    btn.classList.toggle("has-color", hasCustom);
    btn.classList.toggle("calendar-highlight", Number(btn.dataset.room) === Number(state.highlightedRoom));

    const stateLabel = btn.querySelector(".room-state");
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

function openRoom(roomNum) {
  state.selectedRoom = roomNum;
  state.highlightedRoom = null;
  updateRoomVisuals();
  const info = wingNames[state.wing];
  const item = currentLevel();
  const data = loadRoomData(roomNum);

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

/* События календаря */
const EVENTS_STORAGE_KEY = "dorm:calendarEvents";

function loadCalendarEvents() {
  try {
    const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCalendarEvents(events) {
  localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
}

function addCalendarEvent(event) {
  const events = loadCalendarEvents();
  events.push(event);
  events.sort((a, b) => {
    const aKey = `${a.date}T${a.start}`;
    const bKey = `${b.date}T${b.start}`;
    return aKey.localeCompare(bKey);
  });
  saveCalendarEvents(events);
}

function eventsForDate(dateKey) {
  return loadCalendarEvents().filter(event => event.date === dateKey);
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
    preview.textContent = `${formatDateRu(date)} · ${start}–${end} · ${calendarRoomLabel(state.wing, currentLevel().level, state.selectedRoom)}`;
    preview.classList.add("is-ready");
  } else {
    preview.textContent = "Выбери дату и время — запись появится в общем календаре.";
    preview.classList.remove("is-ready");
  }
}

/* Календарь */
const monthNames = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
];

function sameDate(a,b){
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
    const eventMarkup = dayEvents.map(event => {
      const label = event.calendarLabel || calendarRoomLabel(event.wing, event.level, event.room);
      return `
        <button
          class="calendar-event"
          data-calendar-event-id="${event.id}"
          title="${event.wingName} · этаж ${event.level} · блок ${event.block} · комната ${event.room}"
        >
          <span class="calendar-event-time">${event.start}–${event.end}</span>
          <span class="calendar-event-room">${label}</span>
        </button>
      `;
    }).join("");

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
      const event = loadCalendarEvents().find(item => item.id === btn.dataset.calendarEventId);
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

$("#roomColor").addEventListener("input", updateColorPreview);
$("#bookingDate").addEventListener("input", updateBookingPreview);
$("#bookingStart").addEventListener("input", updateBookingPreview);
$("#bookingEnd").addEventListener("input", updateBookingPreview);

$("#dialogSave").addEventListener("click", () => {
  if (state.selectedRoom === null) return;

  saveRoomData(state.selectedRoom, {
    notes: $("#roomNotes").value.trim(),
    colorValue: Number($("#roomColor").value)
  });

  const date = $("#bookingDate").value;
  const start = $("#bookingStart").value;
  const end = $("#bookingEnd").value;
  const hasAnyBookingField = Boolean(date || start || end);

  if (hasAnyBookingField) {
    if (!date || !start || !end) {
      $("#dialogMessage").textContent = "Для календаря выбери дату, время начала и время окончания.";
      $("#dialogMessage").className = "dialog-message is-error";
      return;
    }

    if (end <= start) {
      $("#dialogMessage").textContent = "Время окончания должно быть позже времени начала.";
      $("#dialogMessage").className = "dialog-message is-error";
      return;
    }

    const item = currentLevel();
    const wingInfo = wingNames[state.wing];

    addCalendarEvent({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      start,
      end,
      roomCode: roomCode(state.selectedRoom),
      calendarLabel: calendarRoomLabel(state.wing, item.level, state.selectedRoom),
      wing: state.wing,
      wingName: wingInfo.full,
      level: item.level,
      block: item.block,
      room: state.selectedRoom
    });

    // Если событие сохранено в другом месяце, при открытии календаря сразу покажем его месяц.
    const [year, month] = date.split("-").map(Number);
    state.calendarDate = new Date(year, month - 1, 1);
    renderCalendar();
  }

  updateRoomVisuals();
  $("#roomDialog").close();
});

$$("[data-wing]").forEach(btn => btn.addEventListener("click", () => selectWing(btn.dataset.wing)));

$("#homeBtn").addEventListener("click", () => {
  showSection("dorm");
  showScreen("home");
});

$("#dormTab").addEventListener("click", () => showSection("dorm"));
$("#calendarTab").addEventListener("click", () => showSection("calendar"));

$("#crumbHome").addEventListener("click", () => showScreen("home"));
$("#crumbWing").addEventListener("click", () => state.wing && showScreen("wing"));
$("#crumbBlock").addEventListener("click", () => state.wing && showScreen("floor"));

$("#changeWingBtn").addEventListener("click", () => showScreen("home"));
$("#backToBuildingBtn").addEventListener("click", () => showScreen("wing"));
$("#goHomeBtn").addEventListener("click", () => showScreen("home"));

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
});

$("#nextMonth").addEventListener("click", () => {
  state.calendarDate = new Date(
    state.calendarDate.getFullYear(),
    state.calendarDate.getMonth() + 1,
    1
  );
  renderCalendar();
});

$("#todayBtn").addEventListener("click", () => {
  state.calendarDate = new Date();
  renderCalendar();
});

renderCalendar();
