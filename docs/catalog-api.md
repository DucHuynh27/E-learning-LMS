# Hợp đồng API — Catalog & Enrolment

> **Canonical spec.** `@content` implement theo file này; `@qa` viết e2e dựa trên đây.
> Prompt vai trò: [`../prompt/dev-content/AGENTS.md`](../prompt/dev-content/AGENTS.md)
> Giải thích module: [`catalog.md`](catalog.md)

## 1. Quy ước chung

- **Versioning:** mọi route dưới `/v1`.
- **Auth:** mặc định yêu cầu `Authorization: Bearer <accessToken>`. Route công khai đánh dấu **Public** (`@Public()`).
- **Response:** luôn bọc `{ data: ... }` (do `TransformInterceptor`).
- **Lỗi:** `{ statusCode, message, path, timestamp }` (do `AllExceptionsFilter`).
- **Validation:** class-validator qua `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) → field lạ hoặc thiếu → **400**.
- **Phân trang:** query `page` (≥1, mặc định 1), `limit` (1..100, mặc định 20).

## 2. Quyền (RBAC)

| Vai trò | Quyền |
| --- | --- |
| Khách (chưa login) | Xem **danh sách** khoá học đã `PUBLISHED` |
| `STUDENT` | Như khách + enroll + xem enrolment của mình |
| `INSTRUCTOR` | CRUD section/lesson/course **của mình** + publish |
| `ADMIN` | Toàn quyền |

**Quy tắc sở hữu:** INSTRUCTOR chỉ thao tác khoá có `instructorId === user.userId`; ngược lại → **403**.

## 3. Entities & ràng buộc DB

| Entity | Trường chính | Ràng buộc / Index |
| --- | --- | --- |
| `Course` | `title`, `slug`, `description?`, `thumbnailKey?`, `priceCents`, `status` (DRAFT/PUBLISHED/ARCHIVED), `instructorId` | `slug` unique · index `(instructorId)` · `(status, createdAt)` |
| `Section` | `courseId`, `title`, `position` | unique `(courseId, position)` · FK cascade |
| `Lesson` | `sectionId`, `title`, `type` (VIDEO/ARTICLE/QUIZ), `position`, `durationSec`, `isPublished` | unique `(sectionId, position)` · FK cascade |
| `Enrolment` | `userId`, `courseId`, `status` (ACTIVE/COMPLETED/EXPIRED), `progressPct`, `enrolledAt`, `completedAt?` | unique `(userId, courseId)` · index `(courseId, status)` |

> `slug` sinh tự động từ `title` khi tạo; có thể sửa qua PATCH; phải unique.

## 4. Endpoints

| Method | Path | Quyền | Input | Success |
| --- | --- | --- | --- | --- |
| POST | `/v1/courses` | INSTRUCTOR, ADMIN | `CreateCourseDto` | 201 `CourseResponse` |
| GET | `/v1/courses` | **Public** | `?page&limit&q&instructorId&status` | 200 `{ items, meta }` |
| GET | `/v1/courses/:id` | Auth | — | 200 `CourseDetailResponse` |
| PATCH | `/v1/courses/:id` | owner / ADMIN | `UpdateCourseDto` | 200 `CourseResponse` |
| DELETE | `/v1/courses/:id` | owner / ADMIN | — | 204 |
| POST | `/v1/courses/:id/publish` | owner / ADMIN | — | 200 `CourseResponse` |
| POST | `/v1/courses/:id/unpublish` | owner / ADMIN | — | 200 `CourseResponse` |
| POST | `/v1/courses/:courseId/sections` | owner / ADMIN | `CreateSectionDto` | 201 `SectionResponse` |
| PATCH | `/v1/sections/:id` | owner / ADMIN | `UpdateSectionDto` | 200 `SectionResponse` |
| DELETE | `/v1/sections/:id` | owner / ADMIN | — | 204 |
| POST | `/v1/sections/:sectionId/lessons` | owner / ADMIN | `CreateLessonDto` | 201 `LessonResponse` |
| PATCH | `/v1/lessons/:id` | owner / ADMIN | `UpdateLessonDto` | 200 `LessonResponse` |
| DELETE | `/v1/lessons/:id` | owner / ADMIN | — | 204 |
| POST | `/v1/courses/:courseId/enroll` | STUDENT | — | 201 `EnrolmentResponse` |
| GET | `/v1/enrolments/me` | Auth | `?page&limit` | 200 `{ items, meta }` |
| GET | `/v1/courses/:courseId/enrolments` | owner / ADMIN | `?page&limit` | 200 `{ items, meta }` |

**Quy tắc `publish`:** chỉ publish khi khoá có **≥1 section và ≥1 lesson**; nếu không → **409**.

**Quy tắc `enroll`:** khoá phải `PUBLISHED`; chưa mở → **409**; đã enroll → **409**.

## 5. DTO (request)

**CreateCourseDto**
| Field | Kiểu | Ràng buộc |
| --- | --- | --- |
| `title` | string | bắt buộc, 1..200 |
| `description` | string? | ≤ 5000 |
| `priceCents` | int? | ≥ 0, mặc định 0 |
| `thumbnailKey` | string? | — |

**CreateSectionDto**: `title` string 1..200 (bắt buộc) · `position` int ≥ 0 (tuỳ chọn; mặc định = cuối danh sách).

**CreateLessonDto**: `title` string 1..200 · `type?` enum VIDEO/ARTICLE/QUIZ (mặc định ARTICLE) · `position?` int ≥ 0 · `durationSec?` int ≥ 0 (mặc định 0) · `isPublished?` boolean (mặc định false).

**Update\*Dto**: như bản Create nhưng **mọi field tuỳ chọn** (dùng `PartialType` của `@nestjs/mapped-types`).

## 6. Response shapes (field public)

```
CourseResponse   { id, title, slug, description, priceCents, status, thumbnailKey, instructorId, createdAt, updatedAt }
SectionResponse  { id, courseId, title, position }
LessonResponse   { id, sectionId, title, type, position, durationSec, isPublished }
EnrolmentResponse{ id, courseId, userId, status, progressPct, enrolledAt, completedAt }

CourseDetailResponse = CourseResponse + { sections: (SectionResponse & { lessons: LessonResponse[] })[] }
```

- Danh sách: `{ data: { items: T[], meta: { page, limit, total } } }`.
- Đơn: `{ data: T }`.
- **Không** trả `passwordHash` hay field nội bộ khác.

## 7. Mã lỗi

| Mã | Khi nào |
| --- | --- |
| 400 | DTO sai / thiếu field bắt buộc / field lạ |
| 401 | Chưa login hoặc token sai/hết hạn |
| 403 | Sai role, hoặc không phải chủ sở hữu |
| 404 | Không tìm thấy (hoặc course chưa `PUBLISHED` với STUDENT) |
| 409 | Trùng `slug` · publish khi thiếu nội dung · enroll khoá chưa mở / đã enroll |

## 8. Ghi chú cho @qa (e2e)

- STUDENT tạo course → **403**.
- INSTRUCTOR tạo course → 201; PATCH course của người khác → **403**.
- GET `/v1/courses` (không token) → chỉ thấy `PUBLISHED`.
- publish khi chưa có lesson → **409**; sau khi thêm section+lesson → 200.
- enroll 2 lần cùng khoá → lần 2 **409**; enroll khoá DRAFT → **409**.
- DTO thừa field → **400** (nhờ `forbidNonWhitelisted`).
