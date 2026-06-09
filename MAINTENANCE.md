# 维护说明

## 日常修改流程

1. 在 Windows 本地修改 `app.js`、`styles.css`、`index.html` 或资源文件。
2. 启动本地预览：

```powershell
node SanWeiGrowthPWA/dev-server.mjs 5173
```

3. 打开 `http://127.0.0.1:5173/` 检查。
4. 如果页面没有更新，打开浏览器开发者工具，清除该站点的 Service Worker 和缓存。
5. 检查语法：

```powershell
node --check SanWeiGrowthPWA/app.js
node --check SanWeiGrowthPWA/sw.js
```

6. 上传到 GitHub 仓库根目录，等待 GitHub Pages 自动更新。

移动端和回顾页渲染检查：

```powershell
$env:VERIFY_WIDTH="390"; $env:VERIFY_HEIGHT="844"; $env:VERIFY_TAB="review"; $env:VERIFY_SEED="1"; node SanWeiGrowthPWA/verify-pwa.mjs http://127.0.0.1:5173/
```

## 文件分工

- `app.js`：应用逻辑、计分、奖励、称号、备份恢复、页面渲染。
- `styles.css`：界面样式、移动端和桌面端布局。
- `index.html`：网页标题、PWA 入口、iOS 主屏标题。
- `manifest.webmanifest`：PWA 名称、图标、安装信息。
- `sw.js`：离线缓存。每次改动上线后，建议递增 `CACHE_NAME`。
- `assets/`：主屏幕图标和浏览器图标。
- `SYNC_AND_AI_PLAN.md`：账号同步和 AI 称号接入方案。

## iOS 图标更新

iOS 可能会缓存旧的主屏幕图标。上传新图标后：

1. 删除旧的主屏幕图标。
2. 用 Safari 重新打开 GitHub Pages 网址。
3. 点分享按钮，重新添加到主屏幕。
4. 如果仍显示旧图标，清除 Safari 对该网站的缓存后再添加。

## 当前数据策略

当前数据保存在每台设备浏览器自己的 `localStorage` 中。不同设备、不同浏览器、不同网址的数据不自动互通。

已支持：

- 下载 JSON 备份。
- 复制 JSON 备份。
- 粘贴 JSON 恢复。
- 从 JSON 文件恢复。

## 未来自动同步方向

推荐使用 Supabase：

- Supabase Auth：邮箱和密码登录。
- Supabase Database：保存每个用户自己的成长数据。
- Row Level Security：限制用户只能读取和写入自己的数据。

静态 GitHub Pages 可以继续作为前端托管，不需要自建服务器；浏览器端通过 Supabase SDK 读写云端数据。

更详细的同步和 AI 称号方案见 `SYNC_AND_AI_PLAN.md`。
