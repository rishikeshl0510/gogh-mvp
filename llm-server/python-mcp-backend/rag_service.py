"""
RAG Service using LlamaIndex with Ollama embeddings and ChromaDB
Provides document indexing, retrieval, and context-aware chat
"""
import os
import asyncio
from pathlib import Path
from typing import List, Optional, Dict, Any
import chromadb
from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    Document,
    StorageContext,
    Settings,
    PromptTemplate
)
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.llms.ollama import Ollama
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.core.node_parser import SentenceSplitter


class RAGService:
    """RAG service for document indexing and retrieval"""

    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        embedding_model: str = "nomic-embed-text",
        llm_model: str = "llama3.2:1b",
        chroma_path: str = "./chroma_db",
        collection_name: str = "electron_docs"
    ):
        """Initialize RAG service with Ollama and ChromaDB"""
        self.ollama_base_url = ollama_base_url
        self.embedding_model = embedding_model
        self.llm_model = llm_model
        self.chroma_path = chroma_path
        self.collection_name = collection_name

        # Initialize components
        self._setup_llama_index()
        self._setup_chroma()
        self.index = None
        self.query_engine = None

    def _setup_llama_index(self):
        """Configure LlamaIndex settings"""
        # Setup Ollama LLM
        self.llm = Ollama(
            model=self.llm_model,
            base_url=self.ollama_base_url,
            request_timeout=120.0
        )

        # Setup Ollama embeddings
        self.embed_model = OllamaEmbedding(
            model_name=self.embedding_model,
            base_url=self.ollama_base_url,
        )

        # Configure global settings
        Settings.llm = self.llm
        Settings.embed_model = self.embed_model
        Settings.chunk_size = 512
        Settings.chunk_overlap = 50

        # Setup text splitter
        self.text_splitter = SentenceSplitter(
            chunk_size=512,
            chunk_overlap=50
        )

        print(f"✅ LlamaIndex configured with LLM: {self.llm_model}, Embeddings: {self.embedding_model}")

    def _setup_chroma(self):
        """Setup ChromaDB vector store"""
        # Create chroma directory if it doesn't exist
        os.makedirs(self.chroma_path, exist_ok=True)

        # Initialize ChromaDB client
        self.chroma_client = chromadb.PersistentClient(path=self.chroma_path)

        # Get or create collection
        self.chroma_collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name
        )

        # Create vector store
        self.vector_store = ChromaVectorStore(chroma_collection=self.chroma_collection)

        print(f"✅ ChromaDB initialized at {self.chroma_path}")

    async def index_documents(self, file_paths: List[str]) -> Dict[str, Any]:
        """Index multiple documents into the vector store"""
        try:
            documents = []

            for file_path in file_paths:
                if not os.path.exists(file_path):
                    print(f"⚠️ File not found: {file_path}")
                    continue

                # Load document
                loader = SimpleDirectoryReader(
                    input_files=[file_path]
                )
                docs = loader.load_data()
                documents.extend(docs)
                print(f"📄 Loaded: {file_path} ({len(docs)} documents)")

            if not documents:
                return {
                    "success": False,
                    "error": "No documents could be loaded",
                    "indexed": 0
                }

            # Create storage context
            storage_context = StorageContext.from_defaults(
                vector_store=self.vector_store
            )

            # Create or update index
            self.index = VectorStoreIndex.from_documents(
                documents,
                storage_context=storage_context,
                show_progress=True
            )

            # Create query engine
            self.query_engine = self.index.as_query_engine(
                similarity_top_k=5,
                streaming=False
            )

            print(f"✅ Indexed {len(documents)} documents")

            return {
                "success": True,
                "indexed": len(documents),
                "files": file_paths
            }

        except Exception as e:
            print(f"❌ Error indexing documents: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "indexed": 0
            }

    async def index_text(self, text: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Index raw text into the vector store"""
        try:
            # Create document from text
            doc = Document(
                text=text,
                metadata=metadata or {}
            )

            # Create storage context
            storage_context = StorageContext.from_defaults(
                vector_store=self.vector_store
            )

            # Create or update index
            if self.index is None:
                self.index = VectorStoreIndex.from_documents(
                    [doc],
                    storage_context=storage_context
                )
            else:
                self.index.insert(doc)

            # Create/update query engine
            self.query_engine = self.index.as_query_engine(
                similarity_top_k=5,
                streaming=False
            )

            print(f"✅ Indexed text ({len(text)} chars)")

            return {
                "success": True,
                "indexed": 1,
                "chars": len(text)
            }

        except Exception as e:
            print(f"❌ Error indexing text: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def query(self, question: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Query the indexed documents"""
        try:
            if self.query_engine is None:
                # Try to load existing index
                await self._load_existing_index()

                if self.query_engine is None:
                    return {
                        "success": False,
                        "error": "No documents indexed. Please index documents first.",
                        "response": ""
                    }

            # Add context if provided
            if context:
                question = f"Context: {context}\n\nQuestion: {question}"

            # Query the index
            response = self.query_engine.query(question)

            # Extract source nodes
            sources = []
            if hasattr(response, 'source_nodes'):
                for node in response.source_nodes:
                    sources.append({
                        "text": node.text[:200] + "..." if len(node.text) > 200 else node.text,
                        "score": node.score if hasattr(node, 'score') else None,
                        "metadata": node.metadata if hasattr(node, 'metadata') else {}
                    })

            return {
                "success": True,
                "response": str(response),
                "sources": sources,
                "source_count": len(sources)
            }

        except Exception as e:
            print(f"❌ Error querying: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "response": ""
            }

    async def _load_existing_index(self):
        """Load existing index from ChromaDB"""
        try:
            # Check if collection has documents
            count = self.chroma_collection.count()

            if count == 0:
                print("ℹ️ No existing documents in ChromaDB")
                return

            # Create storage context
            storage_context = StorageContext.from_defaults(
                vector_store=self.vector_store
            )

            # Load index from vector store
            self.index = VectorStoreIndex.from_vector_store(
                self.vector_store,
                storage_context=storage_context
            )

            # Create query engine
            self.query_engine = self.index.as_query_engine(
                similarity_top_k=5,
                streaming=False
            )

            print(f"✅ Loaded existing index with {count} documents")

        except Exception as e:
            print(f"⚠️ Could not load existing index: {str(e)}")

    async def clear_index(self) -> Dict[str, Any]:
        """Clear all indexed documents"""
        try:
            # Delete the collection
            self.chroma_client.delete_collection(name=self.collection_name)

            # Recreate collection
            self.chroma_collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name
            )

            # Recreate vector store
            self.vector_store = ChromaVectorStore(chroma_collection=self.chroma_collection)

            # Reset index and query engine
            self.index = None
            self.query_engine = None

            print("✅ Index cleared")

            return {
                "success": True,
                "message": "All indexed documents cleared"
            }

        except Exception as e:
            print(f"❌ Error clearing index: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the indexed documents"""
        try:
            count = self.chroma_collection.count()

            return {
                "success": True,
                "total_documents": count,
                "collection_name": self.collection_name,
                "embedding_model": self.embedding_model,
                "llm_model": self.llm_model
            }

        except Exception as e:
            print(f"❌ Error getting stats: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


# Global RAG service instance
rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get or create RAG service instance"""
    global rag_service
    if rag_service is None:
        rag_service = RAGService()
    return rag_service
