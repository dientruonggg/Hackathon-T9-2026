from ...infrastructure.db.sqlite import get_user_goal, set_user_goal, update_knowledge, check_knowledge

def get_learner_profile(user_id: str) -> str:
    """Tool: Get the user's current goal to understand their context."""
    goal = get_user_goal(user_id)
    return f"The learner's current goal is: {goal}"

def set_learner_profile(user_id: str, goal: str) -> str:
    """Tool: Set the user's learning goal."""
    set_user_goal(user_id, goal)
    return f"Successfully set goal to: {goal}"

def get_knowledge_state(user_id: str, concept: str) -> str:
    """Tool: Check if the user understands a specific concept."""
    score = check_knowledge(user_id, concept)
    return f"Mastery score for '{concept}' is {score}/10."

def set_knowledge_state(user_id: str, concept: str, mastery_level: int) -> str:
    """Tool: Update the user's knowledge state."""
    update_knowledge(user_id, concept, mastery_level)
    return f"Successfully updated '{concept}' mastery to {mastery_level}/10."
