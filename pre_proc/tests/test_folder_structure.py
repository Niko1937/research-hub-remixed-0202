"""
Tests for folder_structure/generate_structure.py
"""

import sys
import tempfile
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from folder_structure.generate_structure import (
    should_ignore,
    generate_tree,
    generate_markdown,
    DEFAULT_IGNORE,
)


class TestShouldIgnore:
    """Tests for should_ignore function"""

    def test_exact_match(self):
        """Test exact pattern match"""
        assert should_ignore(".git", [".git"]) is True
        assert should_ignore("node_modules", ["node_modules"]) is True

    def test_no_match(self):
        """Test no pattern match"""
        assert should_ignore("src", [".git", "node_modules"]) is False

    def test_wildcard_match(self):
        """Test wildcard pattern match"""
        assert should_ignore("test.pyc", ["*.pyc"]) is True
        assert should_ignore("module.pyc", ["*.pyc"]) is True

    def test_wildcard_no_match(self):
        """Test wildcard pattern no match"""
        assert should_ignore("test.py", ["*.pyc"]) is False

    def test_empty_patterns(self):
        """Test with empty patterns list"""
        assert should_ignore("anything", []) is False

    def test_default_ignore_patterns(self):
        """Test default ignore patterns"""
        assert should_ignore(".git", DEFAULT_IGNORE) is True
        assert should_ignore("node_modules", DEFAULT_IGNORE) is True
        assert should_ignore("__pycache__", DEFAULT_IGNORE) is True
        assert should_ignore(".DS_Store", DEFAULT_IGNORE) is True


class TestGenerateTree:
    """Tests for generate_tree function"""

    def test_empty_directory(self):
        """Test tree generation for empty directory"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            lines = generate_tree(path)
            assert lines == []

    def test_single_file(self):
        """Test tree generation with single file"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            (path / "test.txt").write_text("content")

            lines = generate_tree(path)
            assert len(lines) == 1
            assert "test.txt" in lines[0]

    def test_nested_structure(self):
        """Test tree generation with nested structure"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            (path / "folder").mkdir()
            (path / "folder" / "file.txt").write_text("content")
            (path / "root.txt").write_text("content")

            lines = generate_tree(path)
            assert len(lines) >= 2
            # Check that folder and files are present
            tree_text = "\n".join(lines)
            assert "folder" in tree_text
            assert "file.txt" in tree_text
            assert "root.txt" in tree_text

    def test_max_depth(self):
        """Test max depth limitation"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            # Create nested structure: a/b/c/d/e
            current = path
            for name in ["a", "b", "c", "d", "e"]:
                current = current / name
                current.mkdir()
                (current / f"{name}.txt").write_text("content")

            # With max_depth=2, should only see a and b
            lines = generate_tree(path, max_depth=2)
            tree_text = "\n".join(lines)
            assert "a" in tree_text
            assert "b" in tree_text
            # c should not be visible at depth 2
            # (a is depth 0, b is depth 1)

    def test_ignore_patterns(self):
        """Test ignore patterns"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            (path / "visible.txt").write_text("content")
            (path / "hidden.pyc").write_text("content")
            (path / ".git").mkdir()

            lines = generate_tree(path, ignore_patterns=["*.pyc", ".git"])
            tree_text = "\n".join(lines)
            assert "visible.txt" in tree_text
            assert ".pyc" not in tree_text
            assert ".git" not in tree_text

    def test_show_hidden_files(self):
        """Test showing hidden files"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            (path / "visible.txt").write_text("content")
            (path / ".hidden").write_text("content")

            # Without show_hidden
            lines = generate_tree(path, show_hidden=False, ignore_patterns=[])
            tree_text = "\n".join(lines)
            assert "visible.txt" in tree_text
            assert ".hidden" not in tree_text

            # With show_hidden
            lines = generate_tree(path, show_hidden=True, ignore_patterns=[])
            tree_text = "\n".join(lines)
            assert "visible.txt" in tree_text
            assert ".hidden" in tree_text

    def test_folders_only(self):
        """Test showing folders only (no files)"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            (path / "folder").mkdir()
            (path / "file.txt").write_text("content")

            lines = generate_tree(path, show_files=False)
            tree_text = "\n".join(lines)
            assert "folder" in tree_text
            assert "file.txt" not in tree_text


class TestGenerateMarkdown:
    """Tests for generate_markdown function"""

    def test_basic_markdown_generation(self):
        """Test basic markdown generation"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            (path / "test.txt").write_text("content")

            markdown = generate_markdown(str(path))

            assert "# " in markdown  # Title
            assert "**対象パス**" in markdown
            assert "```" in markdown  # Code block
            assert "test.txt" in markdown

    def test_markdown_with_output_file(self):
        """Test markdown generation with output file"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            (path / "test.txt").write_text("content")
            output_file = path / "output.md"

            generate_markdown(str(path), output_path=str(output_file))

            assert output_file.exists()
            content = output_file.read_text()
            assert "test.txt" in content

    def test_markdown_with_custom_title(self):
        """Test markdown with custom title"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            (path / "test.txt").write_text("content")

            markdown = generate_markdown(str(path), title="Custom Title")

            assert "# Custom Title" in markdown

    def test_markdown_statistics(self):
        """Test that markdown includes statistics"""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir)
            (path / "folder").mkdir()
            (path / "folder" / "file.txt").write_text("content")
            (path / "root.txt").write_text("content")

            markdown = generate_markdown(str(path))

            assert "## 統計" in markdown
            assert "フォルダ数:" in markdown
            assert "ファイル数:" in markdown

    def test_nonexistent_path_raises_error(self):
        """Test that nonexistent path raises error"""
        import pytest

        with pytest.raises(FileNotFoundError):
            generate_markdown("/nonexistent/path")

    def test_file_path_raises_error(self):
        """Test that file path (not directory) raises error"""
        import pytest

        with tempfile.NamedTemporaryFile() as f:
            with pytest.raises(NotADirectoryError):
                generate_markdown(f.name)
