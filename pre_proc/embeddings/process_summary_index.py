"""
oipf-summary Index Processing Pipeline

指定したファイルから研究サマリーを生成し、oipf-summaryインデックスに投入するスクリプト

処理フロー:
1. ファイルパスから研究ID（4桁英数字）を抽出
2. ドキュメントを読み込み、最初の5ページからメンバーを抽出
3. LLMで研究要約を生成
4. LLMで研究タグを生成（10個前後）
5. 要約をエンベディング
6. フォルダ構造をMarkdown形式で生成
7. OIPFDocumentを作成してOpenSearchに投入
"""

import sys
import argparse
import asyncio
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.config import config
from common.utils import extract_research_id_from_folder
from folder_structure import generate_tree_md
from embeddings.document_loaders import (
    load_document,
    load_document_pages,
    get_document_text,
    is_image_file,
)
from embeddings.llm_client import LLMClient, get_llm_client
from embeddings.embedding_client import EmbeddingClient, get_embedding_client
from embeddings.opensearch_client import OpenSearchClient, get_opensearch_client
from embeddings.oipf_schema import OIPFDocument


@dataclass
class ProcessingResult:
    """Processing result"""
    success: bool
    document: Optional[OIPFDocument] = None
    error: Optional[str] = None
    research_id: str = ""
    indexed: bool = False


class SummaryIndexPipeline:
    """
    oipf-summary Index Processing Pipeline

    ファイルから研究サマリーを生成してOpenSearchに投入するパイプライン
    """

    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        embedding_client: Optional[EmbeddingClient] = None,
        opensearch_client: Optional[OpenSearchClient] = None,
        index_name: str = "oipf-summary",
        dry_run: bool = False,
        verbose: bool = True,
    ):
        """
        Initialize pipeline

        Args:
            llm_client: LLM client for summary/tag generation
            embedding_client: Embedding client
            opensearch_client: OpenSearch client
            index_name: Target index name
            dry_run: If True, don't actually index
            verbose: Enable verbose output
        """
        self.llm_client = llm_client
        self.embedding_client = embedding_client
        self.opensearch_client = opensearch_client
        self.index_name = index_name
        self.dry_run = dry_run
        self.verbose = verbose

    def _log(self, message: str):
        """Log message if verbose"""
        if self.verbose:
            print(message)

    async def process_file(
        self,
        file_path: str,
        base_path: Optional[str] = None,
        max_pages_for_members: int = 5,
        num_tags: int = 10,
        research_id: Optional[str] = None,
    ) -> ProcessingResult:
        """
        Process a single file and create oipf-summary document

        Args:
            file_path: Path to the file (e.g., research document)
            base_path: Base path to omit in folder structure (optional)
            max_pages_for_members: Max pages to scan for member extraction
            num_tags: Number of tags to generate
            research_id: Optional research ID (4-digit alphanumeric). If not provided, extracted from folder name.

        Returns:
            ProcessingResult with document or error
        """
        file_path = Path(file_path).resolve()
        base_path = Path(base_path).resolve() if base_path else file_path.parent

        self._log(f"\n{'='*60}")
        self._log(f"Processing: {file_path}")
        self._log(f"Base path: {base_path}")
        self._log(f"{'='*60}")

        # 1. Extract or use provided research ID
        if research_id:
            self._log(f"[1/7] Research ID (specified): {research_id}")
        else:
            research_id = extract_research_id_from_folder(str(file_path.parent), str(base_path))
            self._log(f"[1/7] Research ID (extracted): {research_id or '(empty)'}")

        # 2. Load document
        self._log(f"[2/7] Loading document...")

        if is_image_file(file_path):
            return ProcessingResult(
                success=False,
                error="Image files are not supported for summary index. Use oipf-details instead.",
                research_id=research_id,
            )

        # Load full document for summary
        full_text, error = get_document_text(file_path)
        if error:
            return ProcessingResult(
                success=False,
                error=f"Failed to load document: {error}",
                research_id=research_id,
            )

        if not full_text.strip():
            return ProcessingResult(
                success=False,
                error="Document is empty or could not extract text",
                research_id=research_id,
            )

        self._log(f"    Document loaded: {len(full_text)} characters")

        # Load first pages for member extraction
        first_pages_text, _ = get_document_text(file_path, max_pages=max_pages_for_members)
        self._log(f"    First {max_pages_for_members} pages: {len(first_pages_text)} characters")

        # 3. Extract members from first pages
        self._log(f"[3/7] Extracting researchers...")
        members = []
        if self.llm_client:
            try:
                members_result = await self.llm_client.extract_researchers(first_pages_text)
                if members_result.success:
                    members = self.llm_client.parse_researchers(members_result.content)
                    self._log(f"    Found {len(members)} researcher(s): {members[:3]}{'...' if len(members) > 3 else ''}")
                else:
                    self._log(f"    Warning: Member extraction failed: {members_result.error}")
            except Exception as e:
                self._log(f"    Warning: Member extraction error: {e}")

        # 4. Generate research summary
        self._log(f"[4/7] Generating research summary...")
        summary = ""
        if self.llm_client:
            try:
                summary_result = await self.llm_client.generate_research_summary(full_text)
                if summary_result.success:
                    summary = summary_result.content
                    self._log(f"    Summary generated: {len(summary)} characters")
                else:
                    self._log(f"    Warning: Summary generation failed: {summary_result.error}")
            except Exception as e:
                self._log(f"    Warning: Summary generation error: {e}")

        if not summary:
            # Fallback: use first 500 chars as summary
            summary = full_text[:500] + "..." if len(full_text) > 500 else full_text
            self._log(f"    Using fallback summary (first 500 chars)")

        # 5. Generate research tags
        self._log(f"[5/7] Generating research tags...")
        tags = []
        if self.llm_client:
            try:
                tags_result = await self.llm_client.extract_research_tags(full_text, num_tags)
                if tags_result.success:
                    tags = self.llm_client.parse_tags(tags_result.content)
                    self._log(f"    Generated {len(tags)} tag(s): {tags[:5]}{'...' if len(tags) > 5 else ''}")
                else:
                    self._log(f"    Warning: Tag generation failed: {tags_result.error}")
            except Exception as e:
                self._log(f"    Warning: Tag generation error: {e}")

        # 6. Generate embedding (if enabled)
        self._log(f"[6/7] Generating embeddings...")
        embedding = []
        embed_abstract = config.processing.embed_abstract
        embed_tags = config.processing.embed_tags
        self._log(f"    Embedding targets: abstract={embed_abstract}, tags={embed_tags}")

        if embed_abstract and self.embedding_client:
            try:
                embedding_result = await self.embedding_client.embed_text(summary)
                if embedding_result.success and embedding_result.embeddings:
                    embedding = embedding_result.embeddings[0]
                    self._log(f"    Abstract embedding generated: {len(embedding)} dimensions")
                else:
                    self._log(f"    Warning: Abstract embedding failed: {embedding_result.error}")
            except Exception as e:
                self._log(f"    Warning: Abstract embedding error: {e}")

        # 6.5. Generate tags embedding (if enabled)
        tags_embedding = []
        if embed_tags and self.embedding_client and tags:
            try:
                tags_text = ", ".join(tags)
                tags_embedding_result = await self.embedding_client.embed_text(tags_text)
                if tags_embedding_result.success and tags_embedding_result.embeddings:
                    tags_embedding = tags_embedding_result.embeddings[0]
                    self._log(f"    Tags embedding generated: {len(tags_embedding)} dimensions")
                else:
                    self._log(f"    Warning: Tags embedding failed: {tags_embedding_result.error}")
            except Exception as e:
                self._log(f"    Warning: Tags embedding error: {e}")

        # 6.6. Extract proper nouns from folder path and generate embedding (if enabled)
        proper_nouns = []
        proper_nouns_embedding = []
        embed_proper_nouns = config.processing.embed_proper_nouns
        self._log(f"    Embed proper nouns: {embed_proper_nouns}")

        if embed_proper_nouns and self.llm_client:
            try:
                rel_path = str(file_path.relative_to(base_path)) if base_path else str(file_path)
                folder_path_str = str(file_path.parent.relative_to(base_path)) if base_path else str(file_path.parent)

                proper_nouns_result = await self.llm_client.extract_proper_nouns_from_path(
                    file_path=rel_path,
                    file_name=file_path.name,
                    folder_path=folder_path_str,
                )
                if proper_nouns_result.success:
                    proper_nouns = self.llm_client.parse_proper_nouns(proper_nouns_result.content)
                    self._log(f"    Extracted proper nouns: {proper_nouns}")

                    if proper_nouns and self.embedding_client:
                        proper_nouns_text = ", ".join(proper_nouns)
                        proper_nouns_embedding_result = await self.embedding_client.embed_text(proper_nouns_text)
                        if proper_nouns_embedding_result.success and proper_nouns_embedding_result.embeddings:
                            proper_nouns_embedding = proper_nouns_embedding_result.embeddings[0]
                            self._log(f"    Proper nouns embedding generated: {len(proper_nouns_embedding)} dimensions")
                        else:
                            self._log(f"    Warning: Proper nouns embedding failed: {proper_nouns_embedding_result.error}")
                else:
                    self._log(f"    Warning: Proper nouns extraction failed: {proper_nouns_result.error}")
            except Exception as e:
                self._log(f"    Warning: Proper nouns extraction error: {e}")

        # Ensure at least one embedding is generated
        if not embedding and not tags_embedding and not proper_nouns_embedding:
            return ProcessingResult(
                success=False,
                error="No embeddings generated (check EMBEDDING_TARGETS setting)",
                research_id=research_id,
            )

        # 7. Generate folder structure
        self._log(f"[7/7] Generating folder structure...")
        folder_structure = ""
        try:
            # Use the folder containing the file
            folder_structure = generate_tree_md(
                str(file_path.parent),
                base_path=str(base_path),
                max_depth=4,
                show_files=True,
            )
            self._log(f"    Folder structure generated: {len(folder_structure)} characters")
        except Exception as e:
            self._log(f"    Warning: Folder structure generation error: {e}")

        # Validate research_id for document ID
        if not research_id:
            return ProcessingResult(
                success=False,
                error="Research ID is empty. Ensure file is in a subfolder under base_path with ASCII alphanumeric characters.",
                research_id=research_id,
            )

        # Use research_id (4-digit alphanumeric) as document ID for PUT
        doc_id = research_id

        document = OIPFDocument(
            id=doc_id,
            oipf_research_id=research_id,
            related_researchers=members,
            oipf_research_abstract=summary,
            oipf_research_abstract_embedding=embedding,
            oipf_spo_folderstructure_summary=folder_structure,
            oipf_research_richtext=full_text[:100000],  # Limit richtext
            oipf_research_themetags=tags,
            oipf_themetags_embedding=tags_embedding,
            oipf_research_proper_nouns=proper_nouns,
            oipf_proper_nouns_embedding=proper_nouns_embedding,
        )

        # Validate document
        validation_errors = document.validate()
        if validation_errors:
            return ProcessingResult(
                success=False,
                error=f"Document validation failed: {', '.join(validation_errors)}",
                document=document,
                research_id=research_id,
            )

        self._log(f"\nDocument created:")
        self._log(f"  ID: {document.id}")
        self._log(f"  Research ID: {document.oipf_research_id}")
        self._log(f"  Researchers: {len(document.related_researchers)}")
        self._log(f"  Tags: {len(document.oipf_research_themetags)}")
        self._log(f"  Proper Nouns: {len(document.oipf_research_proper_nouns)}")
        self._log(f"  Abstract embedding dims: {len(document.oipf_research_abstract_embedding)}")
        self._log(f"  Tags embedding dims: {len(document.oipf_themetags_embedding)}")
        self._log(f"  Proper nouns embedding dims: {len(document.oipf_proper_nouns_embedding)}")

        # Index to OpenSearch
        indexed = False
        if not self.dry_run and self.opensearch_client:
            try:
                self._log(f"\nIndexing to OpenSearch ({self.index_name})...")
                result = await self.opensearch_client.index_document(
                    index_name=self.index_name,
                    doc_id=document.id,
                    document=document.to_dict(),
                )
                if result.success:
                    indexed = True
                    self._log(f"  Successfully indexed!")
                else:
                    return ProcessingResult(
                        success=False,
                        error=f"Failed to index: {result.error}",
                        document=document,
                        research_id=research_id,
                    )
            except Exception as e:
                return ProcessingResult(
                    success=False,
                    error=f"Failed to index: {e}",
                    document=document,
                    research_id=research_id,
                )
        elif self.dry_run:
            self._log(f"\n[DRY RUN] Would index to {self.index_name}")

        return ProcessingResult(
            success=True,
            document=document,
            research_id=research_id,
            indexed=indexed,
        )


async def main_async(args):
    """Async main function"""
    # Initialize clients
    llm_client = None
    embedding_client = None
    opensearch_client = None

    try:
        llm_client = get_llm_client()
        print(f"LLM Client: {config.llm.model}")
    except Exception as e:
        print(f"Warning: LLM client not available: {e}")

    try:
        embedding_client = get_embedding_client()
        print(f"Embedding Client: {config.embedding.model}")
    except Exception as e:
        print(f"Warning: Embedding client not available: {e}")

    if not args.dry_run:
        try:
            opensearch_client = get_opensearch_client()
            print(f"OpenSearch Client: {config.opensearch.url}")
        except Exception as e:
            print(f"Warning: OpenSearch client not available: {e}")

    # Create pipeline
    pipeline = SummaryIndexPipeline(
        llm_client=llm_client,
        embedding_client=embedding_client,
        opensearch_client=opensearch_client,
        index_name=args.index,
        dry_run=args.dry_run,
        verbose=not args.quiet,
    )

    # Process file
    result = await pipeline.process_file(
        file_path=args.file,
        base_path=args.base_path,
        max_pages_for_members=args.max_pages,
        num_tags=args.num_tags,
        research_id=args.research_id,
    )

    # Output result
    if result.success:
        print(f"\n{'='*60}")
        print("SUCCESS!")
        print(f"{'='*60}")
        print(f"Research ID: {result.research_id}")
        if result.document:
            print(f"Document ID: {result.document.id}")
            print(f"Summary: {result.document.oipf_research_abstract[:200]}...")
            print(f"Tags: {', '.join(result.document.oipf_research_themetags)}")
            print(f"Researchers: {', '.join(result.document.related_researchers)}")
        if result.indexed:
            print(f"Indexed: Yes")
        elif args.dry_run:
            print(f"Indexed: No (dry run)")
        else:
            print(f"Indexed: No")
    else:
        print(f"\n{'='*60}")
        print("FAILED!")
        print(f"{'='*60}")
        print(f"Error: {result.error}")
        sys.exit(1)


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description="研究ファイルからoipf-summaryインデックス用ドキュメントを生成",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # 基本的な使用方法
  python process_summary_index.py /path/to/research/document.pdf

  # ベースパスを指定（フォルダ構造の省略用）
  python process_summary_index.py /data/研究/ABC123_project/report.pdf --base-path /data/研究

  # ドライラン（OpenSearchに投入しない）
  python process_summary_index.py /path/to/document.pdf --dry-run

  # 研究IDを手動指定
  python process_summary_index.py /path/to/document.pdf --research-id XYZ1

  # タグ数とメンバー抽出ページ数を指定
  python process_summary_index.py /path/to/document.pdf --num-tags 15 --max-pages 10
        """
    )

    parser.add_argument(
        "file",
        help="処理対象のファイルパス（PDF、Word、PowerPoint等）"
    )
    parser.add_argument(
        "--base-path", "-b",
        help="フォルダ構造で省略するベースパス"
    )
    parser.add_argument(
        "--research-id", "-r",
        help="研究ID（4桁英数字）を手動指定。省略時はフォルダ名から自動抽出"
    )
    parser.add_argument(
        "--index", "-i",
        default="oipf-summary",
        help="投入先インデックス名（デフォルト: oipf-summary）"
    )
    parser.add_argument(
        "--max-pages", "-p",
        type=int,
        default=5,
        help="メンバー抽出に使用する最大ページ数（デフォルト: 5）"
    )
    parser.add_argument(
        "--num-tags", "-t",
        type=int,
        default=10,
        help="生成するタグ数（デフォルト: 10）"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="ドライラン（OpenSearchに投入しない）"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="進捗表示を抑制"
    )

    args = parser.parse_args()

    # Validate file path
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    if not file_path.is_file():
        print(f"Error: Not a file: {args.file}", file=sys.stderr)
        sys.exit(1)

    # Run async main
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
