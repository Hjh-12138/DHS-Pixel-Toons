<h1 align="center">DeepSeek Toons</h1>

<p align="center">
  <strong>让等待，有一点陪伴</strong>
</p>

<p align="center">
  <img src="design/screenshots/reading-typing.gif" width="49%" alt="鲸鱼娘在聊天界面中阅读和敲键盘的动画" />
  <img src="design/screenshots/character-walks-v0124.gif" width="49%" alt="Kimi、Gemini、Claude、Qwen、Grok、GLM 六个角色的行走动画" />
</p>

<p align="center">
  <a href="https://github.com/Hjh-12138/DSH-Pixel-Toons/releases/tag/v0.1.24"><img src="https://img.shields.io/badge/version-0.1.24-blue" alt="下载 0.1.24 安装包" /></a>
  <img src="https://img.shields.io/badge/Harness-0.2.0--rc.2-527aaa" alt="Harness 0.2.0-rc.2" />
  <img src="https://img.shields.io/badge/verified-Windows-0078d4" alt="目前仅验证 Windows" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT 代码许可证" /></a>
</p>

<p align="center">
  简体中文 · <a href="README.en.md">English</a><br />
  <a href="#动画预览">动画预览</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#功能亮点">功能亮点</a> ·
  <a href="#隐私说明">隐私说明</a> ·
  <a href="#常见问题">常见问题</a>
</p>

**运行环境：DeepSeek Harness `0.2.0-rc.2`；目前仅验证 Windows 的 Web 与桌面客户端。** 桌面安装使用应用自带运行时；Web 命令安装需 Node.js 至少 `22.19.0`（本地验证 `24.12.0`）和 npm。源码开发另需 Git。下列命令使用 PowerShell；桌面自动升级依赖 Windows 任务计划程序。macOS／Linux 尚未验证。

## 动画预览

阅读时趴着翻书，写代码时敲键盘；思考、搜索、检查和任务完成都有对应动作。

12 个像素主题、24 个日光／暮色版本，包含书阁、工坊、鲸鱼港湾与游戏致敬场景。默认预制模式直接播放本地素材，无额外模型调用。

<p align="center">
  <img src="design/screenshots/game-themes-v016.gif" width="900" alt="罗德岛、列车车厢、武陵水畔和蒙德风车广场的像素主题预览" />
</p>

任务完成后，角色会庆祝，再在场景中走走停停，本地闲逛不增加模型请求。阅读／打字和游戏场景动图录自历史版本；六角色行走动图对应 0.1.24。更多素材见[角色与行走说明](design/character-walks.md)，版本变化见 [CHANGELOG](CHANGELOG.md)。

## 快速开始

**[下载 dsh-toons-0.1.24.tgz](https://github.com/Hjh-12138/DSH-Pixel-Toons/releases/download/v0.1.24/dsh-toons-0.1.24.tgz)** · [查看 Release 与校验值](https://github.com/Hjh-12138/DSH-Pixel-Toons/releases/tag/v0.1.24)

### 桌面：下载后直接导入

1. 打开一次 DeepSeek Harness 桌面端，确认 Harness 版本为 `0.2.0-rc.2`。
2. 在内置插件管理中添加下载的 `.tgz` 本地包，并启用 `dsh-toons`。
3. 完全退出并重新打开应用，动画会出现在聊天输入框上方。

桌面安装无需克隆源码或运行构建命令。请保留下载的安装包，profile 可能继续引用本地路径。桌面用户可另行启用 [Windows 自动升级](docs/desktop-auto-update.md)。

### Web：三条命令

已有 Node.js 和 npm 后，停止原 Web 服务，在 PowerShell 中依次运行：

```powershell
npm install --global pnpm @deepseek-ai/dsh@0.2.0-rc.2
dsh plugin --profile web add "https://github.com/Hjh-12138/DSH-Pixel-Toons/releases/download/v0.1.24/dsh-toons-0.1.24.tgz"
dsh --profile web
```

第二条命令直接下载并安装 Release 附件，无需 `dist`、Git 或自行打包。每条命令成功后再继续。已有匹配版本的 CLI 与 pnpm 可跳过第一条；连接或安装问题见[常见问题](#常见问题)。完整源码构建及桌面 CLI 安装步骤见[开发说明](docs/development.md)。

## 功能亮点

- **嵌入聊天界面。** 像素伙伴位于输入框上方，跟随当前会话，不需要另开窗口。
- **动作跟随任务。** 阅读、编辑、思考、搜索、测试和构建会切换对应动作，任务结束时播放庆祝或失落动画。
- **等待时也有陪伴。** 空闲时角色会眨眼、走动和停留，完成后继续在小世界里闲逛。
- **12 个像素主题。** 日常场景与游戏致敬场景均有昼夜配色，可固定喜欢的主题，也可按任务选择或轮换。
- **7 个内置角色。** 默认鲸鱼娘，以及 Kimi、Gemini、Claude、Qwen、Grok 和 GLM 致敬角色，可在「本地资源」中选择。
- **导入自己的角色与场景。** 支持本地 ZIP／内嵌图片 JSON，角色与背景可分别选择、成套应用，并在当前客户端保存。
- **随时收起。** 下方控制区支持收起／展开，窄窗口自动调整布局；收起、后台和系统“减少动态效果”设置会暂停动画。
- **可选动态混合。** 配置的模型根据任务摘要生成中文文字气泡，并组合已有背景、动作、道具和特效；失败时回退到预制场景，额外 token 用量单独显示。

> [!IMPORTANT]
> **动态混合会把工具名称、路径／命令等任务摘要发送给已配置的模型，并产生额外模型用量。摘要也可能包含用户输入的短片段。** 默认预制模式只播放本地素材，插件不会为动画发送任务内容或调用模型。启用前请阅读下方隐私说明。

## 隐私说明

- **预制模式：** 动画使用本地素材和会话状态，不发起额外模型请求。聊天任务本身仍按 Harness 的配置调用模型。
- **动态混合：** 通过 Harness 的模型路由发送当前任务阶段、短摘要、失败标记和角色人设。摘要可能来自工具名称、文件路径、命令、网址、检索词，或用户输入的前 80 个字符；截短不等于脱敏。
- **模型与权限：** 默认沿用当前会话的 provider／model，可在插件配置中覆盖。不复制完整主会话消息；动画导演不执行工具。具体数据处理取决于你配置的模型服务。
- **本地资源与日志：** 导入的角色、场景及选择保存在当前客户端，不上传资源包。用量日志默认关闭；设置 `stateDirectory` 后会在本地记录时间、会话 ID、请求次数及模型用量。

如果任务中包含不希望发送的内容，请保留预制模式。切回预制、结束任务或收起动画会取消动态请求。请求频率、返回格式和回退行为详见[动态场景说明](docs/dynamic-scenes.md)。

## 自定义角色与场景

打开动画条下方的「本地资源」，可选择内置角色，或点击「导入资源包」导入 ZIP／内嵌图片 JSON。角色和场景可以独立切换，「试用示例」会加载薄荷机器人与月光庭院。

资源包格式、大小限制及制作示例见[本地资源包说明](docs/local-resource-packs.md)。Web、桌面和不同浏览器各有自己的资源库；清除客户端网站数据会删除导入资源，请保留原始包。「恢复默认」保留已导入的包，需要清理时可在列表中删除。

内置主题包括海风书桌、窗边书阁、像素工坊、玻璃花房、星空观测室、鲸鱼港湾、雨夜茶室、云端车站，以及罗德岛控制中枢、列车观景车厢、武陵水畔和蒙德风车广场。

## 配置

在所用 profile 的 `cordis.patch.yml` 中按 `id` 覆盖配置。Harness patch 会替换整段 `config`，可从下面的完整示例开始：

```yaml
- id: dsh-toons
  config:
    enabled: true
    source: ready-made only
    fps: 20
    intervalMs: 60000
    timeoutMs: 45000
    maxTokens: 4000
    provider: ''
    model: ''
    stateDirectory: ''
```

| 配置 | 作用 |
| --- | --- |
| `enabled` | 是否启用插件。 |
| `source` | 首次打开时的模式：`ready-made only` 为预制，`mix` 为动态混合。客户端保存的手动选择优先。 |
| `fps` | 场景刷新频率，默认 20。 |
| `intervalMs` | 动态请求的最短间隔，默认 60 秒。 |
| `timeoutMs` / `maxTokens` | 单次动态请求的超时与输出上限，默认 45 秒／4000 token。 |
| `provider` / `model` | 留空时沿用当前会话的模型路由。 |
| `stateDirectory` | 本地用量日志目录；留空则不写日志。 |

动态混合可直接在动画条中选择。token 统计来自模型报告，不折算为货币费用，Host 重启后累计值重新开始。配置修改后重启所用客户端。

## 开发

克隆源码并安装依赖后，在项目根目录运行：

```powershell
npm run typecheck
npm test
npm run preview
```

动作预览地址为 `http://127.0.0.1:3088/`，支持动作、主题、暂停与收起／展开；动态选项使用模拟编排，不调用模型。源码安装、构建与 `npm pack` 命令见[开发说明](docs/development.md#从源码安装)。

- [开发与渲染说明](docs/development.md)：像素布局、逐帧素材、场景计时、隔离 Harness 联调和 Windows 升级测试。
- [更新记录](CHANGELOG.md)：按版本查看功能变化与修复。
- [历史构建与验证记录](docs/BUILD_REPORT.md)：保留旧版本的验证结果与开发机器路径，供追溯参考。

## 常见问题

### 安装后插件没有出现？

确认安装到了正在使用的 profile：Web 用 `web`，桌面用 `desktop`。在插件管理中检查 `dsh-toons` 是否启用，配置中 `enabled` 是否为 `true`；重启 Web 服务或完全退出并重新打开桌面应用。如果仅剩一行状态栏，点击「展开」。仍有问题时查看 Harness 启动日志与安装命令输出。

### 提示找不到 dsh、pnpm 或安装包？

Release 安装请先完成 Web 快速开始中的第一条命令，并重新打开 PowerShell 检查 PATH；桌面端可直接使用内置插件管理。出现 `pnpm was not found` 时用 `pnpm --version` 检查安装。下载失败时可从 Release 页面手动保存 `.tgz`，安装时填写其完整本地路径。源码安装的 `npm exec -- dsh ...` 必须在已运行 `npm ci` 的项目目录中执行。

### Harness 版本不匹配会怎样？

本项目的 Harness peer 依赖固定为 `0.2.0-rc.2`。插件管理可能返回 `incompatible-version`，CLI 可能显示 `plugin command failed; diagnostics: ...`，包管理器也可能显示 peer dependency 冲突。先核对实际客户端与 CLI 的版本，使用匹配版本后重试；仅升级项目依赖中的 CLI 不会升级桌面应用。

### 动态模式没有气泡，或提示回退？

动态请求只在任务运行时发起，空闲时不会生成气泡。检查当前模型配置、凭证、额度和连接；动画条会提示认证失败、超时、空正文或编排校验失败等原因。回退时预制动画仍可用。“中文气泡”是文字，没有语音朗读。

### 如何卸载？

若启用了桌面自动升级，先停用计划任务，避免后台更新与卸载同时进行：

```powershell
Unregister-ScheduledTask -TaskName DSH-Toons-AutoUpdate -Confirm:$false
```

没有启用自动升级则跳过上一步。停止 Web 服务后，使用快速开始中安装的 CLI 卸载 Web profile 的插件：

```powershell
dsh plugin --profile web remove dsh-toons
```

桌面端可在内置插件管理中移除 `dsh-toons`，或完全退出应用后，用[开发说明](docs/development.md#桌面-cli-安装)中设置的 `$desktopCli` 运行：

```powershell
& $desktopCli plugin --profile desktop remove dsh-toons
```

之后重启客户端。卸载不会主动清空浏览器中的角色资源；需要清理时可先在「本地资源」中删除导入包。

### 反馈问题或讨论功能？

安装与运行故障请通过 [Issues 问题模板](https://github.com/Hjh-12138/DSH-Pixel-Toons/issues/new?template=bug_report.yml)提交 Harness 版本、系统、复现步骤与截图；使用交流和功能建议欢迎到 [Discussions](https://github.com/Hjh-12138/DSH-Pixel-Toons/discussions)。

## 致谢与声明

DeepSeek Toons 基于 [claude-toons](https://github.com/achimala/claude-toons) 的 MIT 代码改造，通过 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的原生插件接口接入。ZIP 解码使用 fflate；角色素材使用内置 image_gen 工具结合用户提供的参考生成。完整来源与许可见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md) 和 [LICENSE](LICENSE)。

**本项目为非官方同人／致敬作品，与 DeepSeek、Moonshot AI（Kimi）、Google（Gemini）、Anthropic（Claude）、阿里巴巴（Qwen）、xAI（Grok）、智谱（GLM）及相关游戏公司无隶属、合作或背书关系。** 罗德岛、星穹铁道、终末地、原神等游戏主题，以及品牌与角色名称的相关权利归各自权利人所有；代码的 MIT 许可不代表授予这些第三方权利。
