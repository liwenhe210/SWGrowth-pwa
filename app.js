const STORAGE_KEY = "sanwei-growth-pwa:v1";
const SYNC_META_KEY = "sanwei-growth-pwa:sync-meta:v1";
const SUPABASE_TABLE = "growth_snapshots";
const AI_FUNCTION_NAME = "ai-game-master";

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
  "三维均衡：三项都达到稳定线，或一个周期里平衡日较多。",
  "早睡新手：睡眠节律有明显执行。",
  "内耗拦截者：自评里出现焦虑、内耗、压力等词，同时心境任务有恢复动作。",
  "文献启动：有学业输入，但输出还没跟上。",
  "输出比输入重要：可见输出不低于输入。",
  "低谷不断线：分数不高，但仍然有记录、有保护日或持续活跃。",
  "研究生模式：学业专注和输出都有推进。",
  "身体先稳住：体魄较稳，同时心境没有完全掉线。",
  "今日不断线 / 高能推进：作为低门槛记录和高分推进的兜底称号。"
];

const TITLE_ENGINE = {
  mode: "rules",
  daily(record) {
    return ruleDailyTitleFor(record);
  },
  period(period, records, average, strongest, weakest) {
    return rulePeriodTitleFor(period, records, average, strongest, weakest);
  },
  buildDailyPayload(record) {
    return buildAITitlePayload("day", [record]);
  },
  buildPeriodPayload(period, records) {
    return buildAITitlePayload(period, records);
  }
};

const app = document.querySelector("#app");
let installPrompt = null;
let sync = {
  configured: false,
  ready: false,
  loading: false,
  client: null,
  user: null,
  lastSyncedAt: null,
  error: "",
  pendingCloud: null,
  autoSyncTimer: null,
  suppressAutoSync: false
};
let pendingMerge = null;
let aiRuntime = {
  generatingDates: new Set(),
  errors: {}
};

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
initSupabase();

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
    repairCompletions: [],
    aiSettings: {
      enabled: false,
      shareReflection: true
    }
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
  merged.aiSettings = {
    enabled: Boolean(merged.aiSettings?.enabled),
    shareReflection: merged.aiSettings?.shareReflection !== false
  };

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
  queueCloudSync();
}

function normalizeRecord(record, fallbackDate) {
  return {
    date: record.date || fallbackDate,
    entries: record.entries && typeof record.entries === "object" ? record.entries : {},
    isProtectionDay: Boolean(record.isProtectionDay),
    reflection: record.reflection || "",
    satisfaction: clamp(Number(record.satisfaction || 3), 1, 5),
    tags: Array.isArray(record.tags) ? record.tags : [],
    settledAt: record.settledAt || null,
    aiReview: normalizeAIReview(record.aiReview)
  };
}

function normalizeAIReview(value) {
  if (!value || typeof value !== "object") return null;
  const advice = Array.isArray(value.advice)
    ? value.advice.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 2)
    : [];
  const title = String(value.title || "").trim();
  const analysis = String(value.analysis || "").trim();
  const sourceHash = String(value.sourceHash || "").trim();
  if (!title || !analysis || !sourceHash) return null;
  return {
    title,
    analysis,
    advice,
    tone: String(value.tone || "balanced"),
    model: String(value.model || ""),
    promptVersion: String(value.promptVersion || ""),
    reflectionShared: value.reflectionShared !== false,
    sourceHash,
    generatedAt: value.generatedAt || null
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
            <button class="secondary-btn sync-btn ${sync.user ? "is-signed-in" : ""}" data-action="open-sync">${syncButtonText()}</button>
            <button class="secondary-btn" data-action="install">安装</button>
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
  if (sync.user) return `${syncStatusText()} · ${sync.user.email || "已登录"}`;
  if (ui.tab === "character") return `Lv.${statsValue.totalLevel} / ${statsValue.coinsAvailable} 金币`;
  if (ui.tab === "rewards") return rewardLocked() ? "奖励冷却中" : `${activeRewards().length} 个奖励`;
  if (ui.tab === "review") return `${reviewSummary(ui.reviewPeriod).title}`;
  return `${todayKey() === ui.selectedDate ? "今日" : formatDate(ui.selectedDate)} / ${draftRecord().grade}`;
}

function syncButtonText() {
  if (!sync.configured) return "本地";
  if (sync.loading) return "同步中";
  if (sync.user) return "已同步";
  return "登录";
}

function syncStatusText() {
  if (!sync.configured) return "本地模式";
  if (sync.loading) return "同步中";
  if (sync.error) return "同步异常";
  if (!sync.user) return "未登录";
  if (sync.lastSyncedAt) return `已同步 ${formatDateTime(sync.lastSyncedAt)}`;
  return "已登录";
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
            <div class="title-preview">今日称号：${dailyTitleFor(record)}</div>
            ${hasBalanceBonus(record) ? `<div class="bonus-line">三项均达 6 分，今日可获得平衡加成金币。</div>` : ""}
          </div>
        </div>
      </div>

      ${renderDailyAIReviewPanel(record)}

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

function renderDailyAIReviewPanel(record) {
  const review = validDailyAIReview(record);
  const generating = aiRuntime.generatingDates.has(record.date);
  const error = aiRuntime.errors[record.date];
  const recorded = isRecorded(record) && Boolean(record.settledAt);

  if (review) {
    return `
      <div class="panel panel-pad ai-review-panel">
        <div class="panel-title">
          <h2>AI 成长回顾</h2>
          <span class="hint">${review.generatedAt ? formatDateTime(review.generatedAt) : ""}</span>
        </div>
        ${renderAIReviewContent(review)}
        <div class="inline-actions">
          ${state.aiSettings.enabled && sync.user ? `<button class="secondary-btn" data-action="ai-generate-daily" data-ai-date="${record.date}" ${generating ? "disabled" : ""}>重新生成</button>` : ""}
          ${state.aiSettings.enabled ? `<button class="ghost-btn" data-action="ai-disable">关闭 AI</button>` : ""}
        </div>
      </div>
    `;
  }

  if (!state.aiSettings.enabled) {
    return `
      <div class="panel panel-pad ai-review-panel">
        <div class="panel-title"><h2>AI 成长回顾</h2></div>
        <p class="hint">启用后，每次结算可生成动态称号、表现分析和两条低压力建议。打分数据会发送给 DeepSeek。</p>
        <label class="toggle-row ai-consent-row">
          <span>
            <strong>允许发送一句话总结</strong>
            <span class="hint">关闭后只发送任务状态、分数、满意度和标签。</span>
          </span>
          <input id="ai-share-reflection" type="checkbox" ${state.aiSettings.shareReflection ? "checked" : ""} />
        </label>
        <button class="primary-btn" data-action="ai-enable">启用 AI 每日回顾</button>
      </div>
    `;
  }

  if (!sync.user) {
    return `
      <div class="panel panel-pad ai-review-panel">
        <div class="panel-title"><h2>AI 成长回顾</h2></div>
        <p class="hint">AI 请求需要通过登录账号安全调用 Supabase Edge Function。</p>
        <button class="secondary-btn" data-action="open-sync">登录后生成</button>
      </div>
    `;
  }

  if (!recorded) {
    return `
      <div class="panel panel-pad ai-review-panel">
        <div class="panel-title"><h2>AI 成长回顾</h2></div>
        <p class="hint">完成今日结算后生成称号、分析和建议。</p>
        ${renderAIReflectionSetting()}
      </div>
    `;
  }

  return `
    <div class="panel panel-pad ai-review-panel">
      <div class="panel-title">
        <h2>AI 成长回顾</h2>
        <span class="hint">${generating ? "生成中" : "尚未生成"}</span>
      </div>
      <p class="hint">${generating ? "AI 正在读取今天的得分结构并生成成长反馈。" : error ? escapeHTML(error) : "现有规则称号仍然可用，AI 失败不会影响今日记录。"}</p>
      ${renderAIReflectionSetting()}
      <button class="primary-btn" data-action="ai-generate-daily" data-ai-date="${record.date}" ${generating ? "disabled" : ""}>${generating ? "生成中..." : error ? "重试生成" : "生成今日回顾"}</button>
    </div>
  `;
}

function renderAIReflectionSetting() {
  return `
    <label class="toggle-row ai-consent-row">
      <span>
        <strong>发送一句话总结</strong>
        <span class="hint">关闭后 AI 不会收到总结正文。</span>
      </span>
      <input id="ai-share-reflection" type="checkbox" ${state.aiSettings.shareReflection ? "checked" : ""} />
    </label>
  `;
}

function renderAIReviewContent(review, compact = false) {
  return `
    <div class="ai-review-content ${compact ? "is-compact" : ""}">
      <div class="ai-title-line">
        <span>称号</span>
        <strong>${escapeHTML(review.title)}</strong>
      </div>
      <p>${escapeHTML(review.analysis)}</p>
      ${review.advice.length ? `
        <div class="ai-advice-list">
          ${review.advice.map((item) => `<div>${escapeHTML(item)}</div>`).join("")}
        </div>
      ` : ""}
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

      ${renderTrendChartsPanel(ui.reviewPeriod)}

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

function renderTrendChartsPanel(period) {
  const series = trendSeries(period);
  const recordedCount = series.filter((item) => item.record).length;

  return `
    <div class="panel panel-pad">
      <div class="panel-title">
        <h2>折线统计</h2>
        <span class="hint">${recordedCount} 个记录点</span>
      </div>
      ${
        recordedCount
          ? `<div class="trend-grid">
              ${renderLineChart("总分", series.map((item) => ({ ...item, value: item.record ? totalScore(item.record) : null })), 30, "#2f6f8f")}
              ${DIMENSIONS.map((dimension) => renderLineChart(
                dimension.title,
                series.map((item) => ({ ...item, value: item.record ? scoreForDimension(item.record, dimension.id) : null })),
                10,
                dimension.color
              )).join("")}
            </div>`
          : `<div class="empty-state"><strong>暂无折线数据</strong><span>完成记录后，这里会展示总分和三大板块的变化。</span></div>`
      }
    </div>
  `;
}

function renderLineChart(title, series, maxValue, color) {
  const points = chartPoints(series, maxValue);
  const linePoints = points.filter((point) => point.value !== null).map((point) => `${point.x},${point.y}`).join(" ");
  const latest = [...series].reverse().find((item) => item.value !== null);

  return `
    <article class="chart-card" style="--chart-color:${color}">
      <div class="chart-head">
        <strong>${title}</strong>
        <span>${latest ? `${formatNumber(latest.value)}/${maxValue}` : "暂无"}</span>
      </div>
      <svg class="line-chart" viewBox="0 0 320 126" role="img" aria-label="${title}折线图">
        <line x1="18" y1="18" x2="18" y2="104" class="chart-axis"></line>
        <line x1="18" y1="104" x2="306" y2="104" class="chart-axis"></line>
        <line x1="18" y1="61" x2="306" y2="61" class="chart-grid-line"></line>
        ${linePoints ? `<polyline points="${linePoints}" class="chart-line"></polyline>` : ""}
        ${points.filter((point) => point.value !== null).map((point) => `
          <circle cx="${point.x}" cy="${point.y}" r="3.2" class="chart-dot">
            <title>${point.label}: ${formatNumber(point.value)}</title>
          </circle>
        `).join("")}
      </svg>
      <div class="chart-labels">
        <span>${series[0]?.label || ""}</span>
        <span>${series[series.length - 1]?.label || ""}</span>
      </div>
    </article>
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
  const aiReview = validDailyAIReview(record);

  return `
    <details class="record-item">
      <summary class="record-head">
        <span>
          <strong>${formatDate(record.date)}</strong>
          <em>${dailyTitleFor(record)}</em>
        </span>
        <span>${gradeFor(record)} · ${formatNumber(totalScore(record))}/30 · 满意度 ${record.satisfaction}/5</span>
      </summary>
      <p>${reflection}</p>
      <div class="tag-list">${tags}</div>
      ${aiReview ? renderAIReviewContent(aiReview, true) : ""}
      <div class="record-score-detail">
        ${DIMENSIONS.map((dimension) => renderRecordDimensionDetail(record, dimension)).join("")}
      </div>
    </details>
  `;
}

function renderRecordDimensionDetail(record, dimension) {
  const tasks = TASKS.filter((task) => task.dimension === dimension.id);

  return `
    <div class="record-dimension" style="--dimension-color:${dimension.color}">
      <div class="record-dimension-head">
        <strong>${dimension.title}</strong>
        <span>${formatNumber(scoreForDimension(record, dimension.id))}/10</span>
      </div>
      ${tasks.map((task) => `
        <div class="record-task">
          <span>${task.title}</span>
          <span>${statusLabel(record.entries[task.id] || "none")} · ${formatNumber(taskScore(record, task))}/${task.points}</span>
        </div>
      `).join("")}
    </div>
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
  if (ui.modal.type === "install") return renderInstallModal();
  if (ui.modal.type === "sync") return renderSyncModal();
  if (ui.modal.type === "cloudConflict") return renderCloudConflictModal(ui.modal.cloudSnapshot);
  if (ui.modal.type === "recordMergeConflict") return renderRecordMergeConflictModal();
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
            <span class="field-label">导入备份</span>
            <textarea id="restore-json" placeholder="把备份 JSON 粘贴到这里，再点合并导入"></textarea>
          </label>
          <label class="form-row">
            <span class="field-label">从文件导入</span>
            <input id="restore-file" type="file" accept="application/json,.json" />
          </label>
          <p class="hint">导入会默认合并记录，不会因为备份里缺少某天就删除本机已有记录。同一天内容不同会让你逐条选择。</p>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" data-action="download-backup">下载</button>
          <button class="secondary-btn" data-action="restore-backup">合并导入</button>
          <button class="primary-btn" data-action="copy-backup">复制</button>
        </div>
      </section>
    </div>
  `;
}

function renderRecordMergeConflictModal() {
  if (!pendingMerge) return "";
  const conflict = pendingMerge.conflicts[pendingMerge.index];
  if (!conflict) return "";
  const incomingLabel = pendingMerge.incomingLabel || "备份";
  const progress = `${pendingMerge.index + 1}/${pendingMerge.conflicts.length}`;

  return `
    <div class="modal-backdrop">
      <section class="modal modal-wide" role="dialog" aria-modal="true" aria-label="记录冲突" data-modal>
        <div class="modal-header">
          <h2>${formatDate(conflict.date)} 记录冲突</h2>
          <button class="ghost-btn" data-action="close-modal">取消</button>
        </div>
        <div class="modal-body">
          <div class="sync-status-card">
            <strong>需要选择保留哪一版</strong>
            <p>这是第 ${progress} 条冲突。两边都有内容且不一致，系统不会静默覆盖。</p>
          </div>
          <div class="record-conflict-grid">
            ${renderConflictRecordPreview(conflict.local, "本机版本")}
            ${renderConflictRecordPreview(conflict.incoming, `${incomingLabel}版本`)}
          </div>
        </div>
        <div class="modal-footer conflict-actions">
          <button class="secondary-btn" data-action="merge-keep-local">保留本机版本</button>
          <button class="primary-btn" data-action="merge-use-incoming">使用${incomingLabel}版本</button>
          <button class="danger-btn" data-action="merge-rerecord">重新记录</button>
        </div>
      </section>
    </div>
  `;
}

function renderConflictRecordPreview(record, label) {
  const safeRecord = normalizeRecord(record, record.date);
  const tags = safeRecord.tags?.length ? safeRecord.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("") : "<em>无标签</em>";
  const reflection = (safeRecord.reflection || "").trim() || "无总结";
  const meta = [
    `${formatNumber(totalScore(safeRecord))}/30 · ${gradeFor(safeRecord)}`,
    `满意度 ${safeRecord.satisfaction}/5`,
    safeRecord.isProtectionDay ? "保护日" : "",
    safeRecord.settledAt ? `记录于 ${formatDateTime(safeRecord.settledAt)}` : ""
  ].filter(Boolean).join(" · ");

  return `
    <article class="conflict-record-card">
      <div class="conflict-record-head">
        <strong>${label}</strong>
        <span>${meta}</span>
      </div>
      <p>${escapeHTML(reflection)}</p>
      <div class="tag-list">${tags}</div>
      <div class="conflict-task-list">
        ${TASKS.map((task) => `
          <div>
            <span>${task.title}</span>
            <strong>${statusLabel(safeRecord.entries[task.id] || "none")}</strong>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderInstallModal() {
  return `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-label="安装说明" data-modal>
        <div class="modal-header">
          <h2>安装到主屏幕</h2>
          <button class="ghost-btn" data-action="close-modal">关闭</button>
        </div>
        <div class="modal-body">
          <div class="install-steps">
            <div>
              <strong>iPhone / iPad Safari</strong>
              <p>点底部分享按钮，选择「添加到主屏幕」，再点「添加」。如果已经安装过，删除旧图标后重新添加可以刷新图标和标题。</p>
            </div>
            <div>
              <strong>Android Chrome</strong>
              <p>点右上角菜单，选择「安装应用」或「添加到主屏幕」。如果当前浏览器支持直接安装，也可以点本页顶部「安装」按钮。</p>
            </div>
            <div>
              <strong>电脑浏览器</strong>
              <p>Chrome / Edge 地址栏右侧可能出现安装图标；也可以从浏览器菜单里选择安装应用。</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="primary-btn" data-action="close-modal">知道了</button>
        </div>
      </section>
    </div>
  `;
}

function renderSyncModal() {
  const config = supabaseConfig();
  const userEmail = sync.user?.email || "";

  return `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-label="云同步" data-modal>
        <div class="modal-header">
          <h2>云同步</h2>
          <button class="ghost-btn" data-action="close-modal">关闭</button>
        </div>
        <div class="modal-body">
          ${!sync.configured ? renderSyncConfigHint(config) : sync.user ? renderSignedInSync(userEmail) : renderSignInForm()}
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" data-action="close-modal">关闭</button>
        </div>
      </section>
    </div>
  `;
}

function renderSyncConfigHint(config) {
  return `
    <div class="sync-status-card">
      <strong>当前是本地模式</strong>
      <p>要启用电脑和手机自动同步，请先在 Supabase 创建项目，然后把 Project URL 和 anon public key 填到 <code>supabase-config.js</code>。</p>
      <p class="hint">已检测配置：URL ${config.url ? "已填写" : "未填写"}，anon key ${config.anonKey ? "已填写" : "未填写"}。</p>
    </div>
  `;
}

function renderSignInForm() {
  return `
    <div class="sync-status-card">
      <strong>登录后自动同步</strong>
      <p>同一账号在电脑和手机登录后会共享一份云端数据；不同账号的数据由 Supabase 权限隔离。</p>
    </div>
    ${sync.error ? `<p class="sync-error">${escapeHTML(sync.error)}</p>` : ""}
    <label class="form-row">
      <span class="field-label">邮箱</span>
      <input id="sync-email" type="email" autocomplete="email" placeholder="you@example.com" />
    </label>
    <label class="form-row">
      <span class="field-label">密码</span>
      <input id="sync-password" type="password" autocomplete="current-password" placeholder="至少 6 位" />
    </label>
    <div class="inline-actions">
      <button class="primary-btn" data-action="sync-sign-in" ${sync.loading ? "disabled" : ""}>登录</button>
      <button class="secondary-btn" data-action="sync-sign-up" ${sync.loading ? "disabled" : ""}>注册</button>
    </div>
  `;
}

function renderSignedInSync(userEmail) {
  return `
    <div class="sync-status-card">
      <strong>${escapeHTML(userEmail)}</strong>
      <p>${syncStatusText()}</p>
      <p class="hint">本地仍会保存一份离线缓存；登录状态下，结算、兑换奖励、恢复备份等操作会自动上传到云端。</p>
    </div>
    ${sync.error ? `<p class="sync-error">${escapeHTML(sync.error)}</p>` : ""}
    <div class="sync-actions">
      <button class="primary-btn" data-action="sync-pull" ${sync.loading ? "disabled" : ""}>拉取云端</button>
      <button class="secondary-btn" data-action="sync-push" ${sync.loading ? "disabled" : ""}>上传本机</button>
      <button class="danger-btn" data-action="sync-sign-out" ${sync.loading ? "disabled" : ""}>退出登录</button>
    </div>
  `;
}

function renderCloudConflictModal(cloudSnapshot) {
  return `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-label="选择同步方向" data-modal>
        <div class="modal-header">
          <h2>选择同步方向</h2>
        </div>
        <div class="modal-body">
          <div class="sync-compare">
            <div>
              <strong>本机</strong>
              <span>${localStateSummary()}</span>
            </div>
            <div>
              <strong>云端</strong>
              <span>${cloudStateSummary(cloudSnapshot)}</span>
            </div>
          </div>
          <p class="hint">建议先下载备份，再选择。默认同步会合并本机和云端；这里的覆盖选项只适合你明确知道哪一边才是完整数据时使用。</p>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" data-action="export">先备份</button>
          <button class="danger-btn" data-action="sync-use-cloud">使用云端覆盖本机</button>
          <button class="secondary-btn" data-action="sync-push">本机覆盖云端</button>
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
      if (action === "merge-keep-local") resolvePendingMergeConflict("local");
      if (action === "merge-use-incoming") resolvePendingMergeConflict("incoming");
      if (action === "merge-rerecord") resolvePendingMergeConflict("rerecord");
      if (action === "open-sync") openModal({ type: "sync" });
      if (action === "sync-sign-in") signInFromModal();
      if (action === "sync-sign-up") signUpFromModal();
      if (action === "sync-sign-out") signOut();
      if (action === "sync-pull") pullCloudState({ force: true });
      if (action === "sync-push") pushCloudState({ manual: true });
      if (action === "sync-use-cloud") usePendingCloudState();
      if (action === "ai-enable") enableDailyAI();
      if (action === "ai-disable") disableDailyAI();
      if (action === "ai-generate-daily") generateDailyAIReview(button.dataset.aiDate, { force: true });
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

  const aiShareReflection = app.querySelector("#ai-share-reflection");
  if (aiShareReflection) {
    aiShareReflection.addEventListener("change", () => {
      state.aiSettings.shareReflection = aiShareReflection.checked;
      saveState();
      render();
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
  if (state.aiSettings.enabled && sync.user) {
    generateDailyAIReview(ui.selectedDate);
  }
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

function enableDailyAI() {
  const shareReflection = app.querySelector("#ai-share-reflection");
  if (shareReflection) state.aiSettings.shareReflection = shareReflection.checked;
  state.aiSettings.enabled = true;
  saveState();
  if (!sync.user) {
    showToast("AI 已启用，请先登录");
    openModal({ type: "sync" });
    return;
  }
  const record = state.records[ui.selectedDate];
  render();
  if (record && isRecorded(record) && record.settledAt) {
    generateDailyAIReview(ui.selectedDate);
  }
}

function disableDailyAI() {
  state.aiSettings.enabled = false;
  saveState();
  render();
}

async function generateDailyAIReview(dateKey, { force = false } = {}) {
  const record = state.records[dateKey] ? normalizeRecord(state.records[dateKey], dateKey) : null;
  if (!record || !isRecorded(record) || !record.settledAt) {
    showToast("请先完成这一天的结算");
    return;
  }
  if (!state.aiSettings.enabled) {
    showToast("请先启用 AI 每日回顾");
    return;
  }
  if (!sync.client || !sync.user) {
    openModal({ type: "sync" });
    return;
  }
  if (aiRuntime.generatingDates.has(dateKey)) return;

  const sourceHash = dailyReviewSourceHash(record);
  if (!force && validDailyAIReview(record)) return;

  aiRuntime.generatingDates.add(dateKey);
  delete aiRuntime.errors[dateKey];
  render();

  try {
    const response = await invokeAIFunction({
      mode: "daily_review",
      sourceHash,
      force,
      payload: buildDailyAIRequestPayload(record)
    });
    const review = normalizeAIReview({
      ...response.review,
      sourceHash: response.sourceHash || sourceHash,
      model: response.model || response.review?.model,
      promptVersion: response.promptVersion || response.review?.promptVersion,
      reflectionShared: state.aiSettings.shareReflection,
      generatedAt: response.generatedAt || response.review?.generatedAt || new Date().toISOString()
    });
    if (!review) throw new Error("AI 返回内容格式不完整");

    state.records[dateKey] = normalizeRecord({
      ...state.records[dateKey],
      aiReview: review
    }, dateKey);
    if (ui.draftDate === dateKey && ui.draft) {
      ui.draft.aiReview = clone(review);
    }
    saveState();
    showToast(response.cached ? "已读取缓存的 AI 回顾" : "AI 成长回顾已生成");
  } catch (error) {
    const message = readableAIError(error);
    aiRuntime.errors[dateKey] = message;
    showToast(`AI 生成失败：${message}`);
  } finally {
    aiRuntime.generatingDates.delete(dateKey);
    render();
  }
}

async function invokeAIFunction(body) {
  const config = supabaseConfig();
  const { data, error } = await sync.client.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("登录状态已失效，请重新登录");

  const response = await fetch(`${config.url}/functions/v1/${AI_FUNCTION_NAME}`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || result.message || `AI 服务请求失败 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return result;
}

function buildDailyAIRequestPayload(record) {
  const previousRecords = sortedRecords()
    .filter((item) => isRecorded(item) && item.date <= record.date)
    .slice(-7)
    .map((item) => ({
      date: item.date,
      totalScore: totalScore(item),
      health: scoreForDimension(item, "health"),
      mindset: scoreForDimension(item, "mindset"),
      study: scoreForDimension(item, "study")
    }));

  return {
    date: record.date,
    totalScore: totalScore(record),
    grade: gradeFor(record),
    dimensions: Object.fromEntries(DIMENSIONS.map((dimension) => [dimension.id, scoreForDimension(record, dimension.id)])),
    tasks: Object.fromEntries(TASKS.map((task) => [task.id, {
      status: record.entries[task.id] || "none",
      score: taskScore(record, task),
      maxScore: task.points
    }])),
    reflection: state.aiSettings.shareReflection ? record.reflection || "" : "",
    reflectionShared: state.aiSettings.shareReflection,
    satisfaction: record.satisfaction,
    tags: record.tags || [],
    isProtectionDay: record.isProtectionDay,
    recentTrend: previousRecords
  };
}

function dailyReviewSourceHash(record, shareReflection = state.aiSettings.shareReflection) {
  const payload = {
    date: record.date,
    entries: Object.fromEntries(TASKS.map((task) => [task.id, record.entries[task.id] || "none"])),
    reflection: shareReflection ? record.reflection || "" : "",
    reflectionShared: shareReflection,
    satisfaction: record.satisfaction,
    tags: record.tags || [],
    isProtectionDay: record.isProtectionDay
  };
  return `daily-${hashString(stableStringify(payload))}`;
}

function validDailyAIReview(record) {
  const review = normalizeAIReview(record?.aiReview);
  if (!review) return null;
  return review.sourceHash === dailyReviewSourceHash(record, review.reflectionShared) ? review : null;
}

function hashString(value) {
  let hash1 = 1779033703;
  let hash2 = 3144134277;
  let hash3 = 1013904242;
  let hash4 = 2773480762;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charCodeAt(index);
    hash1 = hash2 ^ Math.imul(hash1 ^ character, 597399067);
    hash2 = hash3 ^ Math.imul(hash2 ^ character, 2869860233);
    hash3 = hash4 ^ Math.imul(hash3 ^ character, 951274213);
    hash4 = hash1 ^ Math.imul(hash4 ^ character, 2716044179);
  }
  hash1 = Math.imul(hash3 ^ (hash1 >>> 18), 597399067);
  hash2 = Math.imul(hash4 ^ (hash2 >>> 22), 2869860233);
  hash3 = Math.imul(hash1 ^ (hash3 >>> 17), 951274213);
  hash4 = Math.imul(hash2 ^ (hash4 >>> 19), 2716044179);
  return [hash1, hash2, hash3, hash4]
    .map((hash) => (hash >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

function readableAIError(error) {
  const message = error?.message || String(error || "AI 生成失败");
  if (error?.status === 404) return "AI Edge Function 尚未部署";
  if (error?.status === 401) return "登录状态已失效，请重新登录";
  if (error?.status === 429) return "今天的 AI 生成次数已达上限";
  if (/Failed to fetch|NetworkError/i.test(message)) return "网络连接失败，请稍后重试";
  return message;
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
    settledAt: null,
    aiReview: null
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

function statusLabel(statusID) {
  return STATUSES.find((status) => status.id === statusID)?.label || "未做";
}

function taskScore(record, task) {
  return task.points * statusMultiplier(record.entries[task.id] || "none");
}

function taskScoreByID(record, taskID) {
  const task = TASKS.find((item) => item.id === taskID);
  return task ? taskScore(record, task) : 0;
}

function scoreForDimension(record, dimensionID) {
  return TASKS
    .filter((task) => task.dimension === dimensionID)
    .reduce((sum, task) => sum + taskScore(record, task), 0);
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
    title: periodTitleFor(period, scoredRecords, averageScore, strongest, weakest),
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

function dailyTitleFor(record) {
  const aiReview = validDailyAIReview(record);
  if (aiReview) return aiReview.title;
  return TITLE_ENGINE.daily(record);
}

function periodTitleFor(period, records, average, strongest, weakest) {
  return TITLE_ENGINE.period(period, records, average, strongest, weakest);
}

function ruleDailyTitleFor(record) {
  const reflection = `${record.reflection || ""} ${(record.tags || []).join(" ")}`;
  const health = scoreForDimension(record, "health");
  const mindset = scoreForDimension(record, "mindset");
  const study = scoreForDimension(record, "study");

  if (hasBalanceBonus(record)) return "三维均衡";
  if (record.isProtectionDay || (totalScore(record) >= 8 && totalScore(record) < 18)) return "低谷不断线";
  if (taskScoreByID(record, "health_sleep") >= 2) return "早睡新手";
  if (/(内耗|焦虑|压力|崩|烦|自责|低落)/.test(reflection) && (mindset >= 4 || taskScoreByID(record, "mind_support") > 0)) return "内耗拦截者";
  if (taskScoreByID(record, "study_input") > 0 && taskScoreByID(record, "study_output") === 0) return "文献启动";
  if (taskScoreByID(record, "study_output") >= 2 && taskScoreByID(record, "study_output") >= taskScoreByID(record, "study_input")) return "输出比输入重要";
  if (study >= 6 && taskScoreByID(record, "study_focus") > 0) return "研究生模式";
  if (health >= 6 && mindset >= 4) return "身体先稳住";
  if (totalScore(record) >= 23) return "高能推进";
  return "今日不断线";
}

function rulePeriodTitleFor(period, records, average, strongest, weakest) {
  if (!records.length) return "等待开局者";

  const reflectionText = records.map((record) => `${record.reflection || ""} ${(record.tags || []).join(" ")}`).join(" ");
  const balanceDays = records.filter(hasBalanceBonus).length;
  const outputAverage = averageTaskScore(records, "study_output");
  const inputAverage = averageTaskScore(records, "study_input");
  const focusAverage = averageTaskScore(records, "study_focus");
  const sleepAverage = averageTaskScore(records, "health_sleep");
  const mindRecoveryAverage = averageTaskScore(records, "mind_recovery") + averageTaskScore(records, "mind_support");

  if (average >= 24 && balanceDays >= Math.ceil(records.length * 0.45)) return "三维均衡";
  if (average < 18 && records.length >= 4) return "低谷不断线";
  if (/(内耗|焦虑|压力|崩|烦|自责|低落)/.test(reflectionText) && mindRecoveryAverage >= 3) return "内耗拦截者";
  if (outputAverage >= 2.5 && outputAverage >= inputAverage) return "输出比输入重要";
  if (strongest === "study" && focusAverage >= 1.5) return "研究生模式";
  if (inputAverage >= 2 && outputAverage < 2) return "文献启动";
  if (sleepAverage >= 2.5) return "早睡新手";

  return titleFor(period, average, strongest, weakest, records.length);
}

function buildAITitlePayload(period, records) {
  const normalizedRecords = records.filter(Boolean);
  const scores = normalizedRecords.map((record) => ({
    date: record.date,
    totalScore: totalScore(record),
    grade: gradeFor(record),
    dimensionScores: Object.fromEntries(DIMENSIONS.map((dimension) => [dimension.id, scoreForDimension(record, dimension.id)])),
    taskScores: Object.fromEntries(TASKS.map((task) => [task.id, taskScore(record, task)])),
    reflection: record.reflection || "",
    satisfaction: record.satisfaction,
    tags: record.tags || [],
    isProtectionDay: record.isProtectionDay
  }));

  return {
    period,
    app: "科研人才养成计划",
    titleStyle: "温和、有趣、具体、带研究生日常感，不羞辱用户",
    records: scores
  };
}

function averageTaskScore(records, taskID) {
  if (!records.length) return 0;
  return records.reduce((sum, record) => sum + taskScoreByID(record, taskID), 0) / records.length;
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

function trendSeries(period) {
  const interval = period === "week" ? currentWeekInterval() : currentMonthInterval();
  const today = parseKey(todayKey());
  const end = interval.end < addDays(today, 1) ? interval.end : addDays(today, 1);
  const series = [];

  for (let cursor = interval.start; cursor < end; cursor = addDays(cursor, 1)) {
    const key = keyFromDate(cursor);
    const record = state.records[key] ? normalizeRecord(state.records[key], key) : null;
    series.push({
      key,
      label: formatDate(key),
      record: record && isRecorded(record) ? record : null
    });
  }

  return series;
}

function chartPoints(series, maxValue) {
  const left = 18;
  const right = 306;
  const top = 18;
  const bottom = 104;
  const count = Math.max(1, series.length - 1);

  return series.map((item, index) => {
    const value = item.value === null || item.value === undefined ? null : clamp(Number(item.value), 0, maxValue);
    const x = series.length === 1 ? (left + right) / 2 : left + ((right - left) * index) / count;
    const y = value === null ? null : bottom - ((bottom - top) * value) / maxValue;
    return {
      ...item,
      x: Math.round(x * 10) / 10,
      y: y === null ? null : Math.round(y * 10) / 10,
      value
    };
  });
}

function heatmapStyle(record) {
  if (!record) return "--cell-bg:#f0ede6; --cell-color:#8b8981";
  const score = totalScore(record);
  const palette = [
    { min: 0, background: "#dce5eb", color: "#40505d" },
    { min: 6, background: "#c6d3dc", color: "#344754" },
    { min: 12, background: "#aabcc9", color: "#273b49" },
    { min: 18, background: "#849bad", color: "#ffffff" },
    { min: 23, background: "#637d92", color: "#ffffff" },
    { min: 27, background: "#435f77", color: "#ffffff" }
  ];
  const tone = [...palette].reverse().find((item) => score >= item.min) || palette[0];
  const protectionOutline = record.isProtectionDay ? "inset 0 0 0 2px rgba(255,255,255,0.72)" : "none";
  return `--cell-bg:${tone.background}; --cell-color:${tone.color}; --cell-outline:${protectionOutline}`;
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
  if (ui.modal?.type === "recordMergeConflict") {
    pendingMerge = null;
  }
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
    startStateMerge(restored, {
      source: "backup",
      incomingLabel: "备份",
      successMessage: "备份已合并"
    });
  } catch {
    showToast("导入失败：备份格式不正确");
  }
}

function startStateMerge(incomingValue, options = {}) {
  const merge = buildStateMerge(state, incomingValue, options);
  if (!merge.conflicts.length) {
    commitMergedState(merge);
    return true;
  }

  pendingMerge = merge;
  ui.modal = { type: "recordMergeConflict" };
  render();
  return false;
}

function buildStateMerge(localValue, incomingValue, options = {}) {
  const localState = normalizeState(clone(localValue));
  const incomingState = normalizeState(clone(incomingValue));
  const mergedState = normalizeState(clone(localState));
  const conflicts = [];
  const summary = {
    addedRecords: 0,
    keptLocalRecords: 0,
    identicalRecords: 0,
    conflictRecords: 0,
    mergedRewards: 0
  };

  mergedState.rewards = mergeRewards(localState.rewards, incomingState.rewards, summary);
  mergedState.repairCompletions = mergeRepairCompletions(localState.repairCompletions, incomingState.repairCompletions);
  mergedState.cooldownUntil = latestISO(localState.cooldownUntil, incomingState.cooldownUntil);
  mergedState.lastPenaltyWeekKey = localState.lastPenaltyWeekKey || incomingState.lastPenaltyWeekKey || null;

  for (const date of Object.keys(incomingState.records).sort()) {
    const incomingRecord = normalizeRecord(incomingState.records[date], date);
    if (!isRecorded(incomingRecord)) continue;

    const localRecord = localState.records[date] ? normalizeRecord(localState.records[date], date) : null;
    if (!localRecord || !isRecorded(localRecord)) {
      mergedState.records[date] = incomingRecord;
      summary.addedRecords += 1;
      continue;
    }

    if (recordsEquivalent(localRecord, incomingRecord)) {
      mergedState.records[date] = mergeEquivalentRecords(localRecord, incomingRecord);
      summary.identicalRecords += 1;
      continue;
    }

    conflicts.push({
      date,
      local: localRecord,
      incoming: incomingRecord
    });
    summary.conflictRecords += 1;
  }

  return {
    source: options.source || "backup",
    incomingLabel: options.incomingLabel || "备份",
    successMessage: options.successMessage || "数据已合并",
    lastSyncedAt: options.lastSyncedAt || null,
    pushAfterCommit: Boolean(options.pushAfterCommit),
    index: 0,
    conflicts,
    mergedState,
    summary,
    reRecordDate: null
  };
}

function resolvePendingMergeConflict(choice) {
  if (!pendingMerge) return;
  const conflict = pendingMerge.conflicts[pendingMerge.index];
  if (!conflict) {
    commitMergedState(pendingMerge);
    return;
  }

  if (choice === "incoming") {
    pendingMerge.mergedState.records[conflict.date] = clone(conflict.incoming);
  }
  if (choice === "local") {
    pendingMerge.mergedState.records[conflict.date] = clone(conflict.local);
  }
  if (choice === "rerecord") {
    delete pendingMerge.mergedState.records[conflict.date];
    pendingMerge.reRecordDate = pendingMerge.reRecordDate || conflict.date;
  }

  pendingMerge.index += 1;
  if (pendingMerge.index < pendingMerge.conflicts.length) {
    render();
    return;
  }

  commitMergedState(pendingMerge);
}

function commitMergedState(merge) {
  const reRecordDate = merge.reRecordDate;
  const pushAfterCommit = merge.pushAfterCommit;
  const lastSyncedAt = merge.lastSyncedAt;
  const message = mergeSummaryMessage(merge);

  state = normalizeState(merge.mergedState);
  ui.draft = null;
  ui.draftDate = null;
  if (reRecordDate) {
    ui.tab = "today";
    ui.selectedDate = reRecordDate;
  }
  refreshRewardCooldown();
  saveState();
  if (lastSyncedAt) sync.lastSyncedAt = lastSyncedAt;
  pendingMerge = null;
  ui.modal = null;
  showToast(message);
  render();
  if (pushAfterCommit) {
    pushCloudState({ silent: true });
  }
}

function mergeSummaryMessage(merge) {
  const parts = [];
  if (merge.summary.addedRecords) parts.push(`新增 ${merge.summary.addedRecords} 天`);
  if (merge.summary.conflictRecords) parts.push(`处理 ${merge.summary.conflictRecords} 个冲突`);
  if (merge.summary.mergedRewards) parts.push(`合并 ${merge.summary.mergedRewards} 个奖励`);
  if (merge.reRecordDate) parts.push(`已跳转到 ${formatDate(merge.reRecordDate)}`);
  return parts.length ? `${merge.successMessage}：${parts.join("，")}` : merge.successMessage;
}

function recordsEquivalent(recordA, recordB) {
  return stableStringify(recordCoreForMerge(recordA)) === stableStringify(recordCoreForMerge(recordB));
}

function recordCoreForMerge(record) {
  const normalized = normalizeRecord(record, record.date);
  return {
    date: normalized.date,
    entries: normalized.entries,
    isProtectionDay: normalized.isProtectionDay,
    reflection: normalized.reflection,
    satisfaction: normalized.satisfaction,
    tags: normalized.tags,
    settledAt: normalized.settledAt
  };
}

function mergeEquivalentRecords(localRecord, incomingRecord) {
  const local = normalizeRecord(localRecord, localRecord.date);
  const incoming = normalizeRecord(incomingRecord, incomingRecord.date);
  const reviews = [local.aiReview, incoming.aiReview]
    .map(normalizeAIReview)
    .filter(Boolean)
    .sort((a, b) => new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime());
  return normalizeRecord({
    ...local,
    aiReview: reviews[0] || null
  }, local.date);
}

function mergeRewards(localRewards, incomingRewards, summary) {
  const merged = localRewards.map((reward) => clone(reward));
  const byID = new Map(merged.map((reward) => [reward.id, reward]));

  for (const incomingReward of incomingRewards) {
    const existing = byID.get(incomingReward.id) || merged.find((reward) => rewardMergeKey(reward) === rewardMergeKey(incomingReward));
    if (!existing) {
      merged.push(clone(incomingReward));
      summary.mergedRewards += 1;
      continue;
    }

    const before = stableStringify(existing);
    existing.redeemedDates = uniqueStrings([...(existing.redeemedDates || []), ...(incomingReward.redeemedDates || [])]);
    existing.archived = Boolean(existing.archived || incomingReward.archived);
    if (!existing.note && incomingReward.note) existing.note = incomingReward.note;
    if (stableStringify(existing) !== before) summary.mergedRewards += 1;
  }

  return merged;
}

function rewardMergeKey(reward) {
  return [
    reward.name,
    reward.note,
    reward.cost,
    reward.requiredWeeklyAverage ?? "",
    reward.requiredActiveDays ?? "",
    reward.requiredDimension ?? "",
    reward.requiredDimensionLevel ?? ""
  ].join("|");
}

function mergeRepairCompletions(localItems, incomingItems) {
  const merged = [...localItems.map((item) => clone(item))];
  const seen = new Set(merged.map(repairCompletionKey));
  for (const item of incomingItems) {
    const key = repairCompletionKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(clone(item));
  }
  return merged;
}

function repairCompletionKey(item) {
  return `${item.id || ""}|${item.date || ""}|${item.title || ""}`;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function latestISO(valueA, valueB) {
  const values = [valueA, valueB].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return values[0] || null;
}

function supabaseConfig() {
  const config = window.SW_GROWTH_SUPABASE_CONFIG || {};
  return {
    url: (config.url || "").trim(),
    anonKey: (config.anonKey || "").trim(),
    sdkUrl: (config.sdkUrl || "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm").trim()
  };
}

async function initSupabase() {
  const config = supabaseConfig();
  sync.configured = Boolean(config.url && config.anonKey);
  if (!sync.configured) {
    render();
    return;
  }

  sync.loading = true;
  sync.error = "";
  render();

  try {
    const module = await import(config.sdkUrl);
    sync.client = module.createClient(config.url, config.anonKey);
    const { data, error } = await sync.client.auth.getSession();
    if (error) throw error;
    sync.user = data.session?.user || null;

    sync.client.auth.onAuthStateChange((_event, session) => {
      sync.user = session?.user || null;
      saveSyncMeta({ userID: sync.user?.id || null, email: sync.user?.email || null });
      if (sync.user) {
        handleSignedIn().catch((error) => {
          sync.error = readableSyncError(error);
          render();
        });
      } else {
        render();
      }
    });

    if (sync.user) await handleSignedIn();
  } catch (error) {
    sync.error = readableSyncError(error);
  } finally {
    sync.loading = false;
    render();
  }
}

async function handleSignedIn() {
  if (!sync.user) return;
  saveSyncMeta({ userID: sync.user.id, email: sync.user.email || null });
  const cloudSnapshot = await fetchCloudSnapshot();
  if (!cloudSnapshot) {
    await pushCloudState({ silent: true });
    return;
  }

  if (statesEquivalent(cloudSnapshot.payload)) {
    sync.lastSyncedAt = cloudSnapshot.updated_at || new Date().toISOString();
    render();
    return;
  }

  if (hasMeaningfulLocalData()) {
    startStateMerge(cloudSnapshot.payload, {
      source: "cloud",
      incomingLabel: "云端",
      successMessage: "云端数据已合并",
      lastSyncedAt: cloudSnapshot.updated_at || new Date().toISOString(),
      pushAfterCommit: true
    });
    return;
  }

  applyCloudSnapshot(cloudSnapshot);
}

async function signInFromModal() {
  const credentials = syncCredentials();
  if (!credentials) return;
  await withSyncLoading(async () => {
    const { error } = await sync.client.auth.signInWithPassword(credentials);
    if (error) throw error;
    closeModal();
  });
}

async function signUpFromModal() {
  const credentials = syncCredentials();
  if (!credentials) return;
  await withSyncLoading(async () => {
    const { error } = await sync.client.auth.signUp(credentials);
    if (error) throw error;
    showToast("注册完成，请按 Supabase 邮件设置确认要求登录");
  });
}

function syncCredentials() {
  if (!sync.client) {
    showToast("Supabase 尚未初始化");
    return null;
  }

  const email = app.querySelector("#sync-email")?.value.trim();
  const password = app.querySelector("#sync-password")?.value || "";
  if (!email || !password) {
    showToast("请填写邮箱和密码");
    return null;
  }
  return { email, password };
}

async function signOut() {
  if (!sync.client) return;
  await withSyncLoading(async () => {
    const { error } = await sync.client.auth.signOut();
    if (error) throw error;
    sync.user = null;
    sync.pendingCloud = null;
    sync.lastSyncedAt = null;
    closeModal();
  });
}

function queueCloudSync() {
  if (sync.suppressAutoSync || !sync.client || !sync.user) return;
  window.clearTimeout(sync.autoSyncTimer);
  sync.autoSyncTimer = window.setTimeout(() => {
    pushCloudState({ silent: true });
  }, 900);
}

async function fetchCloudSnapshot() {
  if (!sync.client || !sync.user) return null;
  const { data, error } = await sync.client
    .from(SUPABASE_TABLE)
    .select("payload, updated_at")
    .eq("user_id", sync.user.id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function pushCloudState({ manual = false, silent = false } = {}) {
  if (!sync.client || !sync.user) {
    if (manual) openModal({ type: "sync" });
    return;
  }

  await withSyncLoading(async () => {
    const { error } = await sync.client.from(SUPABASE_TABLE).upsert(
      {
        user_id: sync.user.id,
        payload: cloudSafeState(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    sync.lastSyncedAt = new Date().toISOString();
    sync.pendingCloud = null;
    if (!silent) showToast("已上传到云端");
  });
}

async function pullCloudState({ force = false } = {}) {
  if (!sync.client || !sync.user) {
    openModal({ type: "sync" });
    return;
  }

  await withSyncLoading(async () => {
    const cloudSnapshot = await fetchCloudSnapshot();
    if (!cloudSnapshot) {
      showToast("云端还没有数据，已上传本机数据");
      await pushCloudState({ silent: true });
      return;
    }

    if (hasMeaningfulLocalData()) {
      startStateMerge(cloudSnapshot.payload, {
        source: "cloud",
        incomingLabel: "云端",
        successMessage: "云端数据已合并",
        lastSyncedAt: cloudSnapshot.updated_at || new Date().toISOString(),
        pushAfterCommit: true
      });
      return;
    }

    applyCloudSnapshot(cloudSnapshot);
    showToast("已使用云端数据");
  });
}

function usePendingCloudState() {
  if (!sync.pendingCloud) {
    closeModal();
    return;
  }
  applyCloudSnapshot(sync.pendingCloud);
  sync.pendingCloud = null;
  closeModal();
  showToast("已使用云端覆盖本机");
}

function applyCloudSnapshot(cloudSnapshot) {
  const payload = cloudSnapshot?.payload;
  if (!payload || typeof payload !== "object") return;
  sync.suppressAutoSync = true;
  state = normalizeState(payload);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  sync.suppressAutoSync = false;
  sync.lastSyncedAt = cloudSnapshot.updated_at || new Date().toISOString();
  ui.draft = null;
  ui.draftDate = null;
  refreshRewardCooldown();
  render();
}

async function withSyncLoading(task) {
  sync.loading = true;
  sync.error = "";
  render();
  try {
    await task();
  } catch (error) {
    sync.error = readableSyncError(error);
    showToast(sync.error);
  } finally {
    sync.loading = false;
    render();
  }
}

function cloudSafeState() {
  return normalizeState(clone(state));
}

function statesEquivalent(payload) {
  try {
    return stableStringify(normalizeState(payload || {})) === stableStringify(cloudSafeState());
  } catch {
    return false;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasMeaningfulLocalData() {
  return sortedRecords().some(isRecorded) || state.rewards.some((reward) => reward.redeemedDates?.length);
}

function localStateSummary() {
  return `${sortedRecords().filter(isRecorded).length} 条记录，${state.rewards.reduce((sum, reward) => sum + reward.redeemedDates.length, 0)} 次奖励兑换`;
}

function cloudStateSummary(cloudSnapshot) {
  try {
    const payload = normalizeState(cloudSnapshot.payload || {});
    const records = Object.values(payload.records || {}).filter(isRecorded).length;
    const redeemed = payload.rewards.reduce((sum, reward) => sum + reward.redeemedDates.length, 0);
    const updated = cloudSnapshot.updated_at ? `，${formatDateTime(cloudSnapshot.updated_at)}` : "";
    return `${records} 条记录，${redeemed} 次奖励兑换${updated}`;
  } catch {
    return "云端数据可用，但摘要读取失败";
  }
}

function saveSyncMeta(meta) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify({ ...loadSyncMeta(), ...meta, updatedAt: new Date().toISOString() }));
}

function loadSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_META_KEY) || "{}");
  } catch {
    return {};
  }
}

function readableSyncError(error) {
  const message = error?.message || String(error || "同步失败");
  if (/Invalid login credentials/i.test(message)) return "邮箱或密码不正确";
  if (/Email not confirmed/i.test(message)) return "邮箱尚未确认，请先查看确认邮件";
  if (/Failed to fetch|NetworkError/i.test(message)) return "网络连接失败，请稍后重试";
  return message;
}

async function installApp() {
  if (!installPrompt) {
    openModal({ type: "install" });
    return;
  }
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
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日 ${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

function formatTime(value) {
  return formatDateTime(value);
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
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register("./sw.js").then((registration) => {
    registration.update().catch(() => {});
  }).catch(() => {});
}
