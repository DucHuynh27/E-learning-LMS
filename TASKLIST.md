# TASKLIST.md

Kế hoạch thực thi E-Learning LMS trong **3 tuần** (mỗi người ~20h/tuần).

## Bối cảnh & ưu tiên

- **Deadline cứng:** 3 tuần. Sức chứa ~5 × 20 × 3 = **300h**, trừ họp/review còn **~220h code**.
- **Cách chấm:** độ hiểu code + những gì thực sự làm; **backend nặng hơn frontend**.
- **Hệ quả:** ưu tiên **chiều sâu hơn bề rộng**. Mỗi người phải giải thích được module mình viết.
  Thà 4 tính năng làm sạch + hiểu rõ, hơn 8 tính năng copy-paste.

## Quy ước

- Trạng thái: `- [ ]` chưa làm · `- [ ]` + **(đang làm)** đang làm · `- [x]` xong.
- Tick theo đúng phạm vi từng dòng: phần implementation/unit/integration đã xong được tick riêng; tích hợp với module thật, review và nghiệm thu QA/e2e vẫn là các task chưa tick cho tới khi hoàn tất.
- Owner ghi bằng **handle**; tra cứu ở bảng dưới.
- Sprint kết thúc khi đạt **exit criteria**, không cứng theo ngày (độ dài tùy độ khó).
- Mỗi PR cập nhật trạng thái trong file này.

### Handle → người → prompt

| Handle | Thành viên | Prompt |
| --- | --- | --- |
| `@lead` | Huỳnh Kim Đức | [`prompt/lead/`](prompt/lead/AGENTS.md) |
| `@content` | _(điền tên)_ | [`prompt/dev-content/`](prompt/dev-content/AGENTS.md) |
| `@media` | _(điền tên)_ | [`prompt/dev-media/`](prompt/dev-media/AGENTS.md) |
| `@learning` | _(điền tên)_ | [`prompt/dev-learning/`](prompt/dev-learning/AGENTS.md) |
| `@qa` | _(điền tên)_ | [`prompt/qa-realtime/`](prompt/qa-realtime/AGENTS.md) |

## Phân loại scope

**MUST (phải có để đủ điểm backend):** Foundation (Auth/RBAC/validation), Catalog + Enrolment, Progress tracking, Quiz cơ bản.
**SHOULD (nếu kịp):** Upload video lên MinIO + serve presigned + **1 job BullMQ** (thumbnail/email) để chứng minh queue, Certificate đơn giản.
**CẮT hẳn:** transcode HLS đa bitrate, sinh PDF + email chứng chỉ, notification phức tạp, chống gian lận quiz nâng cao.

> BullMQ vẫn được "khoe" qua job nhẹ — đủ để giải thích kiến trúc queue mà không đánh đổi cả tuần cho ffmpeg.

## Ngân sách giờ (dự kiến)

| Hạng mục | Giờ |
|---|---|
| Foundation | ~40 |
| Catalog + Enrolment | ~35 |
| Media (upload + serve + 1 job) | ~25 |
| Progress | ~20 |
| Quiz cơ bản | ~25 |
| Certificate đơn giản | ~12 |
| Realtime Q&A tối thiểu | ~20 |
| Tích hợp + e2e + demo + docs | ~25 |
| **Tổng** | **~202** |

Còn ~20h đệm. Nếu trễ: cắt **Realtime** trước, rồi **Certificate**.

---

## Sprint 1 — Foundation + Catalog (Tuần 1)

**Exit criteria:** login JWT chạy · tạo được Course/Lesson qua API đúng RBAC · e2e xanh.

- [x] EnvVars validate (class-validator) + app crash nếu thiếu biến — `@lead`
- [x] Cross-cutting `main.ts`: ValidationPipe · Serializer/Transform interceptor · ExceptionFilter · versioning — `@lead`
- [x] AuthModule: login/refresh, argon2, JwtStrategy, RolesGuard, `@Roles`, `@CurrentUser` — `@lead`
- [x] UsersModule hoàn chỉnh: service + DTO (`findByEmail`/`findByEmailForAuth`) — `@lead`
- [ ] Entity Course/Section/Lesson + migration — `@content`
- [ ] CRUD Course/Lesson + phân trang — `@content`
- [ ] Entity Enrolment + enroll (chỉ khóa PUBLISHED) — `@content`
- [ ] Test DB riêng cho e2e — skeleton xong (`configureApp`), **DB test riêng chưa** — **(đang làm)** `@qa`
- [ ] Spike: upload 1 file lên MinIO qua presigned URL — `@media`

> **Đã xong ngoài danh sách (nền tảng, trước/đầu Sprint 1):** TypeORM DataSource + migration baseline · CI (lint/unit/e2e) + branch protection · hạ tầng compose (Postgres 5433, Redis, MinIO, Bull Board) · README / TASKLIST / docs / prompt.

## Sprint 2 — Progress + Media + Quiz core (Tuần 2)

**Exit criteria:** % tiến độ cập nhật đúng · video hiện diện `READY` (hoặc upload+serve) · nộp quiz ra điểm.

- [x] Entity LessonProgress + PATCH progress (ngưỡng 0.9), unit/integration — `@learning`
- [x] Tính `progressPct` + update Enrolment, cache tổng lesson published và giải thích index — `@learning`
- [x] Entity Quiz/Question/Option + API tạo/thay quiz đúng owner, ẩn đáp án đúng — `@learning`
- [x] Entity QuizAttempt/QuizAnswer + API nộp bài, chấm server-side, giới hạn lượt/thời gian và chống nộp trùng — `@learning`
- [ ] S3Module (MinIO `forcePathStyle`) + UploadsModule — `@media`
- [ ] MediaModule: lưu metadata + serve presigned GET — `@media`
- [ ] BullModule.forRootAsync + **1 worker job** (thumbnail hoặc email) — `@media`
- [ ] e2e cho progress + quiz — `@qa`
- [ ] Tích hợp Learning với schema/module Catalog thật và chốt FK/cascade tới Course/Lesson — `@learning` + `@content` + `@lead`
- [ ] Hỗ trợ + review + gỡ chặn — `@lead`

> Rà soát ngày **2026-11-08** theo các commit `9cfba19` và `078d9c3`: phần implementation Learning đã hoàn thành và chạy với fixtures Catalog trong schema demo riêng. Kiểm tra local gần nhất ngày 2026-11-07: **48 test** (gồm 19 integration PostgreSQL), **1 e2e nền tảng**, lint/build backend và frontend đều qua. E2E nền tảng chưa bao phủ nghiệp vụ Learning.
>
> Bàn giao: xem [`docs/learning.md`](docs/learning.md) và [`docs/learning-wiring.patch`](docs/learning-wiring.patch). Wiring đã được áp dụng; vẫn cần Lead review `AppModule`/`DataSource`, Content cung cấp schema thật và QA xác nhận e2e trước khi nghiệm thu Done toàn hệ thống.

## Sprint 3 — Certificate + Realtime + Hardening (Tuần 3)

**Exit criteria:** đạt 100% phát chứng chỉ (record + trang tra cứu) · Q&A realtime tối thiểu · demo chạy end-to-end.

- [x] Certificate: entity + tự phát khi học đủ mọi lesson published (idempotent) + JSON/HTML tra cứu, unit/integration — `@learning`
- [ ] Q&A: entity QnaThread/QnaPost + WsGateway (room theo course, auth handshake) — `@qa`
- [x] HealthModule (Postgres/Redis/MinIO): implementation + wiring + unit/probe local — `@learning`
- [ ] Hardening: rate limit login/quiz, CORS, ẩn field nhạy cảm — `@lead`
- [ ] e2e toàn hệ + script demo — `@qa`
- [x] Demo Learning riêng: seed/start backend port 3002 và frontend Next.js port 3100, kết nối Auth/Progress/Quiz/Certificate — `@learning`
- [ ] Mỗi người: viết `docs/<module>.md` giải thích kiến trúc module mình — **cả nhóm**
  - [x] Phần Learning: `docs/learning.md`, cập nhật `docs/learning-api.md` và hướng dẫn chạy `frontend/README.md` — `@learning`
- [x] Push origin + bật branch protection — `@lead`

## Đã cắt (không làm trong 3 tuần)
- Transcode HLS đa bitrate + ffmpeg
- Sinh PDF chứng chỉ + gửi email
- Notification in-app đầy đủ
- Refresh token rotation, anti-cheat quiz nâng cao

## Rủi ro
- Auth/RBAC thường ngốn gần 1 tuần của Lead → nếu trượt, cắt tiếp từ dưới lên.
- Media là module bất định nhất → spike ở Sprint 1, không để tới cuối.
- Frontend chấm nhẹ hơn → giữ ở mức đủ demo, không đầu tư quá tay.
