from fastapi import FastAPI
from .presentation.api.schemas.chat import ChatRequest, ChatResponse
from .agent.root_agent import init_root_agent, chat_with_agent
from .infrastructure.db.sqlite import init_sqlite_db

app = FastAPI(title="Learning Companion API")

@app.on_event("startup")
def startup_event():
    """Run database and agent initialization on startup."""
    init_sqlite_db()
    init_root_agent()

@app.post("/webhook/chat", response_model=ChatResponse)
async def chat_webhook(request: ChatRequest):
    """Presentation Layer HTTP endpoint for Webhooks (Discord/Zalo)."""
    # In a production app, verify the webhook signature here for security.
    
    # Process message through the agent
    reply = chat_with_agent(request.user_id, request.message)
    
    return ChatResponse(response_text=reply)
