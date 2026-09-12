from .tools.knowledge_tools import get_learner_profile, set_learner_profile, get_knowledge_state, set_knowledge_state

def init_root_agent():
    """
    Initialize the Google ADK Root Agent with explicit instructions.
    NOTE: Replace this block with actual Google ADK initialization code
    once the ADK package is installed in your environment.
    """
    print('🔵 CALLED: agent/root_agent.py -> init_root_agent')
    print("Google ADK Agent Initialized with tools:")
    print("- get_learner_profile")
    print("- set_learner_profile")
    print("- get_knowledge_state")
    print("- set_knowledge_state")

def chat_with_agent(user_id: str, message: str) -> str:
    """
    Simulated agent response for the Hackathon MVP.
    When ADK is configured, pass `message` to the ADK session here.
    """
    print('🔵 CALLED: agent/root_agent.py -> chat_with_agent')
    get_learner_profile(user_id)
    get_knowledge_state(user_id, "test_concept")
    return f"[Agent via ADK]: I received your message: '{message}'. (My ADK integration needs your Gemini API key!)"
