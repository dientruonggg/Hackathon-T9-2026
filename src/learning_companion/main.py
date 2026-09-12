from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .presentation.api.schemas.chat import ChatRequest, ChatResponse
from .agent.root_agent import init_root_agent, chat_with_agent
from .infrastructure.db.sqlite import init_sqlite_db

app = FastAPI(title="Learning Companion API")

# Add CORS so the Firefox Extension can talk to localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow any origin (for the extension)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Run database and agent initialization on startup."""
    init_sqlite_db()
    init_root_agent()

@app.post("/webhook/chat", response_model=ChatResponse)
async def chat_webhook(request: ChatRequest):
    """Legacy Webhook for Discord/Zalo."""
    reply = chat_with_agent(request.user_id, request.message)
    return ChatResponse(response_text=reply)

@app.post("/api/chat", response_model=ChatResponse)
async def extension_chat(request: ChatRequest):
    """Direct API endpoint for the Firefox Extension."""
    reply = chat_with_agent(request.user_id, request.message)
    return ChatResponse(response_text=reply)
