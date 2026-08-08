import json
import os

from groq import Groq


api_key = os.getenv("GROQ_API_KEY")


client = Groq(api_key=api_key)


SYSTEM_PROMPT = r"""
You are an AI Complaint Intake Assistant for a pharmaceutical quality
complaint system.

You maintain one complaint record across a conversation.

The user can:
1. Provide a new complaint as text, email, OCR text, or document text.
2. Correct or add information.
3. Ask a general question about the complaint.

COMPLAINT JSON RULES:
- Extract only information supported by the current input or existing record.
- Never invent values.
- Unknown values must remain "".
- On an edit, change only the relevant fields.
- Preserve all other existing values.
- Convert dates to YYYY-MM-DD when possible.
- Quantity should contain number + unit when available.
- Keep the exact field names provided in the required JSON.

AI RISK ASSESSMENT:
Assess the issue itself from the complaint information.

LOW:
Minor issue with little or no potential impact on product quality or safety.

MEDIUM:
Possible quality impact requiring investigation, without a clear immediate
safety concern.

HIGH:
Significant potential impact on product quality, product integrity, or
patient/customer safety.

CRITICAL:
Serious or potentially life-threatening safety concern, contamination,
wrong product/strength, serious adverse event, or similarly severe issue.

UNKNOWN:
There is not enough information to determine the risk.

Do not assign HIGH or CRITICAL without supporting information.

The risk assessment must contain:
- level
- reason

COMPLAINT SUMMARY:
Create a detailed summary that covers:
- all important information in the current complaint JSON
- important facts from the conversation
- corrections and additions made through the conversation
- the reported issue and context
- the current risk assessment

The summary must be understandable on its own.

REPLY:
- For a new complaint, briefly confirm what was extracted.
- For an edit, briefly confirm what was changed.
- For a general question, answer it without changing unrelated fields.

Return ONLY valid JSON using this exact structure:

{
  "reply": "",
  "json": {
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
    "priority": ""
  },
  "risk_assessment": {
    "level": "",
    "reason": ""
  },
  "complaint_summary": ""
}
"""


def extract_or_update(
    user_input: str,
    current_json: dict,
    conversation: list,
) -> dict:
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": (
                "CURRENT COMPLAINT JSON:\n"
                f"{json.dumps(current_json, indent=2)}\n\n"
                "CONVERSATION SO FAR:\n"
                f"{json.dumps(conversation, indent=2)}\n\n"
                "LATEST USER INPUT:\n"
                f"{user_input}"
            ),
        },
    ]

    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0,
        response_format={"type": "json_object"},
    )

    response = completion.choices[0].message.content

    try:
        result = json.loads(response)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Groq returned invalid JSON: {response}"
        ) from exc

    if "reply" not in result or "json" not in result:
        raise ValueError(
            "Invalid Groq response: reply/json missing."
        )

    result.setdefault(
        "risk_assessment",
        {
            "level": "Unknown",
            "reason": (
                "Insufficient information to determine complaint risk."
            ),
        },
    )

    result.setdefault("complaint_summary", "")

    return result
