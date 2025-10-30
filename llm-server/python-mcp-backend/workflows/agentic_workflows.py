"""Custom Ollama integration for mcp-agent"""
import httpx
import json
from typing import Any, Optional
from mcp_agent.workflows.llm.augmented_llm_base import (
    AugmentedLLM,
    Message,
    RequestParams,
    GenerateResult,
)


class OllamaAugmentedLLM(AugmentedLLM):
    """Ollama implementation of AugmentedLLM"""

    def __init__(
        self,
        agent,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.2:1b",
        **kwargs
    ):
        super().__init__(agent, **kwargs)
        self.base_url = base_url
        self.default_model = model
        self.client = httpx.AsyncClient(timeout=120.0)

    async def generate(
        self,
        message: str | Message,
        params: Optional[RequestParams] = None,
        **kwargs
    ) -> GenerateResult:
        """Generate response with tool calling support"""
        if params is None:
            params = RequestParams()

        model = params.model or self.default_model

        # Convert message to proper format
        if isinstance(message, str):
            user_message = Message(role="user", content=message)
        else:
            user_message = message

        # Add to conversation history
        self.memory.add_message(user_message)

        # Get tools from agent
        tools = await self._format_tools_for_ollama()

        # Prepare messages
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in self.memory.get_messages()
        ]

        # Call Ollama API
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
        }

        if tools:
            payload["tools"] = tools

        response = await self.client.post(
            f"{self.base_url}/api/chat",
            json=payload
        )
        response.raise_for_status()

        result = response.json()
        assistant_message = result.get("message", {})

        # Handle tool calls
        if "tool_calls" in assistant_message:
            tool_results = await self._execute_tool_calls(
                assistant_message["tool_calls"]
            )

            # Add tool results to conversation and recurse
            for tool_result in tool_results:
                self.memory.add_message(Message(
                    role="tool",
                    content=json.dumps(tool_result)
                ))

            # Recursive call to get final answer
            return await self.generate("", params)

        # Add assistant response to memory
        assistant_response = Message(
            role="assistant",
            content=assistant_message.get("content", "")
        )
        self.memory.add_message(assistant_response)

        return GenerateResult(
            message=assistant_response,
            model=model
        )

    async def generate_str(
        self,
        message: str,
        params: Optional[RequestParams] = None,
        **kwargs
    ) -> str:
        """Generate and return as string"""
        result = await self.generate(message, params, **kwargs)
        return result.message.content

    async def _format_tools_for_ollama(self) -> list:
        """Convert MCP tools to Ollama format"""
        tools = await self.agent.list_tools()

        ollama_tools = []
        for tool in tools:
            ollama_tools.append({
                "type": "function",
                "function": {
                    "name": tool.get("name"),
                    "description": tool.get("description", ""),
                    "parameters": tool.get("inputSchema", {})
                }
            })

        return ollama_tools

    async def _execute_tool_calls(self, tool_calls: list) -> list:
        """Execute MCP tool calls"""
        results = []

        for tool_call in tool_calls:
            function = tool_call.get("function", {})
            tool_name = function.get("name")
            arguments = json.loads(function.get("arguments", "{}"))

            # Call MCP tool
            result = await self.agent.call_tool(tool_name, arguments)
            results.append({
                "tool_call_id": tool_call.get("id"),
                "result": result
            })

        return results

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
