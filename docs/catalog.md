# Module: Catalog & Enrolment

> Owner: @content · Điền theo [`_TEMPLATE.md`](_TEMPLATE.md)

**Hợp đồng API:** endpoint/DTO/response đã chốt tại [`catalog-api.md`](catalog-api.md).

## Phạm vi
`CoursesModule` · `SectionsModule` · `LessonsModule` · `EnrolmentsModule`

## Ghi chú
- Giải thích quan hệ Course → Section → Lesson và `onDelete: Cascade`.
- Nêu lý do các unique `(courseId, position)`, `(userId, courseId)`.
- Vì sao chỉ enroll được khóa `PUBLISHED`.
