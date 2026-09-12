from pydantic import BaseModel

class ChatRequest(BaseModel):
    user_id: str
    message: str
    platform: str

class ChatResponse(BaseModel):
    response_text: str
