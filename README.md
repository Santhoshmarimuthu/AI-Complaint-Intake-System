# AI Complaint Intake System

An AI-powered complaint intake and management system that accepts complaint information through text or uploaded files, extracts structured complaint data, performs AI-based analysis, and stores submitted complaints in PostgreSQL.

## Features

"""
- Text-based complaint intake
- Upload complaints as PDF, DOCX, TXT, EML, and image files
- OCR using EasyOCR for image-based complaints
- PDF text extraction using PyMuPDF
- AI-powered complaint extraction and editing
- Stateful conversations using LangGraph
- AI risk assessment
- Complaint completeness checking
- Detailed complaint summary
- Existing complaint search and loading
- Duplicate complaint detection
- PostgreSQL storage after final submission
- Downloadable complaint form
- React and Redux frontend
- FastAPI backend
- Groq LLM integration
"""


## Project Structure

```text
ai-complaint-intake/
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── index.html
├── backend/
│   ├── api.py
│   ├── graph.py
│   ├── groq_agent.py
│   ├── database.py
│   ├── extractor.py
│   ├── requirements.txt
│   └── .env.example
└── README.md
```

## Backend Setup

Open a terminal inside the `backend` folder:

```bash
pip install -r requirements.txt
```

Create a `.env` file inside `backend`:

```env
GROQ_API_KEY=your_groq_api_key

DB_HOST=localhost
DB_PORT=5432
DB_NAME=complaints_db
DB_USER=postgres
DB_PASSWORD=your_postgresql_password
```

Make sure PostgreSQL is installed and the database specified by `DB_NAME` exists.

Start the backend:

```bash
uvicorn api:app --reload
```

The backend normally runs at:

```text
http://127.0.0.1:8000
```

## Frontend Setup

Open another terminal inside the `frontend` folder.

Install the dependencies:

```bash
npm install
```

Then start the frontend:

```bash
npm run dev
```

### Important Frontend Note

If you are using the provided frontend source code, first run `npm install` in the existing Vite frontend project.

Then replace the existing `src` folder with the provided `src` folder.

You only need to replace:

```text
frontend/src/
```

Do not replace `package.json`, `vite.config.js`, or `index.html` if your existing Vite project already contains them.

After replacing `src`, run:

```bash
npm run dev
```


## Technologies

### Frontend

- React
- Redux
- Vite
- JavaScript
- CSS
- jsPDF

### Backend

- Python
- FastAPI
- LangGraph
- Groq
- Llama
- PostgreSQL
- Psycopg2
- PyMuPDF
- EasyOCR
- python-docx

## Input Formats

The application supports:

- PDF
- DOCX
- TXT
- EML
- PNG
- JPG
- JPEG
- BMP
- WEBP


