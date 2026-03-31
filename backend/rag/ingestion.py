"""
One-time ingestion of green-AI documents into ChromaDB.
Uses sentence-transformers for local embeddings.
"""

import os
import chromadb
from chromadb.utils import embedding_functions
from rag.green_docs import get_all_documents, get_document_texts, get_document_ids

CHROMA_PATH  = os.getenv("CHROMA_PATH", "./chroma_db")
COLLECTION   = "green_ai_docs"
EMBED_MODEL  = "all-MiniLM-L6-v2"


def get_collection():
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBED_MODEL
    )
    collection = client.get_or_create_collection(
        name=COLLECTION,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )
    return collection


def ingest_documents(force: bool = False):
    """
    Ingest all green-AI documents into ChromaDB.
    Skips if already populated unless force=True.
    """
    collection = get_collection()
    existing = collection.count()

    docs    = get_all_documents()
    n_docs  = len(docs)

    if existing >= n_docs and not force:
        print(f"[RAG] ChromaDB already has {existing} docs — skipping ingestion.")
        return

    print(f"[RAG] Ingesting {n_docs} green-AI documents into ChromaDB...")
    texts = get_document_texts()
    ids   = get_document_ids()
    metas = [
        {"title": d["title"], "tags": ",".join(d["tags"])}
        for d in docs
    ]

    # Upsert in case of re-ingestion
    collection.upsert(
        ids=ids,
        documents=texts,
        metadatas=metas,
    )
    print(f"[RAG] Ingestion complete. {n_docs} documents indexed.")
