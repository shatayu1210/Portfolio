"""Minimal REST client for vLLM server (chat-completions) with Qwen model."""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

import requests

from cleansql.config import settings


LOGGER = logging.getLogger(__name__)


class VLLMClient:
    """Client for vLLM OpenAI-compatible API serving fine-tuned Qwen model."""
    
    def __init__(self, host: str | None = None, port: int | None = None, timeout: float | None = None) -> None:
        self.host = host or settings.vllm_host
        self.port = port or settings.vllm_port
        self.timeout = timeout or settings.vllm_timeout
        
        # Support both local (http) and ngrok (https) endpoints
        if self.port == 443 or "ngrok" in self.host:
            self.base_url = f"https://{self.host}"
        else:
            self.base_url = f"http://{self.host}:{self.port}"

    def generate(
        self,
        prompt: str,
        *,
        system: Optional[str] = None,
        temperature: float | None = None,
        max_tokens: int = 1024,
        stop: Optional[List[str]] = None,
        top_p: float = 0.9,
    ) -> str:
        """Call vLLM's OpenAI-compatible /v1/chat/completions endpoint.

        Sends system message (if provided) plus user message with formatted prompt.
        """
        messages: List[Dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, object] = {
            "model": "qwen-coder",  # Model name as registered in vLLM
            "messages": messages,
            "temperature": temperature if temperature is not None else settings.temp,
            "max_tokens": max_tokens,
            "top_p": top_p,
        }
        if stop:
            payload["stop"] = stop

        response = requests.post(
            f"{self.base_url}/v1/chat/completions", json=payload, timeout=self.timeout
        )
        response.raise_for_status()
        data = response.json()

        # Expected shape: {"choices":[{"message":{"content": "..."}}, ...]}
        try:
            choices = data.get("choices") or []
            if not choices:
                raise KeyError("choices")
            message = choices[0].get("message") or {}
            content = message.get("content", "")
        except Exception as exc:
            raise RuntimeError(f"Unexpected chat-completions response: {data}") from exc

        if not isinstance(content, str) or not content.strip():
            raise RuntimeError(f"Empty content from vLLM chat-completions: {data}")

        LOGGER.debug("vLLM chat response: %s", content)
        return content
