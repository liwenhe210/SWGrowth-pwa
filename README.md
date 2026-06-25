# 科研人才养成计划 PWA

这是一个面向个人使用的三维成长游戏化工具，把“体魄、心境、学业”转化为每日加分、角色成长、奖励商店和周期回顾。项目最初考虑过 SwiftUI iOS App，但由于当前开发环境是 Windows，主线已改为零构建的静态 PWA：可以部署到 GitHub Pages，并在 iPhone Safari 中添加到主屏幕使用。

本文档是未来维护的主上下文。新开 Codex 对话时，优先让 Codex 阅读本文件，再根据需要阅读 `app.js`、`AI_SETUP.md`、`SUPABASE_SETUP.md`、`PROMPT_GUIDE.md` 和 `REMOTE_PUBLISH_WORKFLOW.md`。

## 当前项目位置

- 开发目录：`C:\Users\30566\Documents\New project\SanWeiGrowthPWA`
- GitHub 仓库：`liwenhe210/SWGrowth-pwa`
- GitHub Pages：`https://liwenhe210.github.io/SWGrowth-pwa/`
- 发布脚本：`publish-to-github.ps1`
- 本地预览：`node SanWeiGrowthPWA/dev-server.mjs 5173`

## 产品目标

核心目标不是高压自律，而是长期稳定、低负担记录和温和反馈。

- 每日记录应尽量在 2 分钟内完成。
- 所有系统以加分、推进、恢复为核心，不做扣分和断签归零。
- 低分日不等于失败，允许保护日、补记和低能量维护。
- 奖励系统用于形成正反馈，不制造焦虑。
- AI 只做陪伴式称号、旁白和低压力建议，不复述成绩单，不进行心理或医学诊断。

## 核心循环

1. 今日页完成 9 个任务的三段式记录。
2. 点击“今日结算”，生成总分、评级、XP、金币和本地称号。
3. 如果已登录并启用 AI，每日记录会通过 Supabase Edge Function 调用 DeepSeek，生成 AI 称号、今日旁白和一项“明日支线”。
4. 次日可勾选昨日 AI 支线，确认后获得 5 金币。
5. 金币用于兑换奖励商店中的自定义奖励。
6. 回顾页按周/月查看趋势、热力图、历史每日记录和周期总结。
7. 周目标未达成时采用轻量修复式冷却，不扣分。

## 评分模型

每日总分 30 分，三项各 10 分。每个任务支持 `未做 / 部分 / 完成`，分别按 `0 / 0.5 / 1` 倍计分。

### 体魄 10 分

- 睡眠节律 4 分：接近目标入睡/起床也可部分完成。
- 健康饮食 3 分：三餐规律、饮水足够、少高糖高油。
- 适当运动 3 分：散步、拉伸、力量、有氧任选。

### 心境 10 分

- 情绪觉察 3 分：看见今日主要情绪，不要求积极。
- 主动恢复 3 分：呼吸、散步、晒太阳、音乐、离屏任选。
- 自我支持 4 分：鼓励、感恩、友好社交、停止自责循环。

### 学业 10 分

- 深度专注 3 分：至少一个 45-90 分钟无干扰学习块。
- 有效输入 3 分：论文、教材、课程、文献笔记或实验资料。
- 可见输出 4 分：写作、代码、实验记录、批注、问题清单。研究生阶段优先奖励输出。

评级：

- S：27-30
- A：23-26.9
- B：18-22.9
- C：12-17.9
- D：0-11.9

## 整体架构

### 前端 PWA

项目不依赖 npm、Vite、React 或构建工具，核心是原生 HTML/CSS/JavaScript。

- `index.html`：PWA 入口，加载 `styles.css`、`supabase-config.js` 和 `app.js`。
- `app.js`：核心业务逻辑、渲染函数、状态归一化、本地存储、同步、AI 调用、备份合并和事件绑定。
- `styles.css`：移动优先样式，包含今日、角色、奖励、回顾、同步弹窗、AI 面板等界面。
- `sw.js`：Service Worker，当前缓存版本 `sanwei-growth-v13`，采用网络优先策略；不缓存 `supabase-config.js`。
- `manifest.webmanifest` 和 `assets/`：PWA 安装信息、iOS 主屏图标和 maskable 图标。
- `dev-server.mjs`：零依赖本地静态服务器。
- `verify-pwa.mjs`：移动/桌面视口验证脚本，用于检查页面渲染和横向溢出。

### 本地状态

主要状态保存在浏览器 `localStorage`：

- 主数据键：`sanwei-growth-pwa:v1`
- 同步元数据键：`sanwei-growth-pwa:sync-meta:v1`

核心状态结构：

- `records`：按日期键保存每日记录。
- `rewards`：奖励商店条目、兑换记录和归档状态。
- `weeklyFocus` / `weeklyGoal`：当前周重点和周目标。
- `cooldownUntil` / `lastPenaltyWeekKey`：修复式冷却。
- `repairCompletions`：修复任务完成记录。
- `adviceCompletions`：AI 支线完成记录，按来源日期去重。
- `aiSettings`：AI 是否启用、是否允许发送一句话总结。

每日记录 `records[dateKey]` 重点字段：

- `date`
- `entries`：9 个任务状态。
- `isProtectionDay`
- `reflection`
- `satisfaction`
- `tags`
- `settledAt`
- `aiReview`

### Supabase 同步

Supabase 是可选同步层；未配置时应用保持本地模式。

- 前端配置：`supabase-config.js`
- 数据表 SQL：`supabase-schema.sql`
- 表名：`growth_snapshots`
- 鉴权：Supabase Auth 邮箱密码登录。
- 隔离：Row Level Security，用户只能读写自己的 `user_id` 快照。
- 同步模型：本地优先 + 整份状态快照。

重要维护规则：备份导入和云端拉取都必须走同一套 merge engine，不能直接整份覆盖 `state`。当前规则是：

- 两边独有的日期都保留。
- 同日期完全相同的记录去重。
- 同日期不同记录进入冲突队列。
- 冲突弹窗展示本机版和导入/云端版的总分、评级、满意度、结算时间、总结、标签和每项任务状态。
- 用户必须显式选择保留本机、使用导入/云端，或重新记录。
- 奖励、修复任务、AI 支线完成记录也按去重规则合并，不应被覆盖。

相关函数在 `app.js` 中：

- `restoreBackupFromModal()`
- `applyCloudSnapshot()`
- `buildStateMerge()`
- `renderRecordMergeConflictModal()`
- `resolvePendingMergeConflict()`
- `commitMergedState()`
- `mergeRewards()`
- `mergeRepairCompletions()`
- `mergeAdviceCompletions()`

### DeepSeek AI

AI 不从前端直连 DeepSeek，避免泄露 API Key。当前路径：

```text
PWA
  -> Supabase Auth JWT
  -> Supabase Edge Function: ai-game-master
  -> DeepSeek Chat Completions
  -> 服务端校验/修复/缓存
  -> PWA 保存 aiReview 并更新界面
```

相关文件：

- `supabase/functions/ai-game-master/index.ts`
- `supabase-ai-schema.sql`
- `AI_SETUP.md`
- `PROMPT_GUIDE.md`
- `AI_INTEGRATION_PLAN.md`

当前已实现的 AI mode：

- `daily_review`：每日 AI 称号、今日旁白、一项次日支线。

当前尚未实现的 AI mode：

- `period_review`
- `daily_task`
- `random_task`
- `random_reward`

Secrets：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`，当前建议值：`deepseek-v4-flash`
- `AI_PROMPT_VERSION`，当前建议值：`daily-review-v2`

AI 约束：

- 每日每人最多生成 8 次。
- 相同 `sourceHash` 读取缓存。
- 服务端最多尝试 3 次。
- DeepSeek 调用失败时如实报错。
- 模型返回格式不稳定时，服务端尽量修复；仍不稳定则生成同结构的本地兜底回顾。
- AI 失败不影响每日结算，本地规则称号仍可用。
- 最近 7 个 AI 称号会传给服务端，减少重复。
- `analysis` 不应复述总分、评级、维度分和任务清单。
- `advice` 只保留一项，次日可勾选，完成后加 5 金币。

## 当前已实现功能

### 今日

- 今日总评级、三维进度和角色状态。
- 9 个任务的三段式选择。
- 保护日开关。
- 一句话总结、满意度 1-5、标签。
- 今日结算弹窗。
- AI 成长回顾面板。
- 昨日 AI 支线面板。
- 已结算记录可重新结算，修改记录后 AI 结果会按 `sourceHash` 失效。

### 角色

- 体魄、心境、学业三项 XP。
- 每 100 XP 升一级。
- 总等级由三项等级推导。
- 金币统计和本地规则称号。
- 内置称号规则说明。

### 奖励

- 默认奖励：自由娱乐 1 小时、买一个小物、半日外出。
- 自定义奖励名称、备注、金币价格和条件。
- 条件包括周均分、活跃天数、指定属性等级。
- 奖励进度条和可兑换状态。
- 兑换记录。
- 归档奖励：从当前商店隐藏，不删除历史兑换；目前没有单独恢复归档奖励的管理界面。
- 周目标未达成时触发 24 小时商店冷却，并通过修复任务解除。

### 回顾

- 每周/每月切换。
- 周/月周期导航：上一周/上一月、下一周/下一月、回到当前。
- 周均/月均分、记录天数、保护日、最佳一天。
- 三项平均趋势。
- 总分与三项折线图。
- 月度热力图，使用莫兰迪蓝色阶，颜色越深表示得分越高。
- 周重点设置。
- 每日记录回看：按当前所选周/月列出记录，可展开查看三大板块、9 项任务得分、总结、满意度、标签和 AI 回顾。

### 备份与恢复

- 本地 JSON 备份导出。
- JSON 粘贴/恢复。
- 恢复默认使用合并导入，不应默默覆盖已有记录。
- 同日期冲突需要用户显式处理。

### 同步

- Supabase 未配置时显示本地模式。
- Supabase 已配置后支持注册、登录、退出。
- 登录后可自动延迟上传。
- 同步弹窗提供拉取云端、上传本机、先备份等操作。
- 本机和云端都有数据时，使用 merge-first 逻辑，避免静默覆盖。

### PWA 与发布

- 支持安装到 iPhone 主屏幕。
- 支持离线缓存。
- Service Worker 网络优先，减少旧脚本缓存导致的功能滞后。
- 可用 `publish-to-github.ps1` 从开发目录安全发布到 GitHub 克隆目录。

## 未来待加入功能

优先级建议如下。

### P0：稳定性与维护

- 为最近的回顾页周期导航补更多自动化回归测试。
- 为 AI fallback 和 DeepSeek 异常信息补端到端测试。
- 为 `buildStateMerge()` 增加独立测试用例，覆盖 records、rewards、repairCompletions、adviceCompletions。
- 增加“清除旧 Service Worker/重载资源”的用户入口或排错提示。

### P1：周期 AI 称号

当前周/月称号仍主要来自本地规则。建议实现 `period_review`：

- 周称号以完整自然周为单位，周一后生成上周正式称号。
- 月称号在每月 1 日后生成上月正式称号。
- 正在进行中的本周/本月只显示临时预览或规则称号，避免分数变化导致正式称号频繁波动。
- 手动重新生成需要冷却，例如 24 小时一次。
- 周/月称号应相对稳定，写入周期缓存，而不是每次渲染重新生成。
- 该策略仍需用户最终确认后再实施。

### P1：奖励页 AI 任务

在奖励页顶部加入 AI 每日任务：

- 当天首次打开或手动点击时生成。
- 用户可接受或更换。
- 完成后获得金币。
- 金币区间由程序控制，不完全交给 AI。
- 每天最多完成一项，避免刷金币。

### P2：随机任务与随机奖励

实现 `random_task` 和 `random_reward`：

- 随机任务：AI 生成候选，用户确认后才写入正式任务；支持更换候选。
- 随机奖励：AI 生成奖励建议和兑换条件，用户确认后加入现有奖励商店。
- 所有 AI 输出必须映射到现有 Reward / Quest 数据结构，并由程序校验金币、条件和安全性。

### P2：奖励管理增强

- 增加查看和恢复归档奖励的界面。
- 增加奖励分类、排序和搜索。
- 增加兑换历史统计。

### P3：长期数据分析

- 月度/季度更长周期视图。
- 作息稳定性、输出密度、恢复能力、偏科趋势等模式识别。
- 可导出 CSV。

### P3：体验增强

- iOS 主屏启动更新提示。
- 更细的动画反馈。
- 可配置任务文案和分值。
- 可配置主题或色弱友好色阶。

## 运行与验证

本地启动：

```powershell
node SanWeiGrowthPWA/dev-server.mjs 5173
```

打开：

```text
http://127.0.0.1:5173/
```

同一 Wi-Fi 手机临时访问：

```powershell
$env:HOST="0.0.0.0"; node SanWeiGrowthPWA/dev-server.mjs 5173
```

语法检查：

```powershell
node --check SanWeiGrowthPWA/app.js
node --check SanWeiGrowthPWA/sw.js
node --check SanWeiGrowthPWA/supabase/functions/ai-game-master/index.ts
```

PWA 视口验证：

```powershell
$env:VERIFY_WIDTH='390'; $env:VERIFY_HEIGHT='844'; node SanWeiGrowthPWA/verify-pwa.mjs http://127.0.0.1:5173/
$env:VERIFY_WIDTH='1024'; $env:VERIFY_HEIGHT='768'; node SanWeiGrowthPWA/verify-pwa.mjs http://127.0.0.1:5173/
```

## Supabase 部署摘要

完整步骤见 `SUPABASE_SETUP.md` 和 `AI_SETUP.md`。

基础同步：

1. 在 Supabase 创建项目。
2. 在 SQL Editor 运行 `supabase-schema.sql`。
3. 将 Project URL 和 anon public key 填入 `supabase-config.js`。
4. 发布 PWA 到 GitHub Pages。

AI：

1. 在 Supabase SQL Editor 运行 `supabase-ai-schema.sql`。
2. 设置 Secrets：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`AI_PROMPT_VERSION`。
3. 创建或更新 Edge Function：`ai-game-master`。
4. 将 `supabase/functions/ai-game-master/index.ts` 完整部署。
5. 发布 PWA 到 GitHub Pages。

## GitHub 发布流程

当前推荐继续保留双目录隔离：

- Codex 开发目录：`C:\Users\30566\Documents\New project\SanWeiGrowthPWA`
- GitHub 克隆目录：`C:\Users\30566\Documents\GitHub\SWGrowth-pwa`

预览发布：

```powershell
& "C:\Users\30566\Documents\New project\SanWeiGrowthPWA\publish-to-github.ps1"
```

提交并推送：

```powershell
& "C:\Users\30566\Documents\New project\SanWeiGrowthPWA\publish-to-github.ps1" `
  -Commit `
  -Push `
  -CommitMessage "Update SWGrowth PWA"
```

脚本会检查目标仓库、拒绝覆盖未提交修改、创建 Git bundle 备份、复制白名单文件、运行语法检查并显示 Git 变更。

## 维护约定

- 不要把 DeepSeek API Key 写进前端、GitHub、`supabase-config.js` 或 README。
- `supabase-config.js` 只能保存 Supabase URL 和 anon public key。
- 改 Supabase 表结构时同步更新对应 SQL、设置文档和 README。
- 改 AI Prompt 时优先更新 `supabase-ai-schema.sql`、`PROMPT_GUIDE.md` 和线上 `ai_prompt_configs`。
- 改前端资源后提升 `sw.js` 的 `CACHE_NAME`。
- 新增会保存到状态里的字段时，必须更新 `defaultState()`、`normalizeState()`、备份合并逻辑和云同步合并逻辑。
- 任何导入、恢复、云端拉取都不能绕过 merge-first 逻辑。
- 同日期冲突不要自动解决，必须给用户看两个版本并明确选择。
- 对移动端改动必须检查 390px 宽度是否横向溢出。
- `SanWeiGrowthhistory` 是历史/镜像目录，不是当前主开发目录；除非明确要求，不要把改动散到那里。

## 给未来新对话的快速指令

如果未来要继续开发，可以这样开场：

```text
请先阅读 SanWeiGrowthPWA/README.md，按其中的架构和维护约定继续。
本项目是零构建 PWA，核心在 app.js。不要绕过备份/云同步 merge-first 逻辑。
如果涉及 AI，不要把 API Key 放进前端；通过 Supabase Edge Function ai-game-master 修改。
如果涉及发布，优先使用 publish-to-github.ps1。
```
