import asyncio
import os
from typing import Optional
from mcp_agent.app import MCPApp # type: ignore
from mcp_agent.agents.agent import Agent # type: ignore
from mcp_agent.workflows.llm.augmented_llm_base import RequestParams # type: ignore

# Note: mcp-agent doesn't have native Ollama support in the base package
# We'll create a custom Ollama LLM wrapper
from workflows.agentic_workflows import OllamaAugmentedLLM

app = MCPApp(name="electron_ai_backend")

class ElectronMCPAgent:
    """Main agent class for Electron backend"""

    def __init__(self):
        self.app = app
        self.agent = None
        self.llm = None

    async def initialize(self, server_names: list[str] = None): # type: ignore
        """Initialize the agent with specified MCP servers"""
        if server_names is None:
            server_names = ["fetch", "filesystem"]

        self.agent = Agent(
            name="electron_assistant",
            instruction="""You are a helpful AI assistant with access to
            filesystem and web fetch capabilities. Use tools when needed to
            help the user accomplish their tasks.""",
            server_names=server_names,
        )

        async with self.agent:
            self.llm = await self.agent.attach_llm(
                OllamaAugmentedLLM,
                model="llama3.2:1b",  # Or any Ollama model you have
            )

            return self

    async def chat(self, message: str, model: Optional[str] = None) -> str:
        """Send a message and get response"""
        if not self.llm:
            raise RuntimeError("Agent not initialized. Call initialize() first.")

        params = RequestParams(model=model) if model else RequestParams()
        result = await self.llm.generate_str(message, params)
        return result

    async def get_available_tools(self) -> list:
        """Get list of available tools from MCP servers"""
        if not self.agent:
            raise RuntimeError("Agent not initialized")

        tools = await self.agent.list_tools()
        return tools


# Example usage
async def example_usage():
    """Example of how to use the agent"""
    async with app.run() as mcp_agent_app:
        logger = mcp_agent_app.logger

        # Initialize agent
        agent_instance = ElectronMCPAgent()
        await agent_instance.initialize()

        # Check available tools
        tools = await agent_instance.get_available_tools()
        logger.info("Available tools:", data=tools)

        # Example: Read a file
        result = await agent_instance.chat(
            "Show me what's in README.md"
        )
        logger.info(f"Result: {result}")

        # Example: Fetch web content
        result = await agent_instance.chat(
            "Fetch the first paragraph from https://www.anthropic.com"
        )
        logger.info(f"Web content: {result}")

        # Multi-turn conversation
        result = await agent_instance.chat(
            "Summarize that in one sentence"
        )
        logger.info(f"Summary: {result}")


if __name__ == "__main__":
    asyncio.run(example_usage())
