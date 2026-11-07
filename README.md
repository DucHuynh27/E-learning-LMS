# E-Learning LMS

Backend API cho Hệ thống Quản lý & Phân phối Khóa học Trực tuyến: xử lý video, tracking tiến độ học tập, Q&A real-time và làm bài quiz.

## Công nghệ

| Thành phần     | Công nghệ                                            |
| -------------- | ---------------------------------------------------- |
| Framework      | NestJS 12 (Modular Monolith, ESM)                    |
| Database & ORM | PostgreSQL 16 + TypeORM                              |
| Queue / Async  | BullMQ + Redis                                       |
| Real-time      | Socket.io (WS Gateway)                               |
| Storage        | MinIO (S3-compatible)                                |
| Validation     | class-validator + class-transformer (chuẩn duy nhất) |
| Test / Lint    | Vitest + oxlint                                      |

## Kiến trúc

Modular Monolith — mỗi domain là một module độc lập, **mỗi module có MỘT owner** để tránh xung đột khi làm song song.

## Module & Owner

| Module | Owner | Vai trò | Phạm vi chính |
| --- | --- | --- | --- |
| `TypeOrmModule`, `ConfigModule` (EnvVars), `AuthModule`, `UsersModule`, cross-cutting (pipes/filters/interceptors), Swagger | **Huỳnh Kim Đức — Lead** (`@lead`, kiêm PM/PO/BA) · [Hướng dẫn](prompt/lead/AGENTS.md) | Nền tảng | DataSource + migration nền tảng, JWT/RBAC, chuẩn hóa tầng I/O, review thay đổi cross-cutting |
| `CoursesModule`, `SectionsModule`, `LessonsModule`, `EnrolmentsModule` | **Dev Content** (`@content`) · [Hướng dẫn](prompt/dev-content/AGENTS.md) | Content | CRUD khóa học/section/lesson, publish, enrolment, phân quyền Instructor/Student |
| `UploadsModule`, `MediaModule`, cấu hình `BullModule`, `S3Module`, worker thumbnail | **Dev Media** (`@media`) · [Hướng dẫn](prompt/dev-media/AGENTS.md) | Infra / Media | Upload/playback qua presigned URL MinIO, metadata video, một job BullMQ sinh thumbnail |
| `ProgressModule`, `CertificatesModule`, `QuizzesModule`, `AttemptsModule`, `HealthModule` | **Dev Learning** (`@learning`) · [Hướng dẫn](prompt/dev-learning/AGENTS.md) | Learning | Tiến độ học tập, chứng chỉ dạng record + tra cứu, quiz chấm server-side và giới hạn lượt/thời gian, health check |
| `QnaModule`, `NotificationsModule`, `WsGateway` + **toàn bộ e2e test** | **QA Realtime** (`@qa`) · [Hướng dẫn](prompt/qa-realtime/AGENTS.md) | Realtime + QA | Q&A real-time tối thiểu, room theo course, DB test riêng và e2e xuyên module |

Các owner chưa có tên thành viên dùng handle thống nhất với [`TASKLIST.md`](TASKLIST.md); điền tên thật khi nhóm chốt nhân sự. Mỗi owner phụ trách cả migration, unit/integration test và tài liệu của module mình; QA phụ trách e2e. Lead duyệt thay đổi cross-cutting.

Phạm vi theo [`TASKLIST.md`](TASKLIST.md): không triển khai HLS đa bitrate, PDF/email chứng chỉ hoặc notification đầy đủ; Swagger đang hoãn.

### Rủi ro đã biết — module Media (`@media`)

- Kinh nghiệm ffmpeg/S3: **pair với Lead** + nhờ hỗ trợ giảng viên.
- Media là module rủi ro cao nhất → spike upload presigned URL ngay Sprint 1, không để tới cuối.

## Roadmap theo giai đoạn

| Phase                           | Mục tiêu                                     | Owner chính    |
| ------------------------------- | -------------------------------------------- | -------------- |
| 0. Foundation                   | TypeORM + Config + Auth + RBAC + Health + CI | Lead + cả nhóm |
| 1. Catalog & Content            | Course/Section/Lesson + Enrolment            | `@content`     |
| 2. Media Pipeline               | Upload MinIO → BullMQ → thumbnail            | `@media`       |
| 3. Progress & Certificate       | % hoàn thành + chứng chỉ record và tra cứu  | `@learning`    |
| 4. Quiz                         | Thi, chấm điểm, giới hạn lượt/thời gian      | `@learning`    |
| 5. Realtime Q&A & Notifications | Socket.io, room theo course                  | `@qa`          |
| 6. Hardening                    | Rate limit, caching, observability, e2e      | Cả nhóm        |

## Quy ước làm việc

- **Hợp đồng trước, code sau**: chốt DTO + route spec trước khi implement.
- **Branch theo module**: `feat/auth`, `feat/content`, `feat/media`, `feat/learning`, `feat/realtime`.
- **PR rule**: cần ≥1 reviewer; PR đụng cross-cutting (auth, config, base entity) do **Lead** duyệt.
- **Definition of Done**: API chạy + e2e xanh + phân quyền đúng role, **QA ký**.
- **Test ownership**: Dev viết unit/integration; QA viết e2e.
- **Demo cuối tuần**: mỗi người show 1 endpoint thật + test tương ứng.

## Tài liệu & điều phối

| Tài liệu | Nội dung |
| --- | --- |
| [`TASKLIST.md`](TASKLIST.md) | Chia việc theo sprint, phân loại scope MUST/SHOULD/CẮT, exit criteria mỗi sprint |
| [`docs/`](docs/README.md) | Mỗi người tự viết phần giải thích module mình phụ trách (chứng minh độ hiểu code) |
| [`prompt/`](prompt/AGENTS.md) | Prompt onboarding cho AI agent — điểm vào là `prompt/AGENTS.md` |

## Quy trình làm việc cho thành viên

### 1. Cài đặt lần đầu
Theo mục [Setup](#setup) bên dưới: clone → `pnpm install` → `cp .env.example .env` → `compose up -d` → `pnpm migration:run`.

### 2. Vào việc trên branch của mình

| Branch | Owner |
| --- | --- |
| `feat/auth` | @lead |
| `feat/content` | @content |
| `feat/media` | @media |
| `feat/learning` | @learning |
| `feat/realtime` | @qa |

```bash
git switch feat/<module> && git pull
# ... code ...
pnpm lint && pnpm test && pnpm test:e2e
git add -A && git commit -m "feat(<module>): ..."
git push
```

### 3. Đọc prompt trước khi code
- Đọc `prompt/AGENTS.md` rồi `prompt/<vai-trò>/AGENTS.md`.
- Nói với AI: *"Đọc `prompt/AGENTS.md` và `prompt/<vai-trò>/AGENTS.md` trước khi code."*

### 4. Mở PR (`main` được bảo vệ)
- Không push trực tiếp `main`; phải qua PR + **1 review** + CI xanh.
- `gh pr create --base main --head feat/<module> --fill`.
- PR đụng cross-cutting (auth/config/base entity) cần **@lead** duyệt.

### 5. Definition of Done mỗi task
- API chạy · unit test (dev) · e2e (qa) xanh · phân quyền đúng role.
- Tick trạng thái trong `TASKLIST.md`, cập nhật `docs/<module>.md`.

### 6. Khi `main` đổi
```bash
git switch main && git pull
git switch feat/<module> && git merge main
```

## Setup

**Yêu cầu:** Node.js 24+, `pnpm`, và Podman hoặc Docker kèm Compose.

```bash
# 1. Cài dependencies
cd backend
pnpm install

# 2. Tạo file môi trường từ mẫu (giá trị mặc định đã đủ cho dev local)
cp .env.example .env

# 3. Khởi động hạ tầng (Postgres, Redis, MinIO, Bull Board)
podman-compose -f docker-compose.yml up -d      # hoặc: docker compose up -d

# 4. Chạy migration để tạo schema
pnpm migration:run

# 5. Chạy backend ở chế độ watch
pnpm start:dev
```

API mặc định ở `http://localhost:3000`.

### Cổng dịch vụ

| Dịch vụ                     | Cổng host   | Ghi chú                                                       |
| --------------------------- | ----------- | ------------------------------------------------------------- |
| PostgreSQL (`lms-postgres`) | **5433**    | Cố tình lệch khỏi `5432` để không đụng Postgres local của máy |
| Redis                       | 6379        |                                                               |
| MinIO API / Console         | 9000 / 9001 |                                                               |
| Bull Board                  | 3001        | Dashboard debug queue                                         |

> Nếu máy bạn **không** có Postgres nào chiếm `5432`, có thể đổi `DB_PORT=5432` trong `.env` cho tiện. Đây là biến duy nhất cần sửa.
> Lưu ý Podman: các image trong `docker-compose.yml` đã được qualify `docker.io/...` để chạy được trên cả Podman lẫn Docker.

### Lệnh thường dùng

```bash
pnpm start:dev                       # dev server (watch)
pnpm lint                            # oxlint
pnpm test                            # unit test (vitest)
pnpm test:e2e                        # e2e test (vitest)
pnpm build                           # build production

pnpm migration:generate src/database/migrations/<Ten>   # sinh migration từ entity
pnpm migration:run                   # áp dụng migration
pnpm migration:revert                # rollback migration gần nhất
```

Chi tiết backend xem tại [`backend/README.md`](backend/README.md).
