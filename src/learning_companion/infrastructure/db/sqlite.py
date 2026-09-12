import sqlite3
import os

DB_PATH = "learning_companion.db"

def init_sqlite_db():
    print('🟢 CALLED: db/sqlite.py -> init_sqlite_db')
    """Initialize SQLite database and create tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            goal TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS knowledge_state (
            user_id TEXT,
            concept TEXT,
            mastery_score INTEGER,
            PRIMARY KEY (user_id, concept)
        )
    ''')
    conn.commit()
    conn.close()

def get_user_goal(user_id: str) -> str:
    print('🟢 CALLED: db/sqlite.py -> get_user_goal')
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT goal FROM users WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else "No specific goal set yet."

def set_user_goal(user_id: str, goal: str):
    print('🟢 CALLED: db/sqlite.py -> set_user_goal')
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO users (user_id, goal) VALUES (?, ?)", (user_id, goal))
    conn.commit()
    conn.close()

def update_knowledge(user_id: str, concept: str, level: int):
    print('🟢 CALLED: db/sqlite.py -> update_knowledge')
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO knowledge_state (user_id, concept, mastery_score) VALUES (?, ?, ?)", (user_id, concept, level))
    conn.commit()
    conn.close()

def check_knowledge(user_id: str, concept: str) -> int:
    print('🟢 CALLED: db/sqlite.py -> check_knowledge')
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT mastery_score FROM knowledge_state WHERE user_id = ? AND concept = ?", (user_id, concept))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else 0
