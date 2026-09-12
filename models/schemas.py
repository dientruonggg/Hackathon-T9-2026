from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    user_id: str
    message: str
    platform: str # 'discord' or 'zalo'

class ChatResponse(BaseModel):
    response_text: str

class KnowledgeStateDTO(BaseModel):
    user_id: str
    concept: str
    mastery_level: int
