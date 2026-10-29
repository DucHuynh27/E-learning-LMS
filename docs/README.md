# docs/ — Tài liệu giải thích module

Mục đích: mỗi người viết **một file giải thích module mình phụ trách**, để chứng minh
độ hiểu code (đây là tiêu chí chấm chính) và để cả nhóm tra cứu chéo.

## Cách dùng
1. Copy [`_TEMPLATE.md`](_TEMPLATE.md) thành `docs/<module>.md`.
2. Điền theo khung, ưu tiên giải thích **vì sao** (why) hơn liệt kê **cái gì** (what).
3. Cập nhật khi module thay đổi.

## Danh sách file cần viết

| File | Owner | Phạm vi | Trạng thái |
|---|---|---|---|
| [`auth.md`](auth.md) | @lead | Auth/RBAC + cross-cutting + config | ⬜ |
| [`catalog.md`](catalog.md) | @content | Courses/Sections/Lessons/Enrolments | ⬜ |
| [`media.md`](media.md) | @media | Uploads/Media/Bull/S3 | ⬜ |
| [`learning.md`](learning.md) | @learning | Progress/Certificates/Quizzes/Attempts | ⬜ |
| [`qa-realtime.md`](qa-realtime.md) | @qa | QnA/Notifications/WsGateway + e2e | ⬜ |

## Hợp đồng API (spec)

Spec giao diện chốt **trước khi code** — nguồn sự thật cho dev, QA và AI:

| File | Owner | Module |
|---|---|---|
| [`catalog-api.md`](catalog-api.md) | @content | Catalog & Enrolment |
| [`media-api.md`](media-api.md) | @media | Uploads / Media / Queue |
| [`learning-api.md`](learning-api.md) | @learning | Progress / Quiz / Certificate |
| [`qa-realtime-api.md`](qa-realtime-api.md) | @qa | Q&A realtime / Notifications |
