# AGENTS.md — Dev Content

> Đọc [`prompt/AGENTS.md`](../AGENTS.md) trước. File này chỉ nói phần riêng của vai trò Dev Content.

## Vai trò
Sở hữu domain **nội dung khóa học** — người gỡ phụ thuộc cho mọi người (ai cũng cần `Course`/`Lesson`).

## Phạm vi module sở hữu
`CoursesModule` · `SectionsModule` · `LessonsModule` · `EnrolmentsModule`

## Entity cần tạo (kiểu cột tường minh!)
- **Course**: `id`, `title`, `slug` (unique), `description?`, `thumbnailKey?`, `priceCents`, `status` (DRAFT/PUBLISHED/ARCHIVED), `instructorId` (FK User), timestamps. Index `(instructorId)`, `(status, createdAt)`.
- **Section**: `id`, `courseId` (FK, cascade), `title`, `position`. Unique `(courseId, position)`.
- **Lesson**: `id`, `sectionId` (FK, cascade), `title`, `type` (VIDEO/ARTICLE/QUIZ), `position`, `durationSec`, `isPublished`. Unique `(sectionId, position)`.
- **Enrolment**: `id`, `userId`, `courseId`, `status`, `progressPct` (denormalized), `enrolledAt`, `completedAt?`. Unique `(userId, courseId)`. Index `(courseId, status)`.

## Phụ thuộc
- **Auth/RBAC của Lead** → chờ `RolesGuard`, `@Roles()`, `@CurrentUser()`.
- **Dev Media** cần `Lesson` trước khi làm video.
- **Dev Learning** cần `Enrolment`/`Lesson` cho progress.

## Ràng buộc riêng
- Phân quyền: Instructor sửa khóa của mình, Student chỉ enroll/đọc.
- Chỉ enroll được khóa `PUBLISHED`.
- Mọi route list phải phân trang.

## Definition of Done
CRUD khóa học chạy + phân quyền đúng role + e2e xanh (QA ký).

## TODO (đào sâu sau)
- [ ] Route spec chi tiết (method + path + quyền)
- [ ] DTO cho từng endpoint
- [ ] Quy tắc publish khóa (điều kiện gì thì cho PUBLISHED)
