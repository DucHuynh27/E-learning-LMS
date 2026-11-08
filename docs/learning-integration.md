# Bàn giao tích hợp Learning

Rà soát ngày 2026-11-08 trên `feat/learning`: remote `origin/feat/content` và `origin/feat/media` vẫn ở `c76b1b4`, chưa có entities/migrations Content/Media. Learning đã chạy với fixtures; chưa đánh dấu hoàn tất tích hợp Catalog thật.

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
- [ ] Khi publish/unpublish/thêm/xoá/chuyển lesson, gọi `PublishedLessonCache.invalidate(courseId)` cho các course bị ảnh hưởng.
- [ ] Chạy lại integration và QA e2e với schema thật, không dùng fixtures để tick hoàn tất mục này.

Learning giữ FK nội bộ và FK tới users từ migration hiện tại. Không tự tạo module Catalog hoặc thêm FK trỏ tới bảng chưa tồn tại trên nhánh này.

## 3. Kiểm thử đã có để QA tham khảo

```powershell
cd backend
$env:LEARNING_DB_TESTS = '1'
npm test -- src/learning/learning.integration.spec.ts src/learning/learning.http.integration.spec.ts
```

`learning.integration.spec.ts` kiểm tra service/transaction trên PostgreSQL. `learning.http.integration.spec.ts` khởi tạo AuthModule + LearningModule, dùng JWT/RolesGuard/ValidationPipe/envelope/filter thật, đi qua HTTP bằng Supertest. Cả hai dùng schema ngẫu nhiên riêng; Catalog vẫn là fixtures. HTTP suite stub riêng HealthService để kiểm tra route/error contract, không coi đó là health probe của hạ tầng thật.

| Luồng | Dev đã kiểm chứng | QA cần làm với hệ thống đầy đủ |
| --- | --- | --- |
| Progress | 401/403, UUID/body sai 400, ngưỡng 90%, phần trăm, cache cũ, hai bài hoàn thành đồng thời | Tạo/publish/enroll qua API Catalog thật; cập nhật tiến độ bằng tài khoản Student |
| Quiz | Owner/admin tạo/thay đề, role sai 403, nested DTO 400, draft preview, ẩn `isCorrect`, snapshot nhất quán khi sửa đồng thời | Tạo quiz trên lesson thật của Instructor; xác nhận Instructor khác bị từ chối |
| Attempt | Chấm server-side, question/option ngoài đề, deadline, giới hạn 3 lượt, submit một lần, rollback và concurrency | Thực hiện trọn vòng bắt đầu/nộp/làm lại từ frontend với Catalog thật |
| Certificate | Cấp một lần, danh sách cá nhân, JSON/HTML public, 404, CSP | Hoàn thành khóa thật và đối chiếu record/chứng chỉ, kiểm tra không cấp trùng |
| Health | Unit thành công/lỗi/timeout; HTTP contract 200/503 với probe stub | Bật/tắt PostgreSQL, Redis, MinIO thật và kiểm tra health |

E2E nền tảng `backend/test/app.e2e-spec.ts` hiện chỉ kiểm tra `/v1`; không đại diện cho nghiệm thu các luồng Learning ở trên. Review cross-cutting và chữ ký QA vẫn để mở trong TASKLIST.

## 4. Đưa integration vào CI

Workflow hiện tại chưa bật `LEARNING_DB_TESTS`, nên `pnpm test` mặc định bỏ qua các suite dùng PostgreSQL. Lead cần thêm bước dưới đây vào job đã có PostgreSQL và `.env` trước khi dùng CI làm bằng chứng nghiệm thu Learning:

```yaml
- name: Learning PostgreSQL integration
  run: pnpm test src/learning/learning.integration.spec.ts src/learning/learning.http.integration.spec.ts
  env:
    LEARNING_DB_TESTS: '1'
```

Hai suite tự tạo/chạy migration/dọn schema test riêng; tài khoản DB của job cần quyền tạo schema và extension UUID như môi trường hiện tại. Không cần khởi động Redis/MinIO cho bước này: suite kiểm tra fallback/cache adapter riêng, HTTP module suite stub HealthService. Không dùng việc test bị skip để tick nhiệm vụ này.
