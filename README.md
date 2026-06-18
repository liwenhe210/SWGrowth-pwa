# 科研人才养成计划 PWA

这是 Windows 友好的三维成长游戏版本。它不依赖 macOS、Xcode 或 npm，使用原生 HTML/CSS/JavaScript 实现。

## 功能

- 每日 9 项加分记录：体魄、心境、学业各 10 分。
- 三段式状态：未做、部分、完成。
- 保护日、主观满意度、标签、一句话总结。
- 移动端常驻安装和备份入口。
- 角色三维属性、XP、等级、金币和平衡加成。
- 本地动态称号：根据打分、任务结构和自评关键词生成每日/每周/每月称号。
- 自定义奖励、奖励进度条、兑换记录、轻量修复任务。
- 周/月总结、称号、趋势折线图、月度热力图。
- 每日记录回看：可展开查看总分、三大板块、9 个任务得分、总结、满意度和标签。
- 可选 Supabase 邮箱密码登录同步；未配置时保持本地模式。
- `localStorage` 本地存储，service worker 离线缓存。

## Supabase 同步

配置步骤见 `SUPABASE_SETUP.md`。同步启用后，GitHub Pages 继续托管前端，Supabase 负责账号、数据表和不同账号之间的数据隔离。

## DeepSeek AI

- `AI_SETUP.md`：每日 AI 称号、分析和建议的部署步骤。
- `AI_INTEGRATION_PLAN.md`：每日/周期称号、AI 任务和随机奖励的分阶段方案。

## Windows 本地运行

在项目根目录运行：

```powershell
node SanWeiGrowthPWA/dev-server.mjs 5173
```

然后打开：

```text
http://localhost:5173
```

同一 Wi-Fi 下临时用手机访问 Windows 电脑：

```powershell
$env:HOST="0.0.0.0"; node SanWeiGrowthPWA/dev-server.mjs 5173
```

然后在手机 Safari 打开电脑的局域网地址，例如：

```text
http://你的电脑IP:5173
```

局域网 HTTP 适合临时预览；正式添加到主屏幕建议部署到 HTTPS 静态站点。

## iPhone 使用方式

最稳定的方式是部署到 HTTPS 静态站点，例如 GitHub Pages、Cloudflare Pages 或 Netlify。部署后在 iPhone Safari 中打开网址，点分享按钮，再选择「添加到主屏幕」。

如果只是用 iPhone 访问 Windows 局域网地址，可以看到网页界面，但离线缓存和安装能力可能受 iOS 的安全限制影响。
