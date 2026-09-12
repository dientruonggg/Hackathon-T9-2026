# Viewport Learning Companion

> **Loại tài liệu:** MVP Product & Engineering Spec  
> **Trạng thái:** Draft để team review và chốt trước khi lập kế hoạch code  
> **Phiên bản:** 0.1  
> **Ngày:** 12/09/2026

## 0. Tóm tắt một câu

**Viewport Learning Companion là Firefox Agent hiểu phần nội dung đang nằm trước mắt người học, giúp họ hỏi ngay tại chỗ và ghi nhớ những nơi họ đã hiểu, chưa hiểu hoặc muốn quay lại.**

Nguyên tắc sản phẩm:

> Không luôn luôn quan sát, nhưng luôn có đúng ngữ cảnh khi người dùng gọi.

Agent không cố đọc toàn bộ Internet và không theo dõi nền. Nó chỉ phục vụ một khoảnh khắc học tập có chủ đích trong viewport hiện tại.

Luồng giá trị:

```text
Nhìn thấy -> Hỏi tại chỗ -> Đánh dấu -> Nhớ khi quay lại
```

---

## 1. Dự án phục vụ ai?

### 1.1 Người dùng mục tiêu

- Sinh viên học qua tài liệu trên web.
- Lập trình viên mới học qua documentation và tutorial.
- Người tự học thường xuyên đọc blog hoặc bài viết kỹ thuật.

### 1.2 Vấn đề cần giải quyết

Khi gặp một đoạn khó, người học thường phải:

1. Copy nội dung sang chatbot.
2. Mô tả lại ngữ cảnh.
3. Hỏi và nhận câu trả lời ở một nơi khác.
4. Sau đó không nhớ mình từng vướng ở trang hoặc đoạn nào.

Các sự thật cần phân biệt:

```text
Trang đã mở != Nội dung đã nhìn thấy
Nội dung đã nhìn thấy != Người học đã hiểu
Một lần nói "đã hiểu" != Kiến thức được nhớ lâu
```

Chatbot thông thường không biết người dùng đang nhìn phần nào và đã từng hỏi gì tại đúng vị trí đó.

### 1.3 Job to be done

> Khi đang đọc một phần kiến thức trên web, tôi muốn hỏi ngay về phần đang thấy và lưu dấu mức hiểu của mình, để lần sau quay lại tôi tiếp tục đúng nơi mà không phải dựng lại ngữ cảnh.

### 1.4 Giá trị sản phẩm

| Trước | Sau khi có Companion |
|---|---|
| Copy-paste đoạn văn sang chatbot | Agent tự lấy phần viewport sau khi người dùng bấm |
| Không nhớ đã hỏi ở đâu | Dấu mốc gắn với URL, heading và snippet |
| Chat mới mất ngữ cảnh | Agent truy xuất ký ức liên quan khi quay lại |
| Đọc xong tưởng là hiểu | Trạng thái hiểu dựa trên tín hiệu và bằng chứng rõ ràng |

### 1.5 Không phải sản phẩm gì?

- Không phải chatbot tổng quát.
- Không phải công cụ theo dõi toàn bộ lịch sử duyệt web.
- Không phải hệ thống tự động chấm năng lực chính xác tuyệt đối.
- Không phải roadmap nghề nghiệp.
- Không phải knowledge graph hoặc LMS đầy đủ.

---

## 2. Trải nghiệm người dùng tối thiểu

```text
Bấm mở -> Đọc viewport -> Hỏi -> Đánh dấu -> Quay lại
```

### Bước 1 - Kích hoạt

Người dùng bấm biểu tượng extension. Sidebar mở ra và xin đọc tab hiện tại.

Trước thời điểm này, extension không thu nội dung trang.

### Bước 2 - Hiểu vị trí hiện tại

Extension xác định:

- URL;
- tiêu đề trang;
- heading gần viewport nhất;
- vị trí cuộn;
- các khối text hoặc code đang giao với viewport.

Payload nội dung phải bị giới hạn độ dài để tránh gửi cả trang.

### Bước 3 - Gợi lại ký ức

Agent truy vấn bộ nhớ bằng:

```text
URL + heading + dấu vân tay snippet
```

Nếu đã có dấu mốc, sidebar nói rõ lần tương tác trước và trạng thái lúc đó.

Nếu chưa có dấu mốc, agent chỉ giới thiệu nội dung hiện tại và không được bịa lịch sử.

### Bước 4 - Hỏi và thao tác

Người dùng có thể hỏi:

```text
"Đoạn này nghĩa là gì?"
"Vì sao phải làm như vậy?"
"Giải thích đoạn code đang hiện."
```

Agent trả lời dựa trên viewport và ký ức liên quan. Sau đó người dùng chọn một trong ba trạng thái:

- `Đã hiểu`
- `Chưa hiểu`
- `Xem lại sau`

### Bước 5 - Đồng hành khi quay lại

Khi người dùng chủ động mở extension tại cùng trang hoặc cùng section, agent:

1. Tìm lại dấu mốc.
2. Hiển thị ghi chú và trạng thái cũ.
3. Cho phép tiếp tục câu hỏi.
4. Nếu có anchor phù hợp, cuộn hoặc highlight lại đoạn đã lưu.

Ví dụ:

> **Agent:** Bạn đang ở phần Query, Key và Value. Bạn từng đánh dấu phần này là Chưa hiểu. Muốn mình giải thích tiếp từ câu hỏi cũ về vai trò của Key không?
>
> **Người dùng:** Có, giải thích bằng ví dụ ngắn.

---

## 3. Agent được đọc gì và phải bỏ qua gì?

MVP áp dụng nguyên tắc **allow-by-context**:

- Chỉ đọc trang HTML có dạng bài viết hoặc tài liệu.
- Chỉ đọc sau khi người dùng chủ động kích hoạt.
- Domain hoặc loại trang nhạy cảm bị chặn trước khi trích xuất nội dung.

### 3.1 Chính sách nguồn mặc định

| Nhóm | Hành vi mặc định | Ví dụ |
|---|---|---|
| Cho phép | Đọc viewport sau khi bấm | Documentation, tutorial, technical blog, bài báo HTML |
| Bỏ qua | Không trích xuất nội dung | YouTube, video player, trang cá nhân, social feed |
| Nhạy cảm | Chặn mặc định; cần quyền riêng nếu hỗ trợ sau | ChatGPT, email, messaging, workspace riêng |
| Cấm | Không bao giờ đọc | Ngân hàng, thanh toán, password manager, trang quản trị, browser internal pages |
| Không hỗ trợ | Thông báo giới hạn | Firefox PDF viewer, ảnh scan, canvas, iframe bị khóa |

### 3.2 Quy tắc quyết định nguồn

1. Nếu URL thuộc danh sách cấm: dừng trước khi đọc DOM.
2. Nếu domain nằm trong danh sách `Never read` của người dùng: dừng và giải thích lý do.
3. Nếu trang là YouTube, video, social hoặc profile: báo không hỗ trợ trong MVP.
4. Nếu trang là HTML article hoặc docs: cho phép đọc viewport sau thao tác bấm.
5. Nếu không phân loại chắc chắn: không đọc; cho người dùng chọn `Cho phép lần này` hoặc `Luôn chặn`.

### 3.3 Quyền kiểm soát của người dùng

- Cho phép một lần trên tab hiện tại.
- Thêm domain vào danh sách `Never read`.
- Xem mọi dấu mốc đã lưu.
- Xóa một dấu mốc.
- Xóa ký ức theo domain.
- Xóa toàn bộ bộ nhớ.

### 3.4 Ranh giới PDF

Firefox chặn content script trong trình xem PDF tích hợp. Vì vậy MVP không cam kết biết viewport hoặc trang PDF hiện tại.

Khi gặp PDF, hệ thống phải:

1. Phát hiện loại trang.
2. Không cố inject content script.
3. Hiển thị `PDF chưa được hỗ trợ trong MVP`.
4. Không giả vờ rằng agent đã đọc được tài liệu.

Import PDF và OCR là nhánh tương lai, không nằm trong demo.

---

## 4. Viewport và mức độ hiểu

### 4.1 Dữ liệu viewport tối thiểu

| Trường | Mục đích | Giới hạn |
|---|---|---|
| `url` + `title` | Nhận diện nguồn | Không lưu query nhạy cảm nếu domain bị chặn |
| `heading` | Biết section hiện tại | Heading gần viewport nhất |
| `visible_text` | Ngữ cảnh cho câu hỏi | Tối đa 2.000-4.000 ký tự |
| `code_blocks` | Giải thích code đang thấy | Chỉ block giao viewport |
| `scroll_ratio` | Khôi phục gần vị trí cũ | Chỉ là vị trí, không phải bằng chứng đã đọc |
| `captured_at` | Sắp xếp và hết hạn | Thời gian địa phương |

### 4.2 Trạng thái mức hiểu

| Trạng thái | Ý nghĩa | Bằng chứng tối thiểu |
|---|---|---|
| `SEEN` | Agent đã đọc viewport khi người dùng kích hoạt | Capture thành công |
| `ASKED` | Người dùng đã hỏi về section | Có câu hỏi gắn với dấu mốc |
| `SELF_REPORTED` | Người dùng tự chọn Đã hiểu | Nút xác nhận; độ tin cậy vừa |
| `CHECKED` | Người dùng trả lời được một câu kiểm tra | Kết quả checkpoint; độ tin cậy cao hơn |
| `NEEDS_REVIEW` | Người dùng chọn Chưa hiểu hoặc trả lời sai | Phản hồi rõ ràng |
| `UNKNOWN` | Không đủ bằng chứng | Trạng thái mặc định an toàn |

### 4.3 Tuyên bố trung thực

Agent có thể **ước lượng** người dùng đã hiểu đến đâu dựa trên:

- câu hỏi đã hỏi;
- phản hồi `Đã hiểu` hoặc `Chưa hiểu`;
- kết quả checkpoint;
- lịch sử quay lại cùng section.

Agent không thể biết chắc người dùng đã hiểu chỉ vì nội dung xuất hiện trên màn hình. Mọi kết luận phải đi kèm nguồn bằng chứng.

### 4.4 Checkpoint tùy chọn

Nếu còn thời gian, MVP có thể có nút `Kiểm tra nhanh`.

Agent tạo đúng một câu hỏi từ viewport. Người dùng có quyền bỏ qua. Checkpoint giúp nâng trạng thái từ `SELF_REPORTED` lên `CHECKED`; đây không phải hệ thống thi cử.

---

## 5. Agent tools

Agent là một vòng `LLM + tools` nhỏ. Ứng dụng chịu trách nhiệm quyền truy cập và ghi dữ liệu; model chỉ yêu cầu công cụ phù hợp.

| Tool | Loại | Trách nhiệm |
|---|---|---|
| `read_current_viewport` | Đọc | Lấy context giới hạn từ tab hiện tại sau khi được phép |
| `check_source_policy` | Đọc | Quyết định domain hoặc loại trang có được đọc hay không |
| `search_web` | Đọc | Tìm nguồn bổ sung khi người dùng yêu cầu; trả link và snippet |
| `search_memory` | Đọc | Tìm dấu mốc theo URL, heading, topic và snippet fingerprint |
| `read_memory` | Đọc | Mở chi tiết một dấu mốc đã tìm thấy |
| `write_short_memory` | Ghi | Giữ context tạm trong lần mở sidebar |
| `write_long_memory` | Ghi | Lưu dấu mốc do người dùng xác nhận |
| `update_understanding` | Ghi | Cập nhật trạng thái và bằng chứng hiểu/chưa hiểu |
| `highlight_or_resume` | Thao tác | Highlight hoặc đưa người dùng về vị trí đã lưu |
| `forget_memory` | Xóa | Xóa dấu mốc theo yêu cầu người dùng |

### 5.1 Quy tắc tool

- `check_source_policy` luôn chạy trước `read_current_viewport`.
- Model không được tự bỏ qua denylist.
- Model không trực tiếp truy cập DOM.
- Tool đọc viewport phải giới hạn số ký tự.
- Tool ghi dài hạn phải có hành động hoặc xác nhận từ người dùng.
- Tool xóa phải xác định đúng phạm vi cần xóa.
- Tool result gửi cho model phải ngắn và có cấu trúc.

---

## 6. Bộ nhớ

### 6.1 Bộ nhớ ngắn hạn

Bộ nhớ ngắn hạn:

- tồn tại trong lần mở sidebar hoặc phiên hỏi hiện tại;
- giữ viewport hiện tại;
- giữ vài lượt hội thoại gần nhất;
- giữ kết quả tool gần nhất;
- tự xóa khi đóng phiên hoặc sau thời hạn cấu hình.

Ví dụ:

```json
{
  "current_heading": "Query, Key and Value",
  "visible_text": "...",
  "recent_question": "Key dùng để làm gì?"
}
```

### 6.2 Bộ nhớ dài hạn

Bộ nhớ dài hạn:

- tồn tại qua các lần đóng/mở Firefox;
- tồn tại đến khi người dùng xóa;
- chỉ lưu khi người dùng đánh dấu hoặc xác nhận một trạng thái có giá trị;
- không lưu toàn bộ nội dung trang hoặc toàn bộ hội thoại theo mặc định;
- mỗi ký ức phải có nguồn, thời gian, trạng thái và bằng chứng.

Trong spec này, **vĩnh cửu** nghĩa là không tự hết hạn trong phạm vi sản phẩm, không có nghĩa là không thể xóa.

### 6.3 Dữ liệu một dấu mốc

```json
{
  "memory_id": "uuid",
  "url": "https://example.com/attention",
  "title": "Understanding Self-Attention",
  "heading": "Query, Key and Value",
  "snippet_fingerprint": "sha256:...",
  "snippet_preview": "Query represents...",
  "scroll_ratio": 0.62,
  "status": "NEEDS_REVIEW",
  "question": "Key dùng để làm gì?",
  "note": "Chưa hiểu vai trò của Key",
  "evidence": ["USER_MARKED_NOT_UNDERSTOOD"],
  "created_at": "2026-09-12T10:00:00+07:00",
  "updated_at": "2026-09-12T10:05:00+07:00"
}
```

### 6.4 Truy vấn bộ nhớ

MVP không cần vector database. Thứ tự tìm:

1. URL chính xác.
2. Heading chính xác hoặc gần giống.
3. Snippet fingerprint.
4. Topic/tag nếu agent đã trích xuất.
5. Mốc gần nhất theo thời gian.

---

## 7. Kiến trúc sơ bộ

```text
Firefox Sidebar
      |
      v
Source Policy -> Viewport Extractor
      |
      v
Agent API <-> Memory Repository
      |
      v
LLM Provider
```

### 7.1 Thành phần

| Khối | Trách nhiệm MVP |
|---|---|
| Sidebar UI | Hiển thị context, chat, trạng thái nguồn và nút đánh dấu |
| Content script | Trích xuất heading/text/code giao viewport; highlight và resume |
| Background script | Mở sidebar, chuyển message, giữ quyền và trạng thái tab |
| Source policy | Allow/deny theo protocol, domain, page type và lựa chọn người dùng |
| Agent backend | Ghép context + memory, gọi model, điều phối tool và trả lời |
| Memory repository | Lưu dấu mốc, truy vấn liên quan, cập nhật và xóa |

### 7.2 Đề xuất lưu trữ

- Prototype nhanh: `browser.storage.local` cho memory và settings.
- Nếu cần backend dùng chung: SQLite cho memory; extension gửi user/session ID cục bộ.
- Không dùng vector database ở MVP.

### 7.3 Agent loop tối thiểu

```text
CHECK  -> trang có được đọc không?
READ   -> lấy viewport có giới hạn
RECALL -> truy vấn ký ức liên quan
ANSWER -> trả lời dựa trên context có nguồn
ACT    -> đánh dấu, highlight, update hoặc forget theo thao tác người dùng
```

Policy phải chạy trước model. Model không được tự ghi long-term memory nếu chưa có tín hiệu xác nhận từ người dùng.

---

## 8. E2E bắt buộc cho demo

### 8.1 Kịch bản vàng: quay lại một đoạn từng chưa hiểu

| Bước | Thao tác demo | Kết quả nhìn thấy |
|---:|---|---|
| 1 | Mở một bài HTML về Self-Attention | Trang thật trong Firefox |
| 2 | Cuộn tới heading Query, Key and Value | Đoạn cần học nằm trong viewport |
| 3 | Bấm extension | Sidebar báo đúng title + heading và tool trace `read_current_viewport` |
| 4 | Hỏi “Key dùng để làm gì?” | Agent trả lời dựa trên đoạn đang thấy |
| 5 | Bấm Chưa hiểu | Dấu mốc được lưu; trang được highlight |
| 6 | Đóng sidebar hoặc chuyển trang, rồi quay lại | Không cần nhập lại câu hỏi cũ |
| 7 | Bấm extension lần nữa | Agent gọi `search_memory` và gợi lại trạng thái Chưa hiểu |
| 8 | Bấm Giải thích cách khác | Agent tiếp tục đúng context; có thể cập nhật Đã hiểu |

### 8.2 Nhánh từ chối

1. Mở YouTube hoặc trang thuộc `Never read`.
2. Bấm extension.
3. Sidebar hiển thị:

> Trang này bị bỏ qua theo chính sách nguồn. Không có nội dung nào được trích xuất hoặc gửi tới model.

### 8.3 Tiêu chí hoàn thành E2E

- Không cần copy-paste nội dung.
- Heading trong sidebar khớp với viewport thật.
- Câu trả lời sử dụng nội dung viewport, không trả lời chung chung.
- Dấu mốc còn tồn tại sau khi đóng/mở sidebar.
- Quay lại đúng trang/heading sẽ truy xuất được dấu mốc.
- Nguồn bị chặn không gửi nội dung tới backend/model.
- PDF hiển thị giới hạn rõ ràng thay vì lỗi hoặc giả vờ đã đọc.

Thông điệp cần thể hiện trong demo:

> Agent không cần biết mọi thứ người dùng làm. Nó chỉ cần biết đúng phần người dùng đang nhìn khi được gọi, và nhớ chính xác lần đã đồng hành tại đó.

---

## 9. Phạm vi chốt

### 9.1 Must have

- Firefox sidebar mở từ toolbar.
- Source policy chặn PDF viewer, YouTube, social/personal, sensitive và custom denylist.
- Đọc title, URL, heading, visible text/code và scroll position của trang HTML được phép.
- Chat một câu hỏi dựa trên viewport.
- Ba trạng thái: Đã hiểu, Chưa hiểu, Xem lại sau.
- Long-term marker được lưu, tìm lại và xóa được.
- Highlight/resume.
- Một E2E test theo kịch bản vàng.

### 9.2 Should have nếu còn thời gian

- Nút Kiểm tra nhanh với một câu active recall.
- Tool trace nhỏ trong sidebar để giám khảo thấy read/search/write memory.
- Cho phép người dùng bổ sung domain vào `Never read`.

### 9.3 Không làm trong hackathon

- PDF parsing hoặc OCR.
- YouTube transcript hoặc video understanding.
- Theo dõi nền toàn bộ lịch sử duyệt web.
- Đọc private chat tự động.
- Browser automation rộng hoặc tài khoản online.
- Roadmap và spaced repetition đầy đủ.
- Vector database.
- Multi-agent.
- Đồng bộ đa thiết bị.

---

## 10. Thứ tự lập kế hoạch code sau khi team duyệt

| Mốc | Đầu ra kiểm chứng |
|---|---|
| A. Extension shell | Sidebar mở được; hiển thị tab hiện tại |
| B. Source policy | Trang cho phép đọc được; YouTube/PDF/denylist bị từ chối |
| C. Viewport | Heading và visible text khớp với màn hình |
| D. Memory | Save/search/read/delete marker chạy độc lập |
| E. Agent | Trả lời từ viewport + memory; không bịa nguồn |
| F. E2E | Chạy trọn kịch bản vàng và quay video dưới 2 phút |

### 10.1 Cách chạy bản demo

Demo sử dụng **Temporary Add-on** của Firefox, chưa publish lên addons.mozilla.org và chưa cần gói cài đặt đã ký.

Quy trình dự kiến:

1. Mở `about:debugging` trong Firefox.
2. Chọn `This Firefox`.
3. Chọn `Load Temporary Add-on`.
4. Chọn `manifest.json` trong thư mục extension.
5. Kiểm tra sidebar, quyền truy cập và backend trước khi quay/demo.

Temporary Add-on chỉ tồn tại cho đến khi bị remove hoặc Firefox khởi động lại. Vì vậy team cần:

- đặt add-on ID cố định trong `browser_specific_settings` để giảm rủi ro dữ liệu đổi theo ID;
- giữ sẵn tab `about:debugging`;
- có checklist reload extension trước demo;
- chuẩn bị dữ liệu seed cho kịch bản quay lại dấu mốc;
- không phụ thuộc vào việc publish hoặc review trên AMO trong ngày thi.

---

## 11. Rủi ro cần chấp nhận

- DOM của từng website khác nhau; extractor phải ưu tiên tính tổng quát và có fallback.
- ChatGPT là trang động và nhạy cảm; không đưa vào demo chính nếu chưa kiểm tra quyền riêng tư.
- Viewport chỉ phản ánh nội dung đang hiển thị, không chứng minh người dùng đã đọc kỹ.
- Mức hiểu là ước lượng có bằng chứng, không phải kết luận tuyệt đối.
- Firefox PDF viewer nằm ngoài phạm vi content script.

---

## 12. Các quyết định team cần chốt

- [ ] Demo chính chỉ chạy trên HTML article/docs.
- [ ] Extension chỉ đọc sau thao tác chủ động của người dùng.
- [ ] YouTube, social/personal pages và các nguồn nhạy cảm bị chặn mặc định.
- [ ] ChatGPT không nằm trong demo chính; nếu hỗ trợ phải xin quyền riêng.
- [ ] PDF/OCR không nằm trong MVP.
- [ ] Long-term memory tồn tại đến khi người dùng xóa.
- [ ] Mức hiểu luôn đi kèm bằng chứng và không được tuyên bố tuyệt đối.
- [ ] E2E vàng là `đọc viewport -> hỏi -> đánh dấu -> quay lại -> nhớ`.
- [ ] Demo chạy bằng Firefox Temporary Add-on qua `about:debugging`.

Khi các mục trên được duyệt, team mới chuyển sang kế hoạch code và chia task.

---

## 13. Nguồn kỹ thuật tham khảo

- [Mozilla MDN - Content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)
- [Mozilla MDN - Sidebars](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Sidebars)
- [Mozilla MDN - storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)
- [Firefox Extension Workshop - Temporary installation in Firefox](https://www.extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
- [Firefox Extension Workshop - Testing persistent and restart features](https://extensionworkshop.com/documentation/develop/testing-persistent-and-restart-features/)
