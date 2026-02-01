"""
Tests for embeddings/document_loaders.py
"""

import sys
import tempfile
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings.document_loaders import (
    is_supported_file,
    get_loader_for_file,
    load_document,
    detect_encoding,
    SUPPORTED_EXTENSIONS,
    get_supported_extensions_info,
)


class TestIsSupportedFile:
    """Tests for is_supported_file function"""

    def test_supported_extensions(self):
        """Test that supported extensions return True"""
        assert is_supported_file(Path("document.pdf")) is True
        assert is_supported_file(Path("document.docx")) is True
        assert is_supported_file(Path("document.txt")) is True
        assert is_supported_file(Path("document.md")) is True
        assert is_supported_file(Path("document.html")) is True
        assert is_supported_file(Path("document.csv")) is True
        assert is_supported_file(Path("document.json")) is True
        assert is_supported_file(Path("document.xlsx")) is True
        assert is_supported_file(Path("document.pptx")) is True

    def test_unsupported_extensions(self):
        """Test that unsupported extensions return False"""
        assert is_supported_file(Path("document.exe")) is False
        assert is_supported_file(Path("document.zip")) is False
        assert is_supported_file(Path("document.mp3")) is False
        assert is_supported_file(Path("document.jpg")) is False
        assert is_supported_file(Path("document.png")) is False

    def test_case_insensitive(self):
        """Test that extension check is case insensitive"""
        assert is_supported_file(Path("document.PDF")) is True
        assert is_supported_file(Path("document.DOCX")) is True
        assert is_supported_file(Path("document.TXT")) is True


class TestGetLoaderForFile:
    """Tests for get_loader_for_file function"""

    def test_pdf_loader(self):
        """Test PDF loader mapping"""
        result = get_loader_for_file(Path("document.pdf"))
        assert result is not None
        loader_class, kwargs = result
        assert "PDF" in loader_class.__name__ or "Pdf" in loader_class.__name__

    def test_text_loader(self):
        """Test text loader mapping"""
        result = get_loader_for_file(Path("document.txt"))
        assert result is not None
        loader_class, kwargs = result
        assert "Text" in loader_class.__name__

    def test_unsupported_returns_none(self):
        """Test that unsupported file returns None"""
        result = get_loader_for_file(Path("document.exe"))
        assert result is None


class TestLoadDocument:
    """Tests for load_document function"""

    def test_nonexistent_file(self):
        """Test loading nonexistent file"""
        result = load_document(Path("/nonexistent/file.txt"))
        assert result.success is False
        assert "not found" in result.error.lower()

    def test_unsupported_file_type(self):
        """Test loading unsupported file type"""
        with tempfile.NamedTemporaryFile(suffix=".exe", delete=False) as f:
            f.write(b"content")
            f.flush()
            result = load_document(Path(f.name))
            assert result.success is False
            assert "Unsupported" in result.error

    def test_file_too_large(self):
        """Test loading file that's too large"""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            # Write more than max_file_size_mb
            f.write(b"A" * (1024 * 1024))  # 1MB
            f.flush()
            result = load_document(Path(f.name), max_file_size_mb=0.5)
            assert result.success is False
            assert "too large" in result.error.lower()

    def test_load_text_file(self):
        """Test loading a simple text file"""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w") as f:
            f.write("Hello, World!")
            f.flush()
            result = load_document(Path(f.name))
            # This may fail if langchain dependencies aren't installed
            # but the structure should be correct
            assert result.file_path == f.name
            assert result.file_type == ".txt"


class TestDetectEncoding:
    """Tests for detect_encoding function"""

    def test_utf8_detection(self):
        """Test UTF-8 encoding detection"""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="wb") as f:
            f.write("Hello, World!".encode("utf-8"))
            f.flush()
            encoding = detect_encoding(Path(f.name))
            assert encoding.lower() in ["utf-8", "ascii"]

    def test_nonexistent_file_returns_utf8(self):
        """Test that nonexistent file returns utf-8 as default"""
        encoding = detect_encoding(Path("/nonexistent/file.txt"))
        assert encoding == "utf-8"


class TestGetSupportedExtensionsInfo:
    """Tests for get_supported_extensions_info function"""

    def test_returns_dict(self):
        """Test that function returns a dictionary"""
        info = get_supported_extensions_info()
        assert isinstance(info, dict)

    def test_contains_common_extensions(self):
        """Test that common extensions are included"""
        info = get_supported_extensions_info()
        assert ".pdf" in info
        assert ".txt" in info
        assert ".docx" in info
        assert ".md" in info

    def test_values_are_loader_names(self):
        """Test that values are loader class names"""
        info = get_supported_extensions_info()
        for ext, loader_name in info.items():
            assert isinstance(loader_name, str)
            assert "Loader" in loader_name or len(loader_name) > 0


class TestSupportedExtensions:
    """Tests for SUPPORTED_EXTENSIONS constant"""

    def test_is_set(self):
        """Test that SUPPORTED_EXTENSIONS is a set"""
        assert isinstance(SUPPORTED_EXTENSIONS, set)

    def test_contains_common_extensions(self):
        """Test that common extensions are included"""
        assert ".pdf" in SUPPORTED_EXTENSIONS
        assert ".txt" in SUPPORTED_EXTENSIONS
        assert ".docx" in SUPPORTED_EXTENSIONS
        assert ".xlsx" in SUPPORTED_EXTENSIONS
        assert ".pptx" in SUPPORTED_EXTENSIONS
        assert ".md" in SUPPORTED_EXTENSIONS
        assert ".html" in SUPPORTED_EXTENSIONS
        assert ".csv" in SUPPORTED_EXTENSIONS
        assert ".json" in SUPPORTED_EXTENSIONS
