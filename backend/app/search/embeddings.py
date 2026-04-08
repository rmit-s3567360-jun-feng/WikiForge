"""嵌入生成与管理 — bge-small-zh 本地模型 + sqlite-vec"""

import json
import struct
from pathlib import Path
from typing import Optional

from app.config import get_config
from app.models.database import get_db

# 延迟加载模型（首次调用时初始化）
_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        cfg = get_config()
        _model = SentenceTransformer(cfg.llm.embedding_model)
    return _model


def embed_text(text: str) -> list[float]:
    """生成单条文本的嵌入向量"""
    model = _get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """批量生成嵌入向量"""
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32)
    return [e.tolist() for e in embeddings]


def _floats_to_blob(floats: list[float]) -> bytes:
    """将 float 列表转为 sqlite-vec 需要的 blob 格式"""
    return struct.pack(f'{len(floats)}f', *floats)


def _blob_to_floats(blob: bytes) -> list[float]:
    """从 blob 还原 float 列表"""
    n = len(blob) // 4
    return list(struct.unpack(f'{n}f', blob))


async def store_embedding(page_id: str, text: str) -> None:
    """生成嵌入并存入数据库"""
    embedding = embed_text(text)
    blob = _floats_to_blob(embedding)

    db = await get_db()
    try:
        await db.execute(
            """INSERT OR REPLACE INTO page_embeddings (page_id, embedding, updated_at)
               VALUES (?, ?, datetime('now'))""",
            (page_id, blob),
        )
        await db.commit()
    finally:
        await db.close()


async def store_embeddings_batch(items: list[tuple[str, str]]) -> None:
    """批量存储嵌入: [(page_id, text), ...]"""
    if not items:
        return

    page_ids = [i[0] for i in items]
    texts = [i[1] for i in items]
    embeddings = embed_texts(texts)

    db = await get_db()
    try:
        for page_id, emb in zip(page_ids, embeddings):
            blob = _floats_to_blob(emb)
            await db.execute(
                """INSERT OR REPLACE INTO page_embeddings (page_id, embedding, updated_at)
                   VALUES (?, ?, datetime('now'))""",
                (page_id, blob),
            )
        await db.commit()
    finally:
        await db.close()


async def search_by_vector(query: str, top_k: int = 10) -> list[tuple[str, float]]:
    """
    向量相似度搜索。
    返回 [(page_id, similarity_score), ...] 按相似度降序。
    """
    query_embedding = embed_text(query)

    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT page_id, embedding FROM page_embeddings"
        )
    finally:
        await db.close()

    if not rows:
        return []

    # 计算余弦相似度（嵌入已归一化，点积即余弦相似度）
    results = []
    for row in rows:
        page_id = row[0]
        stored_emb = _blob_to_floats(row[1])
        score = sum(a * b for a, b in zip(query_embedding, stored_emb))
        results.append((page_id, score))

    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]
