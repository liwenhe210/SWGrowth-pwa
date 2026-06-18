# SWGrowth DeepSeek AI 接入计划

## 1. 结论

三个 AI 功能都可实现。推荐保留现有本地规则作为降级方案，并通过 Supabase Edge Function 调用 DeepSeek。

不要在 `app.js`、`supabase-config.js` 或 GitHub 仓库中保存 DeepSeek API Key。PWA 前端代码和网络请求都可以被用户查看，密钥必须存放在 Supabase Edge Function Secret 中。

截至 2026-06-18，DeepSeek 官方推荐使用 `deepseek-v4-flash` 和 `deepseek-v4-pro`。模型名称必须通过服务端环境变量配置，不要写死在前端。

## 2. 推荐架构

```text
PWA
  -> Supabase Auth 用户令牌
  -> Supabase Edge Function: ai-game-master
  -> 校验用户、频率和输入
  -> DeepSeek Chat Completions
  -> 校验结构化 JSON
  -> 返回结果并写入 Supabase
  -> PWA 保存离线副本并更新界面
```

Edge Function 使用用户 JWT 鉴权。DeepSeek Key 通过 `DEEPSEEK_API_KEY` Secret 读取。

## 3. 统一 AI 接口

建立一个 Edge Function：`ai-game-master`。

请求使用 `mode` 区分用途：

- `daily_review`：每日称号、分析和建议。
- `period_review`：每周或每月称号、分析和建议。
- `daily_task`：生成当天每日任务。
- `random_task`：生成一个可确认或更换的随机任务。
- `random_reward`：生成一个可确认或更换的奖励建议。

所有响应使用 DeepSeek JSON Output，并在服务端进行字段、长度、金币范围和枚举校验。无效响应最多自动重试一次，仍失败则回退到本地规则。

## 4. 每日、每周、每月 AI 回顾

### 每日输入

- 日期、总分、评级。
- 体魄、心境、学业三项得分。
- 9 个任务状态。
- 一句话总结、满意度、标签、保护日状态。
- 最近 7 天的简要趋势，不发送完整历史。

### 每日输出

```json
{
  "title": "输出引擎点火员",
  "analysis": "今天学业输出推进明显，同时体魄保持了基础节律。",
  "advice": [
    "明天优先保留一个完整专注块",
    "睡前安排十分钟低强度恢复"
  ],
  "tone": "energetic"
}
```

约束：

- 称号 4 至 12 个汉字。
- 有趣、活泼、游戏化，但不能羞辱、诊断或制造焦虑。
- 分析必须引用实际得分或总结内容，不能凭空编造。
- 建议最多 2 条，每条必须具体且低压力。

### 触发和缓存

- 用户点击“今日结算”后触发每日生成。
- 先保存用户记录，再请求 AI；AI 失败不能阻止结算。
- 根据原始记录生成 `sourceHash`。
- 相同 `sourceHash` 不重复调用。
- 用户修改记录后将旧结果标记为过期，可自动或手动重新生成。
- 每周、每月回顾首次打开时按需生成并缓存，避免每次渲染都产生费用。

### 页面展示

- 今日界面：评级下方显示 AI 称号、分析、建议和“重新生成”按钮。
- 每日历史：展开某天记录时显示当日 AI 回顾。
- 周/月回顾：显示对应称号、周期分析和下一阶段建议。
- AI 不可用时展示现有规则称号和本地复盘文案。

## 5. AI 每日任务

奖励页顶部增加“每日任务”区域。

任务状态：

```text
未生成 -> 待接受 -> 进行中 -> 已完成
                    -> 已放弃
                    -> 已过期
```

推荐采用“当天首次打开奖励页时生成”，而不是每天零点批量生成。这样更节省调用量，也不会遇到用户时区和长期不打开应用的问题。

AI 输出：

```json
{
  "title": "十分钟桌面复位",
  "description": "整理当前研究资料和明天首先要处理的一项任务。",
  "category": "study",
  "difficulty": "easy",
  "rewardCoins": 5,
  "expiresOn": "2026-06-18"
}
```

系统约束：

- 每天最多完成 1 个 AI 每日任务。
- 金币由程序根据难度限制在固定区间，不能完全由 AI 决定。
- 建议区间：简单 3 至 5，中等 6 至 8，较高 9 至 12。
- 任务必须能在当天完成，不涉及危险行为、医疗诊断或高额消费。
- 完成采用用户自我确认，不做虚假的自动验证。

## 6. 随机任务

流程：

1. 用户点击“随机任务”。
2. AI 生成候选任务。
3. 用户选择“确认开启”或“换一个”。
4. 确认后任务才写入正式数据。
5. 完成后获得金币。

限制：

- 每日免费更换次数建议为 3 次。
- 同时进行中的随机任务建议最多 3 个。
- 每个候选任务包含预计用时、难度、分类和金币。
- AI 只负责提出候选内容，程序负责金币上限、到期时间和状态变化。

## 7. 随机奖励

流程：

1. 用户点击“随机奖励”。
2. AI 根据金币、等级、近期表现和用户偏好生成候选奖励。
3. 用户选择“加入奖励商店”或“换一个”。
4. 确认后转换为现有 `Reward` 对象。

AI 输出必须映射到应用已经支持的条件：

```json
{
  "name": "无负担电影夜",
  "note": "选择一部想看的电影，完整休息一次。",
  "cost": 80,
  "requiredWeeklyAverage": 20,
  "requiredActiveDays": 4,
  "requiredDimension": null,
  "requiredDimensionLevel": null
}
```

暂时不要允许 AI 创建程序无法自动判断的自由文本条件。金币价格也必须经过程序限制，避免奖励经济系统失衡。

## 8. 数据模型

建议新增：

```text
DayRecord.aiReview
  title
  analysis
  advice[]
  model
  promptVersion
  sourceHash
  generatedAt
  status

WeeklyReview.aiReview / MonthlyReview.aiReview
  title
  analysis
  advice[]
  sourceHash
  generatedAt

AITask
  id
  type: daily | random
  title
  description
  category
  difficulty
  rewardCoins
  status
  generatedAt
  acceptedAt
  completedAt
  expiresOn

BonusCoinTransaction
  id
  sourceType
  sourceID
  amount
  createdAt
```

金币应使用唯一交易记录计算，`sourceID` 必须唯一，防止多设备重复点击任务完成后重复领取。

长期建议把 AI 回顾、任务和金币流水放进独立 Supabase 表，而不是全部塞进 `growth_snapshots.payload`。本地 state 仍保留缓存，用于离线浏览。

## 9. Supabase 表建议

- `ai_reviews`：每日、每周、每月 AI 结果。
- `ai_tasks`：每日任务和随机任务。
- `coin_transactions`：额外金币流水。
- `ai_generation_logs`：调用类型、模型、token、耗时和错误，不保存完整敏感文本。

所有表都包含 `user_id` 并启用 RLS。普通用户只能访问自己的数据。

## 10. 隐私与成本控制

- 首次使用 AI 时明确说明：打分、总结和标签会发送给 DeepSeek。
- 提供“启用 AI”“允许发送一句话总结”两个独立开关。
- 不向 DeepSeek 发送邮箱、密码或真实姓名。
- `user_id` 使用不可读的匿名标识。
- 每种功能设置每日调用次数上限。
- 保存 token 使用量，便于估算费用。
- 超时、余额不足或 API 异常时使用本地规则，不影响记录和同步。

## 11. 分阶段实施

### 阶段一：AI 每日回顾

- 创建 Edge Function 和 Secret。
- 完成 JWT 鉴权、JSON 校验、调用限流和错误回退。
- 扩展 `DayRecord.aiReview`。
- 今日页和每日历史显示称号、分析和建议。
- 保留当前本地称号规则。

### 阶段二：周/月回顾

- 增加周期数据摘要和 `sourceHash`。
- 缓存周/月 AI 结果。
- 增加重新生成和过期提示。

### 阶段三：每日任务与金币流水

- 增加 `ai_tasks` 和 `coin_transactions`。
- 奖励页顶部加入每日任务。
- 完成任务时由数据库唯一约束保证金币只发放一次。

### 阶段四：随机任务与随机奖励

- 增加候选预览、确认和更换流程。
- 限制任务数量、更换次数和金币范围。
- 随机奖励确认后写入现有奖励商店。

## 12. 测试重点

- API Key 不出现在浏览器源代码、GitHub 和网络请求参数中。
- 未登录用户不能调用 AI 接口。
- 不同账号不能读取彼此 AI 结果和任务。
- 重复点击、离线重试和多设备同步不会重复发金币。
- AI 返回空内容、错误 JSON、超时或限流时正常回退。
- 修改历史记录后旧 AI 回顾会失效，不展示与当前数据不符的建议。
- 导入备份和云端合并时保留 AI 结果，并按 `sourceHash` 识别过期内容。

## 13. 官方资料

- DeepSeek API Quick Start: https://api-docs.deepseek.com/
- DeepSeek Chat Completion: https://api-docs.deepseek.com/api/create-chat-completion
- DeepSeek JSON Output: https://api-docs.deepseek.com/guides/json_mode
- Supabase Edge Function Secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase Edge Function Auth: https://supabase.com/docs/guides/functions/auth
- Supabase Cron: https://supabase.com/docs/guides/cron/quickstart
