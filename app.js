const focusTasks = [
  { id: "task-card", color: "lilac-card", chip: "进行中", title: "整理开卡页首屏优化方案", project: "开卡页优化", deadline: "周五 18:00", hours: "2.5 小时", next: "把已记录的 3 个信息层级问题整理成方案草图。", action: "记录进展" },
  { id: "task-report", color: "lime-card", chip: "待开始", title: "补齐竞品分析结论与截图", project: "会员权益梳理", deadline: "明天 16:00", hours: "1.0 小时", next: "先确认对比维度，再补充两款竞品的权益入口。", action: "开始任务" },
  { id: "task-data", color: "cobalt-card", chip: "等待反馈", title: "核对活动数据口径", project: "九月活动复盘", deadline: "周四 12:00", hours: "1.0 小时", next: "跟进数据同学确认新客口径，收到反馈后继续。", action: "去跟进" }
];

let activeIndex = 0;
let dragStart = null;
const APP_KEY = "intern-task-console-v1";
const state = { tasks: [...focusTasks], logs: [], settings: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, dailyCapacity: null, reduceMotion: false }, updatedAt: Date.now() };

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_KEY, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("app");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persistState(label = "数据") {
  state.updatedAt = Date.now();
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("app", "readwrite");
      tx.objectStore("app").put(structuredClone(state), "state");
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    localStorage.setItem(`${APP_KEY}-version`, String(state.updatedAt));
    return true;
  } catch (error) {
    showToast(`保存失败，${label}仍保留在页面中`);
    return false;
  }
}

async function restoreState() {
  try {
    const db = await openDatabase();
    const saved = await new Promise((resolve, reject) => {
      const tx = db.transaction("app", "readonly");
      const request = tx.objectStore("app").get("state");
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    if (saved?.settings?.reduceMotion) document.body.classList.add("reduce-motion");
  } catch (_) { /* keep the visible sample state when storage is unavailable */ }
}

function cardTemplate(task, visualIndex) {
  return `<article class="focus-card ${task.color}" data-id="${task.id}" data-pos="${visualIndex}" aria-hidden="${visualIndex !== 0}">
    <div>
      <div class="card-top"><span class="card-number">重点 ${String(activeIndex + 1).padStart(2, "0")} / 03</span><span class="status-pill">${task.chip}</span></div>
      <h2>${task.title}</h2>
      <div class="next-step"><span>下一步</span>${task.next}</div>
    </div>
    <div class="card-bottom">
      <div class="deadline"><div><span>项目</span><strong>${task.project}</strong></div><div><span>截止</span><strong>${task.deadline}</strong></div><div><span>今日计划</span><strong>${task.hours}</strong></div></div>
      <button class="card-action" type="button" data-action="${task.id}">${task.action} ↗</button>
    </div>
  </article>`;
}

function renderDeck() {
  const deck = document.querySelector("#focus-deck");
  const ordered = focusTasks.map((_, offset) => focusTasks[(activeIndex + offset) % focusTasks.length]);
  deck.innerHTML = ordered.map(cardTemplate).join("");
  document.querySelector("#task-name-list").innerHTML = focusTasks.map((task, i) => `<button type="button" class="task-name-button ${i === activeIndex ? "active" : ""}" data-select="${i}" style="--card-color:${i === 0 ? "var(--lilac)" : i === 1 ? "var(--lime)" : "var(--cobalt)"}"><span class="n">0${i+1}</span><strong>${task.title}</strong><small>${task.hours}</small></button>`).join("");
  document.querySelector("#deck-dots").innerHTML = focusTasks.map((_, i) => `<button type="button" class="${i === activeIndex ? "active" : ""}" data-select="${i}" aria-label="切换到第 ${i+1} 项"></button>`).join("");
  bindCardActions();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function selectCard(index, direction = 1) {
  if (index === activeIndex) return;
  const front = document.querySelector('.focus-card[data-pos="0"]');
  if (front && !document.body.classList.contains("reduce-motion")) {
    front.style.transform = `translateX(${direction > 0 ? "-115%" : "115%"}) rotate(${direction > 0 ? "-7deg" : "7deg"})`;
    front.style.opacity = "0";
    window.setTimeout(() => { activeIndex = index; renderDeck(); }, 230);
  } else { activeIndex = index; renderDeck(); }
}

function bindCardActions() {
  document.querySelectorAll("[data-select]").forEach(el => el.addEventListener("click", () => selectCard(Number(el.dataset.select), Number(el.dataset.select) > activeIndex ? 1 : -1)));
  document.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", e => {
    e.stopPropagation();
    const task = focusTasks.find(item => item.id === el.dataset.action);
    if (task.chip === "等待反馈") navigateTo("waiting"); else openDrawer();
    showToast(task.chip === "等待反馈" ? "已打开该任务的跟进事项" : `已打开「${task.title}」的稳定编辑视图`);
  }));
  document.querySelector('.focus-card[data-pos="0"]')?.addEventListener("dblclick", openDrawer);
}

document.querySelector("#next-card").addEventListener("click", () => selectCard((activeIndex + 1) % focusTasks.length, 1));
document.querySelector("#prev-card").addEventListener("click", () => selectCard((activeIndex - 1 + focusTasks.length) % focusTasks.length, -1));
document.querySelector("#focus-deck").addEventListener("pointerdown", event => { dragStart = event.clientX; });
document.querySelector("#focus-deck").addEventListener("pointerup", event => {
  if (dragStart === null) return;
  const delta = event.clientX - dragStart;
  if (Math.abs(delta) > 55) selectCard((activeIndex + (delta < 0 ? 1 : -1) + focusTasks.length) % focusTasks.length, delta < 0 ? 1 : -1);
  dragStart = null;
});
document.querySelector("#focus-deck").addEventListener("pointermove", event => {
  if (document.body.classList.contains("reduce-motion") || event.pointerType === "touch") return;
  const front = document.querySelector('.focus-card[data-pos="0"]');
  if (!front) return;
  const rect = front.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  front.style.setProperty("--tilt-y", `${(x - .5) * 4}deg`);
  front.style.setProperty("--tilt-x", `${(.5 - y) * 3}deg`);
});
document.querySelector("#focus-deck").addEventListener("pointerleave", () => {
  const front = document.querySelector('.focus-card[data-pos="0"]');
  front?.style.setProperty("--tilt-y", "0deg");
  front?.style.setProperty("--tilt-x", "0deg");
});

const viewNames = { intake: "需求接单台", roadmap: "实习项目路线图", schedule: "工作负荷协商台", today: "今日推进台", waiting: "等待跟进台", weekly: "周报证据台" };
function navigateTo(view, updateHash = true) {
  if (!viewNames[view]) view = "today";
  document.querySelectorAll(".module-card").forEach(item => { item.classList.remove("active"); item.removeAttribute("aria-current"); });
  const button = document.querySelector(`.module-card[data-view="${view}"]`);
  button?.classList.add("active"); button?.setAttribute("aria-current", "page");
  document.querySelectorAll("[data-view-panel]").forEach(panel => {
    const active = panel.dataset.viewPanel === view;
    panel.hidden = !active;
    panel.classList.remove("view-enter");
    if (active && !document.body.classList.contains("reduce-motion")) requestAnimationFrame(() => panel.classList.add("view-enter"));
  });
  document.body.classList.remove("menu-open");
  if (updateHash) history.replaceState(null, "", `#${view}`);
  window.scrollTo({ top: 0, behavior: document.body.classList.contains("reduce-motion") ? "auto" : "smooth" });
}
document.querySelectorAll(".module-card").forEach(button => button.addEventListener("click", () => navigateTo(button.dataset.view)));

document.querySelector(".mobile-menu").addEventListener("click", () => document.body.classList.toggle("menu-open"));
document.querySelector("#reduce-motion").addEventListener("click", event => {
  document.body.classList.toggle("reduce-motion");
  event.currentTarget.textContent = document.body.classList.contains("reduce-motion") ? "恢复动态" : "减少动态";
  state.settings.reduceMotion = document.body.classList.contains("reduce-motion");
  persistState("动效设置");
});
document.querySelector("#new-task").addEventListener("click", openNewTask);
document.querySelectorAll("[data-open-new]").forEach(button => button.addEventListener("click", openNewTask));
document.querySelector(".followup-strip button").addEventListener("click", () => navigateTo("waiting"));

function openNewTask() {
  const modal = document.querySelector("#task-modal");
  modal.showModal();
  requestAnimationFrame(() => document.querySelector("#new-title").focus());
}

document.querySelector("#new-task-form").addEventListener("submit", async event => {
  event.preventDefault();
  const title = document.querySelector("#new-title").value.trim();
  if (!title) { document.querySelector("#new-title").reportValidity(); return; }
  const startNow = event.submitter?.dataset.createMode === "start";
  const task = { id: crypto.randomUUID(), title, priority: document.querySelector("#new-priority").value, deadline: document.querySelector("#new-deadline").value || null, status: startNow ? "进行中" : "待确认", createdAt: new Date().toISOString() };
  state.tasks.push(task); state.logs.push({ id: crypto.randomUUID(), taskId: task.id, type: "task_created", at: task.createdAt, text: `创建任务：${title}` });
  const saved = await persistState("新任务");
  if (saved) { document.querySelector("#task-modal").close(); event.currentTarget.reset(); showToast(`已创建「${title}」· ${task.status}`); }
});

const drawer = document.querySelector("#detail-drawer");
const drawerBackdrop = document.querySelector("#drawer-backdrop");
function openDrawer() { drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); drawerBackdrop.classList.add("show"); requestAnimationFrame(() => drawer.querySelector("textarea")?.focus()); }
function closeDrawer() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); drawerBackdrop.classList.remove("show"); }
document.querySelectorAll("[data-open-drawer]").forEach(button => button.addEventListener("click", openDrawer));
document.querySelector(".drawer-close").addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", event => { if (event.key === "Escape" && drawer.classList.contains("open")) closeDrawer(); });
document.querySelector(".save-details").addEventListener("click", async () => { await persistState("任务详情"); showToast("已保存详情，其他工作区已同步"); });
document.querySelector(".record-progress").addEventListener("click", async () => { state.logs.push({ id: crypto.randomUUID(), taskId: "task-card", type: "manual_progress", at: new Date().toISOString(), text: "更新任务详情中的进展" }); await persistState("进展"); showToast("已保存进展并加入周报来源"); });

let intakeVersion = 1;
document.querySelectorAll("#raw-demand, #intake-title").forEach(input => input.addEventListener("input", () => {
  intakeVersion += 1;
  window.clearTimeout(input.draftTimer);
  input.draftTimer = window.setTimeout(async () => { await persistState("需求草稿"); showToast("草稿已保存"); }, 800);
}));
document.querySelector(".ai-organize").addEventListener("click", event => {
  const version = intakeVersion; const button = event.currentTarget;
  button.disabled = true; button.textContent = "整理中… 可继续编辑";
  window.setTimeout(() => {
    button.disabled = false; button.textContent = "✦ AI 整理建议";
    if (version !== intakeVersion) showToast("建议基于较早内容，请重新检查后采用"); else showToast("AI 暂不可用，输入已保留，可手动填写");
  }, 900);
});
document.querySelector(".adopt-suggestion").addEventListener("click", async event => { event.currentTarget.textContent = "已采用为下一步"; event.currentTarget.disabled = true; await persistState("下一步建议"); showToast("已采用建议；原始需求保持不变"); });
document.querySelector(".confirm-intake").addEventListener("click", async () => {
  const title = document.querySelector("#intake-title").value.trim(); if (!title) { showToast("请先填写有效的任务标题"); return; }
  await persistState("需求确认"); showToast("任务已确认 · 还有 3 项待确认问题，可继续推进");
});

document.querySelectorAll(".step input").forEach(input => input.addEventListener("change", async event => {
  event.currentTarget.closest(".step").classList.toggle("done", event.currentTarget.checked);
  state.logs.push({ id: crypto.randomUUID(), taskId: "task-card", type: "step_changed", at: new Date().toISOString(), text: event.currentTarget.checked ? "步骤已完成" : "步骤已重新打开" });
  await persistState("步骤"); showToast(event.currentTarget.checked ? "已完成步骤；任务状态未自动改变" : "步骤已重新打开");
}));
document.querySelector(".add-step").addEventListener("click", () => showToast("已新增空白步骤，可在任务详情中填写"));

let draggedBlock = null;
document.querySelectorAll(".schedule-block").forEach(block => block.addEventListener("dragstart", () => draggedBlock = block));
document.querySelectorAll(".day-card").forEach(day => {
  day.addEventListener("dragover", event => event.preventDefault());
  day.addEventListener("drop", async event => { event.preventDefault(); if (!draggedBlock) return; day.appendChild(draggedBlock); draggedBlock = null; await persistState("排期"); showToast("已调整排期；任务截止日期未改变"); });
});
document.querySelectorAll(".schedule-action, .day-add").forEach(button => button.addEventListener("click", () => showToast("请选择日期与 0.25 小时粒度的计划工时")));
document.querySelector(".generate-negotiation").addEventListener("click", () => showToast("已生成可编辑协商草稿；排期与截止日期均未改变"));

document.querySelectorAll(".open-talk").forEach(button => button.addEventListener("click", () => document.querySelector(".talk-panel textarea").focus()));
document.querySelector(".copy-talk").addEventListener("click", async () => { await navigator.clipboard?.writeText(document.querySelector(".talk-panel textarea").value); showToast("已复制话术；未记录为已沟通"); });
document.querySelector(".mark-followed").addEventListener("click", async event => { state.logs.push({ id: crypto.randomUUID(), taskId: "task-card", type: "followup", at: new Date().toISOString(), text: "已跟进产品导师" }); await persistState("跟进记录"); event.currentTarget.textContent = "已跟进 · 可设新日期"; showToast("已写入本次沟通时间"); });
document.querySelector(".add-waiting").addEventListener("click", () => showToast("完成任务不能新增等待；其他任务可继续填写等待对象与日期"));

const reportEditor = document.querySelector("#report-editor");
reportEditor.addEventListener("input", () => { window.clearTimeout(reportEditor.timer); reportEditor.timer = window.setTimeout(() => persistState("周报草稿"), 800); });
document.querySelector(".generate-report").addEventListener("click", () => showToast("AI 暂不可用；当前草稿与 6 条来源均已保留"));
document.querySelector(".copy-report").addEventListener("click", async () => { await navigator.clipboard?.writeText(reportEditor.value); showToast("已复制纯文本，不含内部来源 ID"); });
document.querySelector(".export-report").addEventListener("click", () => {
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([reportEditor.value], { type: "text/markdown;charset=utf-8" })); link.download = "实习周报_2026-09-28_10-04.md"; link.click(); URL.revokeObjectURL(link.href); showToast("已导出 Markdown，内容与编辑器一致");
});

const searchInput = document.querySelector(".global-search input");
const searchBox = document.createElement("div"); searchBox.className = "search-results"; document.querySelector(".global-search").appendChild(searchBox);
searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  const matches = !query ? [] : focusTasks.filter(task => `${task.title}${task.project}${task.next}`.toLowerCase().includes(query));
  searchBox.innerHTML = matches.map(task => `<button type="button" data-result="${task.id}"><strong>${task.title}</strong><small>${task.project} · ${task.chip}</small></button>`).join("") || (query ? "<p>没有匹配结果</p>" : "");
  searchBox.classList.toggle("show", Boolean(query));
  searchBox.querySelectorAll("button").forEach(button => button.addEventListener("click", () => { searchBox.classList.remove("show"); searchInput.value = ""; navigateTo("today"); activeIndex = focusTasks.findIndex(task => task.id === button.dataset.result); renderDeck(); openDrawer(); }));
});

window.addEventListener("storage", event => { if (event.key === `${APP_KEY}-version` && Number(event.newValue) > state.updatedAt) showToast("另一标签页有新版本，请刷新或先保留当前草稿"); });

const settingsModal = document.querySelector("#settings-modal");
document.querySelector(".settings-button").addEventListener("click", () => {
  document.querySelector("#timezone-setting").value = state.settings.timezone || "Asia/Shanghai";
  document.querySelector("#capacity-setting").value = state.settings.dailyCapacity ?? "";
  document.querySelector("#motion-setting").checked = document.body.classList.contains("reduce-motion");
  settingsModal.showModal();
});
document.querySelector("#settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  state.settings.timezone = document.querySelector("#timezone-setting").value;
  const capacity = document.querySelector("#capacity-setting").value;
  state.settings.dailyCapacity = capacity === "" ? null : Number(capacity);
  state.settings.reduceMotion = document.querySelector("#motion-setting").checked;
  document.body.classList.toggle("reduce-motion", state.settings.reduceMotion);
  await persistState("设置"); settingsModal.close(); showToast("设置已保存");
});
document.querySelector(".export-json").addEventListener("click", () => {
  const backup = { schemaVersion: 1, exportedAt: new Date().toISOString(), ...state };
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type:"application/json" })); link.download = `一叠事_备份_${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(link.href); showToast("已导出完整 JSON 备份");
});
document.querySelector("#import-json").addEventListener("change", async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (incoming.schemaVersion !== 1 || !Array.isArray(incoming.tasks) || !Array.isArray(incoming.logs) || typeof incoming.settings !== "object") throw new Error("invalid");
    if (!confirm("导入将替换当前数据。建议先导出备份，是否继续？")) { event.target.value = ""; return; }
    state.tasks = incoming.tasks; state.logs = incoming.logs; state.settings = incoming.settings; await persistState("导入数据"); showToast("备份已导入，请刷新查看全部数据");
  } catch (_) { showToast("导入失败：文件结构或版本不受支持，原数据未改变"); }
  event.target.value = "";
});
document.querySelector(".remove-samples").addEventListener("click", async () => {
  const today = document.querySelector('[data-view-panel="today"]');
  today.querySelector(".today-grid").hidden = true;
  let empty = today.querySelector(".empty-state");
  if (!empty) {
    empty = document.createElement("div"); empty.className = "empty-state";
    empty.innerHTML = `<div><span class="status-pill outline">今日为空</span><h2>还没有任务</h2><p>记下带教交给你的第一件事，或从任务池加入今天。</p><div class="button-row"><button class="primary-button" type="button" data-empty-create>创建第一项任务</button><button class="outline-button" type="button" data-load-sample>载入示例</button></div></div>`;
    today.appendChild(empty);
    empty.querySelector("[data-empty-create]").addEventListener("click", openNewTask);
    empty.querySelector("[data-load-sample]").addEventListener("click", () => { empty.remove(); today.querySelector(".today-grid").hidden = false; showToast("已载入带明显标记的示例数据"); });
  }
  settingsModal.close(); await persistState("示例数据"); showToast("已移除示例数据，用户任务未受影响");
});

function registerWebMcpTools() {
  if (!document.modelContext?.registerTool) return;
  const tools = [
    { name: "list_today_tasks", title: "查看今日任务", description: "读取当前今日重点任务及其状态，不修改数据。", inputSchema: { type:"object", properties:{}, additionalProperties:false }, annotations:{ readOnlyHint:true, untrustedContentHint:false }, execute: async () => focusTasks.map(({id,title,chip,deadline,next}) => ({id,title,status:chip,deadline,nextAction:next})) },
    { name: "start_task_creation", title: "开始新建任务", description: "打开新建任务表单；不会在用户提交前创建数据。", inputSchema: { type:"object", properties:{ title:{type:"string",maxLength:80} }, additionalProperties:false }, annotations:{ readOnlyHint:false, untrustedContentHint:false }, execute: async input => { openNewTask(); if (input?.title) document.querySelector("#new-title").value = input.title; return { status:"form_opened" }; } },
    { name: "navigate_workspace", title: "打开功能工作区", description: "切换到六个工作区之一，不修改业务数据。", inputSchema: { type:"object", properties:{ view:{type:"string",enum:Object.keys(viewNames)} }, required:["view"], additionalProperties:false }, annotations:{ readOnlyHint:true, untrustedContentHint:false }, execute: async input => { if (!viewNames[input?.view]) throw new Error("未知工作区"); navigateTo(input.view); return { view:input.view, title:viewNames[input.view] }; } }
  ];
  tools.forEach(tool => { try { document.modelContext.registerTool(tool); } catch (_) {} });
}

renderDeck();
restoreState();
navigateTo(location.hash.slice(1) || "today", false);
registerWebMcpTools();
