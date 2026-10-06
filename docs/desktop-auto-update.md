# 桌面鲸鱼娘自动升级

Windows 任务计划程序在当前用户登录期间，每 5 分钟检查 GitHub 的 `main` 分支。
有更新时，它在独立副本里安装依赖、检查类型、运行测试、构建并打包，再使用桌面端自带运行时与插件管理 API 安装插件。

## 启用

先在 DeepSeek Harness 桌面端安装一次 `dsh-toons`，然后在项目根目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-desktop-auto-update.ps1
```

默认桌面命令位置为 `D:\DSH\resources\runtime\cli\bin\dsh.cmd`。
安装在其他目录时，通过 `-DshCommand` 指定实际路径；自定义 Harness 数据目录时传入 `-DshHome`。
可以通过 `-IntervalMinutes 15` 改为每 15 分钟检查。

## 更新行为

- 只同步配置的 `main` 分支，独立副本放在 `work/desktop-updater/repo`，不修改开发目录的分支或未提交内容。
- GitHub 版本低于已安装版本时跳过，避免把本地较新的开发版降级。
- 相同版本号的新提交也会重新构建安装，每个提交使用独立包路径，避免包管理器重复使用旧的本地包。
- 桌面应用运行期间只准备包。完全退出应用后，下一轮检查会安装；再次打开应用生效。不会自动关闭应用。
- 没有新提交时不重复安装。离线、类型检查或测试失败时记录错误，之后再检查。
- 桌面端的插件兼容性校验继续生效，不自动批准不兼容的运行时版本。
- 安装前备份桌面 profile 的清单、锁文件和配置；不修改用户的模型、角色或场景设置。
- 安装使用桌面自带运行时与插件管理 API，在 profile 的同一把安装锁内重新检查版本和插件是否仍被选中，避免覆盖并发手动安装的新版或恢复已卸载的插件。
- 已卸载插件时停止升级，不会自动把插件装回来。
- 有多个更新进程时只允许一个执行。独立副本出现本地改动或本地提交时停止，不自动丢弃修改。
- 只支持稳定的 `x.y.z` 插件版本。任务使用当前用户权限，不保存用户密码；电脑关机或用户未登录时不检查。

## 查看状态

```powershell
Get-ScheduledTask -TaskName DSH-Toons-AutoUpdate
Get-ScheduledTaskInfo -TaskName DSH-Toons-AutoUpdate
Get-Content -LiteralPath .\work\desktop-updater\state.json
Get-Content -LiteralPath .\work\desktop-updater\update.log -Tail 30
```

立即手动检查一次：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\auto-update-desktop.ps1 -ConfigPath .\work\desktop-updater\config.json
```

只准备更新包，暂不安装：给上述命令追加 `-PrepareOnly`。

## 暂停和停用

```powershell
Disable-ScheduledTask -TaskName DSH-Toons-AutoUpdate
Enable-ScheduledTask -TaskName DSH-Toons-AutoUpdate
Unregister-ScheduledTask -TaskName DSH-Toons-AutoUpdate -Confirm:$false
```

停用不会卸载鲸鱼娘，也不会清除已经安装的包。请保留 `work/desktop-updater/packages`：
桌面 profile 可能仍引用其中的本地安装包。
原有的手动安装包和 `work/desktop-updater/backups` 可用于手动恢复旧版本。
