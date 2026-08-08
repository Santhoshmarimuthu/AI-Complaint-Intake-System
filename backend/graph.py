from langgraph.graph import END, StateGraph

from database import save_complaint
from groq_agent import extract_or_update
from state import ComplaintState


def llm_node(state: ComplaintState):
    result = extract_or_update(
        state["user_input"],
        state["complaint_json"],
        state.get("conversation", []),
    )

    conversation = list(state.get("conversation", []))

    conversation.append(
        {
            "role": "user",
            "content": state["user_input"],
        }
    )

    conversation.append(
        {
            "role": "assistant",
            "content": result["reply"],
        }
    )

    return {
        "complaint_json": result["json"],
        "assistant_message": result["reply"],
        "conversation": conversation,
        "risk_assessment": result.get(
            "risk_assessment",
            {
                "level": "Unknown",
                "reason": "Insufficient information.",
            },
        ),
        "complaint_summary": result.get(
            "complaint_summary",
            "",
        ),
    }


def submit_node(state: ComplaintState):
    return {
        "db_result": save_complaint(
            state["complaint_json"]
        )
    }


def router(state: ComplaintState):
    if state.get("submitted", False):
        return "submit"

    return END


builder = StateGraph(ComplaintState)

builder.add_node("llm", llm_node)
builder.add_node("submit", submit_node)

builder.set_entry_point("llm")

builder.add_conditional_edges(
    "llm",
    router,
    {
        "submit": "submit",
        END: END,
    },
)

builder.add_edge("submit", END)

graph = builder.compile()
