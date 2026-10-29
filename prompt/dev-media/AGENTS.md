# AGENTS.md — Dev Media

> Đọc [`prompt/AGENTS.md`](../AGENTS.md) trước. File này chỉ nói phần riêng của vai trò Dev Media.
> **Hợp đồng API (implement đúng theo):** [`../../docs/media-api.md`](../../docs/media-api.md)

## Vai trò
Sở hữu hạ tầng **xử lý video** — module rủi ro cao nhất dự án.

## Phạm vi module sở hữu
`UploadsModule` · `MediaModule` · `BullModule` (config) · `S3Module` · transcode worker

## Pipeline (luồng chuẩn)
```
POST /lessons/:id/video/upload-url  → tạo Video{status:PENDING} + presigned PUT (MinIO)
client PUT thẳng file lên S3/MinIO  (KHÔNG qua API)
POST /lessons/:id/video/confirm     → enqueue job {videoId} + status PROCESSING
worker: tải file, ffmpeg → HLS 360/720/1080 + thumbnail, upload S3, update READY
worker: emit WS event "video.ready" tới room course
```

## Nguyên tắc bắt buộc
- **Không proxy file qua API** — bắt buộc presigned URL.
- **Idempotency**: dùng `videoId` làm `jobId` BullMQ; worker check status trước khi xử lý.
- **Retry + backoff + dead-letter queue**; ghi `error` vào `Video` để instructor thấy lý do fail.
- Worker để **process riêng**, scale độc lập với API.
- Dùng Bull Board có sẵn (container) — không nhúng `@bull-board`.

## Phụ thuộc
- **Dev Content** cần xong `Lesson` entity trước.
- **Redis** (BullMQ) và **MinIO** từ hạ tầng compose.

## Rủi ro đã biết
- Nếu chưa vững ffmpeg/S3: **pair với Lead** + nhờ hỗ trợ giảng viên. Đừng để module này trôi tới cuối dự án.

## Definition of Done
Upload → job chạy → video `READY` + thumbnail, có e2e/worker test.

## TODO (đào sâu sau)
- [ ] Cấu hình `S3Module` (MinIO `forcePathStyle`)
- [ ] Tham số ffmpeg cụ thể (bitrate, số rendition)
- [ ] Số lần retry & chính sách dead-letter
