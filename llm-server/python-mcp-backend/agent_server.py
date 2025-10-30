"""FastAPI server to expose MCP agent to Electron app with RAG"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import os
import aiofiles

from main import ElectronMCPAgent, app as mcp_app
from rag_service import get_rag_service, RAGService


# Request/Response models
class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = None
    use_rag: Optional[bool] = False


class ChatResponse(BaseModel):
    response: str
    model_used: str
    sources: Optional[List[dict]] = None


class ToolsResponse(BaseModel):
    tools: list


class RAGIndexRequest(BaseModel):
    file_paths: List[str]


class RAGIndexTextRequest(BaseModel):
    text: str
    metadata: Optional[dict] = None


class RAGQueryRequest(BaseModel):
    question: str
    context: Optional[str] = None


# Global instances
agent_instance: Optional[ElectronMCPAgent] = None
rag_instance: Optional[RAGService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize agent and RAG on startup"""
    global agent_instance, rag_instance

    async with mcp_app.run() as mcp_agent_app:
        # Initialize MCP Agent
        agent_instance = ElectronMCPAgent()
        await agent_instance.initialize()
        mcp_agent_app.logger.info("MCP Agent initialized successfully")

        # Initialize RAG service
        rag_instance = get_rag_service()
        mcp_agent_app.logger.info("RAG Service initialized successfully")

        yield

        mcp_agent_app.logger.info("Shutting down MCP Agent and RAG Service")


# Create FastAPI app
app = FastAPI(
    title="Electron MCP Backend",
    description="MCP Agent backend with Ollama for Electron app",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Electron app origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "running", "service": "MCP Agent Backend"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/tools", response_model=ToolsResponse)
async def get_tools():
    """Get available MCP tools"""
    if not agent_instance:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        tools = await agent_instance.get_available_tools()
        return ToolsResponse(tools=tools)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send message to agent and get response (with optional RAG)"""
    if not agent_instance:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        sources = None

        # Use RAG if requested
        if request.use_rag and rag_instance:
            rag_result = await rag_instance.query(request.message)
            if rag_result["success"]:
                # Use RAG response
                response = rag_result["response"]
                sources = rag_result.get("sources", [])
            else:
                # Fallback to regular agent
                response = await agent_instance.chat(
                    request.message,
                    model=request.model
                )
        else:
            # Regular agent response
            response = await agent_instance.chat(
                request.message,
                model=request.model
            )

        return ChatResponse(
            response=response,
            model_used=request.model or "llama3.2:1b",
            sources=sources
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# RAG Endpoints
@app.post("/rag/index")
async def rag_index_files(request: RAGIndexRequest):
    """Index multiple files for RAG"""
    if not rag_instance:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        result = await rag_instance.index_documents(request.file_paths)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/index-text")
async def rag_index_text(request: RAGIndexTextRequest):
    """Index raw text for RAG"""
    if not rag_instance:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        result = await rag_instance.index_text(request.text, request.metadata)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/query")
async def rag_query(request: RAGQueryRequest):
    """Query RAG index"""
    if not rag_instance:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        result = await rag_instance.query(request.question, request.context)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/upload")
async def rag_upload_file(file: UploadFile = File(...)):
    """Upload and index a file"""
    if not rag_instance:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        # Create uploads directory
        upload_dir = "./uploads"
        os.makedirs(upload_dir, exist_ok=True)

        # Save file
        file_path = os.path.join(upload_dir, file.filename)
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        # Index the file
        result = await rag_instance.index_documents([file_path])

        return {
            "success": True,
            "file": file.filename,
            "path": file_path,
            "indexed": result.get("indexed", 0)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/rag/clear")
async def rag_clear():
    """Clear all indexed documents"""
    if not rag_instance:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        result = await rag_instance.clear_index()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/rag/stats")
async def rag_stats():
    """Get RAG statistics"""
    if not rag_instance:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        result = await rag_instance.get_stats()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "agent_server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
