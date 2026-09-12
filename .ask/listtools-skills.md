# Viewport Learning Companion - Skills, Tools, Pipeline và Memory

> **Mục đích:** Tài liệu tổng hợp năng lực, công cụ, luồng xử lý và bộ nhớ của MVP.  
> **Trạng thái:** Draft để team review trước khi lập kế hoạch code.  
> **Nguyên tắc:** Policy và quyền người dùng đứng trước LLM. Agent được đề xuất; ứng dụng mới có quyền thực thi.

## 0. Danh sách nhanh

### 0.1 Skills - năng lực người dùng nhìn thấy

1. **Source Safety** - Chỉ đọc nguồn được phép; bỏ qua PDF, YouTube và trang nhạy cảm.
2. **Viewport Awareness** - Biết heading, text và code đang nằm trong khung nhìn hiện tại.
3. **Contextual Q&A** - Hiểu các câu như “đoạn này là gì?” mà không cần copy-paste.
4. **Memory Recall** - Nhận ra người dùng từng hỏi hoặc đánh dấu section hiện tại.
5. **Learning Marker** - Lưu `Đã hiểu`, `Chưa hiểu` hoặc `Xem lại sau` tại đúng vị trí.
6. **Understanding Tracking** - Ước lượng mức hiểu từ bằng chứng, không suy ra chỉ từ việc đã nhìn thấy.
7. **Resume Learning** - Highlight hoặc đưa người dùng về gần đúng vị trí đã lưu.
8. **Controlled Research** - Tìm thêm nguồn bên ngoài khi người dùng chủ động yêu cầu.
9. **Privacy Control** - Chặn domain, xem bộ nhớ và xóa dữ liệu theo yêu cầu.

### 0.2 System Tools - hệ thống luôn kiểm soát

1. **`check_source_policy`** - Kiểm tra trang trước khi đọc DOM.
2. **`capture_current_viewport`** - Trích xuất viewport với giới hạn dữ liệu.
3. **`build_context_packet`** - Đóng gói context đã lọc cho Agent.
4. **`update_short_session`** - Tự động cập nhật trạng thái ngắn hạn của sidebar.
5. **`save_marker`** - Ghi dấu mốc dài hạn sau hành động người dùng.
6. **`update_understanding`** - Cập nhật trạng thái hiểu và bằng chứng.
7. **`highlight_or_resume`** - Highlight hoặc cuộn tới vị trí đã lưu.
8. **`forget_memory`** - Xóa dữ liệu đúng phạm vi người dùng chọn.
9. **`update_source_policy`** - Thêm/bỏ domain trong chính sách đọc.

### 0.3 Agent Tools - model được phép yêu cầu

1. **`get_viewport_context`** - Đọc context đã được hệ thống capture và lọc.
2. **`search_memory`** - Tìm các dấu mốc liên quan.
3. **`read_memory`** - Đọc chi tiết một dấu mốc cụ thể.
4. **`search_web`** - Tìm nguồn bổ sung khi được người dùng cho phép.
5. **`propose_marker`** - Đề xuất trạng thái hoặc ghi chú; chưa tự ghi dữ liệu.

### 0.4 Nơi lưu dữ liệu

- **Short-term memory:** RAM/state của sidebar; mất khi kết thúc phiên.
- **Long-term memory:** `browser.storage.local` của Firefox; tồn tại trong vòng đời extension cho tới khi bị xóa hoặc môi trường bị reset.
- **Backend:** MVP nên stateless; không cần SQLite hoặc cloud database.

---

## 1. Phân biệt Skill, Tool, Command và Memory

### 1.1 Skill là gì?

Skill là một **năng lực hoàn chỉnh nhìn từ góc độ người dùng**. Một skill thường cần nhiều tool và nhiều bước phối hợp.

Ví dụ:

```text
Skill: Memory Recall
  -> check_source_policy
  -> capture_current_viewport
  -> search_memory
  -> read_memory
  -> Agent tạo lời gợi lại phù hợp
```

Skill không nhất thiết là một function được LLM gọi trực tiếp.

### 1.2 Tool là gì?

Tool là một hàm có contract rõ ràng:

```text
name
input
output
side effect
permission
failure behavior
owner
```

Tool có thể thuộc quyền của:

- **System:** ứng dụng bắt buộc chạy theo rule.
- **Agent:** model được quyền yêu cầu gọi.
- **User-confirmed command:** chỉ chạy sau thao tác rõ ràng của người dùng.

### 1.3 Command là gì?

Command là hành động gây thay đổi trạng thái, ví dụ lưu marker, xóa memory hoặc highlight trang. Command không được chạy âm thầm chỉ vì model muốn.

### 1.4 Memory là gì?

Memory không phải “AI tự nhớ trong đầu”. Memory là dữ liệu có cấu trúc do ứng dụng lưu và truy xuất lại cho Agent.

Trong MVP, memory chủ yếu là:

- vị trí người dùng từng tương tác;
- câu hỏi đã hỏi tại vị trí đó;
- trạng thái người dùng đã chọn;
- bằng chứng về mức hiểu;
- ghi chú ngắn;
- thời gian cập nhật.

---

## 2. Quyền sở hữu và ranh giới hệ thống

| Trách nhiệm | System | Agent | Người dùng |
|---|:---:|:---:|:---:|
| Kiểm tra trang có được đọc không | Có | Không | Cấu hình policy |
| Đọc DOM/viewport | Có | Chỉ nhận kết quả | Kích hoạt |
| Tìm memory | Thực thi | Có thể yêu cầu | Có thể mở danh sách |
| Trả lời câu hỏi | Không | Có | Đặt câu hỏi |
| Đề xuất marker | Validate | Có | Xác nhận |
| Ghi long-term memory | Thực thi | Không trực tiếp | Bấm nút xác nhận |
| Highlight/scroll | Thực thi | Đề xuất | Kích hoạt/xác nhận |
| Xóa memory | Thực thi | Không tự quyết | Yêu cầu và chọn phạm vi |
| Thêm domain vào denylist | Thực thi | Không | Yêu cầu |

Quy tắc trung tâm:

> Agent đề xuất và diễn giải. Ứng dụng kiểm tra và thực thi. Người dùng kiểm soát các thao tác có side effect.

---

## 3. Skills chi tiết

### 3.1 Skill: Source Safety

**Mục tiêu:** Không đọc dữ liệu từ nguồn bị cấm, không hỗ trợ hoặc nhạy cảm.

**Sử dụng:** `check_source_policy`, `update_source_policy`.

**Kết quả có thể có:**

```text
ALLOW
DENY_BLOCKED_DOMAIN
DENY_UNSUPPORTED_PAGE
DENY_SENSITIVE_SOURCE
REQUIRE_ALLOW_ONCE
```

**Chính sách MVP:**

| Loại trang | Mặc định |
|---|---|
| HTML documentation/tutorial/blog | Cho phép sau khi người dùng bấm |
| YouTube/video player | Bỏ qua |
| Social feed/trang cá nhân | Bỏ qua |
| ChatGPT/email/messaging/private workspace | Chặn mặc định |
| Ngân hàng/thanh toán/password/admin | Cấm |
| Firefox PDF viewer/canvas/ảnh scan | Không hỗ trợ |
| Domain trong `Never read` | Cấm theo cấu hình người dùng |

`check_source_policy` phải chạy trước mọi hoạt động đọc DOM và trước khi gọi model.

### 3.2 Skill: Viewport Awareness

**Mục tiêu:** Biết người dùng đang nhìn phần nào của một trang HTML được phép.

**Sử dụng:** `capture_current_viewport`, `get_viewport_context`.

**Dữ liệu lấy:**

- URL đã loại bớt query nhạy cảm;
- title;
- heading gần viewport;
- text thực sự giao với viewport;
- code block giao với viewport;
- scroll ratio;
- thời điểm capture.

**Không lấy:**

- toàn bộ trang;
- nội dung ngoài viewport chỉ để “cho chắc”;
- password/input nhạy cảm;
- hidden DOM;
- private browser pages;
- dữ liệu từ trang đã bị policy chặn.

### 3.3 Skill: Contextual Q&A

**Mục tiêu:** Trả lời câu hỏi ngắn có đại từ chỉ ngữ cảnh như “đoạn này”, “cái này”, “code này”.

**Sử dụng:** `get_viewport_context`, `search_memory`, `read_memory`, `search_web` nếu người dùng cho phép.

**Hành vi:**

1. Trả lời trực tiếp từ viewport nếu đủ dữ kiện.
2. Gợi lại memory liên quan nếu có.
3. Nói rõ thiếu dữ kiện nếu context không đủ.
4. Chỉ tìm web khi người dùng yêu cầu hoặc xác nhận đề xuất.
5. Không nói rằng đã đọc cả trang nếu chỉ có viewport.

### 3.4 Skill: Memory Recall

**Mục tiêu:** Nhận ra người dùng từng tương tác với cùng trang hoặc section.

**Sử dụng:** `search_memory`, `read_memory`.

**Thứ tự tìm trong MVP:**

1. URL chính xác.
2. Heading chính xác hoặc gần giống.
3. Snippet fingerprint.
4. Topic/tag nếu đã có.
5. Marker gần nhất.

Không cần vector database ở MVP.

### 3.5 Skill: Learning Marker

**Mục tiêu:** Gắn một dấu mốc học tập với vị trí cụ thể.

**Sử dụng:** `propose_marker`, `save_marker`.

**Trạng thái người dùng chọn:**

- `UNDERSTOOD`
- `NOT_UNDERSTOOD`
- `REVIEW_LATER`

Agent có thể đề xuất note hoặc topic, nhưng marker chỉ được ghi sau nút bấm hoặc xác nhận của người dùng.

### 3.6 Skill: Understanding Tracking

**Mục tiêu:** Ước lượng người dùng đã hiểu đến đâu bằng bằng chứng.

**Sử dụng:** `update_understanding`, memory hiện có và kết quả checkpoint nếu được triển khai.

**Trạng thái bằng chứng:**

| Trạng thái | Ý nghĩa | Bằng chứng |
|---|---|---|
| `UNKNOWN` | Không đủ dữ kiện | Mặc định |
| `SEEN` | Viewport từng được capture | Capture thành công |
| `ASKED` | Người dùng từng hỏi | Câu hỏi gắn với marker |
| `SELF_REPORTED` | Người dùng tự chọn Đã hiểu | Nút xác nhận |
| `CHECKED` | Trả lời được checkpoint | Kết quả kiểm tra |
| `NEEDS_REVIEW` | Chọn Chưa hiểu hoặc trả lời sai | Phản hồi rõ ràng |

Agent không được kết luận “đã thành thạo” chỉ từ `SEEN` hoặc một lần `SELF_REPORTED`.

### 3.7 Skill: Resume Learning

**Mục tiêu:** Đưa người dùng trở về dấu mốc cũ.

**Sử dụng:** `highlight_or_resume`, `read_memory`.

**Cách resume theo thứ tự:**

1. Tìm text fingerprint còn khớp.
2. Tìm heading.
3. Dùng scroll ratio làm fallback.
4. Nếu trang đã thay đổi quá nhiều, mở URL và báo không thể định vị chính xác.

### 3.8 Skill: Controlled Research

**Mục tiêu:** Tìm nguồn ngoài viewport khi người dùng cần.

**Sử dụng:** `search_web`.

**Ràng buộc MVP:**

- Không tự search chỉ vì model “thấy khó”.
- Chỉ chạy sau câu hỏi rõ ràng hoặc xác nhận của người dùng.
- Trả link nguồn cùng phần giải thích.
- Tối đa một lượt search cho một câu hỏi trong demo.
- Đây là `Should have`, không thuộc E2E bắt buộc.

### 3.9 Skill: Privacy Control

**Mục tiêu:** Cho người dùng biết, kiểm soát và xóa dữ liệu.

**Sử dụng:** `update_source_policy`, `forget_memory`.

**Phạm vi xóa:**

- một marker;
- mọi marker trên một URL;
- mọi marker của một domain;
- toàn bộ memory;
- toàn bộ short-term session.

---

## 4. System Tools chi tiết

### 4.1 `check_source_policy`

**Owner:** Extension/System  
**Model được bỏ qua:** Không

```text
Input:
  url
  protocol
  title
  detected_content_type
  user_allowlist
  user_denylist

Output:
  allowed: boolean
  source_type: article | docs | sensitive | video | pdf | internal | unknown
  reason_code
  safe_url
```

**Side effect:** Không.  
**Failure:** Mặc định từ chối đọc.

### 4.2 `capture_current_viewport`

**Owner:** Content script/System  
**Điều kiện:** `check_source_policy.allowed == true`

```text
Input:
  tab_id
  max_chars = 4000

Output:
  url
  title
  heading
  visible_text
  visible_code
  scroll_ratio
  fingerprint
  captured_at
```

**Side effect:** Không ghi long-term memory.  
**Failure:** Trả `NO_READABLE_CONTENT`, không gửi nội dung rỗng cho model rồi giả vờ đã đọc.

### 4.3 `build_context_packet`

**Owner:** Extension/Application

```text
Input:
  sanitized_viewport
  related_memory_summaries
  recent_short_session
  user_message

Output:
  bounded ContextPacket cho Agent API
```

**Rule:** Loại dữ liệu thừa, giới hạn kích thước và không chứa secret.

### 4.4 `update_short_session`

**Owner:** Sidebar runtime  
**Tự động:** Có

Lưu viewport gần nhất, vài lượt chat và tool result trong RAM/state của sidebar. Đây không phải tool cần LLM gọi sau mỗi câu trả lời.

### 4.5 `save_marker`

**Owner:** MemoryRepository/System  
**Trigger:** Nút `Đã hiểu`, `Chưa hiểu`, `Xem lại sau` hoặc xác nhận rõ ràng.

```text
Input:
  ViewportContext
  selected_status
  optional_note
  evidence

Output:
  saved MemoryMarker
```

**Side effect:** Ghi `browser.storage.local`.

### 4.6 `update_understanding`

**Owner:** MemoryRepository/System

Chỉ cập nhật marker có thật. Mỗi lần cập nhật phải append evidence, timestamp và nguồn hành động.

### 4.7 `highlight_or_resume`

**Owner:** Content script/System

Tìm và highlight đoạn dựa trên fingerprint/heading; scroll ratio chỉ là fallback. Không chạy trên trang bị policy chặn.

### 4.8 `forget_memory`

**Owner:** MemoryRepository/System  
**Trigger:** Yêu cầu người dùng.

Xóa đúng phạm vi đã chọn và trả số bản ghi đã xóa. Không cho model tự quyết định xóa.

### 4.9 `update_source_policy`

**Owner:** SettingsRepository/System  
**Trigger:** Người dùng chọn `Never read`, `Allow once` hoặc gỡ chặn.

`Allow once` chỉ có hiệu lực cho tab hoặc lần kích hoạt hiện tại, không tự biến thành allowlist dài hạn.

---

## 5. Agent Tools chi tiết

### 5.1 `get_viewport_context`

Trả context đã được `capture_current_viewport` và `build_context_packet` xử lý. Tool này không cho model đọc DOM trực tiếp.

### 5.2 `search_memory`

```text
Input:
  url?
  heading?
  fingerprint?
  topic?
  status?
  limit = 5

Output:
  danh sách memory_id + summary + match_reason
```

Không trả toàn bộ dữ liệu memory trong kết quả tìm kiếm.

### 5.3 `read_memory`

```text
Input:
  memory_id

Output:
  một MemoryMarker đã được lọc
```

Chỉ đọc ID đến từ `search_memory` hoặc được người dùng chọn.

### 5.4 `search_web`

```text
Input:
  query
  reason

Output:
  tối đa vài nguồn có title, URL và snippet
```

Tool phải bị gate bởi `user_requested_search == true` hoặc confirmation.

### 5.5 `propose_marker`

```text
Input:
  proposed_status
  proposed_note
  evidence_summary

Output:
  đề xuất hiển thị trên UI
```

Không ghi dữ liệu. UI phải yêu cầu người dùng xác nhận trước khi gọi `save_marker`.

---

## 6. Bộ nhớ của hệ thống

### 6.1 Điều gì được xem là memory?

Memory là **bằng chứng về lần tương tác học tập**, không phải bản sao toàn bộ trang và không phải toàn bộ chat log.

Một marker mẫu:

```json
{
  "memory_id": "uuid",
  "url": "https://example.com/attention",
  "safe_url": "https://example.com/attention",
  "title": "Understanding Self-Attention",
  "heading": "Query, Key and Value",
  "snippet_fingerprint": "sha256:...",
  "snippet_preview": "Query represents...",
  "scroll_ratio": 0.62,
  "topic": "Query-Key-Value",
  "status": "NOT_UNDERSTOOD",
  "question": "Key dùng để làm gì?",
  "note": "Chưa hiểu vai trò của Key",
  "evidence": [
    {
      "type": "USER_MARKED_NOT_UNDERSTOOD",
      "at": "2026-09-12T11:00:00+07:00"
    }
  ],
  "created_at": "2026-09-12T11:00:00+07:00",
  "updated_at": "2026-09-12T11:00:00+07:00"
}
```

### 6.2 Short-term memory

**Nơi lưu MVP:** RAM/state của sidebar.

**Nội dung:**

- viewport gần nhất;
- tối đa vài lượt hội thoại;
- memory summaries đã retrieve;
- action proposal chưa xác nhận;
- request/session ID.

**Vòng đời:**

```text
Mở sidebar -> tạo session
Chat -> cập nhật state
Đóng/kết thúc -> xóa state
```

Không cần ghi short-term memory xuống disk sau mỗi câu.

### 6.3 Long-term memory

**Nơi lưu MVP:** `browser.storage.local`.

**Nội dung:**

- marker;
- evidence của mức hiểu;
- note ngắn;
- source policy và denylist;
- schema version.

**Vòng đời:**

```text
User xác nhận
  -> save_marker
  -> browser.storage.local
  -> search_memory khi quay lại
  -> update hoặc forget theo yêu cầu
```

“Long-term” nghĩa là tồn tại qua các lần tương tác trong vòng đời extension. Nó không phải bộ nhớ bất tử: người dùng có thể xóa, extension có thể bị gỡ và Temporary Add-on có thể bị reset.

### 6.4 Backend có lưu memory không?

**Không trong MVP.** Backend chỉ:

1. Nhận ContextPacket.
2. Chạy agent/model.
3. Trả answer và action proposal.

Không cần SQLite, vector database hoặc cloud memory cho E2E hiện tại.

### 6.5 Dữ liệu không được lưu

- API key hoặc token.
- Toàn bộ HTML của trang.
- Toàn bộ nội dung private chat.
- Password, form input hoặc dữ liệu thanh toán.
- Nội dung từ nguồn bị chặn.
- Chain-of-thought của model.

### 6.6 Lưu ý Temporary Add-on

Demo được load bằng `about:debugging` dưới dạng Temporary Add-on.

- Không đóng hoặc restart Firefox trong lúc chuẩn bị và demo.
- Khai báo add-on ID cố định.
- Có nút hoặc file seed để khôi phục marker demo.
- Không coi `browser.storage.local` của Temporary Add-on là bảo đảm lưu vĩnh viễn qua mọi lần reload/reset.

---

## 7. Agent loop

### 7.1 Luồng chuẩn

```text
USER CLICK
    |
    v
CHECK SOURCE POLICY       <- System bắt buộc
    |
    +-- DENY -> Hiển thị lý do, dừng
    |
    v
CAPTURE VIEWPORT          <- System, giới hạn 2.000-4.000 ký tự
    |
    v
SEARCH MEMORY             <- System preload hoặc Agent tool
    |
    v
BUILD CONTEXT PACKET
    |
    v
AGENT REASON
    |
    +-- Đủ context -> ANSWER
    |
    +-- Thiếu context -> hỏi lại hoặc đề xuất SEARCH WEB
    |
    v
ANSWER + ACTION PROPOSAL
    |
    v
USER CONFIRMS
    |
    v
SAVE / UPDATE / HIGHLIGHT <- System command
```

### 7.2 Giới hạn loop

- Tối đa 4 tool calls trong một lượt chat.
- Tối đa 1 lần `search_web` trong một lượt.
- Không lặp tool với cùng input.
- Không ghi long-term memory nếu chưa có confirmation.
- Nếu tool lỗi, trả lỗi rõ ràng thay vì suy đoán dữ liệu.
- Nếu source policy từ chối, agent loop không được bắt đầu.

### 7.3 Khi nào cần capture lại viewport?

Capture lại nếu:

- URL thay đổi;
- heading thay đổi;
- scroll position thay đổi đáng kể;
- người dùng bấm `Refresh context`;
- câu hỏi nói về “đoạn hiện tại” nhưng cache đã cũ.

Không cần capture lại sau mọi token hoặc mọi câu nếu viewport vẫn giữ nguyên.

---

## 8. Các luồng hệ thống

### 8.1 Mở trang mới nhưng chưa bấm extension

```text
Page opened
-> Agent ngủ
-> Không đọc DOM
-> Không gọi model
-> Không lưu memory
```

### 8.2 Mở sidebar trên trang được phép

```text
User click
-> check_source_policy = ALLOW
-> capture_current_viewport
-> search_memory
-> build_context_packet
-> Hiển thị heading + memory status
```

### 8.3 Mở sidebar trên trang bị chặn

```text
User click
-> check_source_policy = DENY
-> Không capture viewport
-> Không gọi Agent API
-> Hiển thị lý do
```

Ví dụ:

> YouTube bị bỏ qua trong MVP. Không có nội dung nào được trích xuất hoặc gửi tới model.

### 8.4 Người dùng hỏi về viewport

```text
Question
-> get_viewport_context
-> search_memory nếu cần
-> Agent trả lời
-> update_short_session tự động
```

### 8.5 Người dùng đánh dấu “Chưa hiểu”

```text
User clicks NOT_UNDERSTOOD
-> save_marker
-> update_understanding
-> highlight_or_resume(mode=highlight)
-> UI xác nhận đã lưu
```

### 8.6 Người dùng quay lại

```text
User opens extension on same page
-> capture_current_viewport
-> search_memory
-> marker matched
-> read_memory
-> Agent gợi lại câu hỏi và trạng thái cũ
```

### 8.7 Người dùng yêu cầu tìm thêm

```text
User clicks Search more
-> search_web
-> Agent tổng hợp kèm link nguồn
-> Không tự lưu kết quả vào long-term memory
```

### 8.8 Người dùng xóa ký ức

```text
User opens Memory panel
-> chọn marker/domain/all
-> xác nhận
-> forget_memory
-> UI hiển thị số bản ghi đã xóa
```

---

## 9. E2E tool trace bắt buộc

### 9.1 Luồng vàng

| Bước | Người dùng | Tool/Command | Kết quả |
|---:|---|---|---|
| 1 | Mở bài HTML và cuộn tới QKV | Chưa gọi tool | Agent ngủ |
| 2 | Bấm extension | `check_source_policy` | `ALLOW` |
| 3 | Chờ sidebar mở | `capture_current_viewport` | Đúng heading QKV |
| 4 | Sidebar khởi tạo | `search_memory` | Chưa có marker |
| 5 | Hỏi “Key dùng để làm gì?” | `get_viewport_context` | Agent trả lời đúng ngữ cảnh |
| 6 | Bấm `Chưa hiểu` | `save_marker` | Marker được ghi vào Firefox storage |
| 7 | Hệ thống phản hồi | `highlight_or_resume` | Đoạn hiện tại được highlight |
| 8 | Đóng và mở lại sidebar | `search_memory` + `read_memory` | Gợi lại trạng thái Chưa hiểu |
| 9 | Bấm `Đã hiểu` | `update_understanding` | Marker có evidence mới |

### 9.2 Luồng từ chối

| Bước | Người dùng | Tool/Command | Kết quả |
|---:|---|---|---|
| 1 | Mở YouTube hoặc PDF | Chưa đọc | Trang vẫn bình thường |
| 2 | Bấm extension | `check_source_policy` | `DENY` hoặc `UNSUPPORTED` |
| 3 | Sidebar hiển thị lý do | Không gọi viewport/model | Không gửi dữ liệu |

### 9.3 Điều giám khảo cần nhìn thấy

- Tool trace `policy -> viewport -> memory -> answer -> save -> resume`.
- Heading và text khớp với trang thật.
- Câu hỏi không cần copy-paste.
- Marker tồn tại khi đóng/mở sidebar.
- Nguồn bị chặn không tạo request tới model.
- Agent không tuyên bố người dùng đã hiểu nếu thiếu evidence.

---

## 10. Phạm vi MVP và phần để sau

### Must have

- `check_source_policy`
- `capture_current_viewport`
- `build_context_packet`
- `get_viewport_context`
- `search_memory`
- `read_memory`
- `save_marker`
- `update_understanding`
- `highlight_or_resume`
- `forget_memory`
- short-term sidebar state
- long-term `browser.storage.local`
- E2E vàng và E2E từ chối

### Should have

- `search_web`
- `propose_marker`
- checkpoint một câu
- UI quản lý `Never read`
- seed memory cho demo

### Không làm trong hackathon

- PDF parsing/OCR.
- YouTube transcript/video understanding.
- Theo dõi nền.
- Đọc private chat tự động.
- SQLite/cloud memory.
- Vector database/embedding search.
- Multi-agent.
- Đồng bộ nhiều thiết bị.
- Spaced repetition đầy đủ.

---

## 11. Quyết định team cần chốt trước khi code

- [ ] System policy luôn chạy trước Agent.
- [ ] Agent chỉ nhận viewport đã lọc, không đọc DOM trực tiếp.
- [ ] Long-term memory dùng `browser.storage.local` trong MVP.
- [ ] Backend stateless, không dùng SQLite trong MVP.
- [ ] Mọi thao tác ghi/xóa dài hạn cần hành động người dùng.
- [ ] `search_web` là tùy chọn, không nằm trong E2E bắt buộc.
- [ ] Demo chính chỉ chạy trên HTML article/docs.
- [ ] YouTube, PDF, social/personal và sensitive pages bị bỏ qua.
- [ ] Temporary Add-on có seed/recovery plan.
- [ ] E2E vàng là `đọc -> hỏi -> đánh dấu -> đóng/mở -> nhớ -> cập nhật`.

