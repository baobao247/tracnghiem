# Luyện Thi Trắc Nghiệm Pro — Changelog & Architecture Report

## 1. Deep Audit & Bugs Fixed
- **Trích xuất đáp án chính xác**: Tối ưu hóa thuật toán Regex nhận diện đáp án (A, B, C, D) từ file Word (DOCX) và PDF mà không bị nhầm lẫn với các ký tự viết hoa trong câu hỏi.
- **Khôi phục phiên làm bài (Session Auto-Restore)**: Lưu trạng thái làm bài tạm thời vào LocalStorage; nếu người dùng vô tình reload hoặc tắt trình duyệt, bài thi sẽ được tự động khôi phục nguyên vẹn.
- **Cơ chế phản hồi tức thì (Instant Feedback)**: Sửa trạng thái cập nhật màu đáp án đúng/sai ngay khi chọn trong chế độ luyện tập.

---

## 2. Kiến trúc Tái Cấu Trúc (Architecture Refactoring)
Phân chia toàn diện từ 1 file duy nhất thành kiến trúc module chuyên nghiệp:
```
tracnghiem/
├── css/
│   └── style.css            # Toàn bộ theme sáng/tối, layout câu hỏi, navigator grid & modals
├── js/
│   ├── app.js               # Khởi tạo DOM, tiện ích hiển thị, tabs nhập liệu, quản lý theme
│   ├── quiz-parser.js       # Bộ đọc DOCX (mammoth), PDF (pdf.js) & bóc tách cấu trúc câu hỏi
│   └── quiz-engine.js       # Máy thi: Bộ đếm giờ, chấm điểm, lọc câu sai, confetti, đề mẫu
├── index.html               # File HTML5 ngữ nghĩa, gọn gàng và tương thích cao
└── CHANGELOG.md             # Tài liệu kiểm toán và hướng dẫn sử dụng
```

---

## 3. Cải tiến UI/UX & Hiệu năng
- **Tối ưu hóa render danh sách câu hỏi**: Sử dụng DOM fragment và cập nhật class theo từng câu thay vì render lại toàn bộ container.
- **Navigator điều hướng trực quan**: Chấm trạng thái (đã làm, chưa làm, đúng, sai) đổi màu trực tiếp.

---

## 4. Tính năng mới bổ sung
1. **🔄 Nút "Ôn lại câu sai" (Retry Incorrect Only)**:
   - Trong bảng điểm kết quả, bấm nút màu vàng để tự động trích xuất các câu làm sai / bỏ qua và khởi động một bài ôn tập tập trung.
2. **🔍 Bộ lọc câu hỏi sau khi nộp (Review Filter Bar)**:
   - Cho phép lọc xem: *Tất cả*, *Chỉ câu sai (❌)*, *Chỉ câu đúng (✅)* để rà soát lỗi nhanh chóng.
3. **✨ 3 Bộ đề mẫu 1-click**: Tiếng Anh THPT, Lập trình & CNTT, Kiến thức đại cương không cần tải file.