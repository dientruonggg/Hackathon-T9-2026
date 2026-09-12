def init_db():
    """Initialize SQLite database and create tables."""
    pass

def get_user_goal(user_id: str) -> str:
    """Fetch the user's learning goal from the database."""
    pass

def update_knowledge(user_id: str, concept: str, level: int):
    """Upsert the mastery level of a concept for a user in the database."""
    pass

def check_knowledge(user_id: str, concept: str) -> int:
    """Return the mastery level for a concept from the database."""
    pass
