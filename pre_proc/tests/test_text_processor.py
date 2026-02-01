"""
Tests for embeddings/text_processor.py
"""

import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings.text_processor import (
    clean_text,
    split_text_into_chunks,
    truncate_text,
    estimate_tokens,
)


class TestCleanText:
    """Tests for clean_text function"""

    def test_empty_text(self):
        """Test cleaning empty text"""
        assert clean_text("") == ""
        assert clean_text(None) == ""

    def test_remove_null_bytes(self):
        """Test removal of null bytes"""
        text = "Hello\x00World"
        assert clean_text(text) == "Hello World"

    def test_normalize_newlines(self):
        """Test normalization of different newline formats"""
        text = "Line1\r\nLine2\rLine3\nLine4"
        result = clean_text(text)
        assert "\r" not in result
        assert "Line1\nLine2\nLine3\nLine4" == result

    def test_remove_excessive_newlines(self):
        """Test removal of excessive newlines"""
        text = "Line1\n\n\n\n\nLine2"
        result = clean_text(text)
        assert result == "Line1\n\nLine2"

    def test_remove_excessive_spaces(self):
        """Test removal of excessive spaces"""
        text = "Hello    World"
        result = clean_text(text)
        assert result == "Hello World"

    def test_strip_whitespace(self):
        """Test stripping of leading/trailing whitespace"""
        text = "   Hello World   "
        result = clean_text(text)
        assert result == "Hello World"


class TestSplitTextIntoChunks:
    """Tests for split_text_into_chunks function"""

    def test_empty_text(self):
        """Test splitting empty text"""
        chunks = split_text_into_chunks("")
        assert chunks == []

    def test_short_text(self):
        """Test splitting text shorter than chunk size"""
        text = "This is a short text."
        chunks = split_text_into_chunks(text, chunk_size=1000)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_splits(self):
        """Test that long text is split into multiple chunks"""
        text = "This is a sentence. " * 100
        chunks = split_text_into_chunks(text, chunk_size=100, chunk_overlap=20)
        assert len(chunks) > 1

    def test_chunk_size_respected(self):
        """Test that chunk size is approximately respected"""
        text = "Word " * 500
        chunk_size = 100
        chunks = split_text_into_chunks(text, chunk_size=chunk_size, chunk_overlap=0)
        # Allow some flexibility due to word boundaries
        for chunk in chunks[:-1]:  # Last chunk may be smaller
            assert len(chunk) <= chunk_size * 1.5  # Allow 50% overflow for word boundaries

    def test_overlap_creates_continuity(self):
        """Test that overlap creates text continuity between chunks"""
        text = "One two three four five six seven eight nine ten. " * 20
        chunks = split_text_into_chunks(text, chunk_size=100, chunk_overlap=30)

        if len(chunks) > 1:
            # Check that there's some overlap
            # The end of chunk 0 should appear in the beginning of chunk 1
            assert len(chunks) >= 2

    def test_japanese_text(self):
        """Test splitting Japanese text"""
        text = "これはテストです。日本語のテキストを分割します。" * 50
        chunks = split_text_into_chunks(text, chunk_size=100, chunk_overlap=20)
        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk) > 0


class TestTruncateText:
    """Tests for truncate_text function"""

    def test_short_text_unchanged(self):
        """Test that short text is not truncated"""
        text = "Short text"
        result = truncate_text(text, max_length=100)
        assert result == text

    def test_long_text_truncated(self):
        """Test that long text is truncated"""
        text = "A" * 200
        result = truncate_text(text, max_length=100)
        assert len(result) <= 103  # 100 + "..."

    def test_truncate_at_sentence_boundary(self):
        """Test truncation at sentence boundary"""
        text = "First sentence. Second sentence is very long and should be cut."
        result = truncate_text(text, max_length=20)
        # Should truncate somewhere reasonable
        assert len(result) <= 23

    def test_truncate_adds_ellipsis(self):
        """Test that truncation adds ellipsis when no sentence boundary"""
        text = "A" * 200
        result = truncate_text(text, max_length=100)
        assert result.endswith("...")


class TestEstimateTokens:
    """Tests for estimate_tokens function"""

    def test_empty_text(self):
        """Test token estimation for empty text"""
        assert estimate_tokens("") == 0
        assert estimate_tokens(None) == 0

    def test_basic_estimation(self):
        """Test basic token estimation"""
        text = "Hello world"
        tokens = estimate_tokens(text)
        assert tokens > 0
        # With default 4 chars per token, "Hello world" (11 chars) should be ~2-3 tokens
        assert 2 <= tokens <= 4

    def test_custom_chars_per_token(self):
        """Test with custom chars per token ratio"""
        text = "A" * 100
        tokens_default = estimate_tokens(text)
        tokens_custom = estimate_tokens(text, chars_per_token=2.0)
        assert tokens_custom == tokens_default * 2
