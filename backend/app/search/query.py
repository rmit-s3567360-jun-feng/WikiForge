"""问答引擎 — 检索 + LLM 综合答案"""

from app.config import get_wiki_root
from app.llm.router import get_provider
from app.search.hybrid import hybrid_search

QUERY_SYSTEM = """你是一个知识管理助手。根据用户的问题和提供的 Wiki 页面内容，给出准确、结构化的回答。

规则：
1. 只基于提供的内容回答，不要编造信息
2. 引用具体来源页面
3. 如果提供的内容无法回答问题，明确说明
4. 用中文回答
5. 回答要结构化，使用 markdown 格式

输出严格 JSON 格式：
{
  "answer": "markdown 格式的答案",
  "citations": ["page_id_1", "page_id_2"]
}"""

QUERY_USER = """问题：{question}

以下是相关 Wiki 页面内容：

{context}"""


async def query_wiki(question: str, top_k: int = 7) -> dict:
    """
    问答流程：
    1. 混合检索 top-k 页面
    2. 加载页面内容
    3. LLM 综合答案 + citations
    """
    # 1. 检索
    results = await hybrid_search(question, top_k=top_k)

    if not results:
        return {
            "answer": "知识库中暂无相关内容。请先导入一些文档。",
            "citations": [],
        }

    # 2. 加载页面内容
    wiki_root = get_wiki_root()
    context_parts = []
    valid_page_ids = []

    for page_id, score in results:
        # page_id 格式: "category/page-name"
        parts = page_id.split("/", 1)
        if len(parts) != 2:
            continue
        category, name = parts
        file_path = wiki_root / category / f"{name}.md"
        if file_path.exists():
            content = file_path.read_text(encoding="utf-8")
            # 去掉 frontmatter
            if content.startswith("---"):
                end = content.find("---", 3)
                if end > 0:
                    content = content[end + 3:].strip()
            # 截断过长的内容
            if len(content) > 3000:
                content = content[:3000] + "\n...[截断]"
            context_parts.append(f"### [{page_id}]\n{content}")
            valid_page_ids.append(page_id)

    if not context_parts:
        return {
            "answer": "检索到相关页面但无法读取内容。",
            "citations": [],
        }

    context = "\n\n---\n\n".join(context_parts)

    # 3. LLM 综合答案
    provider = get_provider("query")
    result = await provider.chat_json(
        messages=[
            {"role": "system", "content": QUERY_SYSTEM},
            {
                "role": "user",
                "content": QUERY_USER.format(
                    question=question, context=context
                ),
            },
        ],
        max_tokens=4096,
    )

    answer = result.get("answer", "无法生成答案。")
    citations = result.get("citations", [])
    # 过滤确保 citations 都是有效的 page_id
    citations = [c for c in citations if c in valid_page_ids]

    return {
        "answer": answer,
        "citations": citations,
    }
