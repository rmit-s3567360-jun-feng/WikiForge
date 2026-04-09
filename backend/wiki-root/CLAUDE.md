# PKM Wiki Schema

> 本文件定义了 Wiki 的结构约定、页面格式规范和工作流。
> LLM 在执行 Ingest / Query / Lint 操作前必须读取本文件。

---

## Wiki 结构

```
wiki-root/
├── CLAUDE.md          # 本文件（Schema 定义）
├── index.md           # 内容目录（每次 ingest 后自动更新）
├── log.md             # 操作日志（每次操作后追加）
├── sources/           # 原始文档摘要页（每份文档一页）
├── entities/          # 实体页（人物、组织、产品）
├── concepts/          # 概念页（技术方法、抽象概念）
└── topics/            # 主题聚合页（跨文档的主题汇总）
```

## 页面分类规则

| 分类 | 放什么 | 命名规则 | 示例 |
|------|-------|---------|------|
| **sources/** | 每份原始文档的摘要和结构化提取 | `{文档关键词}.md` | `attention-is-all-you-need.md` |
| **entities/** | 具名实体：人名、组织、产品、项目 | `{实体名}.md` | `openai.md`, `transformer.md` |
| **concepts/** | 抽象概念、技术方法、理论框架 | `{概念名}.md` | `attention-mechanism.md`, `rlhf.md` |
| **topics/** | 主题聚合：跨多个文档的主题汇总 | `{主题名}.md` | `人工智能.md`, `性能优化.md` |

**判断依据：**
- 能用"谁/哪个"提问的 → entities（腾讯是谁？Unity是什么产品？）
- 能用"什么是/怎么做"提问的 → concepts（什么是注意力机制？怎么做性能优化？）
- 跨多个文档反复出现的主题 → topics

## 页面 Frontmatter 格式

所有 Wiki 页面必须以 YAML frontmatter 开头：

```yaml
---
title: "页面标题"
category: "sources|entities|concepts|topics"
created_at: "YYYY-MM-DD"
last_updated: "YYYY-MM-DD"
source_refs:
  - source_id: "abc123"
    filename: "原始文档名.pdf"
related_pages:
  - "concepts/attention-mechanism"
  - "entities/openai"
topic_tags: ["标签1", "标签2"]
source_count: 1
---
```

**必填字段：** title, category, topic_tags
**推荐字段：** source_refs, related_pages, source_count

## Wikilink 语法

使用 `[[category/page-name]]` 格式创建页面间链接：

```markdown
参见 [[concepts/attention-mechanism]] 了解注意力机制的详细说明。
该项目由 [[entities/openai]] 发布。
```

**规则：**
- 链接必须包含分类前缀（`concepts/`, `entities/`, `sources/`, `topics/`）
- 链接目标是文件名去掉 `.md` 后缀
- 每个页面应至少链接到 2 个相关页面
- 如果提到了一个实体/概念但对应页面不存在，仍然写上链接（后续 Lint 会发现）

## Ingest 工作流

当处理一份新文档时，LLM 应遵循以下流程：

### 1. 创建摘要页
在 `sources/` 中创建一个摘要页，包含：
- 文档基本信息（类型、长度、语言）
- 结构化内容提取（关键要点、数据、结论）
- 对文档中重要实体和概念的 wikilink 引用

### 2. 创建或更新实体页和概念页
- 如果文档提到的实体/概念在 Wiki 中已存在 → **更新**该页面，融入新信息
- 如果是全新的实体/概念 → **创建**新页面
- 更新时不是简单追加，而是将新旧信息融合重写为连贯的内容

### 3. 更新已有相关页面
- 检查 index.md 中的已有页面列表
- 对内容相关的已有页面，添加交叉引用或补充信息
- 一次 ingest 应该触及 5-15 个已有页面

### 4. 维护交叉引用
- 新页面必须链接到相关的已有页面
- 已有页面应反向链接到新内容
- 使用 `[[wikilink]]` 语法

## 页面更新规则

**融合而非追加：** 当更新已有页面时，LLM 应该：
1. 读取已有页面的完整内容
2. 将新信息与已有信息融合
3. 输出一个连贯的、更新后的完整页面
4. 保留所有来源引用（source_refs 中追加新来源）
5. 更新 `last_updated` 日期和 `source_count`

**不要：**
- 简单地把新内容追加到底部
- 删除已有的有效信息
- 移除已有的交叉引用

## Query 工作流

回答用户问题时：
1. 先读 index.md 确定哪些页面可能相关
2. 读取相关页面的完整内容
3. 综合所有信息给出答案，附带引用
4. 如果答案揭示了新的洞察，建议归档为新 Wiki 页面

## 内容质量标准

- **准确性：** 所有事实必须有源文档支撑
- **结构化：** 使用标题、列表、表格组织信息
- **简洁：** 提取核心信息，不复制原文大段落
- **链接：** 每个页面至少 2 个 wikilink 到相关页面
- **中文优先：** 标签和内容使用中文，术语可保留英文
