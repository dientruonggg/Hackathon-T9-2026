from typing import Optional

class LearnerProfile:
    def __init__(self, user_id: str, goals: str):
        self.user_id = user_id
        self.goals = goals

class KnowledgeState:
    def __init__(self, user_id: str, concept: str, mastery_score: int):
        self.user_id = user_id
        self.concept = concept
        self.mastery_score = mastery_score
