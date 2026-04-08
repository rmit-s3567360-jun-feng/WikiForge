"""文件上传 & Ingest API"""

import hashlib
import traceback
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.config import get_uploads_dir, get_config
from app.models.schemas import IngestResponse

router = APIRouter()

SUPPORTED_TYPES = {".pdf", ".docx", ".doc", ".pptx", ".ppt", ".md", ".txt"}


@router.post("/ingest", response_model=IngestResponse)
async def ingest_file(file: UploadFile = File(...)):
    """上传文件并触发 ingest pipeline"""
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_TYPES:
        raise HTTPException(400, f"不支持的文件类型: {suffix}")

    # 检查 API key 配置
    cfg = get_config()
    if not cfg.llm.cloud_api_key and not cfg.llm.local_api_key:
        raise HTTPException(
            500,
            "未配置 LLM API key。请编辑 backend/config.yaml 填入 cloud_api_key，"
            "或设置环境变量 MINIMAX_API_KEY",
        )

    # 保存上传文件
    uploads_dir = get_uploads_dir()
    uploads_dir.mkdir(parents=True, exist_ok=True)
    file_path = uploads_dir / file.filename

    content = await file.read()
    content_hash = hashlib.sha256(content).hexdigest()

    with open(file_path, "wb") as f:
        f.write(content)

    # 调用 ingest pipeline
    from app.ingest.pipeline import run_ingest_pipeline

    try:
        result = await run_ingest_pipeline(file_path, content_hash)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"文档处理失败: {str(e)}")
