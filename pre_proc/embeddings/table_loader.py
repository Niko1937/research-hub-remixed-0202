"""
Table Loader Module

Excel/CSVファイルをpandasで読み込み、LLMが理解しやすいMarkdownテーブル形式に変換する。
カラム情報、統計情報、シート情報をメタデータとして抽出。
"""

import sys
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np


@dataclass
class TableMetadata:
    """Table metadata for LLM understanding"""
    sheet_name: str = ""
    columns: list[str] = field(default_factory=list)
    column_types: dict[str, str] = field(default_factory=dict)
    row_count: int = 0
    numeric_columns: list[str] = field(default_factory=list)
    numeric_stats: dict[str, dict] = field(default_factory=dict)  # column -> {min, max, mean, etc.}
    sample_values: dict[str, list] = field(default_factory=dict)  # column -> first few values


@dataclass
class TableDocument:
    """Processed table document"""
    markdown_content: str  # Full table in markdown format
    schema_description: str  # Human-readable schema description
    summary_context: str  # Context for LLM summary generation
    metadata: TableMetadata
    truncated: bool = False  # True if table was too large and truncated


@dataclass
class TableLoaderResult:
    """Result of loading a table file"""
    success: bool
    documents: list[TableDocument] = field(default_factory=list)
    error: Optional[str] = None
    file_path: str = ""
    file_type: str = ""


def _detect_encoding(file_path: Path) -> str:
    """Detect file encoding for CSV files"""
    try:
        import chardet
        with open(file_path, "rb") as f:
            raw_data = f.read(10000)
            result = chardet.detect(raw_data)
            return result.get("encoding", "utf-8") or "utf-8"
    except Exception:
        return "utf-8"


def _get_dtype_description(dtype) -> str:
    """Convert pandas dtype to human-readable description"""
    dtype_str = str(dtype)
    if "int" in dtype_str:
        return "整数"
    elif "float" in dtype_str:
        return "小数"
    elif "datetime" in dtype_str:
        return "日時"
    elif "bool" in dtype_str:
        return "真偽値"
    elif "object" in dtype_str or "string" in dtype_str:
        return "文字列"
    else:
        return dtype_str


def _calculate_numeric_stats(df: pd.DataFrame, column: str) -> dict:
    """Calculate statistics for a numeric column"""
    try:
        series = pd.to_numeric(df[column], errors='coerce').dropna()
        if len(series) == 0:
            return {}

        stats = {
            "min": float(series.min()),
            "max": float(series.max()),
            "mean": float(series.mean()),
            "count": int(len(series)),
        }

        # Add median if enough data points
        if len(series) >= 3:
            stats["median"] = float(series.median())

        # Add std if enough data points
        if len(series) >= 2:
            stats["std"] = float(series.std())

        return stats
    except Exception:
        return {}


def _get_sample_values(df: pd.DataFrame, column: str, max_samples: int = 3) -> list:
    """Get sample values from a column"""
    try:
        # Get unique non-null values
        unique_values = df[column].dropna().unique()[:max_samples]
        return [str(v) for v in unique_values]
    except Exception:
        return []


def _dataframe_to_markdown(
    df: pd.DataFrame,
    max_rows: int = 100,
    max_columns: int = 20,
) -> tuple[str, bool]:
    """
    Convert DataFrame to markdown table format.

    Args:
        df: DataFrame to convert
        max_rows: Maximum rows to include
        max_columns: Maximum columns to include

    Returns:
        Tuple of (markdown_string, was_truncated)
    """
    truncated = False

    # Truncate if necessary
    if len(df) > max_rows:
        df = df.head(max_rows)
        truncated = True

    if len(df.columns) > max_columns:
        df = df.iloc[:, :max_columns]
        truncated = True

    # Convert to markdown
    try:
        # Handle NaN values
        df_display = df.fillna("")

        # Format numeric columns to avoid excessive decimals
        for col in df_display.select_dtypes(include=[np.number]).columns:
            df_display[col] = df_display[col].apply(
                lambda x: f"{x:.6g}" if pd.notna(x) and x != "" else x
            )

        markdown = df_display.to_markdown(index=False)
        return markdown, truncated
    except Exception as e:
        # Fallback: simple format
        lines = []
        headers = " | ".join(str(col) for col in df.columns)
        separator = " | ".join("---" for _ in df.columns)
        lines.append(f"| {headers} |")
        lines.append(f"| {separator} |")

        for _, row in df.iterrows():
            row_str = " | ".join(str(v) if pd.notna(v) else "" for v in row)
            lines.append(f"| {row_str} |")

        return "\n".join(lines), truncated


def _create_schema_description(metadata: TableMetadata) -> str:
    """Create human-readable schema description"""
    lines = []

    lines.append(f"【テーブル構造】")
    lines.append(f"- 行数: {metadata.row_count}")
    lines.append(f"- 列数: {len(metadata.columns)}")
    lines.append("")

    lines.append("【カラム情報】")
    for col in metadata.columns:
        dtype = metadata.column_types.get(col, "不明")
        samples = metadata.sample_values.get(col, [])
        sample_str = f" (例: {', '.join(samples[:2])})" if samples else ""
        lines.append(f"- {col}: {dtype}{sample_str}")

    # Add numeric statistics
    if metadata.numeric_stats:
        lines.append("")
        lines.append("【数値カラムの統計】")
        for col, stats in metadata.numeric_stats.items():
            if stats:
                stat_parts = []
                if "min" in stats:
                    stat_parts.append(f"最小: {stats['min']:.6g}")
                if "max" in stats:
                    stat_parts.append(f"最大: {stats['max']:.6g}")
                if "mean" in stats:
                    stat_parts.append(f"平均: {stats['mean']:.6g}")
                if stat_parts:
                    lines.append(f"- {col}: {', '.join(stat_parts)}")

    return "\n".join(lines)


def _create_summary_context(
    df: pd.DataFrame,
    metadata: TableMetadata,
    sheet_name: str = "",
) -> str:
    """Create context for LLM summary generation"""
    lines = []

    if sheet_name:
        lines.append(f"シート名: {sheet_name}")

    lines.append(f"データ件数: {metadata.row_count}行 × {len(metadata.columns)}列")
    lines.append("")
    lines.append("カラム一覧:")
    for col in metadata.columns:
        dtype = metadata.column_types.get(col, "")
        lines.append(f"  - {col} ({dtype})")

    # Add sample data (first few rows)
    lines.append("")
    lines.append("サンプルデータ（先頭行）:")
    sample_df = df.head(5)
    sample_md, _ = _dataframe_to_markdown(sample_df)
    lines.append(sample_md)

    # Add numeric column summaries
    if metadata.numeric_stats:
        lines.append("")
        lines.append("数値データの概要:")
        for col, stats in metadata.numeric_stats.items():
            if stats:
                lines.append(f"  {col}: {stats.get('min', 'N/A')} ~ {stats.get('max', 'N/A')} (平均: {stats.get('mean', 'N/A'):.6g})")

    return "\n".join(lines)


def load_excel_file(
    file_path: Path,
    max_rows: int = 100,
    max_columns: int = 20,
) -> TableLoaderResult:
    """
    Load Excel file and convert to TableDocuments.

    Args:
        file_path: Path to Excel file
        max_rows: Maximum rows per sheet
        max_columns: Maximum columns per sheet

    Returns:
        TableLoaderResult with documents for each sheet
    """
    file_path = Path(file_path)

    if not file_path.exists():
        return TableLoaderResult(
            success=False,
            error=f"File not found: {file_path}",
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
        )

    try:
        # Read all sheets
        xlsx = pd.ExcelFile(file_path)
        documents = []

        for sheet_name in xlsx.sheet_names:
            try:
                df = pd.read_excel(xlsx, sheet_name=sheet_name)

                # Skip empty sheets
                if df.empty:
                    continue

                # Create metadata
                metadata = TableMetadata(
                    sheet_name=sheet_name,
                    columns=list(df.columns),
                    column_types={col: _get_dtype_description(df[col].dtype) for col in df.columns},
                    row_count=len(df),
                )

                # Identify numeric columns and calculate stats
                for col in df.columns:
                    if pd.api.types.is_numeric_dtype(df[col]):
                        metadata.numeric_columns.append(col)
                        stats = _calculate_numeric_stats(df, col)
                        if stats:
                            metadata.numeric_stats[col] = stats

                    # Get sample values
                    metadata.sample_values[col] = _get_sample_values(df, col)

                # Convert to markdown
                markdown_content, truncated = _dataframe_to_markdown(df, max_rows, max_columns)

                # Add sheet header
                full_markdown = f"## シート: {sheet_name}\n\n{markdown_content}"
                if truncated:
                    full_markdown += f"\n\n※ データが大きいため、先頭{max_rows}行のみ表示"

                # Create schema description
                schema_desc = _create_schema_description(metadata)

                # Create summary context
                summary_context = _create_summary_context(df, metadata, sheet_name)

                documents.append(TableDocument(
                    markdown_content=full_markdown,
                    schema_description=schema_desc,
                    summary_context=summary_context,
                    metadata=metadata,
                    truncated=truncated,
                ))

            except Exception as e:
                # Skip problematic sheets but continue
                print(f"Warning: Failed to process sheet '{sheet_name}': {e}")
                continue

        if not documents:
            return TableLoaderResult(
                success=False,
                error="No valid sheets found in Excel file",
                file_path=str(file_path),
                file_type=file_path.suffix.lower(),
            )

        return TableLoaderResult(
            success=True,
            documents=documents,
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
        )

    except Exception as e:
        return TableLoaderResult(
            success=False,
            error=f"Failed to load Excel file: {str(e)}",
            file_path=str(file_path),
            file_type=file_path.suffix.lower(),
        )


def load_csv_file(
    file_path: Path,
    max_rows: int = 100,
    max_columns: int = 20,
    encoding: Optional[str] = None,
) -> TableLoaderResult:
    """
    Load CSV file and convert to TableDocument.

    Args:
        file_path: Path to CSV file
        max_rows: Maximum rows
        max_columns: Maximum columns
        encoding: File encoding (auto-detected if None)

    Returns:
        TableLoaderResult with document
    """
    file_path = Path(file_path)

    if not file_path.exists():
        return TableLoaderResult(
            success=False,
            error=f"File not found: {file_path}",
            file_path=str(file_path),
            file_type=".csv",
        )

    try:
        # Detect encoding if not specified
        if encoding is None:
            encoding = _detect_encoding(file_path)

        # Try to read CSV with detected encoding
        try:
            df = pd.read_csv(file_path, encoding=encoding)
        except UnicodeDecodeError:
            # Fallback encodings
            for fallback_encoding in ["utf-8", "shift_jis", "cp932", "latin1"]:
                try:
                    df = pd.read_csv(file_path, encoding=fallback_encoding)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                return TableLoaderResult(
                    success=False,
                    error="Failed to decode CSV file with any encoding",
                    file_path=str(file_path),
                    file_type=".csv",
                )

        # Skip empty files
        if df.empty:
            return TableLoaderResult(
                success=False,
                error="CSV file is empty",
                file_path=str(file_path),
                file_type=".csv",
            )

        # Create metadata
        metadata = TableMetadata(
            sheet_name="",
            columns=list(df.columns),
            column_types={col: _get_dtype_description(df[col].dtype) for col in df.columns},
            row_count=len(df),
        )

        # Identify numeric columns and calculate stats
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                metadata.numeric_columns.append(col)
                stats = _calculate_numeric_stats(df, col)
                if stats:
                    metadata.numeric_stats[col] = stats

            # Get sample values
            metadata.sample_values[col] = _get_sample_values(df, col)

        # Convert to markdown
        markdown_content, truncated = _dataframe_to_markdown(df, max_rows, max_columns)

        if truncated:
            markdown_content += f"\n\n※ データが大きいため、先頭{max_rows}行のみ表示"

        # Create schema description
        schema_desc = _create_schema_description(metadata)

        # Create summary context
        summary_context = _create_summary_context(df, metadata)

        document = TableDocument(
            markdown_content=markdown_content,
            schema_description=schema_desc,
            summary_context=summary_context,
            metadata=metadata,
            truncated=truncated,
        )

        return TableLoaderResult(
            success=True,
            documents=[document],
            file_path=str(file_path),
            file_type=".csv",
        )

    except Exception as e:
        return TableLoaderResult(
            success=False,
            error=f"Failed to load CSV file: {str(e)}",
            file_path=str(file_path),
            file_type=".csv",
        )


def load_table_file(
    file_path: Path,
    max_rows: int = 100,
    max_columns: int = 20,
) -> TableLoaderResult:
    """
    Load any supported table file (Excel or CSV).

    Args:
        file_path: Path to file
        max_rows: Maximum rows
        max_columns: Maximum columns

    Returns:
        TableLoaderResult with documents
    """
    file_path = Path(file_path)
    ext = file_path.suffix.lower()

    if ext in [".xlsx", ".xls"]:
        return load_excel_file(file_path, max_rows, max_columns)
    elif ext == ".csv":
        return load_csv_file(file_path, max_rows, max_columns)
    else:
        return TableLoaderResult(
            success=False,
            error=f"Unsupported table file type: {ext}",
            file_path=str(file_path),
            file_type=ext,
        )


def is_table_file(file_path: Path) -> bool:
    """Check if file is a table file (Excel or CSV)"""
    return file_path.suffix.lower() in [".xlsx", ".xls", ".csv"]


def combine_table_documents(documents: list[TableDocument]) -> tuple[str, str]:
    """
    Combine multiple table documents (e.g., multiple sheets) into single strings.

    Args:
        documents: List of TableDocuments

    Returns:
        Tuple of (combined_markdown, combined_summary_context)
    """
    markdown_parts = []
    context_parts = []

    for doc in documents:
        markdown_parts.append(doc.markdown_content)
        context_parts.append(doc.summary_context)

    combined_markdown = "\n\n---\n\n".join(markdown_parts)
    combined_context = "\n\n---\n\n".join(context_parts)

    return combined_markdown, combined_context


if __name__ == "__main__":
    # Test
    import sys

    if len(sys.argv) > 1:
        test_file = Path(sys.argv[1])
        print(f"Loading: {test_file}")

        result = load_table_file(test_file)

        if result.success:
            print(f"Success! Found {len(result.documents)} table(s)")
            for i, doc in enumerate(result.documents):
                print(f"\n{'='*60}")
                print(f"Table {i+1}: {doc.metadata.sheet_name or 'CSV'}")
                print(f"{'='*60}")
                print(f"\nSchema:\n{doc.schema_description}")
                print(f"\nMarkdown Preview:\n{doc.markdown_content[:1000]}...")
        else:
            print(f"Failed: {result.error}")
    else:
        print("Usage: python table_loader.py <excel_or_csv_file>")
