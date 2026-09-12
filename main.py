from fastapi import FastAPI
from models.schemas import ChatRequest, ChatResponse
from agent.core_agent import init_agent, chat_with_agent
from db.database import init_db

app = FastAPI()

@app.on_event("startup")
def startup_event():
    """Run database and agent initialization on startup."""
    init_db()
    init_agent()

@app.post("/webhook/discord", response_model=ChatResponse)
async def discord_webhook(request: ChatRequest):
    """Receive message from Discord, process via Agent, return response."""
    pass

@app.post("/webhook/zalo", response_model=ChatResponse)
async def zalo_webhook(request: ChatRequest):
    """Receive message from Zalo, process via Agent, return response."""
    pass
