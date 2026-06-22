# DeepSeek AI 每日回顾部署说明

当前已实现阶段一：

- 每日动态称号。
- 每日“今日旁白”。
- 按 55% 温柔冒险、25% 科研轻喜剧、15% 基地运营、5% 诗意奇遇抽取文案风格。
- 一项次日可勾选的 AI 支线，完成后获得 5 金币。
- 今日页面与每日记录回看展示。
- 本地规则回退。
- 相同记录缓存、每日调用限制、登录鉴权。

## 1. 检查 Secrets

Supabase Dashboard 的 `Edge Functions > Secrets` 中应包含：

| Name | Value |
| --- | --- |
| `DEEPSEEK_API_KEY` | 真实 DeepSeek API Key，仅填写 Key 本身 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` |
| `AI_PROMPT_VERSION` | `daily-review-v2` |

不要把 `NAME=` 一起填进 Value，也不要把引号填进去。

`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 由 Supabase Edge Functions 自动提供，不需要手工添加。

## 2. 创建 AI 日志表

1. 打开 Supabase Dashboard。
2. 进入 `SQL Editor`。
3. 点击 `New query`。
4. 打开项目文件 `supabase-ai-schema.sql`。
5. 粘贴全部内容并点击 `Run`。
6. 在 `Table Editor` 中确认出现 `ai_generation_logs`和`ai_prompt_configs`。

如果之前已经运行过旧版SQL，请重新运行当前文件。它会补建所需表，并新增或更新 `daily-review-v2` Prompt 配置。

该表只供 Edge Function 的 service role 使用。普通登录用户不能直接读取，避免泄露 AI 调用日志。

## 3. 创建 Edge Function

### Dashboard 方式

1. 进入 `Edge Functions`。
2. 点击 `Create a new function`。
3. 函数名填写：`ai-game-master`。
4. 打开项目文件 `supabase/functions/ai-game-master/index.ts`。
5. 用该文件完整替换在线编辑器中的示例代码。
6. 保持 JWT 验证开启。
7. 点击 `Deploy function`。

### Supabase CLI 方式

本机安装并登录 Supabase CLI 后，在 `SanWeiGrowthPWA` 目录执行：

```powershell
supabase login
supabase link --project-ref zemhjqfxdqfsmsbtckcq
supabase db push
supabase functions deploy ai-game-master
```

当前电脑尚未安装 Supabase CLI，Dashboard 方式更直接。

## 4. 更新 GitHub Pages

Edge Function 部署完成后，把 PWA 本地修改推送到 GitHub：

```powershell
git add SanWeiGrowthPWA
git commit -m "Add DeepSeek daily AI reviews"
git push
```

等待 GitHub Pages 部署完成。Service Worker 缓存已更新为 `sanwei-growth-v12`。

## 5. 使用方法

1. 打开应用并登录 Supabase 账号。
2. 在今日页找到 `AI 成长回顾`。
3. 选择是否允许发送一句话总结。
4. 点击 `启用 AI 每日回顾`。
5. 完成每日打分并点击 `今日结算`。
6. AI 会在后台生成称号、今日旁白和一项“明日支线”。
7. 次日起可在今日页的“昨日支线”或历史记录中勾选完成，确认后获得 5 金币。

若当天已经结算，可以点击 `生成今日回顾`。记录内容修改后，旧 AI 回顾会自动失效，重新结算即可生成新版。

## 6. 测试和排错

### 显示“AI Edge Function 尚未部署”

确认函数名称严格为 `ai-game-master`，并且已成功部署。

### 显示“请先执行 supabase-ai-schema.sql”

进入 SQL Editor 执行 `supabase-ai-schema.sql`。

### DeepSeek 返回模型不存在

检查 Secret 的 Value 只填写：

```text
deepseek-v4-flash
```

不要填写 `DEEPSEEK_MODEL=deepseek-v4-flash` 作为整个 Value。

### DeepSeek 鉴权失败

确认 `DEEPSEEK_API_KEY` 是真实 Key，账户有可用余额，并且 Key 前后没有空格或引号。

### 查看服务端日志

进入 `Edge Functions > ai-game-master > Logs`。

AI 调用缓存和用量摘要可在 `ai_generation_logs` 表查看。

### 显示“AI 返回的不是有效 JSON”

请重新部署最新的 `supabase/functions/ai-game-master/index.ts`。新版解析器可以处理 DeepSeek 偶尔返回的 Markdown JSON 代码块或 JSON 前后的说明文字，同时仍会验证称号、分析和建议字段。

## 7. 安全说明

- DeepSeek API Key 不会进入 PWA、GitHub 或浏览器请求。
- Edge Function 会验证 Supabase 登录令牌。
- 每位用户每天最多发起 8 次每日回顾生成。
- 相同记录默认返回缓存，不重复调用 DeepSeek。
- AI 失败不会影响每日结算、金币、经验或云同步。
