# Research Hub Backend

FastAPI backend for Research Hub application.

## Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Environment Variables

Create a `.env` file in the project root with:

```env
LLM_BASE_URL=https://your-llm-api-endpoint.com
LLM_API_KEY=your-api-key
LLM_MODEL=vertex_ai.gemini-2.5-flash
```

## Run

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Or:

```bash
cd backend
python -m app.main
```

## API Endpoints

- `GET /` - Health check
- `GET /health` - Health check
- `POST /api/research-chat` - Main chat endpoint (SSE streaming)

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI entry point
│   ├── config.py         # Environment settings
│   ├── routers/
│   │   └── research_chat.py  # /api/research-chat endpoint
│   ├── services/
│   │   ├── llm_client.py     # LLM API client
│   │   ├── external_search.py # OpenAlex, Semantic Scholar, arXiv
│   │   └── mock_data.py      # Mock data for employees, research
│   └── models/
│       └── schemas.py        # Pydantic models
├── data/                 # JSON data storage
├── requirements.txt
└── README.md
```
