"""
クラスタリング + LLMラベリング

既存のembeddingsを読み込み、k-meansでクラスタリングし、
各クラスタの代表サンプルをLLMに渡してラベルを生成する
"""

import json
import asyncio
from pathlib import Path
import numpy as np
from sklearn.cluster import KMeans
from sklearn.manifold import TSNE

# プロジェクトルートをパスに追加
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.llm_client import LLMClient, ChatMessage


DATA_DIR = Path(__file__).parent.parent / "data"
EMBEDDINGS_FILE = DATA_DIR / "knowwho_embeddings.json"
OUTPUT_FILE = DATA_DIR / "knowwho_embeddings_clustered.json"

# クラスタ数
N_CLUSTERS = 6


async def generate_cluster_label(llm: LLMClient, members: list[dict]) -> str:
    """クラスタメンバーの情報からLLMでラベルを生成"""

    member_info = "\n".join([
        f"- {m['display_name']} ({m['department']} / {m['job_title']})\n"
        f"  専門: {', '.join(m.get('expertise', []))}\n"
        f"  キーワード: {', '.join(m.get('keywords', []))}"
        for m in members[:5]  # 最大5人
    ])

    prompt = f"""以下のグループメンバーの専門性を分析し、このグループを表す簡潔なラベル（10文字以内）を1つ生成してください。

## グループメンバー:
{member_info}

## 指示:
- ラベルは日本語で、技術分野や専門領域を表すものにしてください
- 例: 「NLP/対話」「画像認識」「LLM基盤」「MLOps」「事業戦略」など
- ラベルのみを出力してください（説明不要）"""

    messages = [ChatMessage(role="user", content=prompt)]

    try:
        response = await llm.chat_completion(messages, max_tokens=50)
        label = response.content.strip().replace('"', '').replace("'", "")
        # 長すぎる場合は切り詰め
        if len(label) > 15:
            label = label[:15]
        return label
    except Exception as e:
        print(f"  LLM labeling failed: {e}")
        return f"クラスタ{members[0].get('cluster_id', '?')}"


async def main():
    print("=" * 60)
    print("クラスタリング + LLMラベリング")
    print("=" * 60)

    # 1. Embeddingsを読み込む
    print("\n[1] Embeddingsファイルを読み込み中...")
    with open(EMBEDDINGS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    employees = data["employees"]
    print(f"  {len(employees)}人の従業員データを読み込みました")

    # embeddingが存在するかチェック
    employees_with_embedding = [e for e in employees if "embedding" in e and e["embedding"]]
    print(f"  うち{len(employees_with_embedding)}人にembeddingがあります")

    if len(employees_with_embedding) < N_CLUSTERS:
        print("  エラー: embeddingを持つ従業員が少なすぎます")
        return

    # 2. Embedding行列を作成
    print("\n[2] Embedding行列を作成中...")
    embeddings = np.array([e["embedding"] for e in employees_with_embedding])
    print(f"  形状: {embeddings.shape}")

    # 3. t-SNEで2Dに次元削減（既存のtsne_x/yがなければ再計算）
    print("\n[3] t-SNEで2D次元削減中...")
    perplexity = min(5, len(employees_with_embedding) - 1)
    tsne = TSNE(n_components=2, perplexity=perplexity, random_state=42, max_iter=1000)
    coords_2d = tsne.fit_transform(embeddings)

    # 正規化 (0-1)
    coords_2d[:, 0] = (coords_2d[:, 0] - coords_2d[:, 0].min()) / (coords_2d[:, 0].max() - coords_2d[:, 0].min() + 1e-8)
    coords_2d[:, 1] = (coords_2d[:, 1] - coords_2d[:, 1].min()) / (coords_2d[:, 1].max() - coords_2d[:, 1].min() + 1e-8)

    for i, emp in enumerate(employees_with_embedding):
        emp["tsne_x"] = float(coords_2d[i, 0])
        emp["tsne_y"] = float(coords_2d[i, 1])

    print(f"  t-SNE完了")

    # 4. k-meansクラスタリング
    print(f"\n[4] k-means クラスタリング (k={N_CLUSTERS})...")
    kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(embeddings)

    for i, emp in enumerate(employees_with_embedding):
        emp["cluster_id"] = int(cluster_labels[i])

    # クラスタごとにグループ化
    clusters = {}
    for emp in employees_with_embedding:
        cid = emp["cluster_id"]
        if cid not in clusters:
            clusters[cid] = []
        clusters[cid].append(emp)

    print(f"  クラスタ分布:")
    for cid, members in sorted(clusters.items()):
        print(f"    クラスタ {cid}: {len(members)}人")

    # 5. LLMでクラスタラベリング
    print(f"\n[5] LLMでクラスタラベリング中...")
    llm = LLMClient()

    cluster_labels_map = {}
    cluster_centers = {}

    for cid, members in sorted(clusters.items()):
        print(f"  クラスタ {cid} をラベリング中...")
        label = await generate_cluster_label(llm, members)
        cluster_labels_map[cid] = label
        print(f"    → ラベル: {label}")

        # クラスタ中心座標を計算
        center_x = np.mean([m["tsne_x"] for m in members])
        center_y = np.mean([m["tsne_y"] for m in members])
        cluster_centers[cid] = {
            "label": label,
            "center_x": float(center_x),
            "center_y": float(center_y),
            "count": len(members),
        }

        # 各メンバーにラベルを付与
        for emp in members:
            emp["cluster_label"] = label

    # 6. 結果を保存
    print(f"\n[6] 結果を保存中...")

    output_data = {
        "metadata": {
            **data.get("metadata", {}),
            "n_clusters": N_CLUSTERS,
            "cluster_method": "kmeans",
            "labeling_method": "llm",
        },
        "clusters": cluster_centers,
        "employees": employees_with_embedding,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"  保存完了: {OUTPUT_FILE}")

    # サマリー
    print("\n" + "=" * 60)
    print("クラスタリング結果サマリー")
    print("=" * 60)
    for cid, info in sorted(cluster_centers.items()):
        print(f"  [{cid}] {info['label']}: {info['count']}人 (center: {info['center_x']:.2f}, {info['center_y']:.2f})")

    print("\n完了!")


if __name__ == "__main__":
    asyncio.run(main())
