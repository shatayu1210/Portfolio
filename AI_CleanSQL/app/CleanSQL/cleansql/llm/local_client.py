"""Local LLM client for llama.cpp/Ollama on M1 Mac (alternative to vLLM)."""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

import requests

from cleansql.config import settings


LOGGER = logging.getLogger(__name__)


class LocalLLMClient:
    """Client for llama.cpp or Ollama serving Qwen model on M1 Mac.
    
    Compatible with:
    - llama.cpp server (llama-server)
    - Ollama
    - Any OpenAI-compatible local server
    """
    
    def __init__(self, host: str | None = None, port: int | None = None, timeout: float | None = None) -> None:
        self.host = host or settings.vllm_host
        self.port = port or settings.vllm_port
        self.timeout = timeout or settings.vllm_timeout
        self.base_url = f"http://{self.host}:{self.port}"
        
        # Detect server type
        self.server_type = self._detect_server_type()
        LOGGER.info(f"Detected server type: {self.server_type}")

    def _detect_server_type(self) -> str:
        """Detect if server is llama.cpp, Ollama, or OpenAI-compatible."""
        try:
            # Try Ollama endpoint
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                return "ollama"
        except Exception:
            pass
        
        try:
            # Try OpenAI-compatible endpoint (llama.cpp)
            response = requests.get(f"{self.base_url}/v1/models", timeout=5)
            if response.status_code == 200:
                return "openai"
        except Exception:
            pass
        
        # Default to OpenAI-compatible
        return "openai"

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
        """Generate text using local LLM server.
        
        Works with llama.cpp server or Ollama.
        """
        if self.server_type == "ollama":
            return self._generate_ollama(prompt, system, temperature, max_tokens, stop)
        else:
            return self._generate_openai(prompt, system, temperature, max_tokens, stop, top_p)

    def _generate_openai(
        self,
        prompt: str,
        system: Optional[str],
        temperature: Optional[float],
        max_tokens: int,
        stop: Optional[List[str]],
        top_p: float,
    ) -> str:
        """Generate using OpenAI-compatible API (llama.cpp server)."""
        messages: List[Dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, object] = {
            "model": "qwen-coder",  # Model name
            "messages": messages,
            "temperature": temperature if temperature is not None else settings.default_temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
        }
        if stop:
            payload["stop"] = stop

        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            json=payload,
            timeout=self.timeout
        )
        response.raise_for_status()
        data = response.json()

        try:
            choices = data.get("choices") or []
            if not choices:
                raise KeyError("choices")
            message = choices[0].get("message") or {}
            content = message.get("content", "")
        except Exception as exc:
            raise RuntimeError(f"Unexpected response: {data}") from exc

        if not isinstance(content, str) or not content.strip():
            raise RuntimeError(f"Empty content from server: {data}")

        LOGGER.debug("LLM response: %s", content)
        return content

    def _generate_ollama(
        self,
        prompt: str,
        system: Optional[str],
        temperature: Optional[float],
        max_tokens: int,
        stop: Optional[List[str]],
    ) -> str:
        """Generate using Ollama API."""
        # Combine system and user prompt for Ollama
        full_prompt = prompt
        if system:
            full_prompt = f"{system}\n\n{prompt}"

        payload = {
            "model": "qwen-coder",
            "prompt": full_prompt,
            "stream": False,
            "options": {
                "temperature": temperature if temperature is not None else settings.temp,
                "num_predict": max_tokens,
                "top_p": 0.9,
            }
        }
        if stop:
            payload["options"]["stop"] = stop

        response = requests.post(
            f"{self.base_url}/api/generate",
            json=payload,
            timeout=self.timeout
        )
        response.raise_for_status()
        data = response.json()

        content = data.get("response", "").strip()
        if not content:
            raise RuntimeError(f"Empty content from Ollama: {data}")

        LOGGER.debug("Ollama response: %s", content)
        return content
