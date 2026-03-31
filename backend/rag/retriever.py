"""
Retrieves the most relevant green-AI document chunks from ChromaDB
given a query derived from the notebook's static analysis results.
"""

from typing import List, Dict
from rag.ingestion import get_collection


def build_query(static_analysis, summary) -> str:
    """Construct a rich query string from analysis results."""
    parts = [
        f"framework: {static_analysis.framework}",
        f"model type: {static_analysis.model_type}",
        f"complexity: {static_analysis.complexity_tier}",
    ]
    if static_analysis.detected_patterns:
        parts.append(f"patterns detected: {', '.join(static_analysis.detected_patterns)}")
    if summary.total_co2_grams > 1.0:
        parts.append("high carbon emissions from ML training")
    if "mixed_precision" not in (static_analysis.detected_patterns or []):
        parts.append("mixed precision training not used")
    if "early_stopping" not in (static_analysis.detected_patterns or []):
        parts.append("no early stopping detected")
    return ". ".join(parts)


def retrieve_chunks(
    static_analysis,
    summary,
    n_results: int = 6,
) -> List[Dict]:
    """
    Query ChromaDB and return top-N relevant document chunks.
    Returns list of dicts with keys: id, content, title, tags.
    """
    collection = get_collection()
    query      = build_query(static_analysis, summary)

    results = collection.query(
        query_texts=[query],
        n_results=min(n_results, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for idx, (doc, meta, dist) in enumerate(zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    )):
        chunks.append({
            "id":       results["ids"][0][idx],
            "content":  doc,
            "title":    meta.get("title", ""),
            "tags":     meta.get("tags", ""),
            "score":    round(1 - dist, 4),  # cosine distance → similarity
        })

    return chunks
