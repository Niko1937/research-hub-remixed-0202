"""
Folder Structure Generator

指定したフォルダの階層構造をMarkdownファイル形式で出力するスクリプト
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional


# デフォルトで無視するフォルダ・ファイル
DEFAULT_IGNORE = [
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    ".DS_Store",
    "*.pyc",
    ".env",
    ".idea",
    ".vscode",
]


def should_ignore(name: str, ignore_patterns: list[str]) -> bool:
    """
    ファイル/フォルダを無視すべきか判定

    Args:
        name: ファイル/フォルダ名
        ignore_patterns: 無視するパターンのリスト

    Returns:
        bool: 無視すべき場合True
    """
    for pattern in ignore_patterns:
        if pattern.startswith("*"):
            # ワイルドカードパターン（例: *.pyc）
            if name.endswith(pattern[1:]):
                return True
        elif name == pattern:
            return True
    return False


def generate_tree(
    path: Path,
    prefix: str = "",
    ignore_patterns: list[str] = None,
    max_depth: Optional[int] = None,
    current_depth: int = 0,
    show_files: bool = True,
    show_hidden: bool = False,
) -> list[str]:
    """
    ディレクトリツリーを生成

    Args:
        path: 対象パス
        prefix: 行頭のプレフィックス
        ignore_patterns: 無視するパターン
        max_depth: 最大深度（Noneで無制限）
        current_depth: 現在の深度
        show_files: ファイルも表示するか
        show_hidden: 隠しファイルを表示するか

    Returns:
        list[str]: ツリー構造の行リスト
    """
    if ignore_patterns is None:
        ignore_patterns = DEFAULT_IGNORE

    if max_depth is not None and current_depth >= max_depth:
        return []

    lines = []

    try:
        entries = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
    except PermissionError:
        return [f"{prefix}[Permission Denied]"]

    # フィルタリング
    filtered_entries = []
    for entry in entries:
        # 隠しファイルのチェック
        if not show_hidden and entry.name.startswith("."):
            continue
        # 無視パターンのチェック
        if should_ignore(entry.name, ignore_patterns):
            continue
        # ファイル表示のチェック
        if not show_files and entry.is_file():
            continue
        filtered_entries.append(entry)

    for i, entry in enumerate(filtered_entries):
        is_last = i == len(filtered_entries) - 1
        connector = "└── " if is_last else "├── "
        extension = "    " if is_last else "│   "

        if entry.is_dir():
            lines.append(f"{prefix}{connector}{entry.name}/")
            lines.extend(
                generate_tree(
                    entry,
                    prefix + extension,
                    ignore_patterns,
                    max_depth,
                    current_depth + 1,
                    show_files,
                    show_hidden,
                )
            )
        else:
            lines.append(f"{prefix}{connector}{entry.name}")

    return lines


def generate_markdown(
    target_path: str,
    output_path: Optional[str] = None,
    max_depth: Optional[int] = None,
    show_files: bool = True,
    show_hidden: bool = False,
    ignore_patterns: list[str] = None,
    title: Optional[str] = None,
) -> str:
    """
    フォルダ構造をMarkdown形式で生成

    Args:
        target_path: 対象フォルダのパス
        output_path: 出力ファイルパス（Noneで標準出力）
        max_depth: 最大深度
        show_files: ファイルも表示するか
        show_hidden: 隠しファイルを表示するか
        ignore_patterns: 無視するパターン
        title: ドキュメントタイトル

    Returns:
        str: 生成されたMarkdown
    """
    path = Path(target_path).resolve()

    if not path.exists():
        raise FileNotFoundError(f"Path not found: {target_path}")

    if not path.is_dir():
        raise NotADirectoryError(f"Not a directory: {target_path}")

    if ignore_patterns is None:
        ignore_patterns = DEFAULT_IGNORE.copy()

    # タイトル生成
    doc_title = title or f"{path.name} フォルダ構造"

    # ツリー生成
    tree_lines = generate_tree(
        path,
        ignore_patterns=ignore_patterns,
        max_depth=max_depth,
        show_files=show_files,
        show_hidden=show_hidden,
    )

    # Markdown生成
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    markdown_lines = [
        f"# {doc_title}",
        "",
        f"**対象パス**: `{path}`",
        f"**生成日時**: {now}",
        "",
    ]

    # オプション情報
    options = []
    if max_depth:
        options.append(f"最大深度: {max_depth}")
    if not show_files:
        options.append("フォルダのみ表示")
    if show_hidden:
        options.append("隠しファイルを含む")

    if options:
        markdown_lines.append(f"**オプション**: {', '.join(options)}")
        markdown_lines.append("")

    markdown_lines.extend([
        "## ディレクトリ構造",
        "",
        "```",
        f"{path.name}/",
    ])
    markdown_lines.extend(tree_lines)
    markdown_lines.extend([
        "```",
        "",
    ])

    # 統計情報
    total_dirs = sum(1 for line in tree_lines if line.rstrip().endswith("/"))
    total_files = len(tree_lines) - total_dirs

    markdown_lines.extend([
        "## 統計",
        "",
        f"- フォルダ数: {total_dirs + 1}",  # +1 for root
        f"- ファイル数: {total_files}",
        "",
    ])

    markdown_content = "\n".join(markdown_lines)

    # 出力
    if output_path:
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(markdown_content, encoding="utf-8")
        print(f"Output saved to: {output_file}")

    return markdown_content


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="フォルダの階層構造をMarkdownファイル形式で出力",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # 基本的な使用方法（標準出力）
  python generate_structure.py /path/to/folder

  # ファイルに出力
  python generate_structure.py /path/to/folder -o structure.md

  # フォルダのみ表示（深度2まで）
  python generate_structure.py /path/to/folder --no-files --depth 2

  # 無制限の深度で取得
  python generate_structure.py /path/to/folder --depth 0

  # 隠しファイルも含めて表示
  python generate_structure.py /path/to/folder --hidden

  # 特定のパターンを追加で無視
  python generate_structure.py /path/to/folder --ignore "*.log" --ignore "tmp"
        """
    )

    parser.add_argument(
        "path",
        help="対象フォルダのパス"
    )
    parser.add_argument(
        "-o", "--output",
        help="出力ファイルパス（指定しない場合は標準出力）"
    )
    parser.add_argument(
        "-d", "--depth",
        type=int,
        default=4,
        help="最大深度（デフォルト: 4）"
    )
    parser.add_argument(
        "--no-files",
        action="store_true",
        help="フォルダのみ表示（ファイルを非表示）"
    )
    parser.add_argument(
        "--hidden",
        action="store_true",
        help="隠しファイル・フォルダも表示"
    )
    parser.add_argument(
        "--ignore",
        action="append",
        default=[],
        help="追加で無視するパターン（複数指定可）"
    )
    parser.add_argument(
        "--no-default-ignore",
        action="store_true",
        help="デフォルトの無視パターンを使用しない"
    )
    parser.add_argument(
        "-t", "--title",
        help="ドキュメントのタイトル"
    )

    args = parser.parse_args()

    # 無視パターンの設定
    if args.no_default_ignore:
        ignore_patterns = args.ignore
    else:
        ignore_patterns = DEFAULT_IGNORE.copy() + args.ignore

    # depth=0 は無制限として扱う
    max_depth = args.depth if args.depth != 0 else None

    try:
        markdown = generate_markdown(
            target_path=args.path,
            output_path=args.output,
            max_depth=max_depth,
            show_files=not args.no_files,
            show_hidden=args.hidden,
            ignore_patterns=ignore_patterns,
            title=args.title,
        )

        if not args.output:
            print(markdown)

    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except NotADirectoryError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
