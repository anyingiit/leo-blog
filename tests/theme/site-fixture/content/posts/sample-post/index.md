---
title: 视觉回归样例长文
slug: sample-post
date: 2026-03-01T08:00:00Z
tags: [测试, 样式]
summary: 这篇固定的样例文章覆盖标题层级、列表、表格、代码、提示框、公式、Mermaid 和图片，用于像素级回归测试。
---

这是一段正文，混排 **粗体**、*斜体*、`行内代码` 和 [链接](https://example.com)。中文与 English 混排时，行高和字距都应保持稳定。

## 二级标题

- 无序列表第一项
- 第二项，带一个嵌套列表
  - 嵌套项
1. 有序列表
2. 第二项

### 三级标题

| 列 A | 列 B | 列 C |
| --- | :---: | ---: |
| 左对齐 | 居中 | 123 |
| 文本 | 文本 | 4.56 |

```go
package main

import "fmt"

func main() {
	fmt.Println("你好，世界")
}
```

> [!NOTE]
> 这是注意。

> [!TIP]
> 这是提示。

> [!IMPORTANT]
> 这是重要。

> [!WARNING]
> 这是警告。

> [!CAUTION]
> 这是小心。

> 普通引用。

## 公式与图表

行内公式 $E = mc^2$，块级公式：

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$

```mermaid
graph LR
  A[写作] --> B[构建] --> C[发布]
```

## 图片

![样例示意图](diagram.png)

最后一段文字。
