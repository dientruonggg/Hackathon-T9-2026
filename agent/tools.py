from db.database import get_user_goal, update_knowledge, check_knowledge

def get_learner_profile(user_id: str) -> str:
    """Tool: Get the user's current goal to understand their context."""
    pass

def get_knowledge_state(user_id: str, concept: str) -> str:
    """Tool: Check if the user understands a specific concept."""
    pass

def set_knowledge_state(user_id: str, concept: str, mastery_level: int) -> str:
    """Tool: Update the user's knowledge state when they demonstrate understanding."""
    pass
