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
- DONE (bằng test): payload WebSocket `qna.thread.created`, `qna.post.created`, `notification.created` đã dùng Thread/Post/Notification response DTO; không lộ `authorId`/`userId` hoặc identity field lồng nhau.
- DONE (bằng test): catalog access fail closed cho mọi lỗi DB/hạ tầng; course missing trả 404; student chưa enroll bị 403.
- DONE (bằng test): `emitToCourse` revalidate từng socket trong room; socket mất quyền hoặc gặp lỗi catalog bị loại khỏi room và không nhận broadcast.
- Trade-off hiện tại: revalidation không dùng cache, nên mỗi broadcast có thể phát sinh một truy vấn quyền cho mỗi socket trong room. Cách này ưu tiên fail-closed và đúng dữ liệu; cần cân nhắc cache TTL ngắn ở rollout đa-instance.
- DONE (bằng test): E2E riêng database `lms_e2e`, cleanup/reset, student/owner/admin resolve, notification ownership, missing 404, cross-room và revoke enrollment.
- DONE (bằng stress): `pnpm test` 10/10 pass sau khi cô lập test state và bật `fileParallelism: false`.
- NEED REVIEW: CI GitHub trên PR #61/#64 chưa được xác nhận trong workspace hiện tại.

## Chiến lược test

- Unit test DTO: [`backend/src/common/dto/realtime-responses.dto.spec.ts`](../backend/src/common/dto/realtime-responses.dto.spec.ts).
- E2E HTTP/WebSocket: [`backend/test/qna-realtime.e2e-spec.ts`](../backend/test/qna-realtime.e2e-spec.ts).
- CI E2E: khởi động PostgreSQL rồi chạy migration, sau đó chạy `pnpm test:e2e`.
- Database E2E: sử dụng `lms_e2e`, riêng khỏi database dev.

### Hợp đồng tối thiểu Catalog

`QnaCatalogAccess` cần Catalog cung cấp các cột sau:

- `courses`: `id`, `instructorId`, `status`.
- `enrolments`: `id`, `userId`, `courseId`, `status`; quyền học viên chỉ được xác nhận khi `status` là `ACTIVE` hoặc `COMPLETED`.
- `findLesson` (khi dùng lesson trong Q&A) cần `lessons.id`, `lessons.sectionId`, `lessons.isPublished`, `sections.id`, `sections.courseId` và `courses.status`.

E2E hiện mô phỏng `courses` và `enrolments` trong database `lms_e2e`; fixture `courses` có thêm `title` và `slug` bắt buộc, cùng FK `instructorId` tới `users(id)`. Trước khi tạo fixture, test kiểm tra `information_schema`; bảng đã có thì không bị tạo lại hoặc drop. Test chỉ xóa dữ liệu theo UUID user/course được tạo riêng cho lần chạy. Nếu test tự tạo bảng mô phỏng, chỉ những bảng đó mới được drop, không dùng `CASCADE`.
