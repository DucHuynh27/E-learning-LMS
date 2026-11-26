# Bàn giao tích hợp Learning

Catalog đã vào `main` qua PR #62. Learning chạy trên schema Catalog thật với migration liên kết dữ liệu và một bộ E2E dùng database PostgreSQL riêng. Xem `learning-review.md` để đối chiếu lịch sử review.

## 1. Contract DB cần Content cung cấp

Các tên bảng/cột dưới đây được đọc/ghi bởi `backend/src/learning/catalog-access.service.ts` và `backend/src/progress/progress.service.ts`.

| Bảng | Cột cần dùng |
| --- | --- |
| `courses` | `id` UUID, `instructorId` UUID, `status` có `PUBLISHED` |
| `sections` | `id` UUID, `courseId` UUID, `position` integer |
| `lessons` | `id` UUID, `sectionId` UUID, `position` integer, `durationSec` integer không âm, `isPublished` boolean |
| `enrolments` | `id` UUID, `userId` UUID, `courseId` UUID, `status` có `ACTIVE`/`COMPLETED`/`EXPIRED`, `progressPct` integer, `completedAt` timestamptz nullable |

Enrolment cần unique `(userId, courseId)` để mỗi user/course có đúng một bản ghi khoá khi cập nhật tiến độ. Index unique theo vị trí Section/Lesson trong contract Catalog hỗ trợ truy vấn theo course. Media cần đồng bộ duration vào Lesson khi video sẵn sàng; Learning hiện dùng `lesson.durationSec` theo spec.

## 2. Khóa ngoại Learning và Catalog

Migration `1795200000000-LinkLearningToCatalog` chạy sau Catalog với `synchronize: false`.

| Cột Learning | Tham chiếu | Khi xóa bản ghi được tham chiếu |
| --- | --- | --- |
| `lesson_progress.lessonId` | `lessons.id` | Cascade tiến độ của bài |
| `quizzes.lessonId` | `lessons.id` | Cascade quiz, câu hỏi, lựa chọn, lượt làm và câu trả lời |
| `certificates.courseId` | `courses.id` | Restrict. API xóa khóa đã cấp chứng chỉ trả 409 |

PostgreSQL xác thực dữ liệu cũ trong transaction khi thêm khóa ngoại. Nếu còn bản ghi mồ côi, migration dừng để quyết định cách xử lý bản ghi đó. Chứng chỉ đã cấp vẫn tra cứu được nếu giáo viên ẩn khóa học hoặc xóa một bài.

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

Chạy E2E Learning từ `backend` bằng `pnpm test:e2e test/learning-catalog.e2e-spec.ts`. Test dùng quyền `CREATEDB` để dựng một PostgreSQL database riêng, chạy migrations, rồi kiểm tra tạo/xuất bản/ghi danh, khôi phục lượt quiz, chấm điểm, tiến độ, tra cứu chứng chỉ và chính sách xóa. Database test được dọn sau khi chạy. Review cross-cutting và xác nhận từ QA là các bước bàn giao.

## 4. CI và tổng bài published

Cấu hình trong PR #29: lint-and-test có PostgreSQL service, lint/build và npm test đầy đủ, không skip integration. Job frontend cài frozen lockfile rồi lint/test/typecheck/build. Job e2e kiểm tra nền tảng riêng. Đã đọc log [CI run #31](https://github.com/DucHuynh27/E-learning-LMS/actions/runs/44504032170): backend 68 test, frontend 9 test và e2e 1 test đều qua trên head `16c3636` (merge ref `3f4abd0`). Lead vẫn cần review cấu hình và xác nhận required checks; chưa dùng kết quả với fixtures để tick tích hợp Catalog thật.

PublishedLessonCache và invalidate đã bỏ. GET đọc snapshot chỉ đọc, PATCH tổng hợp số bài hiện tại từ PostgreSQL trong một câu SQL theo course; không gọi Redis trong lúc giữ row lock. Content không cần gửi cache invalidation để bảo đảm tỷ lệ/chứng chỉ. Khi nội dung thay đổi, GET phản ánh dữ liệu hiện tại còn enrolment denormalized được cập nhật ở PATCH kế tiếp; nếu cần đồng bộ ngay từ Content thì cần cơ chế ghi riêng do Content/Lead chốt.

Trang chi tiết khóa học hiển thị tiến độ và chứng chỉ cho từng khóa đã ghi danh. Nút đánh dấu đã học lưu qua API Progress. Trang Learning vẫn dùng cho kịch bản demo.
