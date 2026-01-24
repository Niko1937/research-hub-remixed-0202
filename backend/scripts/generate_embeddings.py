"""
KnowWho Embedding Generator

従業員プロファイルのEmbeddingを生成し、t-SNEで2D座標に変換するスクリプト。

Usage:
    cd backend
    python scripts/generate_embeddings.py
"""

import json
import os
import sys
from pathlib import Path

import httpx
import numpy as np
from sklearn.manifold import TSNE
from dotenv import load_dotenv

# Load environment variables from project root
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / ".env")

# Configuration
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "bedrock.cohere.embed-v4")

DATA_DIR = Path(__file__).parent.parent / "data"
INPUT_FILE = DATA_DIR / "knowwho_db.json"
OUTPUT_FILE = DATA_DIR / "knowwho_embeddings.json"


def create_profile_text(employee: dict) -> str:
    """Create a text representation of an employee profile for embedding."""
    profile = employee.get("profile", {})

    parts = [
        f"名前: {employee['display_name']}",
        f"役職: {employee['job_title']}",
        f"部署: {employee['department']}",
        f"研究概要: {profile.get('research_summary', '')}",
        f"専門分野: {', '.join(profile.get('expertise', []))}",
        f"キーワード: {', '.join(profile.get('keywords', []))}",
        f"略歴: {profile.get('bio', '')}",
    ]

    return "\n".join(parts)


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Get embeddings from the LLM API."""
    if not LLM_BASE_URL or not LLM_API_KEY:
        print("Warning: LLM_BASE_URL or LLM_API_KEY not set. Using mock embeddings.")
        # Generate random embeddings for testing
        return [np.random.randn(1536).tolist() for _ in texts]

    embeddings = []

    with httpx.Client(timeout=60.0) as client:
        for i, text in enumerate(texts):
            print(f"  Embedding {i + 1}/{len(texts)}: {text[:50]}...")

            try:
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
                embedding = data["data"][0]["embedding"]
                embeddings.append(embedding)

            except Exception as e:
                print(f"    Error: {e}")
                # Fallback to random embedding
                embeddings.append(np.random.randn(1536).tolist())

    return embeddings


def compute_tsne(embeddings: list[list[float]], perplexity: int = 5) -> np.ndarray:
    """Compute t-SNE 2D coordinates from embeddings."""
    X = np.array(embeddings)

    # Adjust perplexity based on number of samples
    n_samples = len(embeddings)
    adjusted_perplexity = min(perplexity, max(2, n_samples - 1))

    print(f"  Running t-SNE with perplexity={adjusted_perplexity}...")

    tsne = TSNE(
        n_components=2,
        perplexity=adjusted_perplexity,
        random_state=42,
        max_iter=1000,
        learning_rate="auto",
        init="pca",
    )

    coords_2d = tsne.fit_transform(X)

    # Normalize to [0, 1] range
    coords_min = coords_2d.min(axis=0)
    coords_max = coords_2d.max(axis=0)
    coords_normalized = (coords_2d - coords_min) / (coords_max - coords_min + 1e-8)

    return coords_normalized


def main():
    print("=" * 60)
    print("KnowWho Embedding Generator")
    print("=" * 60)

    # Load employee data
    print(f"\n1. Loading data from {INPUT_FILE}...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    employees = data["employees"]
    print(f"   Found {len(employees)} employees")

    # Create profile texts
    print("\n2. Creating profile texts...")
    texts = [create_profile_text(emp) for emp in employees]

    # Get embeddings
    print("\n3. Generating embeddings...")
    print(f"   Model: {EMBEDDING_MODEL}")
    print(f"   API: {LLM_BASE_URL or 'MOCK (no API configured)'}")
    embeddings = get_embeddings(texts)

    # Compute t-SNE
    print("\n4. Computing t-SNE...")
    coords_2d = compute_tsne(embeddings)

    # Build output data
    print("\n5. Building output data...")
    output = {
        "metadata": {
            "embedding_model": EMBEDDING_MODEL,
            "embedding_dim": len(embeddings[0]) if embeddings else 0,
            "tsne_perplexity": 5,
            "num_employees": len(employees),
        },
        "employees": [],
    }

    for i, emp in enumerate(employees):
        output["employees"].append({
            "employee_id": emp["employee_id"],
            "display_name": emp["display_name"],
            "department": emp["department"],
            "job_title": emp["job_title"],
            "expertise": emp.get("profile", {}).get("expertise", []),
            "keywords": emp.get("profile", {}).get("keywords", []),
            "tsne_x": float(coords_2d[i, 0]),
            "tsne_y": float(coords_2d[i, 1]),
            "embedding": embeddings[i],  # Store full embedding for future use
        })

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
