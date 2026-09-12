import asyncio
from src.learning_companion.main import startup_event, chat_webhook
from src.learning_companion.presentation.api.schemas.chat import ChatRequest

async def run_test():
    print("=== 1. STARTING FASTAPI SYSTEM ===")
    startup_event()
    
    print("\n=== 2. INCOMING WEBHOOK FROM DISCORD ===")
    req = ChatRequest(user_id="hackathon_user", message="Hello, I want to learn Python!", platform="discord")
    print(f"Payload: {req.dict()}")
    
    print("\n=== 3. SYSTEM PROCESSING CHAIN ===")
    response = await chat_webhook(req)
    
    print("\n=== 4. FINAL RESPONSE SENT TO USER ===")
    print(response.response_text)

if __name__ == "__main__":
    asyncio.run(run_test())
