# 角色走路与本地移动 · 0.1.14

新增素材：`assets/deepseek-girl-walk.png`，透明 PNG，4 列 × 2 行。第一行向左、第二行向右，每方向四帧，150 毫秒一帧。使用内置 imagegen 工具，以原 `assets/deepseek-girl-poses.png` 作为角色身份与画风参考生成。

0.1.14 替换了旧行走图。旧图虽然有八个格子，但同方向的腿脚姿势几乎相同，手臂始终前伸，实际播放像滑行；一次仅修改抬脚的候选图仍重复第 1／3、2／4 帧，未采用。最终图逐帧为迈开、前脚抬起、屈膝承重（后脚跟抬起）和后脚回收，手臂配合前后交替。只改变行走素材，保留本地路线与待机逻辑。

最终素材由内置 imagegen 编辑生成，源文件为 `C:/Users/31457/.codex/generated_images/01a109f1-6532-7320-82a5-e0c56d0cd1b4/exec-19d981a9-ae21-4af7-b4e4-f9697fc28e87.png`。`tests/walking-assets.test.ts` 解码项目实际 PNG，在共享身体大小和根节点下采样 80 像素高度的腿部轮廓；逐对比较四帧，要求轮廓变化至少 35%，手部水平跨度变化至少 8 像素。相同检查对 0.1.13 原素材四项均失败，对新素材四项均通过；此检查仍需配合实际播放视觉验收。

人物位置由 `src/client/travel.ts` 管理，独立于工具事件、动作和场景计时。等待时走动与停留交替；阅读、编辑和回复时走回工作位置，停留约 22 秒后短暂起身并返回。完成和失败反应期间停住，之后进入待机闲逛，约 1.2 秒起步，每到一处停留 1.2～2.4 秒，再换个目的地；待机取消工作场景的回桌路线。后台、收起和系统减少动态效果暂停时钟；窗口变窄时同时限制当前位置和目的地。动态导演任务进行时使用其绘图脚本中的移动；任务结束后沿用最后站位，在冻结的背景上闲逛，不重启 Worker 或请求模型。

本地角色使用包内走路动作，只提供一个方向时镜像另一个方向，两个方向都没有时保持原地。本地场景的 `centerX` 是工作与返回的位置，`footY` 是移动时也保留的落脚基线。内置家具固定在工作位置，人物行走时使用地面基线。

制作提示词（内置 imagegen，参考输入为旧人物动作表，透明背景）：

> Use the attached sprite atlas ONLY as a character identity and pixel-art style reference. Create a NEW production sprite atlas for the identical blue-haired whale maid chibi girl, with exactly EIGHT walking sprites arranged in exactly FOUR columns by TWO rows on a genuinely transparent background. This is an animation sheet, not a poster. NO text, labels, grid lines, shadows, background, props or other characters. All 8 sprites show the SAME character, SAME head size, SAME proportions, SAME clothing and palette: long blue hair, blue eyes, white frilled maid headband and blue bow, navy blue dress with white apron, gold tiny details, short navy shoes, visible whale tail. Match reference raster pixel-art crisp stepped edges and shaded anime chibi look. Each cell has generous clear gutters; full figure inside every cell. Identical scale across all cells, body root centered at identical relative x in each cell, foot contact baseline identical relative y in each row. Only small natural vertical bounce, hair and whale tail sway. TOP ROW: four consecutive frames of a complete LEFT-facing side-view walk cycle: left-foot-forward contact, passing legs, right-foot-forward contact, passing legs on the opposite weight. BOTTOM ROW: four consecutive frames of the equivalent RIGHT-facing side-view walk cycle, the same four phases. Actual leg and arm swing differences visible between frames, the forward foot contacts ground and the back foot lifts during passing. Preserve silhouette and face identity without morphing costume or growing/shrinking character. No frontal standing or reading poses. All top four face LEFT, all bottom four face RIGHT. Layout aspect ratio 2:1, regular equal-sized square cells, precisely 4 by 2, maximum clarity for nearest-neighbor game sprite playback.

验证：逐帧来源、位移连续性、往返停留、工作返回、反应暂停、缺失动作、窗口边界与缩放；另在实际页面检查默认女孩和单方向行走的薄荷机器人。

0.1.14 最终编辑提示词（输入为已修正摆臂的候选图，使用内置 imagegen，透明背景）：

> Edit the attached 4-column x 2-row transparent pixel-art character walking atlas. Preserve the character, face, hair, costume, tail, proportions, eight-cell layout and transparent background. The arm swing in columns 1 and 3 is now correct; KEEP IT.
> Critical correction: column 3's LEGS are currently a duplicate of column 1, and column 4's LEGS a duplicate of column 2. Change the LEGS in columns 3 and 4 into genuinely different phases. Four distinct silhouettes per direction are required, not a repeated two-pose sequence.
> TOP ROW all facing LEFT:
> 1. Keep the wide stride: near leg extended forward LEFT, far leg behind RIGHT. Near arm back and far arm forward.
> 2. Keep the raised forward knee: lifted shoe in front to LEFT, support shoe toward RIGHT under the hip. Near arm near vertical.
> 3. Opposite weight, a DOWN/recoil phase: the forward far leg is visibly BENT at the knee and bearing weight on a shoe to LEFT, pelvis slightly lower by about 3 pixels at 80px character height; the near trailing leg stretches BACK to RIGHT with heel RAISED and only TOE touching the baseline. Therefore this frame has a bent planted knee and rear toe contact rather than two straight wide legs like frame 1. Near arm swings forward LEFT and far arm back. Keep feet toe direction LEFT.
> 4. Rear recovery phase: far support leg almost vertical with its shoe planted LEFT of the pelvis; near trailing leg is bent backward, its shoe LIFTED BEHIND the body to RIGHT at least one shoe-height above the ground. This is clearly different from column 2, where the lifted foot is IN FRONT to LEFT and planted shoe toward RIGHT. Near arm returns downward, tilted slightly back, and far arm forward. Preserve one planted shoe.
> BOTTOM ROW all facing RIGHT: exact spatially mirrored counterparts of the TOP ROW, same four phases.
> The visible sequence in each row must be: wide straight-legged contact; lifted front knee; bent-knee down/recoil with rear heel lifted; lifted rear heel. All four leg silhouettes and hand positions must visibly differ at actual 80px display height. In particular, frames 1 and 3 may NOT have identical straight legs, and 2 and 4 may NOT raise the shoe on the same side. Keep two anatomically connected legs and two feet only. Keep hand movement relaxed around waist/hip level, no forward-stretched arms in every cell.
> Maintain consistent ground baseline and root center, crisp pixel-art edges and clean transparency. No labels, grid, floor, props, shadows or extra characters. Exactly 4 columns x 2 rows.
