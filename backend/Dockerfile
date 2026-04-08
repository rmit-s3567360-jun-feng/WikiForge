FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY pyproject.toml .
RUN pip install --no-cache-dir -e "." "httpx[socks]"

# 复制应用代码
COPY app/ app/
COPY wiki-root/ wiki-root/
COPY data/ data/

# 创建必要目录
RUN mkdir -p data/uploads wiki-root/sources wiki-root/entities wiki-root/concepts wiki-root/topics

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
