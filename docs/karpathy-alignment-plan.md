# Karpathy LLM Wiki 严格对齐计划

> 基于 https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
> 审计日期：2026-04-09

---

## Karpathy 架构核心原则

> "Instead of just retrieving from raw documents at query time, the LLM **incrementally builds and maintains a persistent wiki**. The knowledge is compiled once and then *kept current*, not re-derived on every query."

**三层架构：**
1. **Raw Sources** — 不可变的原始文档（LLM 只读）
2. **Wiki** — LLM 维护的 markdown 文件（LLM 完全拥有，持续演化）
3. **Schema (CLAUDE.md)** — 告诉 LLM wiki 的约定、结构、工作流

**三个操作：**
1. **Ingest** — 读源文档 → 写摘要 → 更新 10-15 个已有页面 → 追加 log
2. **Query** — 读 index.md 定位 → 读相关页 → 综合答案 → 好答案归档回 wiki
3. **Lint** — 矛盾检测、孤立页、过期声明、缺失页

**两个关键文件：**
1. **index.md** — 内容目录（LLM 查询时先读这个来定位）
2. **log.md** — 时间线日志（每次操作追加）

---

## 当前状态 vs Karpathy 架构（逐项对比）

### 三层架构

| 层 | Karpathy | 当前状态 | 差距 |
|----|---------|---------|------|
| Raw Sources | 不可变，LLM 只读 | `data/uploads/` ✅ | 一致 |
| Wiki | LLM 维护的 md 文件，交叉链接 | `wiki-root/` ⚠️ 有结构但内容浅 | Wiki 页面质量不足，topic 页是空壳 |
| Schema | CLAUDE.md 定义约定和工作流 | **完全缺失** ❌ | **最大差距** — 没有 Schema，LLM 无从遵循约定 |

### Ingest 操作

| 步骤 | Karpathy | 当前状态 | 差距 |
|------|---------|---------|------|
| 读源文档提取内容 | ✅ | ✅ PDF/DOCX/PPTX/MD | 一致 |
| 加载 CLAUDE.md + index.md 作为上下文 | 必须 | ❌ 未读取 | **关键缺失** — LLM 不知道 wiki 的约定和已有内容 |
| 写摘要页 (sources/) | ✅ | ✅ | 一致 |
| 更新 index.md | ✅ | ✅ 但是全量重建而非增量 | 可接受 |
| 更新 10-15 个已有页面 | **核心价值** | ❌ 只创建新页+追加 | **最大功能缺失** — 这是"知识积累"的关键 |
| 维护交叉引用 | ✅ page_refs | ❌ 表存在但从未写入 | 缺失 |
| 追加 log.md | ✅ | ❌ | 缺失 |
| Git 自动提交 | ✅ | ❌ | 缺失 |

### Query 操作

| 步骤 | Karpathy | 当前状态 | 差距 |
|------|---------|---------|------|
| 先读 index.md 定位相关页 | **核心策略** | ❌ 直接搜索 | **关键缺失** — Karpathy 说 index 在中等规模够用 |
| BM25 关键词搜索 | 提到 qmd 工具 | ❌ 只有 FTS5（不是真正 BM25） | 用户要求第一期做 BM25 |
| 综合答案 + citations | ✅ | ✅ | 一致 |
| 好的答案归档回 wiki | 核心价值 | ❌ | 缺失 |

### Lint 操作

| 项 | Karpathy | 当前状态 |
|----|---------|---------|
| 矛盾检测 | ✅ | ❌ 完全未实现 |
| 孤立页（无入链） | ✅ | ❌ |
| 过期声明 | ✅ | ❌ |
| 缺失页面（被引用但不存在） | ✅ | ❌ |
| 缺失交叉引用 | ✅ | ❌ |

---

## 严格对齐优化计划

### Phase A：Schema 层 + Ingest 重构（最高优先级）

**A1. 创建 CLAUDE.md**
- 文件位置：`wiki-root/CLAUDE.md`
- 内容：Wiki 的结构约定、页面格式规范、wikilink 语法、分类规则
- 这是整个系统的灵魂 — LLM 每次操作前必须读它
- **修改文件：** 新建 `wiki-root/CLAUDE.md`

**A2. 重构 Ingest — LLM 必须读 CLAUDE.md + index.md**
- Wiki 生成时，system prompt 加载 CLAUDE.md
- User prompt 加载 index.md（让 LLM 知道已有什么页面）
- LLM 输出应包含 `updates: [...]`（对已有页面的修改指令）
- **修改文件：** `app/llm/prompts.py`, `app/wiki/generator.py`, `app/ingest/pipeline.py`

**A3. 重构 Wiki 页面更新 — 真正融合而非追加**
- 当 LLM 决定更新一个已有页面时：
  - 读取已有页面完整内容
  - 把已有内容 + 新信息一起发给 LLM
  - LLM 输出融合后的完整页面（不是简单追加）
- 这是 "知识积累" 的核心
- **修改文件：** `app/wiki/generator.py` 新增 `update_existing_page()`

**A4. 实现 log.md**
- 每次 Ingest/Query/Lint 追加一行
- 格式：`## [2026-04-09] ingest | 文件名 | 创建 3 页, 更新 5 页`
- **修改文件：** `app/wiki/log.py`（新建）, `app/ingest/pipeline.py`

**A5. 实现 Git 自动提交**
- 每次 Ingest 完成后：`git add wiki-root/ && git commit -m "ingest: {filename}"`
- **修改文件：** `app/ingest/pipeline.py`

### Phase B：Query 重构 + BM25（高优先级）

**B1. Query 时先读 index.md 定位**
- Karpathy 的策略：先读 index.md → 找到可能相关的页面 → 再读具体页面
- 在中等规模（几百页）这比 embedding 搜索更准确
- **修改文件：** `app/search/query.py`

**B2. 实现真正的 BM25 搜索**
- 当前 FTS5 的排名算法不是标准 BM25
- 用已引入的 `bm25s` 库实现：
  - Ingest 时用 jieba 分词后建 BM25 索引
  - Query 时 BM25 检索 → 替代 FTS5
- 混合策略：BM25（关键词）+ 向量（语义）
- **修改文件：** `app/search/hybrid.py`, `app/search/bm25_index.py`（新建）

**B3. 问答结果归档回 Wiki**
- Query API 返回 `suggested_page`（如果答案值得归档）
- 前端显示 "归档为 Wiki 页面" 按钮
- 点击后创建新 Wiki 页面
- **修改文件：** `app/search/query.py`, `app/api/search.py`, 前端 `SearchPage.tsx`

### Phase C：交叉引用 + Lint（中优先级）

**C1. 构建 page_refs 交叉引用**
- Ingest 后扫描所有 wiki 页面的 `[[wikilink]]`
- 写入 page_refs 表
- API 提供 "相关页面" 查询
- **修改文件：** `app/wiki/refs.py`（新建）, `app/ingest/pipeline.py`

**C2. Lint 基础版**
- 孤立页检测（page_refs 中 0 个入链）
- 悬空链接检测（wikilink 指向不存在的页面）
- 缺失实体页建议
- **修改文件：** `app/lint/checker.py`（新建）, `app/api/lint.py`（新建）

---

## 执行顺序

```
Phase A（Schema + Ingest 重构）← 最高优先级，改变系统本质
  A1 → A2 → A3 → A4 → A5

Phase B（Query + BM25）← 用户明确要求第一期做 BM25
  B1 → B2 → B3

Phase C（交叉引用 + Lint）
  C1 → C2
```

---

## 验收标准

### Phase A 验收
- [ ] `wiki-root/CLAUDE.md` 存在且内容完整
- [ ] Ingest 时 LLM 读取 CLAUDE.md + index.md 作为上下文
- [ ] 单次 Ingest 至少更新 5+ 个已有页面（不只是创建新页）
- [ ] 已有页面更新是 LLM 融合重写，不是简单追加
- [ ] `wiki-root/log.md` 记录每次操作
- [ ] 每次 Ingest 后 wiki-root 自动 git commit

### Phase B 验收
- [ ] Query 先读 index.md 定位相关页面
- [ ] BM25 替代 FTS5 作为关键词搜索引擎
- [ ] 混合排序：BM25 + 向量语义
- [ ] 问答结果可以归档为新 Wiki 页面

### Phase C 验收
- [ ] page_refs 表在每次 Ingest 后更新
- [ ] Lint 能检测孤立页和悬空链接
