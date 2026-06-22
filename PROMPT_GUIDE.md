# DeepSeek Prompt 修改指南

## Prompt 存放位置

部署后，实际优先使用的 Prompt 存在 Supabase 表：

```text
ai_prompt_configs
```

其中：

- `version`：Prompt版本，例如`daily-review-v2`。
- `system_prompt`：主Prompt。
- `retry_prompt`：第一次输出校验失败时追加的Prompt。
- `enabled`：是否可用。

可以在Supabase的`Table Editor > ai_prompt_configs`中直接编辑。

Edge Function会读取Supabase Secret：

```text
AI_PROMPT_VERSION
```

例如Secret为`daily-review-v2`时，会读取表中同名版本；表中没有时使用函数中的最小应急Prompt。

## 推荐修改方式

1. 在`ai_prompt_configs`中新建一行，例如`daily-review-v3`。
2. 复制当前v2的主Prompt和重试Prompt后进行修改。
3. 把Supabase Secret中的`AI_PROMPT_VERSION`改为`daily-review-v3`。
4. 保存后即可用于下一次请求，不需要重新部署Edge Function。

使用新版本号可以避免旧AI缓存被误当成新Prompt结果。

`supabase-ai-schema.sql`中保存了`daily-review-v2`的完整配置，重复运行会更新该版本。

## 推荐约束写法

Prompt约束和程序校验应同时存在：

- Prompt负责告诉模型“应该怎么回答”。
- `validateReview()`负责拒绝或修正异常返回。
- `normalizeAdvice()`负责兼容字符串、数组和对象形式的建议。

不要只依靠Prompt保证JSON格式。模型输出仍然可能包含代码块、额外文字或不同字段形态。

当前程序约束：

- 称号：4至9个汉字。
- 今日旁白：35至70个字符。
- 建议：只保留1项次日可勾选任务，最长80个字符。
- 风格：Edge Function按55/25/15/5抽签，模型返回的`style`必须与指定风格一致。
- 最近称号：前端传递最近7个有效AI称号，用于减少重复词根和句式。
- 语气枚举：`energetic`、`gentle`、`focused`、`resilient`、`balanced`。

## 调试流程

1. 在Supabase打开`Edge Functions > ai-game-master > Logs`。
2. 查看`ai_generation_logs`表中的`status`和`error_message`。
3. 修改Prompt或解析器。
4. 增加`AI_PROMPT_VERSION`版本号。
5. 重新部署函数。
6. 在应用里点击“重试生成”。
