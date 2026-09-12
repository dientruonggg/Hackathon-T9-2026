
# Learning Companion Agent — System Design & Engineering Specification

> **Document status:** Design baseline / source of truth for implementation  
> **Audience:** PO, PM, BA, AI Engineer, Backend Engineer, Frontend/Desktop Engineer, Infra/DevOps, QA, AI coding agents  
> **Primary implementation target:** Python + Google ADK + FastAPI, local-first desktop deployment with optional cloud control plane  
> **Design principle:** The LLM is the reasoning engine; the application owns state, tools, permissions, policies, events, storage, and UI effects.

---

# 0. Executive Summary

## 0.1 Product

Learning Companion Agent is a personal learning system for students and self-learners.

The product is **not** a normal chatbot and does not compete primarily by answering questions better.

Its core value is context:

```text
Goal
  ↓
Learning Roadmap
  ↓
Learning History
  ↓
Knowledge State
  ↓
Current Activity
  ↓
Current Situation
  ↓
Agent Decision
  ↓
Personalized Action
```

The original requirement explicitly defines the product around roadmap, knowledge state, current situation, context, intervention policy, memory, explainability, privacy, and project-based learning.

The system therefore needs more than:

```text
Frontend → LLM API
```

It needs:

```text
Data Sources
    ↓
Event Ingestion
    ↓
Signal Extraction
    ↓
Context Engine
    ↓
Learner State
    ↓
Policy / Decision Layer
    ↓
ADK Agent
    ↓
Tools / Actions
    ↓
User Interface
```

## 0.2 Core implementation decision

The MVP should be a **local-first companion application** running on the student's own computer.

Recommended topology:

```text
┌────────────────────────────────────────────────────┐
│                 STUDENT COMPUTER                   │
│                                                    │
│  ┌───────────────────┐                             │
│  │ Desktop UI        │                             │
│  │ Tauri / Web UI    │                             │
│  └────────┬──────────┘                             │
│           │ localhost                              │
│  ┌────────▼────────────────────────────┐           │
│  │ Local Companion Gateway             │           │
│  │ Python service                      │           │
│  │ - filesystem                       │           │
│  │ - browser events                   │           │
│  │ - local state                      │           │
│  │ - permission checks                │           │
│  └────────┬────────────────────────────┘           │
│           │                                        │
│  ┌────────▼────────────────────┐                   │
│  │ Agent Runtime               │                   │
│  │ Google ADK                  │                   │
│  │ - root agent                │                   │
│  │ - tools                     │                   │
│  │ - callbacks                 │                   │
│  │ - session / state           │                   │
│  └────────┬────────────────────┘                   │
│           │                                        │
│  ┌────────▼─────────────────────┐                  │
│  │ Local Data                   │                  │
│  │ SQLite/Postgres(optional)    │                  │
│  │ Vector index (optional)      │                  │
│  │ Local learning files         │                  │
│  └──────────────────────────────┘                  │
└────────────────────────────────────────────────────┘

                     optional
                        │
                        ▼
┌────────────────────────────────────────────────────┐
│                   CLOUD CONTROL PLANE              │
│                                                    │
│ Cloud Run / Agent Runtime                          │
│ - remote API                                       │
│ - shared model access                              │
│ - centralized observability                       │
│ - optional sync / backup                           │
└────────────────────────────────────────────────────┘
```

The first usable version does **not** need a large cloud architecture.

---

# 1. Product Scope

## 1.1 Product vision

The Agent should help the learner answer:

- Where am I?
- What do I already know?
- What am I weak at?
- What is blocking me now?
- Why do I need to learn this?
- What should I learn next?
- What project should I build?
- Why did the Agent make this recommendation?

## 1.2 Supported interactions

### Learning guidance

Examples:

```text
"I want to become an AI Engineer. What should I learn?"
"Can I learn Transformer before RNN?"
"What should I study today?"
"What project fits my current level?"
```

### Knowledge explanation

Examples:

```text
"What is LSTM?"
"Why does pooling reduce dimensions?"
"Attention vs Self-Attention?"
"Explain this code."
```

### Personal conversation

Examples:

```text
"I feel like I am learning too many things."
"I am stuck and don't know what to study."
"I am worried I am behind."
```

The system may respond as a mentor, but it must not fabricate personal knowledge.

---

# 2. Non-Goals for MVP

Do NOT attempt all of the following in the first release:

- complete monitoring of every application;
- reading private email;
- monitoring social media;
- screen recording;
- invasive keylogging;
- full browser history ingestion;
- automatic code modification;
- autonomous task execution without permission;
- full career/job recommendation engine;
- multi-agent swarm;
- fully autonomous background LLM loop;
- production-grade multi-region infrastructure.

The requirement explicitly emphasizes user permission, pause/delete controls, and privacy.

---

# 3. Actors

## 3.1 Student

Primary user.

Can:

- configure goals;
- configure data permissions;
- chat;
- inspect roadmap;
- inspect memory;
- accept/reject recommendations;
- delete memory;
- pause observation;
- run quizzes;
- inspect evidence behind recommendations.

## 3.2 Agent

AI component.

Can:

- reason;
- retrieve learner context;
- use tools;
- diagnose learning problems;
- recommend actions;
- explain recommendations;
- update approved learner state.

Cannot:

- bypass permissions;
- access arbitrary private data;
- silently modify protected state;
- claim certainty when evidence is weak.

## 3.3 Coding Agent

Examples:

- Claude Code
- Codex
- Cursor
- Gemini/Agents CLI environment

Its task is implementation according to this specification.

It must treat this file + `AGENTS.md` + feature specs as the source of truth.

## 3.4 Administrator / Developer

Can:

- inspect logs;
- inspect evaluation results;
- configure models;
- configure quotas;
- review failures;
- update prompt/version;
- run test/evaluation suites.

---

# 4. Architectural Principles

## 4.1 LLM is not the application

Never put core business rules only in prompts.

Bad:

```text
LLM decides whether browser data is allowed.
```

Good:

```text
PermissionService
    ↓
approved source?
    ↓
event accepted
```

Then the Agent reasons over approved context.

## 4.2 Deterministic code before probabilistic reasoning

Use ordinary code for:

- validation;
- permission checks;
- rate limits;
- event deduplication;
- retention rules;
- data deletion;
- authentication;
- policy constraints;
- schemas;
- database writes.

Use LLM for:

- understanding language;
- diagnosis;
- semantic classification;
- explanation;
- planning;
- recommendation.

## 4.3 Read tools and write tools are different

Read tools:

```text
get_profile()
get_current_state()
get_roadmap()
get_knowledge()
search_learning_history()
get_recent_events()
```

Write tools:

```text
record_learning_event()
update_knowledge_state()
save_memory()
create_learning_plan()
request_intervention()
```

Write tools require stronger validation.

## 4.4 No unrestricted "god tool"

Do not expose:

```python
execute_anything(command)
```

to the model.

Prefer small capability-specific tools.

## 4.5 Agent should fail safely

If evidence is insufficient:

```text
"I don't have enough evidence to conclude that you are struggling with this concept."
```

It should ask or observe rather than invent.

---

# 5. System Architecture

## 5.1 Logical components

```text
                    ┌────────────────────┐
                    │       Clients      │
                    │                    │
                    │ Desktop UI         │
                    │ Browser Extension  │
                    │ VS Code Extension  │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Local Gateway/API  │
                    │                    │
                    │ Auth               │
                    │ Event ingestion    │
                    │ Commands           │
                    │ WebSocket/SSE      │
                    └─────────┬──────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
      Context Engine     Learner Engine    Policy Engine
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                    ┌────────────────────┐
                    │ Google ADK Runtime │
                    │                    │
                    │ Root Agent         │
                    │ Sub-agents (later) │
                    │ Tools              │
                    │ Callbacks           │
                    └─────────┬──────────┘
                              │
                              ▼
                          LLM Model
                              │
                 ┌────────────┼─────────────┐
                 ▼            ▼             ▼
            PostgreSQL     Vector DB      Local DB
```

---

# 6. Deployment Modes

## 6.1 Mode A — Local-only

Everything runs on the user's machine.

```text
Desktop UI
   ↓
Local FastAPI
   ↓
ADK
   ↓
Local LLM (Ollama)
```

Advantages:

- privacy;
- works offline;
- filesystem access is natural;
- no backend hosting cost;
- ideal for development.

Disadvantages:

- hardware dependent;
- model quality can be weaker;
- harder to synchronize across machines.

Ollama provides a local API and supports tool calling and structured outputs for compatible models. It is therefore a viable local inference adapter for development and privacy-oriented deployments.

References:
- https://ollama.com/blog/tool-support
- https://docs.ollama.com/capabilities/structured-outputs

## 6.2 Mode B — Local gateway + cloud Agent

Recommended hybrid architecture.

```text
Local:
filesystem
browser
events
permissions
UI

Cloud:
ADK
LLM
central memory (optional)
observability
```

Sensitive raw data should remain local whenever possible.

Instead of sending:

```text
full browser history
```

send:

```json
{
  "topic": "attention",
  "event_type": "repeated_search",
  "count": 4,
  "time_window_minutes": 35
}
```

## 6.3 Mode C — Fully cloud

Future option.

Only consider when:

- user consent is strong;
- sync is required;
- multi-device support matters;
- infrastructure budget exists.

---

# 7. Google ADK Role

Google ADK is the **agent runtime and orchestration layer**, not the database, desktop application, or complete backend.

Current ADK tooling provides agent definitions, tools, orchestration, callbacks, state/session mechanisms, evaluation and deployment workflows.

References:
- https://google.github.io/adk-docs/tutorials/coding-with-ai/
- https://google.github.io/agents-cli/guide/project-structure/
- https://google.github.io/agents-cli/guide/deployment/

## 7.1 Recommended ADK responsibilities

ADK should own:

- agent definition;
- LLM interaction;
- tool calling;
- agent orchestration;
- agent callbacks;
- session-aware execution;
- evaluation integration;
- optional MCP toolsets.

Application code should own:

- business/domain rules;
- persistence;
- authorization;
- permissions;
- retention;
- event processing;
- UI;
- infrastructure.

## 7.2 Root agent

Initial architecture:

```text
Root Learning Companion Agent
    ├── learner context tools
    ├── learning knowledge tools
    ├── memory tools
    ├── quiz tools
    └── intervention request tools
```

Do not create many agents before the single-agent design becomes insufficient.

---

# 8. ADK Agent Design

Conceptual shape:

```python
root_agent = Agent(
    name="learning_companion",
    model=model,
    instruction=ROOT_AGENT_INSTRUCTION,
    tools=[
        get_learner_profile,
        get_current_learning_state,
        get_roadmap,
        search_learning_history,
        get_relevant_knowledge,
        record_learning_observation,
        propose_learning_update,
        create_quiz,
        request_intervention,
    ],
)
```

The exact imports/API names must be validated against the installed ADK version during implementation. Do not let a coding agent invent an API from memory.

The coding environment should connect to the official ADK documentation/MCP/index when available. Google's current ADK documentation explicitly supports using coding-agent skills and an ADK Docs MCP server.

Reference:
https://google.github.io/adk-docs/tutorials/coding-with-ai/

---

# 9. Tool Architecture

## 9.1 Tool contract

Every tool should have:

```text
Tool
├── name
├── purpose
├── input schema
├── validation
├── authorization requirement
├── side effects
├── output schema
├── failure behavior
└── observability metadata
```

## 9.2 Example

```python
class LearnerContextTool:
    def get_current_state(self, user_id: str) -> CurrentLearningState:
        ...
```

The model-facing wrapper should be small:

```python
def get_current_learning_state() -> dict:
    """
    Get the learner's current roadmap position,
    current topic, known weaknesses and current task.
    """
    ...
```

The underlying implementation should call:

```text
Tool function
   ↓
Application service
   ↓
Repository
   ↓
Database
```

Do not put SQL inside ADK tool functions.

---

# 10. Domain-Oriented Object Model

Recommended layers:

```text
presentation
    ↓
application
    ↓
domain
    ↓
infrastructure
```

## 10.1 Domain entities

### LearnerProfile

```text
LearnerProfile
- learner_id
- goals
- target_role
- experience_level
- interests
- preferred_learning_style
- available_time
- privacy_preferences
- created_at
- updated_at
```

### LearningGoal

```text
LearningGoal
- id
- learner_id
- title
- target_role
- priority
- status
- target_date
```

### Concept

```text
Concept
- id
- name
- domain
- description
- difficulty
```

### ConceptRelation

```text
ConceptRelation
- source_concept_id
- target_concept_id
- relation_type
- confidence
```

Relation types:

```text
PREREQUISITE_OF
RELATED_TO
PART_OF
LEADS_TO
```

### KnowledgeState

```text
KnowledgeState
- learner_id
- concept_id
- mastery_score
- confidence
- evidence_count
- last_seen
- last_assessed
- status
```

Statuses:

```text
UNKNOWN
EXPOSED
LEARNING
PROVISIONAL
MASTERED
REVIEW
```

### LearningEvent

```text
LearningEvent
- id
- learner_id
- source
- event_type
- timestamp
- topic
- metadata
- consent_scope
```

Examples:

```text
PAGE_VIEW
SEARCH
VIDEO_VIEW
QUIZ_ATTEMPT
QUESTION
CODE_ACTIVITY
NOTE_CREATED
PROJECT_ACTIVITY
```

### MemoryItem

```text
MemoryItem
- id
- learner_id
- memory_type
- content
- importance
- confidence
- source
- created_at
- last_used_at
- expires_at
```

Memory types:

```text
PROFILE
PREFERENCE
KNOWLEDGE
EPISODIC
SEMANTIC
GOAL
LEARNING_PATTERN
```

---

# 11. Memory Architecture

## 11.1 Short-term memory

Stores:

```text
current conversation
current task
recent events
current reasoning context
temporary state
```

Characteristics:

- high relevance;
- short retention;
- safe to discard;
- optimized for current session.

ADK session/state mechanisms can cover the conversational runtime layer.

## 11.2 Long-term memory

Stores stable information.

Examples:

```text
Goal:
AI Engineer

Strong:
Python

Weak:
Linear Algebra

Preference:
Understands explanations better with simple analogy
```

Only stable facts should be promoted.

## 11.3 Episodic memory

Events:

```text
Student struggled with Q/K/V on 2026-09-11.
```

This should not automatically become:

```text
Student is weak at Attention forever.
```

The second statement requires evidence aggregation.

## 11.4 Semantic knowledge state

Instead of saving every conversation, store structured learning state:

```json
{
  "concept": "LSTM",
  "mastery": 0.72,
  "confidence": 0.81,
  "evidence": [
    "quiz_score",
    "successful_explanation",
    "project_usage"
  ]
}
```

---

# 12. Memory Promotion and Filtering

## 12.1 The rule

Do not permanently remember everything.

Pipeline:

```text
Raw event
   ↓
Candidate extraction
   ↓
Relevance check
   ↓
Stability check
   ↓
Confidence score
   ↓
Privacy check
   ↓
Memory policy
   ├── discard
   ├── short-term
   ├── episodic
   └── long-term
```

## 12.2 Example: LSTM

Student asks:

```text
"LSTM is what?"
```

Do NOT store:

```text
student knows LSTM
```

because asking means only that the student is interested or unfamiliar.

Later:

```text
Student explains:
"LSTM uses gates to control information flow."

Quiz:
8/10

Project:
implemented LSTM
```

Now update:

```text
LSTM
mastery = 0.78
confidence = 0.86
status = PROVISIONAL
```

Later evidence can move it toward:

```text
MASTERED
```

## 12.3 What to forget

Forget or downgrade:

- one-off questions;
- transient emotions;
- temporary frustration;
- outdated plans;
- stale low-confidence assumptions;
- redundant event-level information;
- data whose consent has been removed.

## 12.4 What to keep

Keep longer:

- explicit goals;
- stable preferences;
- durable skill evidence;
- important recurring difficulties;
- roadmap decisions;
- project history;
- accepted intervention preferences.

---

# 13. Memory Scoring

Recommended conceptual score:

```text
memory_score =
    importance
  * confidence
  * recency_factor
  * recurrence_factor
  * user_explicitness
```

This is a policy score, not necessarily a neural model.

Example:

```text
"I prefer Feynman explanations."
```

Explicit + repeated:

```text
high
```

One accidental long response:

```text
low
```

The system should prefer an explicit user preference over an inferred preference.

---

# 14. Learning Knowledge Graph

The roadmap must not be a checklist.

Use a graph:

```text
Concept
   │
   ├── prerequisite_of
   ├── related_to
   ├── part_of
   └── leads_to
```

Example:

```text
RNN
  ↓
LSTM
  ↓
Seq2Seq
  ↓
Attention
  ↓
Self-Attention
  ↓
Transformer
```

## 14.1 Roadmap generation

Inputs:

```text
Goal
Current knowledge
Interests
Available time
Preferred depth
```

Output:

```text
Personalized roadmap
```

## 14.2 Roadmap object

```text
Roadmap
├── goal
├── phases
├── nodes
├── dependencies
├── checkpoints
├── projects
└── status
```

---

# 15. Context Engine

The Context Engine transforms raw observations into useful signals.

Input:

```text
BrowserEvent
QuizEvent
ChatEvent
ProjectEvent
FileEvent
```

Output:

```text
LearningSignal
```

Example:

```json
{
  "signal_type": "possible_conceptual_gap",
  "topic": "attention",
  "score": 0.78,
  "evidence": [
    "repeated_search",
    "repeated_question",
    "revisit_same_material"
  ]
}
```

## 15.1 Event processing

```text
Raw Event
   ↓
Normalize
   ↓
Validate
   ↓
Deduplicate
   ↓
Aggregate
   ↓
Extract signal
   ↓
Store event/signal
```

## 15.2 Cheap processing first

Do not call the LLM for every browser event.

Example:

```text
Page opened
→ store only

Same topic searched 4 times
→ aggregate

Repeated topic + quiz failure
→ investigate

Strong signal
→ invoke Agent
```

---

# 16. Agent Loop

The core agent loop:

```text
OBSERVE
   ↓
BUILD CONTEXT
   ↓
DIAGNOSE
   ↓
DECIDE
   ↓
ACT OR STAY SILENT
   ↓
OBSERVE RESULT
   ↓
UPDATE STATE
```

More detailed:

```text
Event
 ↓
Permission
 ↓
Context Engine
 ↓
Signal
 ↓
Intervention Policy
 ↓
Need Agent?
 ├── NO → store / wait
 └── YES
       ↓
   ADK Agent
       ↓
   read tools
       ↓
   diagnosis
       ↓
   action proposal
       ↓
   policy validation
       ↓
       action
```

---

# 17. Intervention Policy

The Agent must know when NOT to act.

## 17.1 Decision levels

```text
Level 0 — Ignore
No meaningful signal.

Level 1 — Observe
Interesting but insufficient evidence.

Level 2 — Suggest
Useful opportunity, low interruption.

Level 3 — Ask
Potential issue worth confirming.

Level 4 — Intervene
Strong evidence + high usefulness + permission.
```

## 17.2 Intervention utility

Conceptually:

```text
intervention_utility =
    evidence_strength
  * expected_help
  * permission
  * context_relevance
  - interruption_cost
```

Only intervene if utility exceeds a threshold.

## 17.3 Cooldown

Avoid:

```text
Agent intervention
2 minutes later
Agent intervention
3 minutes later
Agent intervention
```

Use:

```text
cooldown per learner/topic/intervention_type
```

---

# 18. Agent Instruction Design

The root agent instruction should explicitly define:

## Identity

```text
You are a personal learning companion.
You are not a lecturer that turns every question into a lecture.
You are not a surveillance system.
```

## Responsibilities

```text
Understand goal.
Understand learner state.
Answer current question.
Diagnose learning blockers.
Recommend next useful step.
Use tools before assuming learner facts.
```

## Constraints

```text
Never invent memory.
Never bypass permission.
Never claim mastery without evidence.
Never silently modify high-impact state.
Never overwhelm the learner.
```

## Response behavior

For normal question:

```text
answer first
then optionally connect to roadmap
```

For uncertainty:

```text
ask a focused question
```

For repeated confusion:

```text
change teaching strategy
```

---

# 19. Explanation Strategy

The Agent needs multiple explanation modes.

```text
Mode 1 — Direct explanation
Mode 2 — Intuition
Mode 3 — Feynman
Mode 4 — Concrete example
Mode 5 — Diagram
Mode 6 — Formula
Mode 7 — Code
Mode 8 — Mini exercise
```

The Agent should track:

```text
previous_explanation_mode
user_feedback
success_signal
```

Example:

```text
Technical explanation
     ↓
"Still don't understand"
     ↓
Feynman
     ↓
"Still don't understand"
     ↓
Concrete example
     ↓
Mini quiz
```

---

# 20. Personal Mentor Behavior

The system should remember:

```text
learning preferences
difficulty patterns
preferred explanation styles
recurring weaknesses
goals
interests
```

Example:

```text
Preferred:
- concept first
- simple examples
- Feynman
- diagrams

Avoid:
- long abstract theory
- too many formulas at once
```

These are memories about the learner, not hard-coded global behavior.

---

# 21. Conversation Classification

Every user message should conceptually fall into one or more categories:

```text
QUESTION
LEARNING_GUIDANCE
ROADMAP
REVIEW
QUIZ
CAREER
PROJECT
EMOTIONAL_SUPPORT
SMALL_TALK
META_AGENT
```

Do not necessarily call a separate classifier LLM.

For MVP:

```text
Root agent + tools + explicit instruction
```

may be enough.

Later, introduce a lightweight classifier only when evaluation shows a real need.

---

# 22. Recommended Orchestration

## 22.1 MVP

Use one root Agent.

```text
Root Agent
    │
    ├── context tools
    ├── knowledge tools
    ├── memory tools
    ├── roadmap tools
    └── action tools
```

## 22.2 Future

Split specialized agents only when one agent becomes difficult to control:

```text
Root Agent
   ├── Mentor Agent
   ├── Learning Analyst Agent
   ├── Career Agent
   └── Project Coach Agent
```

Routing should be deterministic where practical.

---

# 23. Object-Oriented Application Architecture

Recommended project structure:

```text
learning-companion/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── uv.lock
├── .env.example
├── docs/
│   ├── system-design.md
│   ├── architecture.md
│   ├── product/
│   │   ├── prd.md
│   │   └── personas.md
│   ├── features/
│   │   ├── onboarding/
│   │   │   ├── spec.md
│   │   │   ├── plan.md
│   │   │   └── test-plan.md
│   │   ├── roadmap/
│   │   ├── memory/
│   │   ├── intervention/
│   │   └── observation/
│   └── adr/
│       ├── 001-local-first.md
│       ├── 002-adk.md
│       └── 003-memory-policy.md
│
├── src/
│   └── learning_companion/
│       ├── __init__.py
│       │
│       ├── presentation/
│       │   ├── api/
│       │   │   ├── routes/
│       │   │   ├── schemas/
│       │   │   └── dependencies.py
│       │   └── websocket/
│       │
│       ├── application/
│       │   ├── services/
│       │   │   ├── learner_service.py
│       │   │   ├── roadmap_service.py
│       │   │   ├── memory_service.py
│       │   │   ├── event_service.py
│       │   │   ├── context_service.py
│       │   │   └── intervention_service.py
│       │   └── commands/
│       │
│       ├── domain/
│       │   ├── entities/
│       │   ├── value_objects/
│       │   ├── enums/
│       │   ├── repositories/
│       │   └── policies/
│       │
│       ├── agent/
│       │   ├── root_agent.py
│       │   ├── instructions/
│       │   ├── tools/
│       │   │   ├── learner_tools.py
│       │   │   ├── roadmap_tools.py
│       │   │   ├── knowledge_tools.py
│       │   │   ├── memory_tools.py
│       │   │   ├── quiz_tools.py
│       │   │   └── intervention_tools.py
│       │   ├── callbacks/
│       │   ├── policies/
│       │   └── schemas/
│       │
│       ├── infrastructure/
│       │   ├── db/
│       │   ├── repositories/
│       │   ├── llm/
│       │   │   ├── gemini.py
│       │   │   └── ollama.py
│       │   ├── browser/
│       │   ├── filesystem/
│       │   ├── telemetry/
│       │   └── config/
│       │
│       └── main.py
│
├── local_gateway/
│   └── ...
│
├── browser_extension/
│   └── ...
│
├── desktop/
│   └── ...
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── agent/
│   └── e2e/
│
├── evals/
│   ├── datasets/
│   ├── scenarios/
│   └── configs/
│
└── deployment/
    ├── docker/
    ├── terraform/
    │   ├── dev/
    │   ├── staging/
    │   └── prod/
    └── github/
```

Google's current Agents CLI generated project layout is compatible with this philosophy: agent code, FastAPI serving, evaluation tests, integration tests and deployment infrastructure are separated rather than placing everything into one agent file.

Reference:
https://google.github.io/agents-cli/guide/project-structure/

---

# 24. Responsibility of Each Layer

## 24.1 Presentation

Responsible for:

- HTTP;
- WebSocket;
- request validation;
- response formatting;
- auth dependency injection.

Not responsible for:

- learning rules;
- prompting;
- direct database business logic.

## 24.2 Application

Responsible for use cases:

```text
CreateLearner
GenerateRoadmap
RecordLearningEvent
AnalyzeLearningState
UpdateKnowledge
CreateQuiz
RequestIntervention
```

## 24.3 Domain

Contains:

- entities;
- policies;
- domain rules;
- value objects.

Example:

```python
class InterventionPolicy:
    def should_intervene(self, signal, context) -> Decision:
        ...
```

## 24.4 Infrastructure

Contains:

- database;
- external APIs;
- filesystem;
- browser integration;
- LLM provider adapters;
- observability.

---

# 25. LLM Abstraction

Do not hard-code the entire application to one provider.

Define:

```text
LLMProvider
```

Conceptually:

```python
class LLMProvider(Protocol):
    async def generate(...): ...
```

Implementations:

```text
GeminiProvider
OllamaProvider
FutureProvider
```

ADK remains the preferred agent orchestration layer.

---

# 26. Model Strategy

## Development

Prefer:

```text
local model if cheap/local development is sufficient
```

## Evaluation

Use a stronger cloud model when evaluating reasoning quality.

## Production MVP

Choose based on:

```text
quality
tool calling
latency
cost
privacy
Vietnamese language quality
```

The application should not assume that the strongest model is always necessary.

---

# 27. Local Filesystem Integration

The idea of the Agent understanding the student's study folder is valuable.

Example:

```text
D:\Study\
├── AI\
│   ├── NLP\
│   ├── Deep Learning\
│   └── LLM\
├── Notes\
├── Projects\
└── Courses\
```

The Agent should NOT automatically read all files.

Instead:

```text
User selects folder
      ↓
Permission granted
      ↓
Scanner builds metadata
      ↓
Index file names / types
      ↓
Optional content extraction
      ↓
Learning signals
```

## 27.1 File metadata

Example:

```json
{
  "path": "AI/NLP/attention.md",
  "type": "markdown",
  "modified_at": "...",
  "size": 12450
}
```

## 27.2 Content indexing

Only selected file types initially:

```text
.md
.txt
.pdf
.ipynb
.py
.java
.ts
```

Avoid sending entire folders to the LLM.

Use:

```text
file → chunk → index → retrieve
```

---

# 28. Browser Integration

The browser should initially be a **permissioned signal source**, not a surveillance engine.

Preferred architecture:

```text
Chrome Extension
   ↓
localhost API
   ↓
Local Gateway
   ↓
Event Processor
```

Collect:

```text
page title
domain
timestamp
user-approved learning sites
topic classification
```

Do not collect by default:

```text
passwords
private messages
email content
private browsing
credit card data
```

---

# 29. VS Code Integration

Future signal source:

```text
VS Code extension
   ↓
local gateway
```

Send:

```text
workspace
file type
coding duration
test result
error category
project topic
```

Avoid:

```text
entire source tree upload
```

unless explicitly enabled.

---

# 30. Intervention UI

Recommended MVP UI:

```text
Desktop side panel
```

States:

```text
IDLE
THINKING
SUGGESTION
ASK_CONFIRMATION
QUIZ
ERROR
```

Example:

```text
┌────────────────────────────────┐
│ Learning Companion             │
├────────────────────────────────┤
│ I noticed you revisited        │
│ Attention / QKV several times. │
│                                │
│ Want a 5-minute explanation?   │
│                                │
│ [Yes] [Not now] [Don't suggest]│
└────────────────────────────────┘
```

---

# 31. Event Bus

MVP can use in-process events.

Future:

```text
Redis Streams
Pub/Sub
NATS
Kafka
```

Do NOT introduce Kafka in MVP.

Recommended MVP:

```text
Event API
   ↓
Async queue/background task
```

---

# 32. Database Strategy

## 32.1 MVP local

Use:

```text
SQLite
```

Reason:

- zero infrastructure;
- local-first;
- easy backup;
- easy tests.

## 32.2 Cloud/scale

Move to:

```text
PostgreSQL
```

Potential additions:

```text
pgvector
```

for semantic retrieval.

Graph database is optional.

Do not introduce Neo4j only because the word "knowledge graph" sounds appropriate.

For MVP, PostgreSQL tables can represent:

```text
concept
concept_relation
learner_knowledge
roadmap_node
```

---

# 33. Memory Retrieval

Do not inject all memories into every prompt.

Retrieval layers:

```text
Current session
    ↓
Current learning state
    ↓
Relevant long-term memories
    ↓
Relevant learning history
    ↓
Relevant knowledge graph nodes
```

Candidate memories should be ranked by:

```text
relevance
recency
confidence
importance
user explicitness
```

---

# 34. Agent Context Assembly

Before an important Agent call, assemble a compact context object.

Conceptual:

```text
AgentContext
├── user_message
├── learner_profile_summary
├── current_goal
├── roadmap_position
├── current_concept
├── relevant_knowledge
├── relevant_memory
├── recent_learning_signals
├── permissions
└── intervention_constraints
```

Do not blindly serialize every database row into the prompt.

---

# 35. Context Budget

Context should be bounded.

Example policy:

```text
Current conversation:
latest N turns

Recent events:
latest K relevant events

Long-term memory:
top M relevant items

Knowledge:
current concept + prerequisites + adjacent concepts
```

The exact N/K/M should be configuration.

---

# 36. Agent Output Contracts

Where structured decisions matter, prefer typed schemas.

Example:

```python
class InterventionDecision(BaseModel):
    should_intervene: bool
    confidence: float
    reason: str
    action_type: str
```

Natural language response and machine decision should be separated.

Bad:

```text
LLM returns free text:
"Maybe ask them if they need help?"
```

Better:

```json
{
  "should_intervene": true,
  "confidence": 0.86,
  "action_type": "OFFER_EXPLANATION",
  "reason": "Repeated QKV search + repeated question"
}
```

The app then executes only allowed action types.

Local model providers such as Ollama can also constrain responses to JSON schemas, which is useful for fallback adapters.

Reference:
https://docs.ollama.com/capabilities/structured-outputs

---

# 37. Tool Result Design

Tool results should be concise and typed.

Bad:

```text
100 database rows dumped into prompt.
```

Good:

```json
{
  "current_topic": "Attention",
  "mastery": 0.42,
  "confidence": 0.80,
  "recent_failures": 2,
  "last_reviewed": "2026-09-11"
}
```

---

# 38. Tool Permission Model

Each tool receives a capability class:

```text
READ_SAFE
READ_SENSITIVE
WRITE_LOCAL
WRITE_STATE
WRITE_EXTERNAL
```

Policy:

```text
READ_SAFE
→ allowed

READ_SENSITIVE
→ explicit permission

WRITE_LOCAL
→ validated

WRITE_STATE
→ schema + domain rule

WRITE_EXTERNAL
→ user confirmation
```

---

# 39. Tool Idempotency

Write tools should be idempotent where practical.

Example:

```text
record_learning_event(event_id)
```

If the same event is sent twice:

```text
first → insert
second → ignored / same result
```

This matters because browser and network events can be duplicated.

---

# 40. Agent Callback Policy

Callbacks may enforce cross-cutting rules:

```text
before agent
- correlation id
- audit metadata

before model
- validate context size
- attach request metadata

before tool
- permission check
- logging

after tool
- metrics
- error classification

after model
- schema validation

after agent
- audit
- latency
- outcome
```

Callbacks should not become a second hidden business layer.

Exact API names must follow the installed ADK version.

---

# 41. MCP Strategy

MCP can be used later when standardized external integration is useful.

Possible future tool servers:

```text
GitHub MCP
Filesystem MCP
Calendar MCP
Learning platform MCP
Documentation MCP
```

For core domain operations, prefer first-party Python services/functions until there is a real interoperability need.

ADK supports MCP toolsets.

Reference:
https://google.github.io/adk-docs/
https://google.github.io/mcp-security/

---

# 42. Agent State vs Application State

Very important distinction.

## ADK/session state

Used for:

```text
current agent execution
conversation
short-lived context
tool interaction state
```

## Application/database state

Used for:

```text
learner profile
roadmap
knowledge mastery
learning history
permissions
memory
privacy settings
```

Do not treat ADK session history as your entire product database.

---

# 43. API Design

## Learner

```text
GET    /api/v1/learner/profile
PUT    /api/v1/learner/profile
GET    /api/v1/learner/state
```

## Roadmap

```text
GET    /api/v1/roadmap
POST   /api/v1/roadmap/generate
POST   /api/v1/roadmap/replan
```

## Chat

```text
POST   /api/v1/chat
POST   /api/v1/chat/stream
```

## Events

```text
POST   /api/v1/events
POST   /api/v1/events/batch
```

## Memory

```text
GET    /api/v1/memory
DELETE /api/v1/memory/{id}
DELETE /api/v1/memory/topic/{topic}
DELETE /api/v1/memory/all
```

## Permissions

```text
GET    /api/v1/permissions
PUT    /api/v1/permissions/{source}
```

## Intervention

```text
GET    /api/v1/interventions
POST   /api/v1/interventions/{id}/accept
POST   /api/v1/interventions/{id}/dismiss
```

---

# 44. Use Cases

## UC-01 Onboarding

```text
User provides:
goal
level
interests
time
preferences
```

System:

```text
create learner profile
      ↓
retrieve concept graph
      ↓
build roadmap
      ↓
store roadmap
      ↓
explain rationale
```

## UC-02 Ask a concept

```text
User: "LSTM là gì?"

Agent:
get learner context
       ↓
answer at learner level
       ↓
optionally relate to roadmap
```

## UC-03 Repeated confusion

```text
Question
 ↓
same topic again
 ↓
same topic again
 ↓
knowledge state indicates weak
 ↓
Agent detects pattern
 ↓
ask whether help is needed
```

## UC-04 Browser observation

```text
Page view
 ↓
normalize
 ↓
topic = Attention
 ↓
aggregate repeated visits
 ↓
signal = possible gap
 ↓
policy
 ↓
Agent
 ↓
intervention UI
```

---

# 45. End-to-End Use Case

## E2E-01: Student struggles with Attention

### Starting state

```text
Goal:
AI Engineer

Roadmap:
Deep Learning

Knowledge:
CNN = 0.85
RNN = 0.65
Attention = 0.40
```

### Event sequence

```text
10:00
Open Attention article

10:08
Search "self attention"

10:15
Search "Q K V"

10:20
Search "QKV explained"

10:25
Ask Agent:
"Q K V vẫn chưa hiểu"
```

### System flow

```text
Browser
  ↓
Event ingestion
  ↓
Context Engine
  ↓
Repeated-topic signal
  ↓
Chat event
  ↓
Learner context retrieved
  ↓
ADK Agent
  ↓
get_knowledge_state("attention")
  ↓
get_learning_history("attention")
  ↓
diagnose
  ↓
propose explanation
  ↓
Intervention/response policy
  ↓
Explain Q/K/V at learner level
  ↓
Mini quiz
  ↓
quiz result
  ↓
update knowledge state
```

### Expected state update

Before:

```text
Attention = 0.40
```

After successful quiz:

```text
Attention = 0.55
confidence = increased
last_assessed = now
```

Do not jump to:

```text
Attention = mastered
```

without evidence.

---

# 46. Function-Level Test Plan

Every important service should have unit tests.

## LearnerService

```text
test_create_profile()
test_update_profile()
test_get_profile()
test_reject_invalid_goal()
```

## RoadmapService

```text
test_generate_initial_roadmap()
test_skip_known_concept()
test_preserve_prerequisite_order()
test_identify_missing_prerequisite()
test_replan_after_skill_change()
```

## KnowledgeService

```text
test_record_exposure()
test_update_mastery_from_quiz()
test_do_not_mark_mastery_from_single_question()
test_downgrade_stale_confidence()
```

## MemoryService

```text
test_store_candidate_memory()
test_promote_stable_preference()
test_discard_low_value_event()
test_retrieve_relevant_memory()
test_delete_topic_memory()
test_delete_all_memory()
```

## EventService

```text
test_validate_event()
test_deduplicate_event()
test_aggregate_repeated_topic()
test_reject_unpermitted_source()
```

## InterventionPolicy

```text
test_no_intervention_without_evidence()
test_observe_on_low_confidence()
test_suggest_on_medium_confidence()
test_intervene_on_high_confidence()
test_cooldown_prevents_spam()
test_permission_blocks_intervention()
```

## Tool functions

```text
test_get_current_learning_state()
test_get_roadmap()
test_search_learning_history()
test_record_learning_event()
test_update_knowledge_state()
test_request_intervention()
```

---

# 47. Agent Evaluation

Traditional unit tests are insufficient.

Need agent evaluations.

Example dataset:

```json
{
  "scenario": "student_confused_attention",
  "user_message": "QKV là gì vậy?",
  "learner_state": {
    "current_topic": "Attention",
    "level": "beginner"
  },
  "expected": {
    "answer_level": "beginner",
    "should_use_context": true,
    "should_not_claim_mastery": true
  }
}
```

Evaluate:

```text
context use
tool selection
tool correctness
reasoning quality
instruction following
memory correctness
intervention correctness
verbosity
factuality
```

---

# 48. Agent Test Matrix

Minimum scenario set:

```text
1. New learner asks for AI roadmap
2. Learner already knows Python
3. Learner has weak math
4. Learner asks unrelated factual question
5. Learner asks same question repeatedly
6. Learner says "I still don't understand"
7. Browser data shows repeated topic
8. Permission is denied
9. Permission is revoked after observation
10. User deletes memory
11. User asks "why did you recommend this?"
12. No evidence exists for a weak-skill claim
13. Conflicting learning evidence
14. Stale learning memory
15. Intervention cooldown active
```

---

# 49. E2E Acceptance Criteria

## Scenario

Student starts as:

```text
Goal = AI Engineer
Known = Python
Weak = Linear Algebra
Interest = NLP
```

Acceptance:

```text
A. System creates personalized roadmap.

B. Python is compressed/skipped rather than taught from zero.

C. Linear Algebra appears as a prerequisite gap.

D. Student asks a question about Transformer.

E. Agent retrieves relevant learner context.

F. Agent explains at appropriate depth.

G. Student says "I don't understand."

H. Agent changes explanation strategy.

I. Browser produces repeated Attention searches.

J. System detects a possible conceptual gap.

K. Policy decides whether to intervene.

L. If intervention occurs, the UI displays it.

M. Student can dismiss it.

N. Dismissal is recorded.

O. Relevant learning state can be updated later.

P. Student can inspect why the Agent recommended the next step.

Q. Student can delete the stored memory.

R. Permission changes take immediate effect.
```

---

# 50. Observability

Observability is mandatory because agent systems are difficult to debug from final answers alone.

Track:

```text
request_id
trace_id
session_id
learner_id
agent_version
prompt_version
model
tool_calls
tool_latency
LLM_latency
token usage
errors
policy decision
intervention result
```

Do NOT log:

```text
raw private filesystem contents
passwords
private messages
unredacted sensitive data
```

---

# 51. Structured Event Logging

Every agent invocation should produce structured logs.

Example:

```json
{
  "event": "agent_run",
  "trace_id": "...",
  "agent_version": "0.3.0",
  "model": "gemini",
  "trigger": "user_chat",
  "tools_used": [
    "get_current_learning_state"
  ],
  "duration_ms": 1240,
  "result": "completed"
}
```

---

# 52. Metrics

## Application metrics

```text
api_request_count
api_error_rate
event_processing_latency
database_latency
```

## Agent metrics

```text
agent_run_count
agent_failure_rate
tool_call_count
tool_error_rate
average_agent_latency
```

## Product metrics

```text
intervention_accept_rate
intervention_dismiss_rate
quiz_completion
roadmap_completion
knowledge_improvement
```

## Cost metrics

```text
model_calls
input_tokens
output_tokens
estimated_llm_cost
```

---

# 53. Infrastructure

## 53.1 Local development

```text
Python 3.12+
uv
FastAPI
Google ADK
SQLite
Ollama optional
Docker optional
```

## 53.2 Cloud MVP

Recommended:

```text
Cloud Run
PostgreSQL (when needed)
Cloud Logging
Cloud Monitoring
Secret Manager
Artifact Registry
```

Cloud Run currently provides an always-free allocation for requests-based services including 2 million requests/month plus free CPU/RAM allocations, after which normal usage pricing applies. This is suitable for a low-traffic MVP, but "free tier" should not be treated as a guarantee of a zero-dollar bill; billing can still occur when quotas or other services are used.

Reference:
https://cloud.google.com/run/pricing

## 53.3 Observability

Use Google's native:

```text
Cloud Logging
Cloud Monitoring
Error Reporting
Cloud Trace
```

Current Google Cloud Observability pricing provides free monthly allotments for logging, metrics and trace ingestion, with charges beyond the free allotments.

Reference:
https://cloud.google.com/products/observability/pricing

---

# 54. Deployment Pipeline

Recommended:

```text
Git Push
   ↓
CI
   ├── lint
   ├── type check
   ├── unit tests
   ├── agent tests
   └── evaluation subset
   ↓
Build image
   ↓
Deploy staging
   ↓
Smoke test
   ↓
Evaluation gate
   ↓
Production
```

---

# 55. Environments

```text
local
dev
staging
prod
```

Never use production learner data in evaluation fixtures.

---

# 56. Infrastructure as Code

Use Terraform once cloud infrastructure begins.

Structure:

```text
deployment/terraform/
├── modules/
│   ├── cloud_run/
│   ├── database/
│   ├── monitoring/
│   └── secrets/
├── dev/
├── staging/
└── prod/
```

Do not start with a huge Terraform system if everything is local.

---

# 57. Secrets

Never commit:

```text
GOOGLE_API_KEY
DATABASE_PASSWORD
OAuth credentials
tokens
```

Use:

```text
.env
Secret Manager
CI secrets
```

Commit:

```text
.env.example
```

---

# 58. Cost Control

Main cost drivers:

```text
LLM calls
embedding calls
database
logging
network
```

Control costs by:

```text
event aggregation
LLM gating
model routing
short prompts
memory retrieval
caching
local inference
rate limits
```

Most importantly:

**Do not call the expensive LLM for every observation event.**

---

# 59. Model Routing

Future strategy:

```text
simple task
    ↓
small/local model

classification
    ↓
small model

normal explanation
    ↓
standard model

complex planning/diagnosis
    ↓
strong model
```

This can become:

```text
ModelRouter
```

with policy:

```text
TaskType
    ↓
required quality
    ↓
latency budget
    ↓
privacy requirement
    ↓
model
```

---

# 60. Desktop Architecture

Recommended long-term product:

```text
Desktop App
├── UI
├── Agent status
├── permissions
├── notifications
├── local learning folder
└── local gateway
```

A desktop shell such as Tauri can host the user interface while Python remains the AI/backend runtime.

Do not give the LLM direct operating-system privileges.

Instead:

```text
Agent
 ↓
safe application tool
 ↓
permission service
 ↓
filesystem adapter
 ↓
OS
```

---

# 61. "Understanding the Student's Folder"

This should be framed as:

> **Learning workspace understanding**

The system should infer:

```text
what topics exist
what documents are active
what projects are being built
what notes were recently modified
```

Example:

```text
Study/
  NLP/
    attention.md
    transformer.md
  Projects/
    sentiment-analysis/
```

System signal:

```text
active_topic = NLP
subtopic = Attention
project = sentiment-analysis
```

It does NOT need to read everything.

---

# 62. Personal Conversation

The Agent may support conversation and emotional context, but the memory policy should be conservative.

Example:

```text
"I'm overwhelmed."
```

Response:

```text
supportive response
```

Memory:

```text
do not permanently store as a personal trait by default
```

Only store durable preferences when explicitly stated or repeatedly relevant.

---

# 63. Career Guidance

Career guidance should be layered on top of learning state.

```text
Career Goal
   ↓
Required Skills
   ↓
Current Skills
   ↓
Skill Gap
   ↓
Learning Plan
   ↓
Projects
   ↓
Portfolio
```

Do not build a separate career system before the learner model works.

---

# 64. Project-Based Learning

Projects should connect to concepts.

Example:

```text
CNN
 ↓
image classifier
 ↓
API deployment
 ↓
monitoring
 ↓
next skill
```

Project entity:

```text
Project
- title
- goal
- required_concepts
- difficulty
- status
- evidence
```

The Agent should recommend projects based on:

```text
current skills
goal
missing skills
interest
available time
```

---

# 65. Roadmap Explainability

Every recommendation should have evidence.

Example:

```text
Recommendation:
Study Deep Learning next.

Reasons:
1. Goal = AI Engineer
2. ML foundation is sufficient
3. Current interest = NLP/LLM
4. Deep Learning is a prerequisite for next roadmap phase
```

The system should not expose hidden reasoning chain.

It should expose **decision evidence and concise rationale**, not private chain-of-thought.

---

# 66. Decision Records

For important decisions store:

```text
Decision
- decision_type
- inputs/evidence
- policy_result
- action
- timestamp
- agent_version
```

Example:

```text
decision_type = INTERVENTION
evidence = repeated_topic_search + low_quiz_score
policy = high_confidence
action = offer_help
```

---

# 67. Failure Modes

## LLM hallucinates learner state

Solution:

```text
Always use state tools as source of truth.
```

## Agent spams interventions

Solution:

```text
cooldown
intervention history
policy layer
```

## Memory grows forever

Solution:

```text
promotion policy
decay
retention
deduplication
delete controls
```

## Browser data is noisy

Solution:

```text
aggregation
source allowlist
topic detection
confidence threshold
```

## Local model performs poorly

Solution:

```text
provider abstraction
cloud fallback
model routing
```

## Agent does not improve

Solution:

```text
evaluation dataset
observability
prompt/version tracking
human review
```

---

# 68. MVP Definition

MVP proves only four things:

```text
1. PERSONALIZED ROADMAP

2. OBSERVATION

3. UNDERSTANDING

4. INTERVENTION
```

Intended flow:

```text
Goal
 ↓
Roadmap
 ↓
Observe browser learning activity
 ↓
Recognize possible conceptual difficulty
 ↓
Intervene
 ↓
Explain / quiz
 ↓
Update state
```

---

# 69. MVP Feature Cut

## Must have

```text
onboarding
learner profile
roadmap
concept graph
chat
short-term session
basic long-term memory
learning state
manual event ingestion
browser extension
intervention policy
side-panel notification
quiz
memory deletion
source permission
logs
unit tests
agent evals
one E2E scenario
```

## Should have

```text
filesystem indexing
local LLM mode
streaming
dashboard
project recommendations
```

## Future

```text
VS Code
GitHub
multi-device sync
career engine
advanced graph
multi-agent
advanced MCP
cloud memory
mobile
```

---

# 70. First Implementation Order

Implement in this sequence.

## Phase 1 — Domain foundation

```text
entities
enums
schemas
repositories
database
```

## Phase 2 — Learner model

```text
profile
goal
roadmap
concept
knowledge state
```

## Phase 3 — Agent skeleton

```text
ADK root agent
one model
3–5 read-only tools
chat endpoint
```

## Phase 4 — Memory

```text
session
memory records
promotion policy
retrieval
deletion
```

## Phase 5 — Event engine

```text
event model
ingestion
aggregation
signal extraction
```

## Phase 6 — Intervention

```text
policy
cooldown
intervention record
UI
```

## Phase 7 — Browser

```text
extension
localhost communication
permission
page events
```

## Phase 8 — Evaluation

```text
dataset
agent eval
E2E
regression
```

## Phase 9 — Infrastructure

```text
Docker
Cloud Run
logging
monitoring
CI/CD
```

---

# 71. Coding-Agent Rules

The repository must contain `AGENTS.md`.

Minimum rules:

```text
1. Read docs/system-design.md before changing architecture.
2. Read the feature spec before implementing a feature.
3. Do not invent Google ADK APIs.
4. Check installed ADK version and official docs.
5. Keep domain logic outside agent prompt code.
6. Do not place SQL in ADK tool functions.
7. Every write tool requires validation.
8. Add tests with every new service.
9. Add agent evaluation cases for behavior changes.
10. Do not log sensitive learner data.
11. Do not create a new agent when a service/tool is enough.
12. Do not add infrastructure complexity without a requirement.
13. Preserve provider abstraction.
14. Keep local-first mode working.
```

---

# 72. Recommended AI Coding Workflow

```text
Requirement
    ↓
Feature spec
    ↓
Architecture impact
    ↓
Implementation plan
    ↓
Tasks
    ↓
Code
    ↓
Unit tests
    ↓
Integration test
    ↓
Agent evaluation
    ↓
E2E
    ↓
Review
```

Do not ask a coding agent:

```text
"Build the entire AI Agent."
```

Instead give it:

```text
feature spec
architecture constraints
interfaces
acceptance criteria
test plan
```

---

# 73. Example Feature Spec

```text
Feature:
Repeated Concept Detection

Goal:
Detect when a learner repeatedly revisits one concept.

Inputs:
browser events
chat questions
quiz results

Outputs:
LearningSignal

Rule:
At least N relevant events in T minutes.

Non-goals:
do not decide intervention here

Next:
InterventionPolicy evaluates signal.
```

This separation is important:

```text
Detection ≠ Decision ≠ Action
```

---

# 74. Domain vs Agent Responsibilities

| Concern | Domain/Application | Agent |
|---|---|---|
| Save profile | Yes | No |
| Check permission | Yes | No |
| Read profile | Via tool | Requests |
| Diagnose confusion | No | Yes |
| Decide roadmap rationale | Shared | Yes |
| Enforce dependency | Yes | No |
| Generate natural explanation | No | Yes |
| Delete memory | Yes | Requests |
| Access filesystem | Adapter | Through tool |
| Log trace | Infrastructure | Triggered via runtime |
| Intervention policy | Yes | Consumes result |
| UI notification | Yes | Requests action |

Rule:

> The Agent proposes and orchestrates. The application enforces.

---

# 75. Definition of Done

A feature is complete only when:

```text
[ ] Requirement documented
[ ] Domain design updated
[ ] API/schema defined
[ ] Implementation complete
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Agent eval updated (if agent behavior changes)
[ ] Logs/metrics added
[ ] Permissions reviewed
[ ] Failure cases handled
[ ] E2E path works
[ ] Documentation updated
```

---

# 76. Final Engineering Blueprint

The intended system should ultimately look like:

```text
                         ┌──────────────────┐
                         │      STUDENT     │
                         └────────┬─────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
                 ▼                ▼                ▼
            Desktop UI        Browser          VS Code
                 │             Extension        Future
                 └───────────────┬────────────────┘
                                 ▼
                       ┌───────────────────┐
                       │ Local Gateway     │
                       │                   │
                       │ permissions       │
                       │ event ingestion   │
                       │ filesystem        │
                       │ websocket         │
                       └─────────┬─────────┘
                                 ▼
                       ┌───────────────────┐
                       │ Context Engine    │
                       │                   │
                       │ normalize         │
                       │ aggregate         │
                       │ extract signals   │
                       └─────────┬─────────┘
                                 ▼
                  ┌──────────────────────────────┐
                  │        Learner Model        │
                  │                              │
                  │ Profile                      │
                  │ Goal                         │
                  │ Roadmap                      │
                  │ Knowledge State              │
                  │ Learning History             │
                  │ Memory                       │
                  └───────────────┬──────────────┘
                                  ▼
                       ┌───────────────────┐
                       │ Intervention      │
                       │ Policy            │
                       │                   │
                       │ Should act?       │
                       │ When?             │
                       │ How intrusive?    │
                       └─────────┬─────────┘
                                 ▼
                       ┌───────────────────┐
                       │ Google ADK        │
                       │                   │
                       │ Root Agent        │
                       │ Tools             │
                       │ Callbacks         │
                       │ Session           │
                       └─────────┬─────────┘
                                 ▼
                              LLM
                                 │
                                 ▼
                       ┌───────────────────┐
                       │ Action Proposal   │
                       └─────────┬─────────┘
                                 ▼
                       ┌───────────────────┐
                       │ Application       │
                       │ Policy Validation │
                       └─────────┬─────────┘
                                 ▼
                       ┌───────────────────┐
                       │ UI / Notification │
                       └───────────────────┘
                                 │
                                 ▼
                              Student
                                 │
                                 └──── feedback ────→ state update
```

---

# 77. Core Principle

The central engineering principle is:

> **Do not build a chatbot and add memory. Build a learner-state system with an Agent on top.**

The Agent needs to know:

```text
Where the learner wants to go.
Where the learner is.
What the learner already knows.
What evidence supports that belief.
What the learner is doing now.
What may be blocking them.
Whether intervention is useful.
What action is allowed.
What happened after the action.
```

That is the system.

The LLM is one component inside it.

---

# 78. Current External References

These references should be re-checked against the installed package/version during implementation because Google ADK and cloud services evolve.

- Google ADK coding with AI / Agents CLI:
  https://google.github.io/adk-docs/tutorials/coding-with-ai/
- Google Agents CLI project structure:
  https://google.github.io/agents-cli/guide/project-structure/
- Google Agents CLI deployment:
  https://google.github.io/agents-cli/guide/deployment/
- Google ADK documentation:
  https://google.github.io/adk-docs/
- Google Cloud Run pricing:
  https://cloud.google.com/run/pricing
- Google Cloud Observability pricing:
  https://cloud.google.com/products/observability/pricing
- Ollama tool support:
  https://ollama.com/blog/tool-support
- Ollama structured outputs:
  https://docs.ollama.com/capabilities/structured-outputs

---

# 79. First Milestone

The first milestone is NOT:

> "A fully autonomous personal AI."

It is:

```text
Student enters:
"I want to become an AI Engineer."

        ↓

System creates:
personalized roadmap

        ↓

Student asks:
"I don't understand Attention."

        ↓

Agent retrieves:
profile + roadmap + knowledge

        ↓

Agent explains:
at the correct depth

        ↓

Student says:
"Still don't understand."

        ↓

Agent changes strategy

        ↓

Browser records:
repeated Attention / QKV activity

        ↓

System detects:
possible conceptual gap

        ↓

Policy decides:
useful to intervene

        ↓

Agent asks:
"Want a 5-minute explanation?"

        ↓

Student accepts

        ↓

Agent teaches + quizzes

        ↓

System updates:
Knowledge State + Learning History
```

Once this flow works reliably, the project has demonstrated the actual product thesis.

