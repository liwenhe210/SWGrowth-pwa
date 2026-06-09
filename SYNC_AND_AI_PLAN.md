# 同步与 AI 称号方案

## 当前模式：本地优先

数据保存在浏览器 `localStorage` 中。优点是无需登录、速度快、隐私简单；缺点是电脑和手机不会自动同步。

适合继续保留的能力：

- 自动保存到本机浏览器。
- JSON 下载备份。
- JSON 复制备份。
- JSON 文件恢复。
- 粘贴 JSON 恢复。

## 灵活保存模式

### 模式 A：本地 + 定期备份

保留当前架构，只要求用户每周下载 JSON。

优点：最简单、无账号、无费用。  
缺点：不同设备不同步，换机需要手动恢复。

### 模式 B：本地 + 云盘备份

仍然使用本地数据，但把下载的 JSON 存到 iCloud Drive、OneDrive、Google Drive 或微信文件助手。

优点：实现成本低，误删后容易恢复。  
缺点：仍然不是自动同步。

### 模式 C：账号云同步

推荐方案：GitHub Pages 继续托管前端，Supabase 提供账号、数据库和权限。

优点：电脑和手机登录同一账号后数据互通；不同账号数据隔离。  
缺点：需要创建 Supabase 项目并配置数据库权限。

### 模式 D：账号云同步 + AI 称号

在模式 C 上增加 Supabase Edge Function。前端把当天/本周记录发给 Edge Function，Edge Function 调用 AI 服务生成称号。

优点：API Key 不暴露在网页里，称号可以灵活、有趣、贴合自评文字。  
缺点：需要维护一个云函数，并注意调用成本。

## 推荐 Supabase 数据表

```sql
create table public.growth_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.growth_snapshots enable row level security;

create policy "Users can read own growth data"
on public.growth_snapshots for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own growth data"
on public.growth_snapshots for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own growth data"
on public.growth_snapshots for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 前端同步逻辑

登录后：

1. 从 Supabase 拉取 `growth_snapshots.payload`。
2. 如果云端有数据，提示用户选择「使用云端」「用本机覆盖云端」「先下载本机备份」。
3. 每次结算、兑换奖励、恢复备份后，把完整 `state` upsert 到云端。
4. 保留本地 `localStorage` 作为离线缓存。

## AI 称号输入输出

输入：

```json
{
  "period": "day",
  "score": 22,
  "dimensionScores": {
    "health": 6,
    "mindset": 7,
    "study": 9
  },
  "taskScores": {
    "study_output": 4
  },
  "reflection": "今天有点焦虑，但还是写完了一段实验记录",
  "tags": ["论文", "焦虑", "输出"]
}
```

输出：

```json
{
  "title": "内耗拦截者",
  "reason": "你没有等情绪完全好才行动，而是在焦虑里保住了输出。"
}
```

## AI 称号提示词建议

```text
你是一个温和、有趣但不过度鸡血的个人成长游戏称号生成器。
请根据用户的健康、心境、学业打分和自评总结，生成一个 2-8 个汉字的中文称号。
称号要具体、灵活、带一点研究生日常感，不要羞辱用户，不要使用失败、废物、摆烂等负面标签。
优先奖励保持记录、恢复能力、输出行为、低谷不断线和平衡推进。
返回 JSON：{"title":"...","reason":"..."}
```

## 不建议的做法

- 不要把 OpenAI、Claude、Gemini 等 AI API Key 写进 `app.js`。网页源码公开，任何人都能拿到。
- 不要用 GitHub Pages 当数据库。它只适合托管静态文件。
- 不要只依赖浏览器缓存保存重要数据，至少保留下载备份。
