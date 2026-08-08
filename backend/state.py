from typing import Dict, List, TypedDict


class ComplaintState(TypedDict):
    complaint_json: dict
    user_input: str
    assistant_message: str
    conversation: List[Dict[str, str]]
    risk_assessment: dict
    completeness: dict
    complaint_summary: str
    submitted: bool
    db_result: dict
