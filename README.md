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

```bash
# hạ tầng (Postgres, Redis, MinIO, Bull Board)
cd backend && docker compose up -d

# backend
pnpm install
pnpm run start:dev
```

Chi tiết backend xem tại [`backend/README.md`](backend/README.md).
