# 配图的英文版

文章的英文副本（`.en.md`）不能直接沿用带中文文字的配图：正文翻成了英文，图还是中文，英文读者照样看不懂。所以发布或修改文章时，**每一张含中文文字的配图都要有对应的英文版**，英文页引用英文图。

## 原则

唯一的标准是：**英文读者看英文图，能和中文读者看原图理解得一样多**。也就是尽可能保留原图要表达的含义，包括作者加的红框、下划线、箭头等标注想强调的东西。

图片千变万化，同一类图也有各种变体，所以**具体怎么做由处理的人（通常是 Claude）看图判断**，下面的做法和工具只是常见情况的参考，不是必须套用的规则。遇到不合适的情况，就换更合适的办法：直接写一段 Pillow 代码、重画、只翻译关键部分、在英文正文或 alt 里补充说明，甚至判断这张图不需要英文版，都可以。

几个通常成立的判断：

- 截自有公开英文原文的资料（Anthropic 文章、英文论文的中文译文等），优先找到原文，用原文措辞。
- 原图本身是英文、只是带上了中文翻译（浏览器翻译、双语字幕），去掉中文部分往往就够了。
- 没有英文原文，就自己翻译，忠实原意，术语和英文正文保持一致。
- 没有文字或只有不影响理解的零星中文（照片里的招牌等），可以共用原图，在英文 alt 里交代。

## 辅助工具（可选）

`tools/image-i18n/render.py` 能处理两类最常见的情况，好处是可重复：改了原图或译文，重跑一次就能重新生成。用不上就不用。

- **`reflow`**：整段文字的截图（文章段落、聊天记录、笔记）。按原图的底色、字号、行距、页边距重新排出英文段落，标注框画回对应的英文片段。
- **`overlay`**：图表、界面这类版式本身有意义的图。在原图上用底色盖住中文，原位写入英文（放不下会自动缩小字号）；也可以只做 `crop` 裁剪。

## 用工具时：标注怎么跟着走

标注要标在**意思对应**的英文片段上，而不是原来的像素位置：

- `reflow` 模式里，用 `[[...]]` 把对应的英文片段括起来，脚本会画回同色同粗细的框；片段跨行时每行各画一段，和原图一致。
- `overlay` 模式里，补丁区域要画在标注框**里面**，框留在区域外就不会被盖掉；如果英文片段的位置和原框差得太多，就把原框也盖掉，再用 `reflow` 或手工补一个 patch。

底色、文字色、标注色默认从原图自动取（`auto`），一般不用填。

## 文件放哪、叫什么

都放在图片原来的目录里（页面包目录，或 Typora 的 `X.assets/`）：

```
content/notes/clever/
├── index.md                        ![中文 alt](j-space-blackmail.png)
├── index.en.md                     ![English alt](j-space-blackmail.en.png)
├── j-space-blackmail.png           原图
├── j-space-blackmail.i18n.yaml     描述文件（hugo.yaml 的 ignoreFiles 让它不进站点）
└── j-space-blackmail.en.png        生成的英文图，和描述文件一起提交
```

英文图命名为 `<原名>.en.png`，`index.en.md` 里改引用它，alt 也写英文。

## 描述文件

`reflow`（例：`content/notes/clever/j-space-blackmail.i18n.yaml`）：

```yaml
source: j-space-blackmail.png
output: j-space-blackmail.en.png
mode: reflow
reference: https://www.anthropic.com/research/global-workspace   # 英文原文出处，没有就删掉
font: serif           # serif / serif-semibold / sans / sans-semibold / mono
size: 46              # 字号：英文字母高度和原图里的拉丁字母差不多即可
line_height: 71       # 量原图相邻两行的间距
padding: [18, 60, 22, 45]   # 上 右 下 左，左边距和原图对齐
box: {width: 4, pad: [5, 3]}   # 标注框线宽、内边距；color 默认取原图
text: >
  ……正文……[[要画框的片段]]……
```

`overlay`（例：`content/notes/this-world-is-not-real/j-space-injection.i18n.yaml`）：

```yaml
source: diagram.png
output: diagram.en.png
mode: overlay
crop: [0, 0, 1679, 1004]        # 可选，先裁剪原图：左 上 右 下
patches:                        # 可选，每块中文一个
  - box: [120, 40, 520, 90]     # 要盖掉的中文区域（裁剪后的坐标）
    text: "Swapping the J-space changes the answer"
    font: sans
    size: 28
    align: left                 # left / center / right
```

坐标用像素，可以先用 Pillow 打开原图量，或者把原图交给 Claude 读出文字和位置。

## 流程

1. 写好中英文正文后，逐张检查配图，按上面的原则判断要不要做英文版、怎么做。
2. 用工具的话，在图旁写 `<原名>.i18n.yaml`：识别图里的中文 → 找原文或翻译 → 填进 `text` / `patches`；不用工具就用别的办法做出 `<原名>.en.png`。
3. 用工具时生成：`python3 tools/image-i18n/render.py <描述文件>`（全部重新生成用 `--all`）。依赖 Pillow 和 PyYAML，字体在 `tools/image-i18n/fonts/`（Source Serif 4 / Source Sans 3 / Source Code Pro，SIL OFL）。
4. 打开英文图核对：没有残留中文、没有溢出、标注落在对应的英文上，意思和原图一致。
5. `index.en.md` 改引用 `<原名>.en.png`，更新英文 alt。
6. 本地或 PR 预览里分别截中文页和英文页，按项目要求标出改动位置后附在 PR / 回复里。

用工具生成的英文图，改了原图或描述文件就重新生成并一起提交，不要手动改生成物。

## 测试

改 `render.py` 后先跑回归测试（CI 的 Test 任务也会跑）：

```bash
pip install -r tools/image-i18n/requirements.txt
python3 -m unittest discover -s tools/image-i18n -v
```

测试分两部分：用合成图片检查拆词、换行、标注框、取色、补丁缩字号和裁剪；再检查 `content/` 里每份描述文件，确认英文图存在、只被英文页引用，并且和按当前描述重新生成的结果一致，改了描述却忘了重新生成会直接失败。
