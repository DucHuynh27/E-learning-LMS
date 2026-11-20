# Module: Catalog & Enrolment

> **Owner:** Huy (`@content`)
> **Hợp đồng API canonical:** [`catalog-api.md`](catalog-api.md)

## 1. Tổng quan
Module Catalog & Enrolment chịu trách nhiệm quản lý toàn bộ nội dung học tập của hệ thống LMS, bao gồm Khóa học (`Course`), Chương (`Section`), Bài học (`Lesson`) và Ghi danh học tập (`Enrolment`). Đây là domain trung tâm cung cấp dữ liệu cho module `Learning` (theo dõi tiến độ, nộp quiz) và `Media` (upload/stream video).

## 2. Luồng dữ liệu / kiến trúc

```
[Client]
   │
   ▼
[ValidationPipe] ──► Kiểm tra DTO, whitelist, forbidNonWhitelisted
   │
   ▼
[JwtAuthGuard & RolesGuard] ──► Xác thực JWT và kiểm tra Role (INSTRUCTOR, ADMIN, STUDENT)
   │
   ▼
[Controller] (Courses / Sections / Lessons / Enrolments)
   │
   ▼
[Service] ──► Kiểm tra quyền sở hữu (ownership), logic publish/enroll, tính slug, quản lý position
   │
   ├──► [PublishedLessonCache] ──► Invalidate cache Redis khi publish/unpublish/sửa lesson
   │
   ▼
[TypeORM Repository] ──► PostgreSQL (courses, sections, lessons, enrolments)
   │
   ▼
[TransformInterceptor] ──► Chuẩn hóa output thành { data: ... }
```

## 3. Các file chính

| File | Trách nhiệm |
|---|---|
| `courses/course.entity.ts` | Entity `Course`: lưu thông tin cơ bản, slug unique, trạng thái DRAFT/PUBLISHED/ARCHIVED, instructorId |
| `courses/courses.service.ts` | Xử lý CRUD khóa học, tạo slug tự động, publish/unpublish, lọc theo quyền truy cập |
| `courses/courses.controller.ts` | Endpoints quản lý và truy vấn khóa học (`/v1/courses`) |
| `courses/slug.util.ts` | Hàm sinh slug chuẩn hóa tiếng Việt có dấu, khử ký tự đặc biệt, fallback timestamp |
| `sections/section.entity.ts` | Entity `Section`: nhóm bài học theo khóa học, quản lý vị trí `position` |
| `sections/sections.service.ts` | Thêm, sửa, xóa section, tính toán auto-position |
| `sections/sections.controller.ts` | Endpoints section (`/v1/courses/:courseId/sections`, `/v1/sections/:id`) |
| `lessons/lesson.entity.ts` | Entity `Lesson`: bài học (VIDEO, ARTICLE, QUIZ), durationSec, isPublished |
| `lessons/lessons.service.ts` | Thêm, sửa, xóa lesson, kích hoạt invalidate cache cho module Learning |
| `lessons/lessons.controller.ts` | Endpoints lesson (`/v1/sections/:sectionId/lessons`, `/v1/lessons/:id`) |
| `enrolments/enrolment.entity.ts` | Entity `Enrolment`: ghi nhận học viên đăng ký khóa học, tiến độ hoàn thành |
| `enrolments/enrolments.service.ts` | Đăng ký khóa học, kiểm tra điều kiện PUBLISHED, tra cứu enrolment cá nhân và theo khóa |
| `enrolments/enrolments.controller.ts` | Endpoints enroll (`/v1/courses/:courseId/enroll`, `/v1/enrolments/me`, `/v1/courses/:courseId/enrolments`) |
| `database/migrations/1794100000000-Catalog.ts` | Migration DDL tạo bảng, ENUMs, ràng buộc CHECK, FOREIGN KEY và INDEX |

## 4. Quyết định thiết kế & lý do

- **Quan hệ tầng bậc `Course → Section → Lesson` với `onDelete: 'CASCADE'`:**
  - Khi xóa một Section, tất cả các bài học thuộc Section đó tự động được dọn dẹp trong DB, tránh sinh ra bản ghi mồ côi (orphan records).
  - Khóa ngoại `Course.instructorId` trỏ về `User` dùng `onDelete: 'RESTRICT'` để ngăn việc vô tình xóa tài khoản giảng viên khi họ vẫn đang sở hữu khóa học đang phát hành.
- **Ràng buộc Unique `(courseId, position)` và `(sectionId, position)`:**
  - Đảm bảo trong cùng một khóa học hoặc một chương, không thể có hai mục có cùng số thứ tự. Vị trí hiển thị luôn rõ ràng và xác định khi sort `ORDER BY position ASC`.
- **Ràng buộc Unique `(userId, courseId)` trên bảng `enrolments`:**
  - Ngăn chặn một học viên ghi danh nhiều lần vào cùng một khóa học, đồng thời hỗ trợ cập nhật tiến độ học tập (`progressPct`) trong `LearningModule` an toàn và không bị duplicate lock.
- **Tại sao chỉ cho phép ghi danh (`enroll`) khi khóa ở trạng thái `PUBLISHED`?**
  - Khóa học ở trạng thái `DRAFT` là nội dung đang soạn thảo bởi giảng viên, chưa hoàn thiện về cấu trúc và bài học. Việc chặn ghi danh ở mức API (trả về HTTP 409 Conflict) đảm bảo học viên không truy cập vào nội dung dở dang.
- **Điều kiện tiên quyết để `publish` khóa học:**
  - Khóa học phải có ít nhất **1 section** và ít nhất **1 lesson**. Nếu vi phạm, hệ thống từ chối publish với lỗi 409 Conflict. Điều này tránh việc người dùng thấy các khóa học "rỗng" trên trang chủ.
- **Tích hợp Invalidation Cache với `LearningModule`:**
  - `PublishedLessonCache` trong module Learning cache số lượng lesson published trên Redis để tối ưu tính toán phần trăm tiến độ. Khi Catalog thay đổi cấu trúc bài học (thêm, sửa trạng thái publish, xóa bài học), `PublishedLessonCache.invalidate(courseId)` được tự động gọi để làm mới cache ngay lập tức.

## 5. Cơ sở dữ liệu liên quan

| Entity | Trường quan trọng | Index / Unique | Lý do |
|---|---|---|---|
| `Course` | `id`, `slug`, `instructorId`, `status`, `priceCents` | Unique `(slug)`<br>Index `(instructorId)`<br>Index `(status, createdAt)` | Tra cứu nhanh theo slug trên URL; lọc khóa học theo giảng viên; lọc danh sách trang chủ theo ngày tạo của các khóa `PUBLISHED`. |
| `Section` | `id`, `courseId`, `position` | Unique `(courseId, position)`<br>Index `(courseId)` | Đảm bảo thứ tự chương duy nhất trong khóa; truy vấn nhanh toàn bộ section của khóa. |
| `Lesson` | `id`, `sectionId`, `position`, `durationSec`, `isPublished` | Unique `(sectionId, position)`<br>Index `(sectionId)` | Đảm bảo thứ tự bài học duy nhất trong chương; kiểm tra duration >= 0. |
| `Enrolment` | `id`, `userId`, `courseId`, `status`, `progressPct` | Unique `(userId, courseId)`<br>Index `(courseId, status)`<br>Index `(userId)` | Chống ghi danh trùng lặp; truy vấn danh sách học viên theo khóa; tra cứu lịch sử học tập của cá nhân. |

## 6. API Endpoints

| Method | Path | Quyền | Input (DTO) | Output |
|---|---|---|---|---|
| POST | `/v1/courses` | INSTRUCTOR, ADMIN | `CreateCourseDto` | 201 `CourseResponse` |
| GET | `/v1/courses` | Public | `CourseQueryDto` (?page, limit, q, instructorId, status) | 200 `{ items, meta }` |
| GET | `/v1/courses/:id` | Auth (STUDENT, INSTRUCTOR, ADMIN) | — | 200 `CourseDetailResponse` |
| PATCH | `/v1/courses/:id` | Owner / ADMIN | `UpdateCourseDto` | 200 `CourseResponse` |
| DELETE | `/v1/courses/:id` | Owner / ADMIN | — | 204 No Content |
| POST | `/v1/courses/:id/publish` | Owner / ADMIN | — | 200 `CourseResponse` |
| POST | `/v1/courses/:id/unpublish` | Owner / ADMIN | — | 200 `CourseResponse` |
| POST | `/v1/courses/:courseId/sections` | Owner / ADMIN | `CreateSectionDto` | 201 `SectionResponse` |
| PATCH | `/v1/sections/:id` | Owner / ADMIN | `UpdateSectionDto` | 200 `SectionResponse` |
| DELETE | `/v1/sections/:id` | Owner / ADMIN | — | 204 No Content |
| POST | `/v1/sections/:sectionId/lessons` | Owner / ADMIN | `CreateLessonDto` | 201 `LessonResponse` |
| PATCH | `/v1/lessons/:id` | Owner / ADMIN | `UpdateLessonDto` | 200 `LessonResponse` |
| DELETE | `/v1/lessons/:id` | Owner / ADMIN | — | 204 No Content |
| POST | `/v1/courses/:courseId/enroll` | STUDENT | — | 201 `EnrolmentResponse` |
| GET | `/v1/enrolments/me` | Auth | `EnrolmentQueryDto` (?page, limit) | 200 `{ items, meta }` |
| GET | `/v1/courses/:courseId/enrolments` | Owner / ADMIN | `EnrolmentQueryDto` (?page, limit) | 200 `{ items, meta }` |

## 7. Xử lý lỗi & edge case

- **Trùng lặp slug:** Tự động phát hiện xung đột và thêm hậu tố đếm (`-1`, `-2`, ...) khi tạo từ `title`. Nếu client chủ động đổi `slug` qua PATCH mà bị trùng với khóa học khác thì trả về `409 ConflictException`.
- **Phân quyền truy cập theo role (RBAC & Ownership):**
  - Client chưa đăng nhập hoặc sinh viên chỉ xem được các khóa học có trạng thái `PUBLISHED`. Khóa `DRAFT` sẽ trả về `404 Not Found` để không làm lộ sự tồn tại của khóa học đang soạn.
  - Giảng viên cố gắng sửa hoặc xóa khóa học/chương/bài học của giảng viên khác sẽ bị trả về `403 ForbiddenException`.
- **Ràng buộc khi ghi danh:**
  - Khóa học chưa `PUBLISHED` → trả về `409 ConflictException`.
  - Sinh viên đã ghi danh trước đó → trả về `409 ConflictException`.
- **Dữ liệu đầu vào lạ (Unknown fields):**
  - Nhờ cấu hình `forbidNonWhitelisted: true` trong global `ValidationPipe`, mọi payload có thuộc tính ngoài DTO đều bị từ chối với mã lỗi `400 Bad Request`.

## 8. Test
- **Unit test suite:** Đã viết đầy đủ các bài test độc lập cho từng service và utility:
  - `slug.util.spec.ts`: Kiểm tra chuẩn hóa tiếng Việt, ký tự đặc biệt, fallback khi chuỗi rỗng.
  - `courses.service.spec.ts`: Kiểm tra tạo khóa học, sinh slug duy nhất, cập nhật phân quyền, publish có điều kiện, unpublish, xóa.
  - `sections.service.spec.ts`: Kiểm tra tính toán vị trí tự động, kiểm tra quyền sở hữu của instructor, cập nhật, xóa.
  - `lessons.service.spec.ts`: Kiểm tra tạo bài học, cập nhật thông tin, kích hoạt dọn dẹp cache.
  - `enrolments.service.spec.ts`: Kiểm tra ghi danh thành công, chặn ghi danh khi khóa chưa mở hoặc đã ghi danh, phân trang danh sách ghi danh.
- Tất cả **63 unit tests** đều vượt qua (100% pass), `oxlint` không có cảnh báo hay lỗi.

## 9. Điểm nhấn kỹ thuật
1. **Quản lý phân cấp toàn vẹn dữ liệu ở tầng cơ sở dữ liệu:** Tận dụng triệt để constraint của PostgreSQL (Foreign Key Cascade, Composite Unique, Check Constraints) kết hợp với TypeORM decorator giúp hệ thống ngăn chặn dữ liệu sai lệch ngay từ tầng lưu trữ.
2. **ESM chuẩn hóa và Type-safety tuyệt đối:** Tuân thủ tiêu chuẩn Node.js ESM (`.js` extension trong mọi import nội bộ), khai báo kiểu cột TypeORM tường minh tương thích với môi trường không có metadata reflection runtime.
3. **Phân quyền đa tầng (Defense in Depth):** Kết hợp cả Role Guard ở tầng controller và Ownership Guard ở tầng service để bảo vệ tài nguyên khóa học của giảng viên.

## 10. Hạn chế / chưa làm
- Thanh toán học phí thực tế: Trường `priceCents` hiện tại lưu giá tiền tính theo cents để phục vụ sau này, nhưng ở Sprint 1 chưa tích hợp cổng thanh toán (Stripe/VNPay/MoMo) nên sinh viên được ghi danh trực tiếp.
- Re-order vị trí nhiều Section/Lesson cùng lúc theo dạng kéo thả (Drag & Drop bulk reorder): hiện tại hỗ trợ cập nhật từng `position` thông qua PATCH.
