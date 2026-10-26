# 配图的英文版

文章的英文副本（`.en.md`）不能直接沿用带中文文字的配图：正文翻成了英文，图还是中文，英文读者照样看不懂。所以发布或修改文章时，**每一张含中文文字的配图都要有对应的英文版**，英文页引用英文图。英文图由 `tools/image-i18n/render.py` 按一份描述文件生成，不用手动截图或修图。

## 每张图怎么处理

按顺序判断，命中哪条就照哪条做：

| 情况 | 做法 |
| --- | --- |
| 图里没有文字，或只有不影响理解的零星中文（照片里的招牌等） | 不处理，中英文共用原图，英文 alt 里交代清楚 |
| 原图本身是英文，只是截图时带上了中文翻译（浏览器翻译、双语字幕） | `overlay` 模式加 `crop`，裁掉中文部分 |
| 截自有公开英文原文的资料（Anthropic 文章、英文论文的中文译文等） | 找到英文原文，**直接用原文措辞**，并在描述文件的 `reference` 里写上出处 |
| 没有英文原文 | 自己翻译，忠实原意，术语和英文正文保持一致 |

然后按图的类型选模式：

- **`reflow`**：整段文字的截图（文章段落、聊天记录、笔记）。按原图的底色、字号、行距、页边距重新排出英文段落。英文和中文长短不同，强行原位替换会挤成一团，重排更好读。
- **`overlay`**：图表、界面、流程图这类版式本身有意义的图。在原图上用底色盖住每块中文，原位写入英文（放不下会自动缩小字号）。

## 标注要跟着走

用户在图上加的红框、下划线等标注表达的是“这里是重点”，英文版必须标在**意思对应**的英文片段上，而不是原来的像素位置：

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

1. 写好中英文正文后，逐张检查配图，按上面的表判断要不要做英文版。
2. 需要的话，在图旁写 `<原名>.i18n.yaml`：识别图里的中文 → 找原文或翻译 → 填进 `text` / `patches`。
3. 生成：`python3 tools/image-i18n/render.py <描述文件>`（全部重新生成用 `--all`）。依赖 Pillow 和 PyYAML，字体在 `tools/image-i18n/fonts/`（Source Serif 4 / Source Sans 3 / Source Code Pro，SIL OFL）。
4. 打开生成的图核对：没有残留中文、没有溢出、标注框落在对应的英文上。
5. `index.en.md` 改引用 `<原名>.en.png`，更新英文 alt。
6. 本地或 PR 预览里分别截中文页和英文页，按项目要求标出改动位置后附在 PR / 回复里。

改了原图或描述文件，就重新生成并一起提交；英文图是生成物，不要手动改。
