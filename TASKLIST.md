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
| `@content` | Nguyễn Đức Phương Huy | [`prompt/dev-content/`](prompt/dev-content/AGENTS.md) |
| `@media` | Đậu Xuân Quang | [`prompt/dev-media/`](prompt/dev-media/AGENTS.md) |
| `@learning` | Phạm Ngọc Minh Quân | [`prompt/dev-learning/`](prompt/dev-learning/AGENTS.md) |
| `@qa` | Bùi Trần Hoàn Mỹ | [`prompt/qa-realtime/`](prompt/qa-realtime/AGENTS.md) |

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
- [x] Entity Course/Section/Lesson + migration — `@content` (Huy)
- [x] CRUD Course/Lesson + phân trang — `@content` (Huy)
- [x] Entity Enrolment + enroll (chỉ khóa PUBLISHED) — `@content` (Huy)
- [ ] Test DB riêng cho e2e — skeleton xong (`configureApp`), **DB test riêng chưa** — **(đang làm)** `@qa`
- [ ] Spike: upload 1 file lên MinIO qua presigned URL — `@media`

> **Đã xong ngoài danh sách (nền tảng, trước/đầu Sprint 1):** TypeORM DataSource + migration baseline · CI (lint/unit/e2e) + branch protection · hạ tầng compose (Postgres 5433, Redis, MinIO, Bull Board) · README / TASKLIST / docs / prompt.

## Sprint 2 — Progress + Media + Quiz core (Tuần 2)

**Exit criteria:** % tiến độ cập nhật đúng · video hiện diện `READY` (hoặc upload+serve) · nộp quiz ra điểm.

- [x] Entity LessonProgress + PATCH progress (ngưỡng 0.9), unit/integration — `@learning`
- [x] Tính `progressPct` + update Enrolment, tổng hợp PostgreSQL theo course và giải thích index — `@learning`
- [x] Entity Quiz/Question/Option + API tạo/thay quiz đúng owner, ẩn đáp án đúng — `@learning`
- [x] Entity QuizAttempt/QuizAnswer + API nộp bài, chấm server-side, giới hạn lượt/thời gian và chống nộp trùng — `@learning`
- [x] Kiểm thử HTTP module Learning: JWT/role, DTO, envelope/lỗi, chấm điểm, deadline/lượt thi và chứng chỉ public với PostgreSQL + fixtures Catalog — `@learning`
- [x] Sửa lỗi snapshot khi đọc/sửa quiz đồng thời, deadline tổng Redis và cache cũ làm tụt trạng thái khoá đã hoàn thành; có test hồi quy — `@learning`
- [x] Đồng bộ frontend scaffold từ `main`, tách dashboard `/learning` và dùng deadline quiz do PostgreSQL cấp, kiểm tra HTTP/integration cho deadline và lượt không giới hạn — `@learning`
- [x] Frontend Learning chịu được sessionStorage bị chặn/hết dung lượng và loại dữ liệu lượt thi sai cấu trúc; 17 test frontend — `@learning`
- [ ] S3Module (MinIO `forcePathStyle`) + UploadsModule — `@media`
- [ ] MediaModule: lưu metadata + serve presigned GET — `@media`
- [ ] BullModule.forRootAsync + **1 worker job** (thumbnail hoặc email) — `@media`
- [x] E2E Learning với Catalog thật: xuất bản, ghi danh, progress, khôi phục và nộp quiz, cấp và tra cứu chứng chỉ — `@learning`
- [x] Migration khóa ngoại Learning ↔ Catalog, kiểm tra cascade và giữ chứng chỉ đã cấp — `@learning`
- [ ] Review chính sách xóa từ `@content` + `@lead` và xác nhận nghiệm thu từ `@qa`
- [x] Xác minh GitHub Actions cho PR #29: backend 68 test không skip, frontend 9 test + lint/typecheck/build, e2e nền tảng 1 test — `@learning` ([CI run #31](https://github.com/DucHuynh27/E-learning-LMS/actions/runs/44504032170))
- [x] Lead review CI/config và xác nhận required checks của main — `@lead` (#11/#12/#18/#27 đã đóng; required checks `lint-and-test`, `e2e`, `frontend` đã xác nhận trên `main`)
- [x] Chuẩn bị contract DB, các quyết định FK/cascade cần chốt và ma trận bàn giao QA tại [`docs/learning-integration.md`](docs/learning-integration.md) — `@learning`
- [ ] Hỗ trợ + review + gỡ chặn — `@lead`

> Bộ test hiện tại **2026-11-19**: **71 test backend = 37 unit + 22 service integration + 10 HTTP integration + 2 regression GET**, thêm **17 test frontend** và **1 e2e nền tảng** riêng. Đã chạy local 37 unit sau khi thêm ba regression PostgreSQL health; các test DB dùng PostgreSQL 16 thật và Catalog fixtures. Xem docs/learning.md và docs/learning-review.md. Checkbox implementation không đồng nghĩa nghiệm thu tích hợp; Catalog thật/FK/cascade, Lead review và QA vẫn mở.
>
> PR #10 đã merge bằng admin bypass theo ghi nhận Lead, không phải approval hoặc QA ký. Các issue của Lead #11/#12/#18/#27 tiếp tục chờ owner xác nhận; cấu hình CI/config được chuẩn bị riêng để review.
>
> Xác minh CI **2026-11-19**: run #31 của PR #29 trên head `16c3636` (merge ref `3f4abd0`) đã qua cả ba job. Log xác nhận `68 passed`, `9 passed`, `1 passed`; đây là bằng chứng CI thực tế, không chỉ kết quả local. PR #29 vẫn chờ Lead review; Catalog thật/FK/cascade và QA xuyên module chưa hoàn tất.

## Sprint 3 — Certificate + Realtime + Hardening (Tuần 3)

**Exit criteria:** đạt 100% phát chứng chỉ (record + trang tra cứu) · Q&A realtime tối thiểu · demo chạy end-to-end.

- [x] Certificate: entity + tự phát khi học đủ mọi lesson published (idempotent) + JSON/HTML tra cứu, unit/integration — `@learning`
- [x] Q&A: entity QnaThread/QnaPost, migration, REST controller/service, DTO/serializer response và WsGateway (handshake JWT, room theo course) — `@qa` (PR #61)
- [x] Cứng hoá payload WebSocket Q&A/Notification sang Thread/Post/Notification response DTO, loại bỏ `authorId`, `userId` và identity field lồng nhau — `@qa`
- [x] Fail closed catalog access: thiếu bảng/schema hoặc lỗi DB không được cấp quyền; course không tồn tại trả 404; chưa enroll trả 403 — `@qa`
- [ ] Nghiệm thu E2E broadcast/room âm và notification ownership — **(đang làm)** `@qa`
- [x] HealthModule (Postgres/Redis/MinIO): implementation + wiring + unit/probe local — `@learning`
- [x] PostgreSQL health probe dùng chung query đang chờ, giữ hạn response 1 giây và phục hồi sau kết quả muộn; ba regression concurrency/timeout — `@learning`
- [x] Hardening: rate limit login/quiz, CORS, ẩn field nhạy cảm — `@lead`
  - [x] CORS trong `configureApp` + `CORS_ORIGIN` (dùng chung runtime/e2e) — `@lead`
  - [x] Rate limit: throttler chạy sau auth (đếm theo tài khoản), `login` 5 (theo email) / `register` 10 / `refresh` 20, `trust proxy` cấu hình, 429 sạch — `@lead`
  - [x] Ẩn field nhạy cảm: `@Exclude` `passwordHash` + test — `@lead`
  - [x] Rate limit route quiz: đọc 30 / start 10 / submit 5 req/60s, đếm theo tài khoản — `@lead` + `@learning` (cần `@learning` review)
- [ ] e2e toàn hệ + script demo — `@qa`
  - [x] Happy-path realtime: connect/socket join, tạo thread/post, thread details, notification REST và response JSON không lộ `authorId`/`userId` — `@qa`
  - [x] Payload WebSocket thread/post/notification không lộ `authorId`, `userId` hoặc identity field lồng nhau; join course chưa enroll trả ack false — `@qa`
  - [x] Unit authorization/catalog: course missing 404; catalog unavailable 503; student enrolled/unenrolled; database error fail closed — `@qa`
  - [ ] Ma trận từ chối: chưa enroll, join course trái quyền, student resolve, thread/notification không tồn tại và notification của người khác — `@qa`
  - [ ] Chứng minh cleanup/reset database test và test DB riêng thay vì dùng database chung; migrations đã chạy trước E2E — `@qa`
- [x] Demo Learning riêng: seed/start backend port 3002 và frontend Next.js port 3100, kết nối Auth/Progress/Quiz/Certificate — `@learning`
- [ ] Mỗi người: viết `docs/<module>.md` giải thích kiến trúc module mình — **cả nhóm**
  - [x] Phần Learning: `docs/learning.md`, cập nhật `docs/learning-api.md` và hướng dẫn chạy `frontend/README.md` — `@learning`
  - [x] Phần Auth: cập nhật `docs/auth.md` (hardening CORS/rate limit/serialize) — `@lead`
  - [ ] Phần Realtime: thay stub `docs/qa-realtime.md` bằng tài liệu kiến trúc/test cụ thể và cập nhật response/WS contract — **(đang làm)** `@qa`
- [x] Push origin + bật branch protection — `@lead`

> Cập nhật **2026-11-19** (branch `feat/auth`): hoàn tất phần hardening thuộc `@lead` — CORS (`configureApp` + `CORS_ORIGIN`), rate limit (throttler toàn cục; `login` 5 theo tài khoản, `register` 10, `refresh` 20), `trust proxy` cấu hình qua `TRUST_PROXY` (mặc định tắt), ẩn `passwordHash` (`@Exclude`). Kiểm tra local: `pnpm lint` sạch, **54 test** (unit + integration throttler/trust-proxy/guard-order) qua, `pnpm build` qua, **1 e2e nền tảng** qua. Xử lý các issue review #30–#35 (đã xác minh guard order đúng, chỉ thêm test hồi quy).

> Cập nhật **2026-11-19** (branch `feat/quiz-rate-limit`, PR #36): rate limit quiz cho đọc/start/submit attempt; sau review đã xử lý #37 (đưa `ThrottlerGuard` chạy **sau** auth → đếm theo tài khoản, không dồn bucket qua proxy), #38 (tách ngưỡng start/submit) và #39 (throttle route đọc quiz). Ripple cross-module: `learning.http.integration.spec.ts` (`@learning`) override throttler storage để test nghiệp vụ không chạm ngưỡng. Kiểm tra local: `pnpm lint` sạch, **58 test** qua, **32 integration Learning** qua (PostgreSQL), `pnpm build` qua, **1 e2e** qua.

## Đã cắt (không làm trong 3 tuần)
- Transcode HLS đa bitrate + ffmpeg
- Sinh PDF chứng chỉ + gửi email
- Notification in-app đầy đủ
- Refresh token rotation, anti-cheat quiz nâng cao

## Rủi ro
- Auth/RBAC thường ngốn gần 1 tuần của Lead → nếu trượt, cắt tiếp từ dưới lên.
- Media là module bất định nhất → spike ở Sprint 1, không để tới cuối.
- Frontend chấm nhẹ hơn → giữ ở mức đủ demo, không đầu tư quá tay.

> Cập nhật **2026-11-20**: điền tên thành viên vào bảng handle (Content = Nguyễn Đức Phương Huy, Media = Đậu Xuân Quang, Learning = Phạm Ngọc Minh Quân, QA/Realtime = Bùi Trần Hoàn Mỹ). Đánh dấu hoàn tất phần `@lead`: Hardening (auth #28, rate limit quiz #36, lớp IP trước auth #31, Redis throttler storage #56 — đã merge `main`) và xác nhận required checks của `main` (`lint-and-test`, `e2e`, `frontend`); các issue review #11/#12/#18/#27 và #30–#39 đã đóng.

> Cập nhật **2026-11-25**: Q&A realtime (`@qa`) đã merge `main` qua PR #61 — entity `QnaThread`/`QnaPost`, Notifications, `WsGateway` (room theo course + auth handshake), API thread/post, e2e có test WebSocket và bước chạy migration. Toàn bộ 15 issue review **#41–#55** đã đóng. Catalog/Enrolment (`@content`) đã merge qua PR #62; còn lại Media (PR #60, đang review) và #88 (FK/cascade Learning↔Catalog).
