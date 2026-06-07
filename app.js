const STORAGE_KEY = "sanwei-growth-pwa:v1";

const DIMENSIONS = [
  {
    id: "health",
    title: "体魄",
    subtitle: "身体健康",
    mark: "体",
    color: "#168268"
  },
  {
    id: "mindset",
    title: "心境",
    subtitle: "良好心态",
    mark: "心",
    color: "#c84d5c"
  },
  {
    id: "study",
    title: "学业",
    subtitle: "专注学业",
    mark: "学",
    color: "#4a58b8"
  }
];

const STATUSES = [
  { id: "none", label: "未做", multiplier: 0 },
  { id: "partial", label: "部分", multiplier: 0.5 },
  { id: "done", label: "完成", multiplier: 1 }
];

const TASKS = [
  {
    id: "health_sleep",
    dimension: "health",
    title: "睡眠节律",
    points: 4,
    note: "接近目标入睡/起床也可以拿部分分。"
  },
  {
    id: "health_food",
    dimension: "health",
    title: "健康饮食",
    points: 3,
    note: "三餐规律、饮水足够、少高糖高油。"
  },
  {
    id: "health_move",
    dimension: "health",
    title: "适当运动",
    points: 3,
    note: "散步、拉伸、力量、有氧任选。"
  },
  {
    id: "mind_awareness",
    dimension: "mindset",
    title: "情绪觉察",
    points: 3,
    note: "看见今日主要情绪，不要求它积极。"
  },
  {
    id: "mind_recovery",
    dimension: "mindset",
    title: "主动恢复",
    points: 3,
    note: "呼吸、散步、晒太阳、音乐、离屏任选。"
  },
  {
    id: "mind_support",
    dimension: "mindset",
    title: "自我支持",
    points: 4,
    note: "鼓励、感恩、友好社交、停止自责循环。"
  },
  {
    id: "study_focus",
    dimension: "study",
    title: "深度专注",
    points: 3,
    note: "至少一个 45-90 分钟无干扰学习块。"
  },
  {
    id: "study_input",
    dimension: "study",
    title: "有效输入",
    points: 3,
    note: "论文、教材、课程、文献笔记或实验资料。"
  },
  {
    id: "study_output",
    dimension: "study",
    title: "可见输出",
    points: 4,
    note: "写作、代码、实验记录、批注、问题清单。"
  }
];

const REPAIR_TASKS = ["整理明天计划", "轻运动 10 分钟", "补一段学习输出"];

const TITLE_RULES = [
  "等待开局者：当前周期没有记录。",
  "三维满格者：周均分达到 27 分以上。",
  "稳定进阶者：月均分达到 27 分以上。",
  "输出型研究者：均分达到 23 分以上，且学业是优势项。",
  "清醒推进者：均分达到 23 分以上，且心境是优势项。",
  "稳定筑基者：均分达到 23 分以上，且体魄是优势项或三项接近。",
  "持续推进者：均分达到 18 分以上。",
  "复苏练习生：均分低于 18 分，且心境是照看项。",
  "重新校准者：均分低于 18 分，且照看项不是心境。"
];

const app = document.querySelector("#app");
let installPrompt = null;

let state = loadState();
let ui = {
  tab: "daily",
  selectedDate: todayKey(),
  draftDate: null,
  draft: null,
  reviewPeriod: "week",
  modal: null,
  toast: null
};

refreshRewardCooldown();
saveState();
render();
registerServiceWorker();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  render();
});

function defaultState() {
  return {
    records: {},
    rewards: [
      {
        id: id(),
        name: "自由娱乐 1 小时",
        note: "适合一次轻量放松。",
        cost: 30,
        requiredWeeklyAverage: null,
        requiredActiveDays: 3,
        requiredDimension: null,
        requiredDimensionLevel: null,
        redeemedDates: [],
        archived: false
      },
      {
        id: id(),
        name: "买一个小物",
        note: "给生活一点具体的奖励。",
        cost: 90,
        requiredWeeklyAverage: 21,
        requiredActiveDays: null,
        requiredDimension: null,
        requiredDimensionLevel: null,
        redeemedDates: [],
        archived: false
      },
      {
        id: id(),
        name: "半日外出",
        note: "完成阶段推进后的恢复时间。",
        cost: 160,
        requiredWeeklyAverage: 23,
        requiredActiveDays: 5,
        requiredDimension: null,
        requiredDimensionLevel: null,
        redeemedDates: [],
        archived: false
      }
    ],
    weeklyFocus: "保持三项都不掉线",
    weeklyGoal: 21,
    cooldownUntil: null,
    lastPenaltyWeekKey: null,
    repairCompletions: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : defaultState();
    return normalizeState(parsed);
  } catch {
    return defaultState();
  }
}

function normalizeState(value) {
  const base = defaultState();
  const merged = { ...base, ...value };
  merged.records = typeof merged.records === "object" && !Array.isArray(merged.records) ? merged.records : {};
  merged.rewards = Array.isArray(merged.rewards) && merged.rewards.length ? merged.rewards : base.rewards;
  merged.repairCompletions = Array.isArray(merged.repairCompletions) ? merged.repairCompletions : [];
  merged.weeklyGoal = clamp(Number(merged.weeklyGoal || 21), 12, 30);

  for (const key of Object.keys(merged.records)) {
    merged.records[key] = normalizeRecord(merged.records[key], key);
  }

  merged.rewards = merged.rewards.map((reward) => ({
    id: reward.id || id(),
    name: reward.name || "未命名奖励",
    note: reward.note || "",
    cost: Math.max(1, Number(reward.cost || 1)),
    requiredWeeklyAverage: nullableNumber(reward.requiredWeeklyAverage),
    requiredActiveDays: nullableNumber(reward.requiredActiveDays),
    requiredDimension: reward.requiredDimension || null,
    requiredDimensionLevel: nullableNumber(reward.requiredDimensionLevel),
    redeemedDates: Array.isArray(reward.redeemedDates) ? reward.redeemedDates : [],
    archived: Boolean(reward.archived || reward.isArchived)
  }));

  return merged;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeRecord(record, fallbackDate) {
  return {
    date: record.date || fallbackDate,
    entries: record.entries && typeof record.entries === "object" ? record.entries : {},
    isProtectionDay: Boolean(record.isProtectionDay),
    reflection: record.reflection || "",
    satisfaction: clamp(Number(record.satisfaction || 3), 1, 5),
    tags: Array.isArray(record.tags) ? record.tags : [],
    settledAt: record.settledAt || null
  };
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function id() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
            <div class="brand-text">
              <div class="brand-title">科研人才养成计划</div>
              <div class="brand-subtitle">${headerSubtitle()}</div>
            </div>
          </div>
          <div class="top-actions">
            ${installPrompt ? `<button class="secondary-btn" data-action="install">安装</button>` : ""}
            <button class="secondary-btn" data-action="export">备份</button>
          </div>
        </div>
      </header>

      <nav class="tabbar" aria-label="主导航">
        <div class="tabbar-inner">
          ${tabButton("daily", "□", "今日")}
          ${tabButton("character", "◇", "角色")}
          ${tabButton("rewards", "☆", "奖励")}
          ${tabButton("review", "▥", "回顾")}
        </div>
      </nav>

      <main class="main">
        ${renderCurrentView()}
      </main>
    </div>
    ${renderModal()}
    ${ui.toast ? `<div class="toast">${escapeHTML(ui.toast)}</div>` : ""}
  `;

  bindEvents();
}

function headerSubtitle() {
  const statsValue = stats();
  if (ui.tab === "character") return `Lv.${statsValue.totalLevel} / ${statsValue.coinsAvailable} 金币`;
  if (ui.tab === "rewards") return rewardLocked() ? "奖励冷却中" : `${activeRewards().length} 个奖励`;
  if (ui.tab === "review") return `${reviewSummary(ui.reviewPeriod).title}`;
  return `${todayKey() === ui.selectedDate ? "今日" : formatDate(ui.selectedDate)} / ${draftRecord().grade}`;
}

function tabButton(tab, mark, label) {
  return `
    <button class="tab-btn ${ui.tab === tab ? "is-active" : ""}" data-tab="${tab}">
      <span>${mark}</span>${label}
    </button>
  `;
}

function renderCurrentView() {
  if (ui.tab === "character") return renderCharacterView();
  if (ui.tab === "rewards") return renderRewardsView();
  if (ui.tab === "review") return renderReviewView();
  return renderDailyView();
}

function renderDailyView() {
  const record = draftRecord();

  return `
    <section class="view">
      <div class="panel panel-pad">
        <div class="date-row">
          <div>
            <div class="panel-title">
              <h2>每日面板</h2>
            </div>
            <div class="hint">${record.isProtectionDay ? "保护日会保留记录，但不影响连续表现。" : "三项各 10 分，只记录获得了什么。"}</div>
          </div>
          <input class="date-input" id="daily-date" type="date" value="${ui.selectedDate}" max="${todayKey()}" />
        </div>
      </div>

      <div class="panel panel-pad">
        <div class="score-hero">
          ${renderGradeBadge(record)}
          <div>
            <div class="rings">
              ${DIMENSIONS.map((dimension) => renderDimensionRing(record, dimension)).join("")}
            </div>
            ${hasBalanceBonus(record) ? `<div class="bonus-line">三项均达 6 分，今日可获得平衡加成金币。</div>` : ""}
          </div>
        </div>
      </div>

      <div class="panel panel-pad">
        <div class="panel-title">
          <h2>9 个核心得分点</h2>
        </div>
        ${DIMENSIONS.map((dimension) => renderDimensionTasks(record, dimension)).join("")}
      </div>

      <div class="panel panel-pad">
        <div class="panel-title">
          <h2>可选补充</h2>
        </div>
        <div class="field-grid">
          <label class="toggle-row">
            <span>
              <strong>今天是保护日</strong>
              <span class="hint">保留当天状态，不把低能量日记成失败。</span>
            </span>
            <input id="protection-day" type="checkbox" ${record.isProtectionDay ? "checked" : ""} />
          </label>

          <div>
            <div class="field-label">主观满意度</div>
            <div class="segmented">
              ${[1, 2, 3, 4, 5].map((value) => `
                <button class="${record.satisfaction === value ? "is-active" : ""}" data-satisfaction="${value}">${value}</button>
              `).join("")}
            </div>
          </div>

          <label>
            <div class="field-label">一句话总结</div>
            <textarea id="reflection" placeholder="选填">${escapeHTML(record.reflection)}</textarea>
          </label>

          <label>
            <div class="field-label">标签</div>
            <input id="tags" type="text" value="${escapeAttribute(record.tags.join(" "))}" placeholder="空格或逗号分隔" />
          </label>
        </div>
      </div>

      <button class="primary-btn wide-btn" data-action="settle">✓ 今日结算</button>
    </section>
  `;
}

function renderGradeBadge(record) {
  return `
    <div class="grade-badge">
      <div>
        <strong>${record.grade}</strong>
        <span>${formatNumber(record.totalScore)}/30</span>
      </div>
    </div>
  `;
}

function renderDimensionRing(record, dimension) {
  const value = scoreForDimension(record, dimension.id);
  return `
    <div class="ring-item">
      <div class="ring" style="--ring-color:${dimension.color}; --progress:${value / 10};">${dimension.mark}</div>
      <div class="ring-label">
        <strong>${dimension.title}</strong>
        <span>${formatNumber(value)}/10</span>
      </div>
    </div>
  `;
}

function renderDimensionTasks(record, dimension) {
  const dimensionScore = scoreForDimension(record, dimension.id);
  const items = TASKS.filter((task) => task.dimension === dimension.id);

  return `
    <div class="dimension-block" style="--dimension-color:${dimension.color}">
      <div class="dimension-heading">
        <strong style="color:${dimension.color}">${dimension.subtitle}</strong>
        <span>${formatNumber(dimensionScore)}/10</span>
      </div>
      ${items.map((task) => renderTaskRow(record, task, dimension)).join("")}
    </div>
  `;
}

function renderTaskRow(record, task, dimension) {
  const current = record.entries[task.id] || "none";

  return `
    <div class="task-row" style="--dimension-color:${dimension.color}">
      <div class="task-copy">
        <div>
          <strong>${task.title}</strong>
          <p>${task.note}</p>
        </div>
        <div class="task-points">${task.points}分</div>
      </div>
      <div class="segmented">
        ${STATUSES.map((status) => `
          <button
            class="${current === status.id ? "is-active" : ""}"
            data-task="${task.id}"
            data-status="${status.id}"
          >${status.label}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCharacterView() {
  const character = stats();
  const week = reviewSummary("week");
  const month = reviewSummary("month");

  return `
    <section class="view">
      <div class="panel panel-pad">
        <div class="panel-title"><h2>角色状态</h2></div>
        <div class="character-hero">
          <div class="avatar">
            <div class="avatar-inner">
              <div class="avatar-glyph" aria-hidden="true"><span></span><span></span><span></span></div>
              <span>Lv.${character.totalLevel}</span>
            </div>
          </div>
          <div class="stats-row">
            ${metric("金币", character.coinsAvailable, "金", "#b06b14")}
            ${metric("7 日活跃", `${weeklyActiveDays()}/5`, "7", "#168268")}
          </div>
        </div>
      </div>

      <div class="panel panel-pad">
        <div class="panel-title"><h2>三维属性</h2></div>
        ${DIMENSIONS.map((dimension) => renderAttributeRow(character, dimension)).join("")}
      </div>

      <div class="panel panel-pad">
        <div class="panel-title"><h2>容错连续性</h2></div>
        ${progressLine("滚动 7 天完成 5 天", `${weeklyActiveDays()}/5`, weeklyActiveDays() / 5, "#168268")}
        <p class="hint">保护日不会清零，也不会算作失败。连续性看最近 7 天的活跃天数。</p>
      </div>

      <div class="grid-2">
        ${titlePanel("本周称号", week.title, week.insight)}
        ${titlePanel("本月称号", month.title, month.nextSuggestion)}
      </div>

      <div class="panel panel-pad">
        <div class="panel-title"><h2>内置称号规则</h2></div>
        <div class="title-rule-list">
          ${TITLE_RULES.map((rule) => `<div>${rule}</div>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderAttributeRow(character, dimension) {
  const xp = character.xp[dimension.id] || 0;
  const level = levelForXP(xp);
  const progress = (xp % 100) / 100;

  return `
    <div class="attribute-row">
      <div class="attribute-head">
        <strong style="color:${dimension.color}">${dimension.title}</strong>
        <strong>Lv.${level}</strong>
      </div>
      ${progressLine("经验", `${Math.floor(xp % 100)}/100 XP`, progress, dimension.color)}
      <div class="hint">累计 ${Math.floor(xp)} XP</div>
    </div>
  `;
}

function titlePanel(label, title, detail) {
  return `
    <div class="panel panel-pad">
      <div class="panel-title"><h3>${label}</h3></div>
      <div class="review-callout">
        <strong>${title}</strong>
        <span class="hint">${detail}</span>
      </div>
    </div>
  `;
}

function renderRewardsView() {
  const character = stats();
  const rewards = activeRewards();

  return `
    <section class="view">
      <div class="panel panel-pad">
        <div class="panel-title">
          <h2>奖励商店</h2>
          <button class="primary-btn" data-action="open-add-reward">＋ 新增</button>
        </div>
        <div class="stats-row">
          ${metric("可用金币", character.coinsAvailable, "金", "#b06b14")}
          ${metric("本周目标", `${formatNumber(state.weeklyGoal)}/30`, "旗", "#4a58b8")}
        </div>
      </div>

      ${rewardLocked() ? renderCooldownPanel() : ""}

      <div class="view">
        ${rewards.length ? rewards.map(renderRewardCard).join("") : emptyState("还没有奖励", "添加一个你真正期待的小奖励，让金币有去处。")}
      </div>
    </section>
  `;
}

function renderCooldownPanel() {
  return `
    <div class="panel panel-pad cooldown">
      <div class="panel-title"><h2>轻量修复</h2></div>
      <p class="hint">上一个周期低于目标，奖励商店冷却到 ${formatDateTime(state.cooldownUntil)}。完成一个修复任务即可重新打开。</p>
      <div class="repair-list">
        ${REPAIR_TASKS.map((task) => `
          <button class="secondary-btn wide-btn" data-repair="${task}">✓ ${task}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderRewardCard(reward) {
  const canRedeemReward = canRedeem(reward);
  const progressItems = rewardProgressItems(reward);

  return `
    <article class="reward-card">
      <div class="reward-head">
        <div>
          <h3>${escapeHTML(reward.name)}</h3>
          ${reward.note ? `<p>${escapeHTML(reward.note)}</p>` : ""}
          <p>已兑换 ${reward.redeemedDates.length} 次</p>
        </div>
        <div class="reward-cost">${reward.cost} 金币</div>
      </div>

      <div class="view">
        ${progressItems.map((item) => progressLine(item.title, item.valueText, item.progress, item.progress >= 1 ? "#168268" : "#b06b14")).join("")}
      </div>

      <div class="reward-actions">
        <button class="danger-btn" data-archive-reward="${reward.id}">归档</button>
        <button class="primary-btn" data-redeem-reward="${reward.id}" ${canRedeemReward ? "" : "disabled"}>✓ 兑换</button>
      </div>
    </article>
  `;
}

function renderReviewView() {
  const summary = reviewSummary(ui.reviewPeriod);

  return `
    <section class="view">
      <div class="segmented">
        <button class="${ui.reviewPeriod === "week" ? "is-active" : ""}" data-period="week">每周</button>
        <button class="${ui.reviewPeriod === "month" ? "is-active" : ""}" data-period="month">每月</button>
      </div>

      <div class="panel panel-pad">
        <div class="panel-title"><h2>${ui.reviewPeriod === "week" ? "每周总结" : "每月总结"}</h2></div>
        <div class="grid-2">
          ${metric("均分", `${formatNumber(summary.averageScore)}/30`, "分", "#2f6f8f")}
          ${metric("记录天数", summary.recordedDays, "记", "#168268")}
          ${metric("保护日", summary.protectionDays, "盾", "#246b61")}
          ${metric("最佳一天", summary.bestDate ? `${formatShortDate(summary.bestDate)} ${formatNumber(summary.bestScore)}` : "暂无", "星", "#b06b14")}
        </div>
        <div class="review-callout" style="margin-top:12px">
          <strong>${summary.title}</strong>
          <span>${summary.insight}</span>
          <span class="hint">${summary.nextSuggestion}</span>
        </div>
      </div>

      <div class="panel panel-pad">
        <div class="panel-title"><h2>三项趋势</h2></div>
        <div class="view">
          ${DIMENSIONS.map((dimension) => {
            const average = summary.dimensionAverages[dimension.id] || 0;
            return progressLine(dimension.title, `${formatNumber(average)}/10`, average / 10, dimension.color);
          }).join("")}
        </div>
        ${summary.strongest && summary.weakest && summary.strongest !== summary.weakest ? `
          <p class="hint">优势项：${dimensionByID(summary.strongest).title}；照看项：${dimensionByID(summary.weakest).title}。</p>
        ` : ""}
      </div>

      ${ui.reviewPeriod === "week" ? renderWeeklyFocusPanel() : renderMonthPanel()}

      ${renderRecordHistoryPanel()}
    </section>
  `;
}

function renderWeeklyFocusPanel() {
  return `
    <div class="panel panel-pad">
      <div class="panel-title"><h2>下周一个重点</h2></div>
      <div class="field-grid">
        <label>
          <div class="field-label">重点</div>
          <input id="weekly-focus" type="text" value="${escapeAttribute(state.weeklyFocus)}" />
        </label>
        <label>
          <div class="field-label">周目标均分</div>
          <input id="weekly-goal" type="number" min="12" max="30" step="1" value="${state.weeklyGoal}" />
        </label>
        <button class="primary-btn wide-btn" data-action="save-weekly-focus">✓ 保存重点</button>
        <p class="hint">每周只选一个重点，避免把复盘变成新的压力源。</p>
      </div>
    </div>
  `;
}

function renderMonthPanel() {
  return `
    <div class="panel panel-pad">
      <div class="panel-title"><h2>月度热力图</h2></div>
      <div class="heatmap">
        ${monthCells().map(renderMonthCell).join("")}
      </div>
      <p class="hint">颜色越深表示当天得分越高；空白代表尚未记录。</p>
    </div>
  `;
}

function renderRecordHistoryPanel() {
  const rows = sortedRecords()
    .filter(isRecorded)
    .slice()
    .reverse()
    .slice(0, 14);

  return `
    <div class="panel panel-pad">
      <div class="panel-title">
        <h2>每日记录回看</h2>
        <span class="hint">最近 ${rows.length} 条</span>
      </div>
      ${
        rows.length
          ? `<div class="record-list">${rows.map(renderRecordHistoryItem).join("")}</div>`
          : emptyState("还没有可回看的记录", "完成一次今日结算后，这里会显示总结、满意度和标签。")
      }
    </div>
  `;
}

function renderRecordHistoryItem(record) {
  const tags = record.tags?.length ? record.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("") : `<span>无标签</span>`;
  const reflection = record.reflection?.trim() ? escapeHTML(record.reflection.trim()) : "未填写一句话总结";

  return `
    <article class="record-item">
      <div class="record-head">
        <strong>${formatDate(record.date)}</strong>
        <span>${gradeFor(record)} · ${formatNumber(totalScore(record))}/30 · 满意度 ${record.satisfaction}/5</span>
      </div>
      <p>${reflection}</p>
      <div class="tag-list">${tags}</div>
    </article>
  `;
}

function renderMonthCell(cell) {
  if (cell.blank) {
    return `<div class="day-cell" style="--cell-bg:transparent; --cell-color:transparent"></div>`;
  }

  const record = state.records[cell.key];
  const display = record ? gradeFor(record) : "";
  const style = heatmapStyle(record);

  return `
    <div class="day-cell" style="${style}" title="${cell.key}">
      <div>${cell.day}<span>${display}</span></div>
    </div>
  `;
}

function renderModal() {
  if (!ui.modal) return "";
  if (ui.modal.type === "settlement") return renderSettlementModal(ui.modal.snapshot);
  if (ui.modal.type === "addReward") return renderAddRewardModal();
  if (ui.modal.type === "backup") return renderBackupModal();
  return "";
}

function renderSettlementModal(snapshot) {
  return `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-label="结算完成" data-modal>
        <div class="modal-header">
          <h2>结算完成</h2>
          <button class="ghost-btn" data-action="close-modal">关闭</button>
        </div>
        <div class="modal-body">
          ${renderGradeBadge(snapshot.record)}
          ${DIMENSIONS.map((dimension) => metric(`${dimension.title} XP`, `+${formatNumber(snapshot.dimensionXP[dimension.id] || 0)}`, dimension.mark, dimension.color)).join("")}
          ${metric(snapshot.balance ? "金币（含平衡加成）" : "金币", `+${snapshot.coinsGained} / 当前 ${snapshot.coinsAvailable}`, "金", "#b06b14")}
        </div>
        <div class="modal-footer">
          <button class="primary-btn" data-action="close-modal">完成</button>
        </div>
      </section>
    </div>
  `;
}

function renderAddRewardModal() {
  return `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-label="新增奖励" data-modal>
        <div class="modal-header">
          <h2>新增奖励</h2>
          <button class="ghost-btn" data-action="close-modal">关闭</button>
        </div>
        <div class="modal-body">
          <label class="form-row">
            <span class="field-label">名称</span>
            <input id="reward-name" type="text" placeholder="例如：看一部电影" />
          </label>
          <label class="form-row">
            <span class="field-label">备注</span>
            <textarea id="reward-note" placeholder="选填"></textarea>
          </label>
          <label class="form-row">
            <span class="field-label">金币</span>
            <input id="reward-cost" type="number" min="1" step="1" value="50" />
          </label>
          <div class="inline-fields">
            <label class="form-row">
              <span class="field-label">本周均分</span>
              <input id="reward-weekly" type="number" min="12" max="30" step="1" placeholder="可空" />
            </label>
            <label class="form-row">
              <span class="field-label">7 日活跃</span>
              <input id="reward-active" type="number" min="1" max="7" step="1" placeholder="可空" />
            </label>
          </div>
          <div class="inline-fields">
            <label class="form-row">
              <span class="field-label">属性</span>
              <select id="reward-dimension">
                <option value="">不限制</option>
                ${DIMENSIONS.map((dimension) => `<option value="${dimension.id}">${dimension.title}</option>`).join("")}
              </select>
            </label>
            <label class="form-row">
              <span class="field-label">属性等级</span>
              <input id="reward-level" type="number" min="1" step="1" placeholder="可空" />
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" data-action="close-modal">取消</button>
          <button class="primary-btn" data-action="save-reward">保存</button>
        </div>
      </section>
    </div>
  `;
}

function renderBackupModal() {
  return `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-label="数据备份" data-modal>
        <div class="modal-header">
          <h2>数据备份</h2>
          <button class="ghost-btn" data-action="close-modal">关闭</button>
        </div>
        <div class="modal-body">
          <label class="form-row">
            <span class="field-label">当前数据</span>
            <textarea id="backup-json" readonly>${escapeHTML(JSON.stringify(state, null, 2))}</textarea>
          </label>
          <label class="form-row">
            <span class="field-label">恢复数据</span>
            <textarea id="restore-json" placeholder="把备份 JSON 粘贴到这里，再点恢复"></textarea>
          </label>
          <label class="form-row">
            <span class="field-label">从文件恢复</span>
            <input id="restore-file" type="file" accept="application/json,.json" />
          </label>
          <p class="hint">恢复会覆盖当前浏览器里的本地数据。操作前建议先下载一份当前备份。</p>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" data-action="download-backup">下载</button>
          <button class="secondary-btn" data-action="restore-backup">恢复</button>
          <button class="primary-btn" data-action="copy-backup">复制</button>
        </div>
      </section>
    </div>
  `;
}

function bindEvents() {
  app.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      readDailyInputs();
      ui.tab = button.dataset.tab;
      render();
    });
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const action = button.dataset.action;
      if (action === "settle") settleDraft();
      if (action === "open-add-reward") openModal({ type: "addReward" });
      if (action === "save-reward") saveRewardFromModal();
      if (action === "save-weekly-focus") saveWeeklyFocus();
      if (action === "close-modal") closeModal();
      if (action === "copy-backup") copyBackup();
      if (action === "export") openModal({ type: "backup" });
      if (action === "install") installApp();
      if (action === "download-backup") downloadBackup();
      if (action === "restore-backup") restoreBackupFromModal();
    });
  });

  app.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });
  });

  const dateInput = app.querySelector("#daily-date");
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      readDailyInputs();
      ui.selectedDate = dateInput.value || todayKey();
      ui.draftDate = null;
      render();
    });
  }

  app.querySelectorAll("[data-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = draftRecord();
      record.entries[button.dataset.task] = button.dataset.status;
      render();
    });
  });

  app.querySelectorAll("[data-satisfaction]").forEach((button) => {
    button.addEventListener("click", () => {
      draftRecord().satisfaction = Number(button.dataset.satisfaction);
      render();
    });
  });

  const protection = app.querySelector("#protection-day");
  if (protection) {
    protection.addEventListener("change", () => {
      draftRecord().isProtectionDay = protection.checked;
      render();
    });
  }

  const reflection = app.querySelector("#reflection");
  if (reflection) {
    reflection.addEventListener("input", () => {
      draftRecord().reflection = reflection.value;
    });
  }

  const tags = app.querySelector("#tags");
  if (tags) {
    tags.addEventListener("input", () => {
      draftRecord().tags = parseTags(tags.value);
    });
  }

  app.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.reviewPeriod = button.dataset.period;
      render();
    });
  });

  app.querySelectorAll("[data-repair]").forEach((button) => {
    button.addEventListener("click", () => {
      state.repairCompletions.push({ id: id(), date: new Date().toISOString(), title: button.dataset.repair });
      state.cooldownUntil = null;
      saveState();
      showToast("奖励商店已重新打开");
      render();
    });
  });

  app.querySelectorAll("[data-redeem-reward]").forEach((button) => {
    button.addEventListener("click", () => {
      redeemReward(button.dataset.redeemReward);
    });
  });

  app.querySelectorAll("[data-archive-reward]").forEach((button) => {
    button.addEventListener("click", () => {
      archiveReward(button.dataset.archiveReward);
    });
  });
}

function draftRecord() {
  if (ui.draftDate !== ui.selectedDate || !ui.draft) {
    ui.draft = clone(getRecord(ui.selectedDate));
    ui.draftDate = ui.selectedDate;
  }
  hydrateRecordComputed(ui.draft);
  return ui.draft;
}

function readDailyInputs() {
  if (!ui.draft || ui.draftDate !== ui.selectedDate) return;
  const reflection = app.querySelector("#reflection");
  const tags = app.querySelector("#tags");
  const protection = app.querySelector("#protection-day");
  if (reflection) ui.draft.reflection = reflection.value;
  if (tags) ui.draft.tags = parseTags(tags.value);
  if (protection) ui.draft.isProtectionDay = protection.checked;
}

function settleDraft() {
  readDailyInputs();
  const record = clone(draftRecord());
  record.date = ui.selectedDate;
  record.settledAt = new Date().toISOString();
  state.records[ui.selectedDate] = normalizeRecord(record, ui.selectedDate);
  refreshRewardCooldown();
  saveState();
  ui.draft = clone(state.records[ui.selectedDate]);
  hydrateRecordComputed(ui.draft);
  ui.modal = { type: "settlement", snapshot: settlementSnapshot(ui.draft) };
  render();
}

function settlementSnapshot(record) {
  const character = stats();
  const dimensionXP = {};
  for (const dimension of DIMENSIONS) {
    dimensionXP[dimension.id] = scoreForDimension(record, dimension.id);
  }

  return {
    record,
    dimensionXP,
    coinsGained: coinsForRecord(record),
    balance: hasBalanceBonus(record),
    coinsAvailable: character.coinsAvailable
  };
}

function getRecord(dateKey) {
  return state.records[dateKey] ? normalizeRecord(state.records[dateKey], dateKey) : emptyRecord(dateKey);
}

function emptyRecord(dateKey) {
  return {
    date: dateKey,
    entries: {},
    isProtectionDay: false,
    reflection: "",
    satisfaction: 3,
    tags: [],
    settledAt: null
  };
}

function hydrateRecordComputed(record) {
  record.totalScore = totalScore(record);
  record.grade = gradeFor(record);
  return record;
}

function statusMultiplier(statusID) {
  return STATUSES.find((status) => status.id === statusID)?.multiplier || 0;
}

function scoreForDimension(record, dimensionID) {
  return TASKS
    .filter((task) => task.dimension === dimensionID)
    .reduce((sum, task) => sum + task.points * statusMultiplier(record.entries[task.id] || "none"), 0);
}

function totalScore(record) {
  return DIMENSIONS.reduce((sum, dimension) => sum + scoreForDimension(record, dimension.id), 0);
}

function gradeFor(record) {
  const score = totalScore(record);
  if (score >= 27) return "S";
  if (score >= 23) return "A";
  if (score >= 18) return "B";
  if (score >= 12) return "C";
  return "D";
}

function isRecorded(record) {
  const hasEntry = Object.entries(record.entries || {}).some(([, value]) => value && value !== "none");
  return Boolean(
    hasEntry ||
      record.isProtectionDay ||
      (record.reflection || "").trim() ||
      (record.tags || []).length ||
      record.settledAt
  );
}

function isActiveDay(record) {
  return !record.isProtectionDay && totalScore(record) >= 12;
}

function hasBalanceBonus(record) {
  return DIMENSIONS.every((dimension) => scoreForDimension(record, dimension.id) >= 6);
}

function coinsForRecord(record) {
  if (!isRecorded(record)) return 0;
  return Math.floor(totalScore(record)) + (hasBalanceBonus(record) ? 3 : 0);
}

function stats() {
  const xp = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension.id, 0]));
  let coinsEarned = 0;

  for (const record of sortedRecords()) {
    if (!isRecorded(record)) continue;
    for (const dimension of DIMENSIONS) {
      xp[dimension.id] += scoreForDimension(record, dimension.id);
    }
    coinsEarned += coinsForRecord(record);
  }

  const coinsSpent = state.rewards.reduce((sum, reward) => sum + reward.cost * reward.redeemedDates.length, 0);
  const levels = DIMENSIONS.map((dimension) => levelForXP(xp[dimension.id]));
  const totalLevel = Math.max(1, Math.round(levels.reduce((sum, level) => sum + level, 0) / levels.length));

  return {
    xp,
    coinsEarned,
    coinsSpent,
    coinsAvailable: Math.max(0, coinsEarned - coinsSpent),
    totalLevel
  };
}

function levelForXP(xp) {
  return Math.floor(xp / 100) + 1;
}

function sortedRecords() {
  return Object.keys(state.records)
    .sort()
    .map((key) => normalizeRecord(state.records[key], key));
}

function weeklyActiveDays(referenceKey = todayKey()) {
  const end = parseKey(referenceKey);
  const start = addDays(end, -6);
  return sortedRecords().filter((record) => {
    const date = parseKey(record.date);
    return date >= start && date <= end && isActiveDay(record);
  }).length;
}

function activeRewards() {
  return state.rewards.filter((reward) => !reward.archived);
}

function rewardProgressItems(reward) {
  const character = stats();
  const items = [
    {
      title: "金币",
      current: character.coinsAvailable,
      target: Math.max(1, reward.cost)
    }
  ];

  if (reward.requiredWeeklyAverage) {
    items.push({
      title: "本周均分",
      current: reviewSummary("week").averageScore,
      target: reward.requiredWeeklyAverage
    });
  }

  if (reward.requiredActiveDays) {
    items.push({
      title: "7 日活跃",
      current: weeklyActiveDays(),
      target: reward.requiredActiveDays
    });
  }

  if (reward.requiredDimension && reward.requiredDimensionLevel) {
    items.push({
      title: `${dimensionByID(reward.requiredDimension).title}等级`,
      current: levelForXP(character.xp[reward.requiredDimension] || 0),
      target: reward.requiredDimensionLevel
    });
  }

  return items.map((item) => {
    const progress = item.target > 0 ? clamp(item.current / item.target, 0, 1) : 1;
    return {
      ...item,
      progress,
      valueText: item.target <= 30 ? `${formatNumber(item.current)}/${formatNumber(item.target)}` : `${Math.floor(item.current)}/${Math.floor(item.target)}`
    };
  });
}

function canRedeem(reward) {
  return !rewardLocked() && rewardProgressItems(reward).every((item) => item.progress >= 1);
}

function redeemReward(rewardID) {
  const reward = state.rewards.find((item) => item.id === rewardID);
  if (!reward || !canRedeem(reward)) return;
  reward.redeemedDates.push(new Date().toISOString());
  saveState();
  showToast("奖励已兑换");
  render();
}

function archiveReward(rewardID) {
  const reward = state.rewards.find((item) => item.id === rewardID);
  if (!reward) return;
  reward.archived = true;
  saveState();
  render();
}

function saveRewardFromModal() {
  const name = app.querySelector("#reward-name")?.value.trim();
  if (!name) {
    showToast("请填写奖励名称");
    return;
  }

  const cost = Math.max(1, Number(app.querySelector("#reward-cost")?.value || 1));
  const requiredDimension = app.querySelector("#reward-dimension")?.value || null;
  const requiredDimensionLevel = nullableNumber(app.querySelector("#reward-level")?.value);

  state.rewards.push({
    id: id(),
    name,
    note: app.querySelector("#reward-note")?.value.trim() || "",
    cost,
    requiredWeeklyAverage: nullableNumber(app.querySelector("#reward-weekly")?.value),
    requiredActiveDays: nullableNumber(app.querySelector("#reward-active")?.value),
    requiredDimension,
    requiredDimensionLevel: requiredDimension ? requiredDimensionLevel : null,
    redeemedDates: [],
    archived: false
  });

  saveState();
  closeModal();
  showToast("奖励已添加");
  render();
}

function saveWeeklyFocus() {
  state.weeklyFocus = app.querySelector("#weekly-focus")?.value.trim() || "保持三项都不掉线";
  state.weeklyGoal = clamp(Number(app.querySelector("#weekly-goal")?.value || 21), 12, 30);
  saveState();
  showToast("重点已保存");
  render();
}

function rewardLocked() {
  return state.cooldownUntil && new Date(state.cooldownUntil).getTime() > Date.now();
}

function refreshRewardCooldown() {
  const previous = previousWeekSummary();
  if (!previous.recordedDays) return;
  const key = weekKey(previous.startKey);
  if (state.lastPenaltyWeekKey === key) return;
  state.lastPenaltyWeekKey = key;
  if (previous.average < state.weeklyGoal) {
    state.cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
}

function previousWeekSummary() {
  const currentStart = startOfWeek(parseKey(todayKey()));
  const start = addDays(currentStart, -7);
  const end = currentStart;
  const records = sortedRecords().filter((record) => {
    const date = parseKey(record.date);
    return date >= start && date < end && isRecorded(record) && !record.isProtectionDay;
  });
  const average = records.length ? records.reduce((sum, record) => sum + totalScore(record), 0) / records.length : 0;
  return {
    startKey: keyFromDate(start),
    average,
    recordedDays: records.length
  };
}

function reviewSummary(period) {
  const interval = period === "week" ? currentWeekInterval() : currentMonthInterval();
  const periodRecords = sortedRecords().filter((record) => {
    const date = parseKey(record.date);
    return date >= interval.start && date < interval.end && isRecorded(record);
  });
  const scoredRecords = periodRecords.filter((record) => !record.isProtectionDay || totalScore(record) > 0);
  const averageScore = scoredRecords.length
    ? scoredRecords.reduce((sum, record) => sum + totalScore(record), 0) / scoredRecords.length
    : 0;

  const dimensionAverages = {};
  for (const dimension of DIMENSIONS) {
    dimensionAverages[dimension.id] = scoredRecords.length
      ? scoredRecords.reduce((sum, record) => sum + scoreForDimension(record, dimension.id), 0) / scoredRecords.length
      : 0;
  }

  const sortedDimensions = [...DIMENSIONS].sort((a, b) => dimensionAverages[a.id] - dimensionAverages[b.id]);
  const weakest = scoredRecords.length ? sortedDimensions[0].id : null;
  const strongest = scoredRecords.length ? sortedDimensions[sortedDimensions.length - 1].id : null;
  const best = scoredRecords.reduce((current, record) => (!current || totalScore(record) > totalScore(current) ? record : current), null);

  return {
    period,
    averageScore,
    recordedDays: periodRecords.length,
    protectionDays: periodRecords.filter((record) => record.isProtectionDay).length,
    bestDate: best?.date || null,
    bestScore: best ? totalScore(best) : 0,
    dimensionAverages,
    strongest,
    weakest,
    title: titleFor(period, averageScore, strongest, weakest, periodRecords.length),
    insight: insightFor(averageScore, strongest, weakest, periodRecords.length),
    nextSuggestion: suggestionFor(weakest, averageScore, periodRecords.length)
  };
}

function titleFor(period, average, strongest, weakest, recordedDays) {
  if (!recordedDays) return "等待开局者";
  if (average >= 27) return period === "week" ? "三维满格者" : "稳定进阶者";
  if (average >= 23) {
    if (strongest === "study") return "输出型研究者";
    if (strongest === "mindset") return "清醒推进者";
    return "稳定筑基者";
  }
  if (average >= 18) return "持续推进者";
  if (weakest === "mindset") return "复苏练习生";
  return "重新校准者";
}

function insightFor(average, strongest, weakest, recordedDays) {
  if (!recordedDays) return "先留下第一条记录，系统会从真实数据里给你反馈。";
  if (strongest && weakest && strongest !== weakest) {
    return `这一段最稳的是${dimensionByID(strongest).title}，最需要照看的可能是${dimensionByID(weakest).title}。`;
  }
  if (average >= 23) return "整体推进很完整，接下来适合维持节奏，不必额外加压。";
  return "数据不是失败记录，而是提醒你把目标调到更容易启动的位置。";
}

function suggestionFor(weakest, average, recordedDays) {
  if (!recordedDays) return "今天只完成一个最小动作：记录一次三维状态。";
  if (!weakest) return "下周继续保持三项平衡。";
  if (weakest === "health") return average >= 18 ? "下阶段主线：固定一个低门槛运动或睡眠锚点。" : "先把体魄目标降到可恢复：散步、拉伸、规律一餐即可。";
  if (weakest === "mindset") return average >= 18 ? "下阶段主线：每天给心境留一个主动恢复窗口。" : "先做情绪觉察，不急着要求自己立刻变好。";
  return average >= 18 ? "下阶段主线：提高可见输出频率。" : "先保留一个最小专注块，哪怕只产出问题清单。";
}

function monthCells() {
  const now = parseKey(todayKey());
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const leadingBlanks = (start.getDay() + 6) % 7;
  const cells = Array.from({ length: leadingBlanks }, () => ({ blank: true }));

  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) {
    cells.push({
      key: keyFromDate(cursor),
      day: cursor.getDate()
    });
  }

  return cells;
}

function heatmapStyle(record) {
  if (!record) return "--cell-bg:#f0ede6; --cell-color:#8b8981";
  if (record.isProtectionDay) return "--cell-bg:#dff0ed; --cell-color:#225f55";
  const score = totalScore(record);
  const opacity = clamp(score / 30, 0.18, 0.88);
  if (score >= 23) return `--cell-bg:${rgba("#168268", opacity)}; --cell-color:#13231f`;
  if (score >= 18) return `--cell-bg:${rgba("#4a58b8", opacity)}; --cell-color:#ffffff`;
  if (score >= 12) return `--cell-bg:${rgba("#b06b14", opacity)}; --cell-color:#1f1710`;
  return `--cell-bg:${rgba("#c84d5c", opacity)}; --cell-color:#ffffff`;
}

function currentWeekInterval() {
  const start = startOfWeek(parseKey(todayKey()));
  return { start, end: addDays(start, 7) };
}

function currentMonthInterval() {
  const now = parseKey(todayKey());
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1)
  };
}

function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function weekKey(dateKey) {
  const start = startOfWeek(parseKey(dateKey));
  return keyFromDate(start);
}

function parseKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function keyFromDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return keyFromDate(new Date());
}

function addDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseTags(value) {
  return value
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dimensionByID(id) {
  return DIMENSIONS.find((dimension) => dimension.id === id) || DIMENSIONS[0];
}

function metric(label, value, mark, color) {
  return `
    <div class="metric" style="--metric-color:${color}">
      <div class="metric-mark">${mark}</div>
      <div>
        <span>${label}</span>
        <strong>${escapeHTML(String(value))}</strong>
      </div>
    </div>
  `;
}

function progressLine(title, valueText, progress, color) {
  return `
    <div class="progress-block" style="--bar-color:${color}; --progress:${clamp(progress, 0, 1)}">
      <div class="progress-meta">
        <span>${title}</span>
        <strong>${valueText}</strong>
      </div>
      <div class="progress-track"><div class="progress-fill"></div></div>
    </div>
  `;
}

function emptyState(title, message) {
  return `
    <div class="panel empty-state">
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;
}

function openModal(modal) {
  ui.modal = modal;
  render();
}

function closeModal() {
  ui.modal = null;
  render();
}

async function copyBackup() {
  const text = app.querySelector("#backup-json")?.value || JSON.stringify(state, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    showToast("备份已复制");
  } catch {
    showToast("复制失败，请手动选择文本");
  }
}

function downloadBackup() {
  const text = JSON.stringify(state, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sanwei-growth-backup-${todayKey()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("备份已下载");
}

async function restoreBackupFromModal() {
  const file = app.querySelector("#restore-file")?.files?.[0];
  const pasted = app.querySelector("#restore-json")?.value.trim();

  try {
    const text = file ? await file.text() : pasted;
    if (!text) {
      showToast("请粘贴 JSON 或选择备份文件");
      return;
    }

    const restored = normalizeState(JSON.parse(text));
    state = restored;
    ui.draft = null;
    ui.draftDate = null;
    refreshRewardCooldown();
    saveState();
    closeModal();
    showToast("数据已恢复");
    render();
  } catch {
    showToast("恢复失败：备份格式不正确");
  }
}

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  render();
}

function showToast(message) {
  ui.toast = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    ui.toast = null;
    render();
  }, 1800);
}

function formatNumber(value) {
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function formatDate(dateKey) {
  const date = parseKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatShortDate(dateKey) {
  return formatDate(dateKey);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value).replaceAll("`", "&#096;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
