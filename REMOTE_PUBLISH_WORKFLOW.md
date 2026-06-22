# iPhone 远程维护与 GitHub 发布

## 推荐方式一：iPhone控制当前Windows Codex

该方式会继续使用Windows电脑上的项目、线程、文件、Git凭据和工具。

前提：

- Windows电脑保持开机、联网并运行Codex App。
- iPhone安装最新版ChatGPT App。
- 两端登录相同ChatGPT账号和工作区。

设置：

1. 在Windows Codex App侧栏选择`Set up Codex mobile`。
2. 扫描显示的二维码。
3. 在iPhone ChatGPT App中完成连接。
4. 在Windows Codex的`Settings > Connections`中管理设备。

连接后可以在iPhone：

- 继续当前线程。
- 发出修改要求。
- 查看diff、测试结果和截图。
- 批准命令。
- 要求Codex运行发布脚本并推送GitHub。

Windows主机睡眠、断网或关闭Codex后，远程访问会停止。

## 推荐发布流程

开发目录：

```text
C:\Users\30566\Documents\New project\SanWeiGrowthPWA
```

GitHub克隆目录：

```text
C:\Users\30566\Documents\GitHub\SWGrowth-pwa
```

预览同步，不提交：

```powershell
& "C:\Users\30566\Documents\New project\SanWeiGrowthPWA\publish-to-github.ps1"
```

同步并创建本地提交：

```powershell
& "C:\Users\30566\Documents\New project\SanWeiGrowthPWA\publish-to-github.ps1" `
  -Commit `
  -CommitMessage "Update AI daily review prompt"
```

同步、提交并推送：

```powershell
& "C:\Users\30566\Documents\New project\SanWeiGrowthPWA\publish-to-github.ps1" `
  -Commit `
  -Push `
  -CommitMessage "Update AI daily review prompt"
```

脚本会：

1. 确认目标是正确GitHub仓库。
2. 拒绝覆盖存在未提交修改的仓库。
3. 创建Git bundle备份。
4. 只复制白名单文件。
5. 运行JavaScript和Edge Function语法检查。
6. 显示Git变更。
7. 只有指定`-Commit`和`-Push`时才提交或推送。

备份目录：

```text
C:\Users\30566\Documents\GitHub\SWGrowth-pwa-backups
```

## 推荐方式二：Codex Worktree

长期可以直接把GitHub克隆目录作为Codex项目，但每个任务选择`Worktree`而不是`Local`。

Codex会在独立Git worktree和分支中修改，不直接触碰`main`工作目录。完成后先查看diff和测试，再提交、推送并创建Pull Request。

这种方式比手动复制更符合Git工作流；当前双目录方式则更适合你希望继续保留额外物理隔离的情况。

## Codex Web替代方案

在iPhone浏览器或ChatGPT中打开：

```text
https://chatgpt.com/codex
```

连接GitHub后，可以让Codex Cloud克隆仓库、修改代码并创建Pull Request。

注意：Codex Cloud看不到Windows上尚未推送的`New project`目录。要使用本地未发布文件，应选择“iPhone控制Windows Codex”；要直接围绕GitHub分支工作，可选择Codex Web。
