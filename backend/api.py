import os
import uuid
from typing import Dict, Optional

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    get_complaint,
    initialize_database,
    save_complaint,
    search_complaints,
)
from extractor import extract_text
from graph import graph


app = FastAPI(title="AI Complaint Intake API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


sessions: Dict[str, dict] = {}


def empty_complaint():
    return {
        "complaint_source": "",
        "customer_name": "",
        "product_name": "",
        "product_strength_grade": "",
        "batch_lot_number": "",
        "manufacturing_date": "",
        "expiry_date": "",
        "quantity_affected": "",
        "complaint_type": "",
        "complaint_date": "",
        "detailed_complaint_description": "",
        "initial_severity": "",
        "priority": "",
    }


def new_state(complaint: Optional[dict] = None):
    return {
        "complaint_json": {
            **empty_complaint(),
            **(complaint or {}),
        },
        "user_input": "",
        "assistant_message": "",
        "conversation": [],
        "risk_assessment": {
            "level": "Unknown",
            "reason": (
                "No complaint information has been provided yet."
            ),
        },
        "completeness": {},
        "complaint_summary": "",
        "submitted": False,
        "db_result": {},
    }


def completeness_for(data: dict):
    required_fields = [
        "complaint_source",
        "customer_name",
        "product_name",
        "product_strength_grade",
        "batch_lot_number",
        "manufacturing_date",
        "expiry_date",
        "quantity_affected",
        "complaint_type",
        "complaint_date",
        "detailed_complaint_description",
    ]

    missing_fields = [
        field
        for field in required_fields
        if not str(data.get(field, "") or "").strip()
    ]

    filled = len(required_fields) - len(missing_fields)

    return {
        "percentage": round(
            (filled / len(required_fields)) * 100
        ),
        "missing_fields": missing_fields,
    }


def response_from_state(session_id: str, state: dict):
    return {
        "session_id": session_id,
        "reply": state.get("assistant_message", ""),
        "json": state.get("complaint_json", {}),
        "risk_assessment": state.get(
            "risk_assessment",
            {},
        ),
        "completeness": completeness_for(
            state.get("complaint_json", {})
        ),
        "complaint_summary": state.get(
            "complaint_summary",
            "",
        ),
    }


def run_input(session_id: str, user_input: str):
    if session_id not in sessions:
        sessions[session_id] = new_state()

    state = sessions[session_id]
    state["user_input"] = user_input
    state["submitted"] = False
    state["db_result"] = {}

    result = graph.invoke(state)

    sessions[session_id] = result

    return response_from_state(
        session_id,
        result,
    )


@app.on_event("startup")
def startup():
    initialize_database()


class TextInput(BaseModel):
    text: str
    session_id: Optional[str] = None


class ChatInput(BaseModel):
    session_id: str
    message: str


class SubmitInput(BaseModel):
    session_id: str


@app.post("/api/complaint/text")
def complaint_text(body: TextInput):
    text = body.text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty.",
        )

    session_id = body.session_id or str(uuid.uuid4())

    return run_input(
        session_id,
        text,
    )


@app.post("/api/complaint/upload")
async def complaint_upload(
    file: UploadFile = File(...),
    session_id: Optional[str] = None,
):
    allowed = {
        ".pdf",
        ".docx",
        ".txt",
        ".eml",
        ".png",
        ".jpg",
        ".jpeg",
        ".bmp",
        ".webp",
    }

    extension = os.path.splitext(
        file.filename or ""
    )[1].lower()

    if extension not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {extension}",
        )

    session_id = session_id or str(uuid.uuid4())

    temp_path = (
        f"_upload_{uuid.uuid4().hex}{extension}"
    )

    with open(temp_path, "wb") as temp_file:
        temp_file.write(await file.read())

    try:
        text = extract_text(temp_path)

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="No readable text was found in the file.",
            )

        return run_input(
            session_id,
            text,
        )

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/api/complaint/chat")
def complaint_chat(body: ChatInput):
    if body.session_id not in sessions:
        raise HTTPException(
            status_code=404,
            detail="Complaint session not found.",
        )

    message = body.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    return run_input(
        body.session_id,
        message,
    )


@app.get("/api/complaint/search")
def complaint_search(
    q: str = Query(""),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        complaints = search_complaints(
            q,
            limit,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Database search failed: {exc}",
        ) from exc

    return {
        "complaints": complaints,
    }


@app.get("/api/complaint/{complaint_id}")
def complaint_by_id(complaint_id: int):
    complaint = get_complaint(complaint_id)

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found.",
        )

    return {
        "complaint": complaint,
    }


@app.post("/api/complaint/load/{complaint_id}")
def load_complaint(complaint_id: int):
    complaint = get_complaint(complaint_id)

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found.",
        )

    session_id = str(uuid.uuid4())

    state = new_state(complaint)

    state["conversation"] = [
        {
            "role": "system",
            "content": (
                f"Loaded existing complaint "
                f"ID {complaint_id} for review."
            ),
        }
    ]

    state["complaint_summary"] = (
        "Existing complaint loaded from PostgreSQL. "
        "Continue the conversation to review or correct it."
    )

    sessions[session_id] = state

    return response_from_state(
        session_id,
        state,
    ) | {
        "complaint_id": complaint_id,
    }


@app.post("/api/complaint/submit")
def complaint_submit(body: SubmitInput):
    if body.session_id not in sessions:
        raise HTTPException(
            status_code=404,
            detail="Complaint session not found.",
        )

    state = sessions[body.session_id]

    result = save_complaint(
        state["complaint_json"]
    )

    state["db_result"] = result

    # Keep the current state and conversation when duplicate.
    # Only a successful submission is marked as submitted.
    state["submitted"] = bool(
        result.get("success")
    )

    sessions[body.session_id] = state

    return {
        "reply": result.get(
            "message",
            "",
        ),
        "result": result,
        "json": state["complaint_json"],
        "risk_assessment": state.get(
            "risk_assessment",
            {},
        ),
        "completeness": completeness_for(
            state["complaint_json"]
        ),
        "complaint_summary": state.get(
            "complaint_summary",
            "",
        ),
    }
