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

| Module                                                                                                                      | Owner                                               | Vai trò       | Phạm vi chính                                         |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------- | ----------------------------------------------------- |
| `TypeOrmModule`, `ConfigModule` (EnvVars), `AuthModule`, `UsersModule`, cross-cutting (pipes/filters/interceptors), Swagger | Huỳnh Kim Đức - **Lead** _(kiêm PM/PO/BA, có code)_ | Nền tảng      | DataSource + migration, JWT/RBAC, chuẩn hóa tầng I/O  |
| `CoursesModule`, `SectionsModule`, `LessonsModule`, `EnrolmentsModule`                                                      |                                                     | Content       | CRUD khóa học/học liệu, phân quyền Instructor/Student |
| `UploadsModule`, `MediaModule`, `BullModule` config, `S3Module`, transcode worker                                           |                                                     | Infra / Media | Presigned URL, ffmpeg worker, HLS + thumbnail         |
| `ProgressModule`, `CertificatesModule`, `QuizzesModule`, `AttemptsModule`                                                   |                                                     | Learning      | Tiến độ, phát chứng chỉ, thi & chấm điểm server-side  |
| `QnaModule`, `NotificationsModule`, `WsGateway` + **toàn bộ e2e test**                                                      | **QA**                                              | Realtime + QA | Q&A real-time, thông báo, e2e xuyên module            |

### Rủi ro đã biết — module Media (Dev 2)

- Ưu tiên người có nền hạ tầng tốt nhất (đã có).
- Nếu chưa ai có kinh nghiệm ffmpeg/S3: **pair với Lead** + nhờ hỗ trợ giảng viên.
- Media là module rủi ro cao nhất → cần spike sớm ở Phase 2, không để tới cuối.

## Roadmap theo giai đoạn

| Phase                           | Mục tiêu                                     | Owner chính    |
| ------------------------------- | -------------------------------------------- | -------------- |
| 0. Foundation                   | TypeORM + Config + Auth + RBAC + Health + CI | Lead + cả nhóm |
| 1. Catalog & Content            | Course/Section/Lesson + Enrolment            | Dev 1          |
| 2. Media Pipeline               | Upload → BullMQ → ffmpeg → S3                | Dev 2          |
| 3. Progress & Certificate       | % hoàn thành + phát chứng chỉ tự động        | Dev 3          |
| 4. Quiz                         | Thi, chấm điểm, giới hạn lượt/thời gian      | Dev 3          |
| 5. Realtime Q&A & Notifications | Socket.io, room theo course                  | QA             |
| 6. Hardening                    | Rate limit, caching, observability, e2e      | Cả nhóm        |

## Quy ước làm việc

- **Hợp đồng trước, code sau**: chốt DTO + route spec trước khi implement.
- **Branch theo module**: `feat/auth`, `feat/media`, `feat/quiz`, …
- **PR rule**: cần ≥1 reviewer; PR đụng cross-cutting (auth, config, base entity) do **Lead** duyệt.
- **Definition of Done**: API chạy + e2e xanh + phân quyền đúng role, **QA ký**.
- **Test ownership**: Dev viết unit/integration; QA viết e2e.
- **Demo cuối tuần**: mỗi người show 1 endpoint thật + test tương ứng.

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

| Dịch vụ | Cổng host | Ghi chú |
|---|---|---|
| PostgreSQL (`lms-postgres`) | **5433** | Cố tình lệch khỏi `5432` để không đụng Postgres local của máy |
| Redis | 6379 | |
| MinIO API / Console | 9000 / 9001 | |
| Bull Board | 3001 | Dashboard debug queue |

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
