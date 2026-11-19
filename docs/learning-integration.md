# Bàn giao tích hợp Learning

Rà soát ngày 2026-11-19: origin/feat/content vẫn chưa có implementation Catalog. PR #10 đã merge bằng admin bypass; tích hợp thật, FK/cascade và nghiệm thu QA còn mở. Xem learning-review.md để đối chiếu issue đã sửa.

## 1. Contract DB cần Content cung cấp

Các tên bảng/cột dưới đây được đọc/ghi bởi `backend/src/learning/catalog-access.service.ts` và `backend/src/progress/progress.service.ts`.

| Bảng | Cột cần dùng |
| --- | --- |
| `courses` | `id` UUID, `instructorId` UUID, `status` có `PUBLISHED` |
| `sections` | `id` UUID, `courseId` UUID, `position` integer |
| `lessons` | `id` UUID, `sectionId` UUID, `position` integer, `durationSec` integer không âm, `isPublished` boolean |
| `enrolments` | `id` UUID, `userId` UUID, `courseId` UUID, `status` có `ACTIVE`/`COMPLETED`/`EXPIRED`, `progressPct` integer, `completedAt` timestamptz nullable |

Enrolment cần unique `(userId, courseId)` để mỗi user/course có đúng một bản ghi khoá khi cập nhật tiến độ. Index unique theo vị trí Section/Lesson trong contract Catalog hỗ trợ truy vấn theo course. Media cần đồng bộ duration vào Lesson khi video sẵn sàng; Learning hiện dùng `lesson.durationSec` theo spec.

## 2. Việc phải chốt trước khi thêm FK

- [ ] Có migration Catalog thật, chạy trước migration thêm liên kết Learning.
- [ ] Kiểm tra/dọn record mồ côi: `lesson_progress.lessonId`, `quizzes.lessonId`, `certificates.courseId` phải tham chiếu dữ liệu thật hợp lệ.
- [ ] Lead và Content chốt hành vi khi xoá lesson/course, đặc biệt việc giữ hay thu hồi chứng chỉ đã cấp.
- [ ] Thêm migration FK tương ứng trong Learning và metadata entity khi có target entity thật; giữ `synchronize: false`.
- [ ] Chạy lại integration và QA e2e với schema thật, không dùng fixtures để tick hoàn tất mục này.

Learning giữ FK nội bộ và FK tới users từ migration hiện tại. Không tự tạo module Catalog hoặc thêm FK trỏ tới bảng chưa tồn tại trên nhánh này.

## 3. Kiểm thử đã có để QA tham khảo

```powershell
cd backend
npm test -- src/learning/learning.integration.spec.ts src/learning/learning.http.integration.spec.ts
```

`learning.integration.spec.ts` kiểm tra service/transaction trên PostgreSQL. `learning.http.integration.spec.ts` khởi tạo AuthModule + LearningModule, dùng JWT/RolesGuard/ValidationPipe/envelope/filter thật, đi qua HTTP bằng Supertest. Cả hai dùng schema ngẫu nhiên riêng; Catalog vẫn là fixtures. HTTP suite stub riêng HealthService để kiểm tra route/error contract, không coi đó là health probe của hạ tầng thật.

| Luồng | Dev đã kiểm chứng | QA cần làm với hệ thống đầy đủ |
| --- | --- | --- |
| Progress | 401/403, UUID/body sai 400, ngưỡng 90%, phần trăm PostgreSQL, GET read-only, hai bài hoàn thành đồng thời | Tạo/publish/enroll qua API Catalog thật; cập nhật tiến độ bằng tài khoản Student |
| Quiz | Owner/admin tạo/thay đề, role sai 403, nested DTO 400, draft preview, ẩn `isCorrect`, snapshot nhất quán khi sửa đồng thời | Tạo quiz trên lesson thật của Instructor; xác nhận Instructor khác bị từ chối |
| Attempt | Chấm server-side, question/option ngoài đề, deadline, giới hạn 3 lượt, submit một lần, rollback và concurrency | Thực hiện trọn vòng bắt đầu/nộp/làm lại từ frontend với Catalog thật |
| Certificate | Cấp một lần, danh sách cá nhân, JSON/HTML public, 404, CSP | Hoàn thành khóa thật và đối chiếu record/chứng chỉ, kiểm tra không cấp trùng |
| Health | Unit thành công/lỗi/timeout; HTTP contract 200/503 với probe stub | Bật/tắt PostgreSQL, Redis, MinIO thật và kiểm tra health |

E2E nền tảng `backend/test/app.e2e-spec.ts` hiện chỉ kiểm tra `/v1`; không đại diện cho nghiệm thu các luồng Learning ở trên. Review cross-cutting và chữ ký QA vẫn để mở trong TASKLIST.

## 4. CI và tổng bài published

Cấu hình đề xuất cho Lead: lint-and-test có PostgreSQL service, lint/build và npm test đầy đủ, không skip integration. Job frontend cài frozen lockfile rồi lint/test/typecheck/build. Job e2e chỉ kiểm tra nền tảng riêng. Số test hiện tại xem learning.md; kết quả local không đại diện cho required status checks trên GitHub.

PublishedLessonCache và invalidate đã bỏ. GET đọc snapshot chỉ đọc, PATCH tổng hợp số bài hiện tại từ PostgreSQL trong một câu SQL theo course; không gọi Redis trong lúc giữ row lock. Content không cần gửi cache invalidation để bảo đảm tỷ lệ/chứng chỉ. Khi nội dung thay đổi, GET phản ánh dữ liệu hiện tại còn enrolment denormalized được cập nhật ở PATCH kế tiếp; nếu cần đồng bộ ngay từ Content thì cần cơ chế ghi riêng do Content/Lead chốt.

Chưa thêm FK tới bảng Catalog chưa tồn tại và chưa quyết định cascade thay Lead/Content. Chứng chỉ đã cấp vẫn giữ nguyên theo chính sách hiện tại.
