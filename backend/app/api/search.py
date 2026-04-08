"""搜索 & 问答 API"""

from fastapi import APIRouter

from app.models.schemas import SearchRequest, SearchResult, QueryRequest, QueryResponse
from app.search.hybrid import hybrid_search
from app.search.query import query_wiki as _query_wiki
from app.config import get_wiki_root

router = APIRouter()


@router.post("/search", response_model=list[SearchResult])
async def search_wiki(req: SearchRequest):
    """搜索 Wiki 页面"""
    results = await hybrid_search(req.query, top_k=req.top_k)

    wiki_root = get_wiki_root()
    output = []
    for page_id, score in results:
        parts = page_id.split("/", 1)
        if len(parts) != 2:
            continue
        category, name = parts
        file_path = wiki_root / category / f"{name}.md"
        snippet = ""
        title = name.replace("-", " ")
        if file_path.exists():
            content = file_path.read_text(encoding="utf-8")
            # 提取 title
            for line in content.split("\n"):
                if line.startswith("title:"):
                    title = line.split(":", 1)[1].strip().strip('"')
                    break
            # 去 frontmatter 取前 200 字符作为 snippet
            if content.startswith("---"):
                end = content.find("---", 3)
                if end > 0:
                    content = content[end + 3:].strip()
            snippet = content[:200]

        output.append(SearchResult(
            page_id=page_id,
            title=title,
            snippet=snippet,
            score=round(score, 4),
        ))
    return output


@router.post("/query", response_model=QueryResponse)
async def query_wiki(req: QueryRequest):
    """问答"""
    result = await _query_wiki(req.question)
    return QueryResponse(
        answer=result["answer"],
        citations=result["citations"],
    )
