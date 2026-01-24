"""
SharePoint Path Summary Generator

深い階層のパス情報をLLMで要約し、Coarse-to-Fine検索用のテキストを生成。

Usage:
    cd backend
    python scripts/generate_path_summaries.py
"""

import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load environment variables from project root
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / ".env")

# Configuration
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "bedrock.anthropic.claude-sonnet-4-20250514-v1:0")

DATA_DIR = Path(__file__).parent.parent / "data"
INPUT_FILE = DATA_DIR / "sharepoint_paths.json"
OUTPUT_FILE = DATA_DIR / "sharepoint_paths_with_embeddings.json"


def generate_summary_with_llm(path_info: dict) -> str:
    """Generate a summary of deep path content using LLM."""
    if not LLM_BASE_URL or not LLM_API_KEY:
        print("Warning: LLM not configured. Using existing summary.")
        return path_info.get("deep_content_summary", "")

    prompt = f"""以下のSharePointフォルダパスの内容を、検索に適した簡潔な要約（100-150文字程度）にしてください。

フォルダパス: {path_info['full_path']}
フォルダ説明: {path_info.get('description', '')}
含まれるコンテンツの詳細:
{path_info.get('deep_content_summary', '')}

要約:"""

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{LLM_BASE_URL}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 200,
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"    LLM Error: {e}")
        return path_info.get("deep_content_summary", "")


def get_embedding(text: str) -> list[float]:
    """Get embedding for a text string."""
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "bedrock.cohere.embed-v4")

    if not LLM_BASE_URL or not LLM_API_KEY:
        import numpy as np
        return np.random.randn(1536).tolist()

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{LLM_BASE_URL}/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": EMBEDDING_MODEL,
                    "input": text,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]
    except Exception as e:
        print(f"    Embedding Error: {e}")
        import numpy as np
        return np.random.randn(1536).tolist()


def process_node(node: dict, depth: int = 1) -> dict:
    """Process a node recursively, generating summaries for deep paths."""
    processed = {
        "path_id": node["path_id"],
        "name": node["name"],
        "level": node["level"],
        "full_path": node["full_path"],
        "description": node.get("description", ""),
    }

    # Level 5 nodes have deep_content_summary that may need processing
    if node.get("deep_content_summary"):
        processed["deep_content_summary"] = node["deep_content_summary"]
        processed["keywords"] = node.get("keywords", [])

        # Create searchable text combining all info
        search_text = f"{node['full_path']} {node.get('description', '')} {node.get('deep_content_summary', '')}"
        processed["search_text"] = search_text

    # Process children recursively
    if "children" in node:
        processed["children"] = [
            process_node(child, depth + 1) for child in node["children"]
        ]

    return processed


def build_flat_index(node: dict, index: list) -> None:
    """Build a flat index of all searchable paths."""
    # Add this node to index
    entry = {
        "path_id": node["path_id"],
        "full_path": node["full_path"],
        "level": node["level"],
        "name": node["name"],
        "description": node.get("description", ""),
    }

    if node.get("deep_content_summary"):
        entry["deep_content_summary"] = node["deep_content_summary"]
        entry["keywords"] = node.get("keywords", [])

    index.append(entry)

    # Process children
    for child in node.get("children", []):
        build_flat_index(child, index)


def main():
    print("=" * 60)
    print("SharePoint Path Summary Generator")
    print("=" * 60)

    # Load path data
    print(f"\n1. Loading data from {INPUT_FILE}...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    hierarchy = data["hierarchy"]
    print(f"   Found {len(hierarchy)} top-level paths")

    # Process hierarchy
    print("\n2. Processing hierarchy...")
    processed_hierarchy = [process_node(node) for node in hierarchy]

    # Build flat index for search
    print("\n3. Building flat search index...")
    flat_index = []
    for node in processed_hierarchy:
        build_flat_index(node, flat_index)
    print(f"   Created index with {len(flat_index)} entries")

    # Generate embeddings for all index entries
    print("\n4. Generating embeddings for search index...")
    for i, entry in enumerate(flat_index):
        # Create text for embedding
        text_parts = [
            entry["full_path"],
            entry.get("description", ""),
        ]
        if entry.get("deep_content_summary"):
            text_parts.append(entry["deep_content_summary"])
        if entry.get("keywords"):
            text_parts.append(" ".join(entry["keywords"]))

        embed_text = " ".join(text_parts)
        print(f"  [{i + 1}/{len(flat_index)}] {entry['full_path'][:50]}...")

        embedding = get_embedding(embed_text)
        entry["embedding"] = embedding

    # Build output
    print("\n5. Building output data...")
    output = {
        "metadata": {
            **data["metadata"],
            "embedding_model": os.getenv("EMBEDDING_MODEL", "bedrock.cohere.embed-v4"),
            "num_paths": len(flat_index),
        },
        "hierarchy": processed_hierarchy,
        "flat_index": flat_index,
        "coarse_summaries": data["search_index"]["coarse_summaries"],
    }

    # Save output
    print(f"\n6. Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("Done!")
    print(f"Output: {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
