FROM python:3.13-slim

# Create a non-root user because claude-code causes permission issues when using bypassPermissions mode
# see https://github.com/anthropics/claude-code-sdk-python/issues/30
RUN groupadd -r appuser && useradd -r -g appuser -m -d /home/appuser appuser

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev curl git gnupg \
    ca-certificates \
    gosu docker-cli \
    build-essential \
    openssh-client && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code@2.1.87 @agentclientprotocol/claude-agent-acp@0.24.2 @zed-industries/codex-acp@0.11.1 @openai/codex

# Cursor CLI (installs `cursor-agent` to /root/.local/bin) — used for the Cursor
# ACP server (`cursor-agent acp`). The install script downloads the binary for
# the current platform.
RUN curl -fsS https://cursor.com/install | bash && \
    cp /root/.local/bin/cursor-agent /usr/local/bin/cursor-agent && \
    chmod +x /usr/local/bin/cursor-agent

# Install uv package manager
RUN curl -LsSf https://astral.sh/uv/install.sh | bash

COPY backend/requirements.lock .

RUN /root/.local/bin/uv pip install --system --no-cache -r requirements.lock

COPY backend/ /app/

RUN chown -R appuser:appuser /app && \
    chmod -R 755 /app && \
    chmod +x /app/entrypoint.sh

ENV HOME=/home/appuser
ENV CLAUDE_CONFIG_DIR=/app/storage/claude-data
ENV CLAUDE_HOME=/app/storage/claude-data
ENV CODEX_HOME=/app/storage/codex-data
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
ENV PYTHONUNBUFFERED=1
ENV TERM=xterm-256color

RUN mkdir -p /app/storage/claude-data /app/storage/codex-data /app/storage/images /app/storage/pdfs /app/storage/xlsx

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
CMD []
