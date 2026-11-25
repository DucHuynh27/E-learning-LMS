# Module: Realtime Q&A & QA

> Owner: @qa · Điền theo [`_TEMPLATE.md`](_TEMPLATE.md)

**Hợp đồng API:** endpoint/DTO/response + WS event đã chốt tại [`qa-realtime-api.md`](qa-realtime-api.md).

## Phạm vi
`QnaModule` · `NotificationsModule` · `WsGateway` · **toàn bộ e2e test**

## Ghi chú
- REST được kiểm soát qua `JwtAuthGuard`; QnA thêm kiểm tra course/enrolment qua `QnaCatalogAccess`, resolve yêu cầu chủ khoá hoặc admin.
- WebSocket xác thực JWT lúc handshake, đặt socket vào room cá nhân `user:{userId}` và cho phép join `course:{courseId}` sau kiểm tra course access.
- Event hiện tại: `qna.thread.created`, `qna.post.created`, `notification.created`; Redis adapter được chuẩn bị để chạy nhiều instance.
- REST QnA/Notification đã dùng mapper DTO riêng để không trả entity và `authorId`/`userId` ra public response.
- Migration realtime được CI chạy trước E2E. E2E dùng PostgreSQL thật, kiểm tra JSON HTTP và JWT/WebSocket cơ bản.

## Trạng thái hiện tại

- DONE: entity/migration; REST thread/post/notification; DTO REST và kiểm tra JSON cơ bản; handshake JWT; join course; E2E happy-path.
- NEED REVIEW: payload WebSocket `qna.thread.created`, `qna.post.created`, `notification.created` vẫn nhận entity thô; cần mapper DTO dùng chung trước khi kết luận Issue #51 hoàn tất.
- PARTIAL: E2E chưa phủ đủ join course trái quyền, student resolve, 404/403, notification ownership ngoài API hiện tại, broadcast event và cleanup/test DB riêng.

## Chiến lược test

- Unit test DTO: [`backend/src/common/dto/realtime-responses.dto.spec.ts`](../backend/src/common/dto/realtime-responses.dto.spec.ts).
- E2E HTTP/WebSocket: [`backend/test/qna-realtime.e2e-spec.ts`](../backend/test/qna-realtime.e2e-spec.ts).
- CI E2E: khởi động PostgreSQL rồi chạy migration, sau đó chạy `pnpm test:e2e`.
- Cần bổ sung test DB riêng/schema reset hoặc strategy cleanup để không phụ thuộc dữ liệu dev.
