# Hackathon Execution Plan: Learning Companion Agent

## 1. Technology Stack for the System

Based on the design document, the system relies on the following core technologies:

- **Backend Application Layer:** Python & FastAPI.
- **Agent Orchestration:** Google ADK (Agent Development Kit).
- **Frontend / Desktop:** Tauri (wrapping a Web UI like React/Vue/Svelte) for the local desktop app.
- **Databases:** SQLite (for local-first) or PostgreSQL, plus an optional Vector Database for semantic search.
- **AI Inference:** Local LLMs via Ollama (for privacy/offline mode) or cloud models (e.g., Gemini) via API.

## 2. MVP Time Estimation (Standard)

For a small team (1-2 developers) building a functioning Minimum Viable Product (MVP), a rough estimate is **4 to 6 weeks**:

- **Week 1:** Setup Google ADK root agent, define base read/write tools, and scaffold the FastAPI backend.
- **Week 2:** Build the basic Memory Architecture (short-term & episodic) and database schemas (SQLite).
- **Week 3:** Develop the Context Engine to process learning events and implement the Intervention Policy logic.
- **Week 4:** Connect a basic User Interface (Tauri or Chat UI) and begin testing local Ollama inference.
- **Week 5-6 (Optional):** Refine prompts, adapt explanation strategies, and fix bugs.

## 3. Connecting to Discord / Zalo using `cloudflared` (Cloudflare Tunnel)

Yes, it is entirely possible to connect this system to a Discord or Zalo bot.

Here is how it works with the architecture:
1. **The Problem:** The design is "Local-first", meaning the FastAPI server runs on `localhost` (the user's machine). Discord and Zalo need a public HTTPS URL (Webhook) to send messages to your bot. They cannot reach your `localhost`.
2. **The Solution (`cloudflared`):** You can install a Cloudflare Tunnel (`cloudflared`) on the local machine. It creates a secure outbound connection from your local FastAPI server to Cloudflare's edge network.
3. **The Flow:**
    - Cloudflare gives you a public URL (e.g., `https://learning-bot.trycloudflare.com`).
    - You put this URL into the Discord Developer Portal or Zalo Official Account portal as your Webhook URL.
    - **User messages Discord/Zalo** → **Discord/Zalo sends POST to Cloudflare** → **Cloudflared routes it to your local FastAPI** → **Google ADK processes it** → **Reply sent back through the tunnel.**

---

## 4. The 8-Hour Hackathon Strategy (Scope Cut)

If we try to build the *entire* 4-6 week specification, we will run out of time. For an 8-hour hackathon, we must aggressively cut the scope and rely heavily on AI to generate boilerplate code.

1. **Drop the Desktop App:** Building a Tauri/React app takes too much time. **Alternative:** Build a **Discord Bot** or **Zalo Bot**. A bot UI requires zero frontend coding!
2. **Drop Local LLM (Ollama):** Downloading and configuring local models will eat your time and RAM. **Alternative:** Use cloud APIs like **Gemini** for instant, high-quality responses.
3. **Simplify the Database:** Skip Vector databases and complex schemas. **Alternative:** Use a simple **SQLite** database or even just in-memory JSON files to store the user's current goal and chat history.
4. **Simplify the Agent Tools:** Only give the Google ADK agent 2 core tools to start: `get_user_profile()` and `update_learning_state()`.

### The 8-Hour AI Action Plan

*   **Hour 1: Boilerplate & Setup**
    *   Generate a basic FastAPI template with Google ADK installed.
    *   Set up Cloudflare Tunnel (`cloudflared`) to get your public HTTPS URL.
*   **Hour 2-3: The Core Agent**
    *   Write the `Root Agent` using Google ADK and connect it to the Gemini API.
    *   Give it a strong system prompt based on your design document (acting as a learning companion, not a generic chatbot).
*   **Hour 4-5: Discord/Zalo Integration**
    *   Create the Discord/Zalo bot in their developer portals.
    *   Write the FastAPI webhook endpoint to receive messages from the bot, pass them to the ADK agent, and send the reply back.
*   **Hour 6: Memory & State (The "Magic")**
    *   Implement a very basic SQLite database.
    *   Give the Agent a tool to read the user's "Knowledge State" so it remembers what they are learning between messages.
*   **Hour 7: Testing & Debugging**
    *   Talk to the bot on Discord/Zalo. Fix any crashes or hallucination issues together.
*   **Hour 8: Polish & Pitch**
    *   Clean up the code, prepare your demo, and practice your hackathon pitch!

---
---

# Kế hoạch thực thi Hackathon (Vietnamese Version)

## 1. Danh sách công nghệ (Tech Stack)

Dựa trên bản thiết kế, hệ thống sử dụng các công nghệ cốt lõi sau:
- **Backend:** Python & FastAPI (xử lý logic, API, sự kiện).
- **Điều phối Agent (Agent Orchestration):** Google ADK (Agent Development Kit).
- **Frontend / Desktop:** Tauri (kết hợp với Web UI như React/Vue) để làm app chạy trên máy tính.
- **Cơ sở dữ liệu:** SQLite (cho local) hoặc PostgreSQL, kết hợp với Vector Database (tùy chọn) để tìm kiếm ngữ nghĩa.
- **Mô hình AI:** Chạy local LLM thông qua **Ollama** (để bảo mật/offline) hoặc dùng API của các Cloud LLM (Gemini, Claude, v.v.).

## 2. Ước tính thời gian cho MVP (Tiêu chuẩn)

Đối với một nhóm nhỏ (1-2 lập trình viên), thời gian ước tính để hoàn thành một MVP (Sản phẩm khả dụng tối thiểu) rơi vào khoảng **4 đến 6 tuần**:
- **Tuần 1:** Cài đặt Google ADK root agent, định nghĩa các công cụ (tools) đọc/ghi cơ bản, và dựng khung FastAPI backend.
- **Tuần 2:** Xây dựng Kiến trúc bộ nhớ (Memory Architecture - trí nhớ ngắn hạn & sự kiện) và thiết kế database (SQLite).
- **Tuần 3:** Phát triển Context Engine để xử lý các sự kiện học tập và lập trình logic cho Chính sách can thiệp (Intervention Policy).
- **Tuần 4:** Kết nối giao diện người dùng (Tauri hoặc Chat UI cơ bản) và test với Ollama chạy local.
- **Tuần 5-6 (Tùy chọn):** Tối ưu hóa prompt, điều chỉnh các chiến lược giải thích của AI và fix bug.

## 3. Kết nối với Discord hoặc Zalo Bot thông qua `cloudflared` (Cloudflare Agent)

Hoàn toàn có thể kết nối hệ thống này với Discord hoặc Zalo bot.

Cách thức hoạt động dựa trên thiết kế hiện tại:
1. **Vấn đề:** Thiết kế này theo hướng "Local-first" (chạy trên máy tính cá nhân), tức là server FastAPI sẽ chạy ở `localhost`. Trong khi đó, máy chủ của Discord và Zalo yêu cầu một đường dẫn HTTPS công khai (Webhook) để gửi tin nhắn tới bot của bạn. Chúng không thể tự chọc thẳng vào `localhost` của bạn được.
2. **Giải pháp (`cloudflared`):** Bạn sử dụng Cloudflare Tunnel (`cloudflared`) cài trên máy tính. Công cụ này sẽ tạo một đường hầm (tunnel) bảo mật từ server FastAPI local của bạn nối ra mạng lưới mép (edge) của Cloudflare.
3. **Luồng hoạt động (Flow):**
    - Cloudflare cấp cho bạn một URL công khai (ví dụ: `https://learning-bot.trycloudflare.com`).
    - Bạn lấy URL này dán vào phần cấu hình Webhook trên Discord Developer Portal hoặc Zalo OA (Official Account).
    - **Người dùng chat trên Discord/Zalo** → **Discord/Zalo bắn request POST tới Cloudflare** → **`cloudflared` dẫn luồng dữ liệu về FastAPI local của bạn** → **Google ADK xử lý dữ liệu** → **Gửi câu trả lời ngược lại qua tunnel lên app.**

---

## 4. Chiến lược Hackathon 8 giờ (Cắt giảm phạm vi)

Nếu cố gắng xây dựng *toàn bộ* bản thiết kế vốn mất 4-6 tuần, chúng ta sẽ cháy giờ. Trong một cuộc thi Hackathon 8 tiếng, chúng ta phải cắt giảm phạm vi cực mạnh và dựa vào AI để viết code nhanh.

1. **Bỏ qua App Desktop:** Làm app bằng Tauri/React sẽ mất rất nhiều thời gian setup frontend. **Thay thế:** Sử dụng luôn một **Discord Bot** / **Zalo Bot**. Dùng Bot thì bạn không cần code giao diện frontend một dòng nào!
2. **Bỏ qua Local LLM (Ollama):** Việc tải và cấu hình model chạy local sẽ ngốn thời gian và RAM máy tính. **Thay thế:** Dùng luôn API của **Gemini** để có tốc độ phản hồi nhanh và thông minh.
3. **Đơn giản hóa Database:** Bỏ qua Vector DB và cấu trúc dữ liệu phức tạp. **Thay thế:** Dùng **SQLite** cơ bản hoặc lưu thẳng ra file JSON để nhớ lịch sử chat và mục tiêu của user.
4. **Đơn giản hóa Agent Tools:** Ban đầu chỉ cấp cho Google ADK agent 2 công cụ (tools): `get_user_profile()` (lấy thông tin user) và `update_learning_state()` (cập nhật trạng thái học tập).

### Kế hoạch hành động 8 giờ cùng AI

*   **Giờ 1: Setup & Khung dự án**
    *   Yêu cầu AI tạo ngay một bộ code mẫu FastAPI có tích hợp Google ADK.
    *   Bật Cloudflare Tunnel (`cloudflared`) để lấy link HTTPS public.
*   **Giờ 2-3: Core Agent (Bộ não AI)**
    *   Viết `Root Agent` bằng Google ADK và nối với API của Gemini.
    *   Bơm cho nó một "System Prompt" thật xịn dựa trên file thiết kế (đóng vai người đồng hành học tập).
*   **Giờ 4-5: Tích hợp Discord / Zalo**
    *   Tạo Bot trên cổng Developer của Discord/Zalo.
    *   Code API Webhook trên FastAPI để nhận tin nhắn từ người dùng, đưa cho Agent xử lý, và trả lời ngược lại bot.
*   **Giờ 6: Trí nhớ & Trạng thái (Phép màu của ứng dụng)**
    *   Tích hợp SQLite cơ bản.
    *   Viết một tool cho Agent để nó có thể "đọc" trạng thái kiến thức của người dùng qua các lần chat.
*   **Giờ 7: Test & Sửa lỗi**
    *   Chat thử với con Bot trên Discord/Zalo. Lỗi ở đâu, fix ở đó.
*   **Giờ 8: Đánh bóng & Chuẩn bị thuyết trình**
    *   Dọn dẹp code, chuẩn bị kịch bản demo và tập pitch cho buổi chấm điểm Hackathon!
