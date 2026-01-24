"""
External Research Search Services

OpenAlex, Semantic Scholar, arXiv から論文を検索
"""

import asyncio
from typing import Optional
from dataclasses import dataclass, field
import re

import httpx


@dataclass
class ExternalPaper:
    """External paper data"""
    title: str
    abstract: str
    authors: list[str]
    year: str
    source: str
    url: str
    citations: Optional[int] = None
    id: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "abstract": self.abstract,
            "authors": self.authors,
            "year": self.year,
            "source": self.source,
            "url": self.url,
            "citations": self.citations,
        }


async def search_openalex(query: str, timeout: int = 15) -> list[ExternalPaper]:
    """
    Search OpenAlex for papers

    Args:
        query: Search query
        timeout: Request timeout in seconds

    Returns:
        List of ExternalPaper
    """
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                "https://api.openalex.org/works",
                params={
                    "search": query,
                    "per-page": 10,
                    "sort": "cited_by_count:desc",
                },
                headers={
                    "User-Agent": "Research-Hub/1.0 (mailto:research@example.com)"
                },
            )

            if response.status_code != 200:
                print(f"OpenAlex API error: {response.status_code}")
                return []

            data = response.json()
            papers = []

            for work in data.get("results", []):
                # Only include papers with open access URL
                oa_url = work.get("open_access", {}).get("oa_url")
                if not oa_url:
                    continue

                papers.append(
                    ExternalPaper(
                        title=work.get("title") or "No title",
                        abstract=work.get("abstract") or work.get("display_name") or "",
                        authors=[
                            a.get("author", {}).get("display_name", "Unknown")
                            for a in work.get("authorships", [])[:3]
                        ],
                        year=str(work.get("publication_year", "N/A")),
                        source="OpenAlex",
                        url=oa_url,
                        citations=work.get("cited_by_count"),
                    )
                )

                if len(papers) >= 3:
                    break

            return papers

    except Exception as e:
        print(f"OpenAlex search failed: {e}")
        return []


async def search_semantic_scholar(query: str, timeout: int = 15) -> list[ExternalPaper]:
    """
    Search Semantic Scholar for papers

    Args:
        query: Search query
        timeout: Request timeout in seconds

    Returns:
        List of ExternalPaper
    """
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                params={
                    "query": query,
                    "limit": 10,
                    "fields": "title,abstract,year,authors,venue,citationCount,openAccessPdf",
                },
                headers={"User-Agent": "Research-Hub/1.0"},
            )

            if response.status_code != 200:
                print(f"Semantic Scholar API error: {response.status_code}")
                return []

            data = response.json()
            papers = []

            for paper in data.get("data", []):
                # Only include papers with open access PDF
                oa_pdf = paper.get("openAccessPdf", {})
                if not oa_pdf or not oa_pdf.get("url"):
                    continue

                papers.append(
                    ExternalPaper(
                        title=paper.get("title") or "No title",
                        abstract=paper.get("abstract") or "",
                        authors=[a.get("name", "") for a in paper.get("authors", [])[:3]],
                        year=str(paper.get("year", "N/A")),
                        source="Semantic Scholar",
                        url=oa_pdf["url"],
                        citations=paper.get("citationCount"),
                    )
                )

                if len(papers) >= 3:
                    break

            return papers

    except Exception as e:
        print(f"Semantic Scholar search failed: {e}")
        return []


async def search_arxiv(query: str, timeout: int = 15) -> list[ExternalPaper]:
    """
    Search arXiv for papers

    Args:
        query: Search query
        timeout: Request timeout in seconds

    Returns:
        List of ExternalPaper
    """
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                "http://export.arxiv.org/api/query",
                params={
                    "search_query": f"all:{query}",
                    "start": 0,
                    "max_results": 3,
                },
            )

            if response.status_code != 200:
                print(f"arXiv API error: {response.status_code}")
                return []

            text = response.text
            papers = []

            # Parse XML response
            entries = re.findall(r"<entry>[\s\S]*?</entry>", text)

            for entry in entries:
                title_match = re.search(r"<title>(.*?)</title>", entry, re.DOTALL)
                abstract_match = re.search(r"<summary>(.*?)</summary>", entry, re.DOTALL)
                published_match = re.search(r"<published>(.*?)</published>", entry)
                id_match = re.search(r"<id>(.*?)</id>", entry)
                author_matches = re.findall(r"<name>(.*?)</name>", entry)

                title = title_match.group(1).replace("\n", " ").strip() if title_match else "No title"
                abstract = abstract_match.group(1).replace("\n", " ").strip() if abstract_match else ""
                year = published_match.group(1)[:4] if published_match else "N/A"
                arxiv_id = id_match.group(1) if id_match else ""

                # Convert abs URL to PDF URL
                url = arxiv_id.replace("/abs/", "/pdf/") + ".pdf" if arxiv_id else ""

                papers.append(
                    ExternalPaper(
                        title=title,
                        abstract=abstract,
                        authors=author_matches[:3],
                        year=year,
                        source="arXiv",
                        url=url,
                    )
                )

            return papers

    except Exception as e:
        print(f"arXiv search failed: {e}")
        return []


async def search_all_sources(query: str) -> list[ExternalPaper]:
    """
    Search all external sources in parallel

    Args:
        query: Search query

    Returns:
        Combined list of papers, sorted by citations
    """
    results = await asyncio.gather(
        search_openalex(query),
        search_semantic_scholar(query),
        search_arxiv(query),
    )

    all_papers = []
    for papers in results:
        all_papers.extend(papers)

    # Sort by citations (descending) and limit to 5
    all_papers.sort(key=lambda p: p.citations or 0, reverse=True)

    # Assign IDs
    for i, paper in enumerate(all_papers[:5], start=1):
        paper.id = i

    return all_papers[:5]
