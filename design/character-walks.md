# 内置角色与行走素材 · 0.1.24

默认鲸鱼娘 Deep seek 与六个附加角色的素材均随插件安装，无需外网或模型调用。在动画条下方展开「本地资源」，从角色菜单直接选择 Kimi、Gemini、Claude、Qwen、Grok 或 GLM；「恢复默认」回到 Deep seek。角色与场景分别选择，每个角色都有待机、思考、搜索、阅读、打字、检查、成功、失落及左右行走十种八帧动作。

![六个附加角色的当前行走效果](screenshots/character-walks-v0124.gif)

## 名称与稳定 ID

显示名称只用于界面和资源包描述。内置选择使用 `builtin-` 前缀，与用户自行导入的角色分开；原有 ID 和选择配置继续有效。

| 显示名称 | 素材目录／ZIP ID | 界面内置选择 ID | 行走帧时长 |
| --- | --- | --- | --- |
| Deep seek | 默认 `assets/animations/` | 默认（空选择值） | 75 毫秒 |
| Kimi | `silver-music` | `builtin-silver-music` | 100 毫秒 |
| Gemini | `purple-star-cat` | `builtin-purple-star-cat` | 100 毫秒 |
| Claude | `orange-flower` | `builtin-orange-flower` | 100 毫秒 |
| Qwen | `blue-fan` | `builtin-blue-fan` | 100 毫秒 |
| Grok | `blonde-goth` | `builtin-blonde-goth` | 100 毫秒 |
| GLM | `black-beast` | `builtin-black-beast` | 100 毫秒 |

六个附加角色首次选择时从当前 Harness Host 读取已安装的归档，校验并解包后在本次客户端运行期间复用，不写入用户导入资源库。尚未加载的角色需要 Host 连接才能首次读取；缓存不作为跨刷新保存的资源库。可导入的完整包在 `examples/character-packs/<ID>.toons.zip`，格式见 [本地资源包说明](../docs/local-resource-packs.md)。

正式插件使用 Harness 原生认证的 `toons/builtin-pack` 接口，Host 只读取精确允许列表中的六个归档，不接受调用方提供的路径或 URL。接口返回有大小限制的 base64；客户端在分配解码字节前检查 ID、编码格式与大小，再校验 ZIP 和 manifest。角色加载不访问外网，也不调用模型。客户端构建产物不再内嵌六份 ZIP，从此前约 54 MB 减至 19.49 MB。预览页单独使用 `src/preview-pack-assets.ts` 提供本地 ZIP，隔离于正式客户端。

## 当前步态与分层

Deep seek 的 `assets/animations/walk.png` 使用偏正面三分之四视角，双眼和围裙正面保持可见。八帧小步交替支撑、抬脚与收脚，左腿高光随步态移动。完整头发、衣裙、手臂与鲸尾统一轻微起伏，腿长和圆厚鞋头接近待机比例，人物中心与落脚线稳定。`design/whale-walk-body.png` 保存完整人物层参考。

六个附加角色从各自 `idle` 第一帧提取原始像素。`design/character-limb-rigs.json` 登记每条腿的范围、腿根和脚踝；丝袜、小腿、脚踝与鞋作为相连肢体连续变形，脚踝以下的整只鞋平移，保持原始鞋形与像素。完整前裙、围裙、蕾丝、低垂装饰与其余人物像素作为前景覆盖腿根，并一起轻微起伏。

![Grok 的完整服装前景、连续腿脚后景与合成效果示例](screenshots/character-layers-v0124.gif)

每帧保持真实脚底接触地面，八个腿脚阶段各不相同。左右行走共用一张四列两行图集，通过镜像播放右行。其他八种动作和 manifest 中的时长、锚点与循环配置保持原样。

资源包加载时扫描并缓存每帧实际可见像素的边界。渲染按同一动作内的可见宽高统一缩放，再限制当前帧的可见位置；透明留白可以延伸到画布外，人物像素保持在画布内。这样可保持脚底落地，同时完整显示高举手等较高的自定义姿势，不因透明格子大小改变人物比例或裁掉人物。

## 重建六个附加角色的行走素材

在项目根目录安装依赖并生成预览：

```powershell
npm ci
node scripts/compose-character-walks.mjs
```

脚本使用项目直接开发依赖 `sharp` 处理 PNG，默认只写入 `work/character-walks/`。若 PATH 中有 `ffmpeg`，还生成正常速度和慢速 GIF；没有 `ffmpeg` 时仍可生成 PNG、图集和校验记录。此脚本处理六个附加角色，Deep seek 的行走素材独立保存。

每个角色的预览目录包含 `idle.png`、`body-fixed.png`、`frames/`、`leg-layers/` 和 `walk-source.png`，以及 `validation.json`、`geometry.json` 与分层说明；汇总记录在 `connected-validation.json`。可传入一个或多个素材 ID，只重建指定角色：

```powershell
node scripts/compose-character-walks.mjs silver-music blue-fan
```

检查播放效果与服装遮挡后，追加 `--write` 将审定素材写入项目：

```powershell
node scripts/compose-character-walks.mjs --write
node scripts/compose-character-walks.mjs --write silver-music
```

写入包括 `assets/characters/<ID>/walk-left.png`、对应完整 ZIP 中的 `walk-left.png`、`examples/character-packs/walk-sources/` 源图集，以及 `design/character-walk-bodies/` 和 `design/character-walk-legs/` 分层参考。ZIP 的 manifest 与其他八种动作文件按原字节保留，并更新目录中的包大小与校验记录；发生变化的原 ZIP 备份到 `work/character-walks/original-packs/`。

## 检查方式

```powershell
npm test
npm run preview
```

测试直接读取正式 PNG、manifest 和 ZIP，检查八帧差异、落脚线、镜像、完整人物层、原始服装与腿脚像素、鞋形和待机比例，以及名称、内置选择、归档读取与可见边界行为。预览页使用实际插件组件；在「本地资源」中切换角色，检查左右行走、工作返回、任务结束后的停留与移动，并在窄窗口确认人物完整显示。正式 Host 的归档读取通过接口测试验证，预览页的本地加载不能代替此项检查。

本页记录 0.1.24 的当前素材。早期方案与八帧动作制作记录分别见 [0.1.14 行走记录](walking-animation.md) 和 [八帧动作记录](eight-frame-animation.md)；其中旧步态描述属于当时的版本。
