# 开发与渲染说明

本文记录 DeepSeek Toons 0.1.24 发布版的实现细节。Release 安装与环境要求见[中文 README](../README.md#快速开始)，版本变化见[CHANGELOG](../CHANGELOG.md)。

## 从源码安装

```powershell
git clone https://github.com/Hjh-12138/DSH-Pixel-Toons.git
Set-Location -LiteralPath .\DSH-Pixel-Toons
npm ci
New-Item -ItemType Directory -Force -Path .\dist | Out-Null
npm pack --pack-destination .\dist
$version = (Get-Content -LiteralPath .\package.json -Raw | ConvertFrom-Json).version
$packagePath = (Resolve-Path -LiteralPath ".\dist\dsh-toons-$version.tgz").Path
npm exec -- dsh plugin --profile web add "$packagePath"
npm exec -- dsh --profile web
```

`npm pack` 通过 `prepack` 自动构建。Web 安装需 PATH 中可用的 pnpm；首次安装可运行 `npm install --global pnpm`。请保留安装用的包及其本地路径。

## 桌面 CLI 安装

先打开一次桌面应用，再完全退出它；下载 Release 包后，将两个路径替换为自己的实际位置：

```powershell
$desktopCli = 'C:\实际安装目录\resources\runtime\cli\bin\dsh.cmd'
$packagePath = 'C:\实际下载目录\dsh-toons-0.1.24.tgz'
& $desktopCli --version
& $desktopCli plugin --profile desktop add "$packagePath"
```

CLI 应显示 `0.2.0-rc.2`。安装后重新打开应用；也可直接在内置插件管理中添加本地包。

## 构建与动作预览

在项目根目录运行：

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

预览地址为 `http://127.0.0.1:3088/`。它复用插件组件、Worker、解释器和角色素材，支持切换动作、主题、暂停、收起／展开与本地资源。动态选项使用模拟导演编排展示背景、道具、特效和气泡，不调用模型。

重新生成安装包：

```powershell
New-Item -ItemType Directory -Force -Path .\dist | Out-Null
npm pack --pack-destination .\dist
```

`prepack` 会重新构建 Host、Client 和动画 Worker。包名由 `package.json` 中的版本决定。

## 原生挂载与像素布局

客户端通过 `conversation.input.dock` 插槽把动画放在输入框上方。画布使用 8 × 14 的位图单元、固定 8 行，按容器宽度以每格约 12 CSS 像素换算列数，列数限制为 36～240；正常宽度下目标高度约 168 CSS 像素。窄画布按比例降低高度，保留人物和道具；布局参数见 `src/client/layout.ts`。

画布不参与父容器的 flex 压缩，控制区位于画布下方，窄容器自动分为两行。收起后只保留控制区与状态；旧版 `hidden` 偏好迁移为 `compact`。主题切换复用已加载的角色素材与 Worker。

## 角色图集与时钟

默认角色动作表位于 `assets/animations/`，连续 8 帧按 4 列 × 2 行排列：

- `idle.png`、`think.png`、`search.png`、`check.png`：待机、思考、搜索和检查。
- `read.png`、`type.png`、`success.png`、`failed.png`：阅读、编辑、庆祝和失落。
- `walk.png`：同一图集经水平镜像用于左右行走，共十种播放动作。

七个内置角色的每种动作均有八帧，具体时长由动作表或资源包 manifest 决定。0.1.24 默认鲸鱼娘行走为每帧 75 毫秒，六个附加角色为每帧 100 毫秒；其他动作保留各自时长。素材结构与重建命令见[角色与行走说明](../design/character-walks.md)和[八帧动作设计](../design/eight-frame-animation.md)。

裁切帧共享人物中心和脚底基线，趴姿沿用站姿的像素比例。默认鲸鱼娘使用偏正面的三分之四行走视角，原始人物层保存在 `design/whale-walk-body.png`；`assets/deepseek-girl-poses.png` 保留作兼容回退。素材使用内置 image_gen 生成，播放采用最近邻缩放。

任务结束后，场景 Worker 与模型请求停止；完成或失败先播放约 1.8 秒反应，再进入本地待机与闲逛。蒸汽、星光、雨滴、波纹等预制小动效由本地时钟继续播放。收起、后台或系统“减少动态效果”会暂停播放。窗口在待机时改变大小只重新布局，不恢复 Worker 的连续运行。

支持行走的导入角色会走动、停留并返回工作位置；缺少行走动作时保持原地。阅读、编辑及真实会话结束状态优先于旧场景的动作意图。资源包制作规则见[本地资源包说明](local-resource-packs.md)。

## 场景调度与中文文字

预制场景至少展示 20 秒，动态场景从真正上屏开始至少展示 45 秒。暂停任务、收起和后台时间不计入展示时长；手动换主题及损坏场景回退立即生效，人物动作继续跟随任务。0.1.24 动态气泡在新场景开始后的前 12 秒展示，任务阶段变化或结束后隐藏。完整编排格式见[动态场景说明](dynamic-scenes.md)。

12 个内置主题均有日光／暮色版本。任务主题按阶段选择背景；全部主题可轮换，固定主题在任务间保留。游戏场景的控制屏、水车、风车等由本地时钟播放。

旧场景代码继续作为解释器兼容参考，默认牌组不再选择旧场景。`clawd()`／`clawd3d()` 映射到固定角色素材；新动态导演只返回经过校验的主题、动作、道具和特效选择，不返回绘图代码或远程地址。汉字和全角标点按两列宽度绘制，气泡按实际列宽换行；字体优先使用系统中的微软雅黑／苹方／思源黑体。气泡为文字，不包含语音。

## 隔离的 Harness 联调

以下命令在当前 PowerShell 进程中使用独立 home，并在退出联调后恢复原来的 `DSH_HOME`：

```powershell
$previousDshHome = $env:DSH_HOME
try {
  $env:DSH_HOME = Join-Path (Get-Location).Path 'work\harness-home'
  npm exec -- dsh --profile web --patch .\dev.patch.yml --patch .\tests\fixtures\offline.patch.yml --no-open --port 3087
} finally {
  $env:DSH_HOME = $previousDshHome
}
```

`offline.patch.yml` 将默认模型设为无网络模拟适配器，生成测试文本并响应动画导演请求；模拟 token 不代表真实费用。测试文件不进入发布包。省略第二个 `--patch` 后使用隔离 profile 中配置的真实模型。开发 patch 固定使用页面内的目录浏览器，发布 bundle 不改变目录选择方式。

Windows 自动升级的隔离集成测试：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\desktop-updater.test.ps1
```

安装与更新机制见[桌面自动升级说明](desktop-auto-update.md)。历史验证结果见[构建记录](BUILD_REPORT.md)，其中的旧版本、机器路径、测试数量与限制只代表当时的验证状态。
