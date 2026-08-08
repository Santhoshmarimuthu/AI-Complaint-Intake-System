import os

import easyocr
import pymupdf
from docx import Document


_reader = None


def _get_reader():
    global _reader

    if _reader is None:
        _reader = easyocr.Reader(["en"])

    return _reader


def extract_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        document = pymupdf.open(file_path)

        try:
            return "\n".join(page.get_text() for page in document)
        finally:
            document.close()

    if ext in [".png", ".jpg", ".jpeg", ".bmp", ".webp"]:
        result = _get_reader().readtext(file_path, detail=0)
        return "\n".join(result)

    if ext == ".docx":
        document = Document(file_path)
        return "\n".join(paragraph.text for paragraph in document.paragraphs)

    if ext in [".txt", ".eml"]:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as file:
            return file.read()

    raise ValueError(f"Unsupported file type: {ext}")
