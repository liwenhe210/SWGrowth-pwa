# Supabase 同步设置

当前 PWA 已支持可选 Supabase 同步。未配置 Supabase 时，应用仍按本地模式工作。

## 1. 创建 Supabase 项目

1. 登录 Supabase。
2. 创建一个新项目。
3. 进入项目后，打开 `SQL Editor`。
4. 复制 `supabase-schema.sql` 的全部内容并运行。

这会创建 `growth_snapshots` 表，并启用 Row Level Security。每个账号只能读取和写入自己的 `user_id` 数据。

## 2. 配置前端

在 Supabase 项目里打开：

`Project Settings` -> `API`

复制：

- Project URL
- anon public key

然后编辑 `supabase-config.js`：

```js
window.SW_GROWTH_SUPABASE_CONFIG = {
  url: "https://你的项目.supabase.co",
  anonKey: "你的 anon public key",
  sdkUrl: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
};
```

`anon public key` 可以放在前端。真正的数据隔离依靠 Supabase Auth 和表上的 RLS 策略。

## 3. 设置登录方式

在 Supabase 打开：

`Authentication` -> `Providers` -> `Email`

建议开发阶段可以先关闭邮箱确认，方便测试；正式使用时再打开邮箱确认。

## 4. 发布到 GitHub Pages

把以下文件一起上传到 GitHub 仓库根目录：

- `supabase-config.js`
- `supabase-schema.sql`
- `app.js`
- `styles.css`
- `index.html`
- `sw.js`
- 其他 PWA 文件

上传后等待 GitHub Pages 更新。因为 PWA 有 Service Worker 缓存，更新后建议在手机上关闭并重新打开 App；如果仍是旧版，删除主屏幕图标后重新添加。

## 5. 使用方式

1. 打开 PWA。
2. 点右上角「登录」或「本地」。
3. 用邮箱密码注册或登录。
4. 如果本机和云端都有数据，应用会让你选择：
   - 使用云端
   - 本机覆盖云端
   - 先备份

登录后，结算、兑换奖励、恢复备份等操作会自动上传云端。

## 6. AI 称号预留

目前称号仍由本地规则生成。后续接 AI 时，不要把 AI API Key 写进 `app.js`。

推荐路线：

1. 在 Supabase 创建 Edge Function。
2. Edge Function 读取 OpenAI 或其他 AI 服务的 API Key。
3. 前端只把当天或周期记录发送给 Edge Function。
4. Edge Function 返回 `{ "title": "...", "reason": "..." }`。
