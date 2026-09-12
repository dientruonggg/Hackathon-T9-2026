from fastapi import FastAPI
from .presentation.api.schemas.chat import ChatRequest, ChatResponse
from .agent.root_agent import init_root_agent, chat_with_agent
from .infrastructure.db.sqlite import init_sqlite_db

app = FastAPI()

@app.on_event("startup")
def startup_event():
    init_sqlite_db()
    init_root_agent()

@app.post("/webhook/chat", response_model=ChatResponse)
async def chat_webhook(request: ChatRequest):
    """Presentation Layer HTTP endpoint."""
    pass
