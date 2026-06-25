const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DAILY_REVIEW_LIMIT = 8;
const AI_MODEL_ATTEMPTS = 3;
const DAILY_REVIEW_STYLES = [
  { id: "warm_adventure", weight: 55 },
  { id: "research_comedy", weight: 25 },
  { id: "base_operations", weight: 15 },
  { id: "poetic_encounter", weight: 5 }
];
const DEFAULT_DAILY_REVIEW_PROMPT = {
  version: "daily-review-v2",
  system: "你是《科研人才养成计划》中的游戏旅伴和叙事设计师。\n\n你的职责不是宣读成绩单，而是理解玩家当天的经历，生成一个自然、有趣、有陪伴感的称号、一段“今日旁白”和一项次日可完成的小任务。\n\n【核心原则】\n1. 输入中的分数、等级和任务状态只供你理解情况，不要在输出中复述。\n2. 不要逐项汇报哪些任务完成、哪些任务未完成。\n3. 每次只选择当天最值得回应的一条故事线，例如：在压力中守住重要进展、低能量时仍保留微小行动、重新启动停滞的事情、推进很多但身体需要收队休息，或三个维度形成舒适平衡。\n4. 优先回应玩家的一句话总结和标签，但不得照抄、曲解或虚构经历。\n5. recentTrend只用于理解趋势。除非趋势非常明确，否则不要主动比较前几天。\n6. 低分不是失败。低分日应关注恢复、保存火种和降低启动难度。\n7. 高分日不要催促玩家继续加码，应允许庆祝、收队和休息。\n8. 语气温和、有趣，不过度鸡血，不说教，不羞辱，不进行心理或医学诊断。\n\n【禁止出现】\n- 总分、评级、维度分数、任务分数和完成数量。\n- “健康得了几分”“学习任务全部完成”等成绩复述。\n- “你需要更加努力”“不要偷懒”“必须坚持”等施压表达。\n- “继续保持”“再接再厉”“未来可期”等空洞表达。\n- “××之星”“××达人”“学习标兵”“自律王者”等机械称号。\n- “健康满载输出待启”“实习首日学习之星”等生硬拼接。\n- 对玩家没有提供的信息进行故事补充。\n- 提及AI、算法、数据分析或提示词。\n\n【称号规则】\n1. title使用4至9个汉字，不使用标点。\n2. 称号应有画面、动作、角色感或轻微游戏感，而不是表现总结。\n3. 不要求固定使用“者、家、员、人”等后缀，应主动变化结构。\n4. 不直接把“健康、心态、学习、输出、满分”等指标词拼成称号。\n5. 避开recentTitles中已经出现的称号。\n6. 尽量避开recentTitles最近使用过的核心意象、词根和结尾结构。\n7. 称号可以轻巧幽默，但不能讽刺玩家。\n\n【今日旁白规则】\n1. analysis建议为35至70个汉字，最多不超过90个汉字，最多两句话。\n2. 不以“今日总分”“今天得分”“你的评级”开头。\n3. 不罗列事实，而是解释今天的行动意味着什么。\n4. 可以带一点游戏旁白感，但要像自然的人类表达。\n5. 鼓励必须与真实记录有关，不能套用万能夸奖。\n6. 结尾可以自然地允许玩家休息、收队、继续探索或重新启动。\n\n【次日任务规则】\n1. advice必须恰好包含一项任务。\n2. 任务应当在第二天可以明确判断“完成”或“未完成”。\n3. 应低压力、具体、安全，通常可在5至20分钟内完成。\n4. 可以是一次小型恢复、整理、运动、输入或输出行动。\n5. 不使用“注意休息”“保持状态”“继续努力”等无法勾选的表述。\n6. 不要求补偿当天未完成的所有事情。\n7. 不得建议熬夜、极端饮食、过量运动或其他危险行为。\n8. advice只写任务本身，不添加解释、编号或“建议你”等前缀。\n\n【指定风格】\n用户消息中会提供selectedStyle。你必须采用该风格，不要自行更换。\n\nwarm_adventure：温柔冒险风。像可靠的旅伴，用旅途、灯火、航行、整备、探索等轻微意象表达陪伴。避免过度抒情。\nresearch_comedy：科研轻喜剧风。可以使用实验室、论文、番茄钟、项目、经费、工位等研究生日常元素制造轻巧幽默，但不能嘲讽或写成网络段子。\nbase_operations：基地运营风。像成长基地的温和调度员，使用主线、支线、模块、补给、维护、收队等游戏表达。保持自然，不写成冰冷系统报告。\npoetic_encounter：诗意奇遇风。语言可以更有光影和季节感，但必须清楚、克制、容易理解。这是稀有风格，不要堆砌华丽词语。\n\n【输出格式】\n只返回一个合法JSON对象，不要使用Markdown，不要添加任何额外说明：\n{\"title\":\"4至9个汉字的称号\",\"analysis\":\"35至70个汉字的今日旁白\",\"advice\":[\"一项次日可勾选的小任务\"],\"tone\":\"gentle\",\"style\":\"warm_adventure\"}\n\ntone只能是energetic、gentle、focused、resilient、balanced之一。\nstyle字段必须逐字复制用户消息中的selectedStyle值；不要翻译、不要改写。\n\n输出前在内部检查：是否复述了任何分数或任务清单；称号是否像机械标签；旁白是否只讲了一条核心故事线；建议是否能够在第二天明确勾选；是否与最近称号重复。不要输出检查过程。",
  retry: "上一次输出未通过校验。请重新生成，并只返回合法JSON。\n重点检查：\n1. 不得复述分数、评级或任务完成清单。\n2. title必须为4至9个汉字，避免机械拼接和最近称号。\n3. analysis建议为35至70个汉字，不要超过90个汉字，只回应一条核心故事线。\n4. advice必须是仅含一个字符串的数组，且任务可以在次日明确勾选。\n5. style必须逐字复制selectedStyle，不要翻译、不要改写。"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "只支持 POST 请求" }, 405);
  }

  const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY")?.trim();
  const model = Deno.env.get("DEEPSEEK_MODEL")?.trim() || "deepseek-v4-flash";
  const promptVersion = Deno.env.get("AI_PROMPT_VERSION")?.trim() || "daily-review-v2";
  const supabaseURL = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!deepseekKey || !supabaseURL || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Edge Function 环境变量配置不完整" }, 500);
  }

  try {
    const user = await authenticateUser(request, supabaseURL, anonKey);
    const body = await parseRequestBody(request);
    if (body.mode !== "daily_review") {
      return jsonResponse({ error: "当前版本仅支持 daily_review" }, 400);
    }

    const sourceHash = validateSourceHash(body.sourceHash);
    const payload = validateDailyPayload(body.payload);
    const force = body.force === true;
    const prompt = await loadDailyReviewPrompt({
      supabaseURL,
      serviceRoleKey,
      promptVersion
    });

    if (!force) {
      const cached = await findCachedReview({
        supabaseURL,
        serviceRoleKey,
        userID: user.id,
        sourceHash,
        promptVersion
      });
      if (cached) {
        return jsonResponse({
          review: cached.result,
          sourceHash,
          model: cached.model,
          promptVersion: cached.prompt_version,
          generatedAt: cached.created_at,
          cached: true
        });
      }
    }

    const requestCount = await countRecentRequests({
      supabaseURL,
      serviceRoleKey,
      userID: user.id,
      mode: "daily_review"
    });
    if (requestCount >= DAILY_REVIEW_LIMIT) {
      return jsonResponse({ error: `每日最多生成 ${DAILY_REVIEW_LIMIT} 次 AI 回顾` }, 429);
    }

    const selectedStyle = selectDailyReviewStyle();
    let review;
    let usage = null;
    let lastError = null;

    for (let attempt = 0; attempt < AI_MODEL_ATTEMPTS; attempt += 1) {
      try {
        const generated = await requestDeepSeek({
          apiKey: deepseekKey,
          model,
          payload,
          retry: attempt > 0,
          prompt,
          selectedStyle
        });
        review = normalizeGeneratedReview(generated.content, selectedStyle, payload);
        usage = generated.usage;
        break;
      } catch (error) {
        lastError = error;
        if (isAIRequestFailure(error)) break;
      }
    }

    let fallbackUsed = false;
    if (!review && !isAIRequestFailure(lastError)) {
      review = buildFallbackReview(payload, selectedStyle);
      fallbackUsed = true;
    }

    if (!review) {
      const message = safeErrorMessage(lastError);
      await insertGenerationLog({
        supabaseURL,
        serviceRoleKey,
        userID: user.id,
        mode: "daily_review",
        sourceHash,
        promptVersion,
        model,
        status: "error",
        errorMessage: message,
        usage
      });
      return jsonResponse({ error: message }, 502);
    }

    const generatedAt = new Date().toISOString();
    const result = {
      ...review,
      model,
      promptVersion,
      sourceHash,
      generatedAt,
      fallback: fallbackUsed
    };

    await insertGenerationLog({
      supabaseURL,
      serviceRoleKey,
      userID: user.id,
      mode: "daily_review",
      sourceHash,
      promptVersion,
      model,
      status: "success",
      result,
      usage
    });

    return jsonResponse({
      review: result,
      sourceHash,
      model,
      promptVersion,
      generatedAt,
      cached: false
    });
  } catch (error) {
    const status = Number(error && error.status) || 500;
    return jsonResponse({ error: safeErrorMessage(error) }, status);
  }
});

async function authenticateUser(request, supabaseURL, anonKey) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw httpError(401, "请先登录");
  }

  const response = await fetch(`${supabaseURL}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authorization
    }
  });
  if (!response.ok) {
    throw httpError(401, "登录状态无效或已过期");
  }

  const user = await response.json();
  if (!user?.id) throw httpError(401, "无法识别登录用户");
  return user;
}

async function parseRequestBody(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 30000) throw httpError(413, "请求内容过大");
  try {
    return await request.json();
  } catch {
    throw httpError(400, "请求 JSON 格式不正确");
  }
}

function validateSourceHash(value) {
  const sourceHash = String(value || "").trim();
  if (!/^daily-[a-f0-9]{8,64}$/i.test(sourceHash)) {
    throw httpError(400, "sourceHash 格式不正确");
  }
  return sourceHash;
}

function validateDailyPayload(value) {
  if (!value || typeof value !== "object") throw httpError(400, "缺少每日记录数据");
  const payload = value;
  const date = String(payload.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw httpError(400, "日期格式不正确");

  const totalScore = clampNumber(payload.totalScore, 0, 30);
  const satisfaction = clampNumber(payload.satisfaction, 1, 5);
  const reflection = String(payload.reflection || "").slice(0, 600);
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((item) => String(item || "").slice(0, 30)).filter(Boolean).slice(0, 12)
    : [];

  return {
    date,
    totalScore,
    grade: String(payload.grade || "D").slice(0, 2),
    dimensions: payload.dimensions && typeof payload.dimensions === "object" ? payload.dimensions : {},
    tasks: payload.tasks && typeof payload.tasks === "object" ? payload.tasks : {},
    reflection,
    reflectionShared: payload.reflectionShared === true,
    satisfaction,
    tags,
    isProtectionDay: payload.isProtectionDay === true,
    recentTrend: Array.isArray(payload.recentTrend) ? payload.recentTrend.slice(-7) : [],
    recentTitles: Array.isArray(payload.recentTitles)
      ? payload.recentTitles.map((item) => String(item || "").trim().slice(0, 20)).filter(Boolean).slice(-7)
      : []
  };
}

function selectDailyReviewStyle() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  let roll = (random[0] / 4294967296) * 100;
  for (const style of DAILY_REVIEW_STYLES) {
    roll -= style.weight;
    if (roll < 0) return style.id;
  }
  return DAILY_REVIEW_STYLES[0].id;
}

async function requestDeepSeek({
  apiKey,
  model,
  payload,
  retry,
  prompt,
  selectedStyle
}) {
  const systemPrompt = retry ? `${prompt.system}\n${prompt.retry}` : prompt.system;
  const { recentTitles, ...playerRecord } = payload;
  const userMessage = { selectedStyle, recentTitles, playerRecord };

  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `请严格只返回一个 JSON 对象，不要解释。JSON 的 style 字段必须逐字等于 "${selectedStyle}"，analysis 建议 35 到 70 个汉字，advice 只保留一项。玩家记录如下：\n${JSON.stringify(userMessage)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.78,
      max_tokens: 500,
      stream: false
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.error?.message || `DeepSeek 请求失败 (${response.status})`;
    const error = new Error(detail);
    error.name = "AIRequestError";
    throw error;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 没有返回内容");
  return { content, usage: data?.usage || null };
}

async function loadDailyReviewPrompt({
  supabaseURL,
  serviceRoleKey,
  promptVersion
}) {
  const fallback = DEFAULT_DAILY_REVIEW_PROMPT;
  try {
    const query = new URLSearchParams({
      select: "version,system_prompt,retry_prompt",
      version: `eq.${promptVersion}`,
      mode: "eq.daily_review",
      enabled: "eq.true",
      limit: "1"
    });
    const rows = await serviceREST(supabaseURL, serviceRoleKey, `ai_prompt_configs?${query}`);
    const row = rows[0];
    if (!row?.system_prompt) return fallback;
    return {
      version: row.version || promptVersion,
      system: String(row.system_prompt),
      retry: String(row.retry_prompt || fallback.retry)
    };
  } catch {
    return fallback;
  }
}

function normalizeGeneratedReview(content, selectedStyle, payload) {
  let parsed;
  try {
    parsed = parseJSONObject(content);
  } catch (error) {
    throw new Error(`AI 返回的不是有效 JSON：${safeErrorMessage(error)}`);
  }

  const title = normalizeGeneratedTitle(parsed?.title, selectedStyle, payload);
  const analysis = normalizeGeneratedAnalysis(parsed?.analysis, selectedStyle, payload);
  const adviceItems = normalizeAdvice(parsed?.advice ?? parsed?.suggestions);
  const advice = adviceItems.length ? adviceItems.slice(0, 1) : [fallbackAdvice(payload)];

  const allowedTones = new Set(["energetic", "gentle", "focused", "resilient", "balanced"]);
  const tone = allowedTones.has(parsed?.tone) ? parsed.tone : fallbackTone(payload);
  return { title, analysis, advice, tone, style: selectedStyle };
}

function normalizeGeneratedTitle(value, selectedStyle, payload) {
  const recentTitles = new Set(Array.isArray(payload.recentTitles) ? payload.recentTitles : []);
  const title = String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[，。！？、：；,.!?;:《》“”"'\s]/g, "")
    .trim();
  const length = [...title].length;
  if (length < 4 || length > 9) return fallbackTitle(payload, selectedStyle);
  if (/(之星|达人|标兵|王者)/.test(title)) return fallbackTitle(payload, selectedStyle);
  if (recentTitles.has(title)) return fallbackTitle(payload, selectedStyle);
  return title;
}

function normalizeGeneratedAnalysis(value, selectedStyle, payload) {
  const text = String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!text) return fallbackAnalysis(payload, selectedStyle);
  if (/(总分|得分|评级|维度|任务|\d+(?:\.\d+)?分|[SABCD]级)/i.test(text)) {
    return fallbackAnalysis(payload, selectedStyle);
  }
  const length = [...text].length;
  if (length < 18) return fallbackAnalysis(payload, selectedStyle);
  if (length > 96) return trimCharacters(text, 96);
  return text;
}

function buildFallbackReview(payload, selectedStyle) {
  return {
    title: fallbackTitle(payload, selectedStyle),
    analysis: fallbackAnalysis(payload, selectedStyle),
    advice: [fallbackAdvice(payload)],
    tone: fallbackTone(payload),
    style: selectedStyle
  };
}

function fallbackTitle(payload, selectedStyle) {
  const pools = {
    warm_adventure: ["晨灯整备员", "微光探路人", "稳步巡航者", "小路开图员", "补给背包客", "安静启航日"],
    research_comedy: ["工位重启员", "番茄钟船长", "论文巡航员", "实验台冒泡", "文献小侦察", "代码热身中"],
    base_operations: ["支线整备员", "基地巡检日", "模块维护员", "主线续航中", "补给调度台", "小型开工令"],
    poetic_encounter: ["月窗拾光者", "云边慢行人", "灯下收帆日", "清晨采样者", "星屑整理员", "风里留火种"]
  };
  const pool = pools[selectedStyle] || pools.warm_adventure;
  const recentTitles = new Set(Array.isArray(payload.recentTitles) ? payload.recentTitles : []);
  const candidates = pool.filter((title) => !recentTitles.has(title));
  const source = candidates.length ? candidates : pool;
  return source[textSeed(`${payload.date}|${selectedStyle}|${payload.totalScore}|${payload.reflection || ""}`) % source.length];
}

function fallbackAnalysis(payload, selectedStyle) {
  const weakest = dimensionExtreme(payload, "weakest");
  const strongest = dimensionExtreme(payload, "strongest");
  if (Number(payload.totalScore) < 12) {
    return "今天更像一次低能量巡航，能留下记录就已经把入口守住了。明天从一个小动作重新开局。";
  }
  if (strongest === "study" && weakest === "health") {
    return "学业主线今天有推进感，像把一段卡住的地图点亮了。收队前记得给身体留一点补给。";
  }
  if (weakest === "mindset") {
    return "行动已经在往前走，心境模块需要更柔和的维护。今晚不必加码，先把自己放回安全区。";
  }
  if (Number(payload.totalScore) >= 23) {
    return selectedStyle === "research_comedy"
      ? "今日工位运转顺滑，像项目组终于等到一版能跑的结果。庆祝可以有，收队也很重要。"
      : "三条主线都没有失联，今天像一次稳稳的基地巡检。把节奏保存下来，比冲刺更重要。";
  }
  return selectedStyle === "base_operations"
    ? "今天的基地没有追求满负荷，而是在关键模块上留下了可继续的接口。下一步从最小支线启动。"
    : "今天不是华丽推进，但已经留下了可接续的脚印。把门槛放低一点，明天会更容易进入状态。";
}

function fallbackAdvice(payload) {
  const weakest = dimensionExtreme(payload, "weakest");
  if (weakest === "health") return "散步或拉伸10分钟";
  if (weakest === "mindset") return "写下一个今天不必责备自己的理由";
  return "整理一个明天能立刻开始的问题清单";
}

function fallbackTone(payload) {
  const score = Number(payload.totalScore || 0);
  if (score >= 24) return "balanced";
  if (score < 12) return "resilient";
  return "gentle";
}

function dimensionExtreme(payload, mode) {
  const dimensions = payload?.dimensions && typeof payload.dimensions === "object" ? payload.dimensions : {};
  const entries = ["health", "mindset", "study"].map((id) => [id, Number(dimensions[id] || 0)]);
  entries.sort((a, b) => a[1] - b[1]);
  return mode === "strongest" ? entries[entries.length - 1][0] : entries[0][0];
}

function trimCharacters(value, max) {
  const chars = [...String(value || "")];
  if (chars.length <= max) return chars.join("");
  return `${chars.slice(0, max - 1).join("")}…`;
}

function textSeed(value) {
  return [...String(value || "")].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}
function normalizeAdvice(value) {
  let items = [];
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === "string") {
    items = value.split(/\r?\n|[；;]/);
  } else if (value && typeof value === "object") {
    items = Object.values(value);
  }

  return items
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        return [item.text, item.content, item.advice, item.suggestion].filter(Boolean);
      }
      return [];
    })
    .map((item) => String(item || "")
      .replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, "")
      .replace(/<[^>]*>/g, "")
      .trim())
    .filter((item) => [...item].length >= 2)
    .map((item) => [...item].slice(0, 80).join(""))
    .slice(0, 1);
}

function parseJSONObject(content) {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content;
  }

  let text = String(content || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!text) throw new Error("返回内容为空");

  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("没有找到 JSON 对象");
    return JSON.parse(text.slice(start, end + 1));
  }
}

function cleanText(value, min, max, label) {
  const text = String(value || "").replace(/<[^>]*>/g, "").trim();
  const length = [...text].length;
  if (length < min || length > max) throw new Error(`AI ${label}长度不符合要求`);
  return text;
}

async function findCachedReview({
  supabaseURL,
  serviceRoleKey,
  userID,
  sourceHash,
  promptVersion
}) {
  const query = new URLSearchParams({
    select: "result,model,prompt_version,created_at",
    user_id: `eq.${userID}`,
    mode: "eq.daily_review",
    source_hash: `eq.${sourceHash}`,
    prompt_version: `eq.${promptVersion}`,
    status: "eq.success",
    order: "created_at.desc",
    limit: "1"
  });
  const rows = await serviceREST(supabaseURL, serviceRoleKey, `ai_generation_logs?${query}`);
  return rows[0] || null;
}

async function countRecentRequests({
  supabaseURL,
  serviceRoleKey,
  userID,
  mode
}) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const query = new URLSearchParams({
    select: "id",
    user_id: `eq.${userID}`,
    mode: `eq.${mode}`,
    created_at: `gte.${start.toISOString()}`,
    limit: String(DAILY_REVIEW_LIMIT)
  });
  const rows = await serviceREST(supabaseURL, serviceRoleKey, `ai_generation_logs?${query}`);
  return rows.length;
}

async function insertGenerationLog({
  supabaseURL,
  serviceRoleKey,
  userID,
  mode,
  sourceHash,
  promptVersion,
  model,
  status,
  result = null,
  errorMessage = null,
  usage = null
}) {
  await serviceREST(supabaseURL, serviceRoleKey, "ai_generation_logs", {
    method: "POST",
    body: {
      user_id: userID,
      mode,
      source_hash: sourceHash,
      prompt_version: promptVersion,
      model,
      status,
      result,
      error_message: errorMessage,
      usage
    }
  });
}

async function serviceREST(
  supabaseURL,
  serviceRoleKey,
  path,
  options = {}
) {
  const response = await fetch(`${supabaseURL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.method === "POST" ? "return=minimal" : ""
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const detail = await response.text();
    if (/ai_generation_logs/i.test(detail) && /does not exist|schema cache/i.test(detail)) {
      throw httpError(500, "请先执行 supabase-ai-schema.sql 创建 AI 日志表");
    }
    throw new Error(`Supabase 日志请求失败 (${response.status})`);
  }
  if (options.method === "POST") return [];
  return await response.json();
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw httpError(400, "数值字段格式不正确");
  return Math.min(max, Math.max(min, number));
}

function isAIRequestFailure(error) {
  return Boolean(error && typeof error === "object" && error.name === "AIRequestError");
}

function safeErrorMessage(error) {
  const message = String(error?.message || error || "AI 服务异常");
  return message.slice(0, 240);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
