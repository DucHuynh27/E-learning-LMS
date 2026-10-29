# AGENTS.md — QA Realtime

> Đọc [`prompt/AGENTS.md`](../AGENTS.md) trước. File này chỉ nói phần riêng của vai trò QA Realtime.

## Vai trò
**Hai việc ghép lại:** xây tính năng real-time **và** là chốt kiểm soát chất lượng (ký Definition of Done).
QA độc lập với PO — không tự định nghĩa rồi tự duyệt.

## Phạm vi module sở hữu
`QnaModule` · `NotificationsModule` · `WsGateway` (Socket.io) · **toàn bộ e2e test**

## Real-time
- WebSocket gateway: xác thực JWT lúc **handshake**, chia **room theo course**.
- Event: câu hỏi/trả lời mới (Q&A), thông báo in-app, `video.ready`, `progress.updated`.
- Dùng **Redis adapter** Socket.io để chạy nhiều instance.

## Entity cần tạo
- **QnaThread**: `id`, `courseId`, `lessonId?`, `authorId`, `title`, `resolved`, `createdAt`. Index `(courseId, createdAt)`.
- **QnaPost**: `id`, `threadId` (FK cascade), `authorId`, `content`, `createdAt`. Index `(threadId, createdAt)`.

## Sở hữu test (điểm khác biệt)
- Viết **acceptance/e2e trước khi dev xong** (ATDD nhẹ) — QA sở hữu tầng e2e.
- Dựng **test DB riêng** cho e2e (hiện e2e đang chạy chung DB dev `elearning_lms` → rủi ro xoá data dev).
- Đảm bảo CI job e2e thực sự dùng được Redis/MinIO (hiện mới bật container).

## Phụ thuộc
- **Auth của Lead** (JWT cho handshake) và **Dev Content** (`Course`) trước khi làm Q&A.

## Definition of Done (do chính bạn ký cho các module khác)
API chạy + e2e xanh + phân quyền đúng role.

## TODO (đào sâu sau)
- [ ] Chiến lược test DB (schema riêng? reset giữa test?)
- [ ] Danh sách event WS + payload
- [ ] Ma trận acceptance test cho từng phase
