"""
Pre-proc Common Utilities

共通ユーティリティ関数
"""

from pathlib import Path
from typing import Optional


def extract_research_id(file_path: str, base_folder: str) -> str:
    """
    ファイルパスから研究IDを抽出する

    ベースフォルダの1階層下のフォルダ名から、
    先頭4桁のASCII英数字を抽出して研究IDとする。

    Args:
        file_path: ファイルの絶対パス
        base_folder: ベースフォルダのパス

    Returns:
        str: 研究ID（4桁以下のASCII英数字）、抽出できない場合は空文字

    Examples:
        >>> extract_research_id("/data/research/ABC123_project/docs/paper.pdf", "/data/research")
        'ABC1'
        >>> extract_research_id("/data/研究ABC123/file.pdf", "/data")
        'ABC1'
        >>> extract_research_id("/data/file.pdf", "/data")
        ''
    """
    try:
        rel_path = Path(file_path).relative_to(base_folder)
        parts = rel_path.parts

        if len(parts) >= 2:
            # 1階層下のフォルダ名を取得
            subfolder_name = parts[0]
            # ASCII英数字のみを抽出
            alphanumeric = "".join(c for c in subfolder_name if c.isascii() and c.isalnum())
            return alphanumeric[:4]
        else:
            return ""
    except ValueError:
        return ""


def extract_research_id_from_folder(folder_path: str, base_folder: str) -> str:
    """
    フォルダパスから研究IDを抽出する

    extract_research_idのフォルダ版。フォルダ自体の名前から研究IDを抽出。

    Args:
        folder_path: フォルダの絶対パス
        base_folder: ベースフォルダのパス

    Returns:
        str: 研究ID（4桁以下のASCII英数字）

    Examples:
        >>> extract_research_id_from_folder("/data/research/ABC123_project", "/data/research")
        'ABC1'
    """
    try:
        rel_path = Path(folder_path).relative_to(base_folder)
        parts = rel_path.parts

        if len(parts) >= 1:
            # フォルダ名を取得
            folder_name = parts[0]
            # ASCII英数字のみを抽出
            alphanumeric = "".join(c for c in folder_name if c.isascii() and c.isalnum())
            return alphanumeric[:4]
        else:
            return ""
    except ValueError:
        return ""


def truncate_text(text: str, max_length: int = 100000, suffix: str = "\n\n[...truncated...]") -> str:
    """
    テキストを最大長で切り詰める

    Args:
        text: 対象テキスト
        max_length: 最大長
        suffix: 切り詰め時に追加するサフィックス

    Returns:
        str: 切り詰められたテキスト
    """
    if len(text) <= max_length:
        return text
    return text[:max_length] + suffix


def safe_filename(name: str, max_length: int = 50) -> str:
    """
    ファイル名に使用できる安全な文字列に変換

    Args:
        name: 元の文字列
        max_length: 最大長

    Returns:
        str: 安全なファイル名
    """
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    return safe[:max_length]
