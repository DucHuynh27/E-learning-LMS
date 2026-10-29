# AGENTS.md — Điểm vào cho AI Agent

> **Đọc file này trước tiên.** Sau đó mở đúng folder vai trò của bạn (mục 3).
> Mọi prompt con nằm trong `prompt/<vai-trò>/AGENTS.md`.

## 1. Dự án

Backend API cho **Hệ thống Quản lý & Phân phối Khóa học Trực tuyến (E-Learning LMS)**:
xử lý video, tracking tiến độ học tập, Q&A real-time, và làm bài quiz.

- **Kiến trúc:** NestJS Modular Monolith — mỗi domain là một module độc lập, **mỗi module có MỘT owner**.
- **Repo:** monorepo (`backend/` NestJS, `frontend/`).
- **Tài liệu tổng:** [`README.md`](../README.md) ở thư mục gốc.

## 2. Cách đọc prompt

1. `prompt/AGENTS.md` (**file này**) — luật chung, ai cũng phải tuân.
2. `prompt/<vai-trò>/AGENTS.md` — phạm vi module bạn sở hữu + hướng dẫn chi tiết.

## 3. Đội ngũ & quyền sở hữu module

| Handle | Vai trò | Folder prompt | Module sở hữu |
|---|---|---|---|
| `@lead` | **Lead** (kiêm PM/PO/BA) | [`prompt/lead/`](lead/AGENTS.md) | `TypeOrmModule`, `ConfigModule`, `AuthModule`, `UsersModule`, cross-cutting (pipes/filters/interceptors), Swagger |
| `@content` | **Dev Content** | [`prompt/dev-content/`](dev-content/AGENTS.md) | `CoursesModule`, `SectionsModule`, `LessonsModule`, `EnrolmentsModule` |
| `@media` | **Dev Media** | [`prompt/dev-media/`](dev-media/AGENTS.md) | `UploadsModule`, `MediaModule`, `BullModule`, `S3Module`, transcode worker |
| `@learning` | **Dev Learning** | [`prompt/dev-learning/`](dev-learning/AGENTS.md) | `ProgressModule`, `CertificatesModule`, `QuizzesModule`, `AttemptsModule` |
| `@qa` | **QA Realtime** | [`prompt/qa-realtime/`](qa-realtime/AGENTS.md) | `QnaModule`, `NotificationsModule`, `WsGateway` + toàn bộ e2e test |

> Các **handle** trên được dùng trong [`TASKLIST.md`](../TASKLIST.md) để gán owner cho từng task.

> **Nguyên tắc vàng:** không sửa file ngoài module của mình. Cần thay đổi cross-cutting (auth, config, base entity) → yêu cầu **Lead**.

## 4. Luật kỹ thuật bắt buộc (mọi thành viên)

### 4.1 ESM
- Repo bật ESM thật (`"type": "module"`, tsconfig `nodenext`).
- **Mọi import nội bộ phải có đuôi `.js`**, ví dụ `import { User } from '../user/user.entity.js'`.

### 4.2 TypeORM
- Dùng `synchronize: false` — **không bao giờ** bật. Mọi thay đổi schema đi qua migration.
- **Khai báo kiểu cột tường minh** cho mọi `@Column` (ví dụ `{ type: 'varchar', length: 255 }`).
  Lý do: CLI chạy bằng `tsx`/esbuild **không phát `emitDecoratorMetadata`**.
- Ràng buộc DB đặt ở mức DB (`@Unique`, `@Index`) — không chỉ ở tầng service.
- App runtime **không nạp migrations** (đã strip trong `app.module.ts`); migrations chỉ do CLI chạy.

### 4.3 Validation
- **`class-validator` + `class-transformer` là công cụ validation DUY NHẤT.** Không thêm Zod/Joi.
- Mọi input (body/query/param, env, job payload) đi qua DTO class.
- Không bao giờ `return entity` thẳng ra ngoài (lộ `passwordHash`) — dùng DTO response.

### 4.4 Env & cổng
- `.env` nạp qua:
  - `nest start` → `--env-file .env`
  - test (vitest) → `--env-file-if-exists=.env`
  - TypeORM CLI → `node --env-file=.env --import tsx ...`
- Cổng: API `3000`, Postgres host **`5433`** (tránh đụng 5432 local), Redis `6379`, MinIO `9000`/`9001`, Bull Board `3001`.
- Trong network Docker, service tự gọi nhau bằng hostname (`postgres:5432`, `redis:6379`) — **không** dùng `DB_PORT`.

### 4.5 Lệnh thường dùng (chạy trong `backend/`)
```bash
pnpm start:dev                      # dev server (watch)
pnpm lint                           # oxlint
pnpm test                           # unit test (vitest)
pnpm test:e2e                       # e2e test (vitest)
pnpm build                          # build production
pnpm migration:generate src/database/migrations/<Ten>
pnpm migration:run
pnpm migration:revert
```

### 4.6 Code style & comment
- **Comment chỉ khi lý do không hiển nhiên từ code** (nói *why*, không *what*). Không viết `// khởi tạo biến`, `// trả về kết quả`.
- Không comment "rác AI": nhắc lại tên hàm, tiêu đề trang trí, giải thích điều code đã nói rõ.
- Ưu tiên **đặt tên tốt + code rõ ràng** hơn là comment dài dòng.
- Tránh "AI slop": không boilerplate thừa, không class/file rỗng, không dựng abstraction khi chưa cần.
- Mỗi dòng phải **giải thích được khi bị hỏi** — tiêu chí chấm là độ hiểu code.

## 5. Quy ước Git & quy trình

- **Branch theo module:** `feat/auth`, `feat/content`, `feat/media`, `feat/learning`, `feat/realtime`; nhánh phụ `fix/<...>`, `chore/<...>`.
- **Hợp đồng trước, code sau:** chốt DTO + route spec trước khi implement.
- **PR:** cần ≥1 reviewer. PR đụng cross-cutting (auth/config/base entity) do **Lead** duyệt.
- **Merge:** squash.
- **Definition of Done:** API chạy + e2e xanh + phân quyền đúng role, **QA ký**.
- **Sở hữu test:** Dev viết unit/integration; QA viết e2e.

## 6. Trạng thái & lộ trình

Lộ trình 6 phase (chi tiết ở `README.md`):

| Phase | Mục tiêu | Owner chính |
|---|---|---|
| **0. Foundation** | TypeORM + Config + Auth/RBAC + Health + CI | Lead + cả nhóm |
| 1. Catalog & Content | Course/Section/Lesson + Enrolment | Dev Content |
| 2. Media Pipeline | Upload → BullMQ → ffmpeg → S3 | Dev Media |
| 3. Progress & Certificate | % hoàn thành + chứng chỉ tự động | Dev Learning |
| 4. Quiz | Thi, chấm điểm, giới hạn lượt/thời gian | Dev Learning |
| 5. Realtime Q&A & Notifications | Socket.io, room theo course | QA Realtime |
| 6. Hardening | Rate limit, caching, observability, e2e | Cả nhóm |

**Phase 0 — đã xong:**
- ✅ TypeORM DataSource + migration baseline (bảng `users`)
- ✅ Config validate (`EnvVars`) + cross-cutting toàn cục (`ValidationPipe`, interceptors, exception filter, URI versioning `/v1`)
- ✅ AuthModule + RBAC (JWT access/refresh, `RolesGuard`, `@Roles`, `@CurrentUser`) và UsersModule (service + DTO)
- ✅ CI (lint/unit/e2e) + branch protection
- ✅ Hạ tầng compose (Postgres 5433, Redis, MinIO, Bull Board)

**Phase 0 — còn lại:**
- ⬜ `BullModule` + `S3Module` (`@media`), `HealthModule` (`@learning`), test DB riêng cho e2e (`@qa`)
- ⬜ Swagger (đang hoãn — chưa cần cho mục tiêu hiện tại)
