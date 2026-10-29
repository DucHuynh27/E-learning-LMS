# Module: Media & Queue

> Owner: @media · Điền theo [`_TEMPLATE.md`](_TEMPLATE.md)

## Phạm vi
`UploadsModule` · `MediaModule` · `BullModule` · `S3Module` · worker

## Ghi chú
- Giải thích vì sao dùng **presigned URL** thay vì proxy file qua API.
- Nêu cấu hình MinIO (`forcePathStyle`) và luồng upload → confirm → job.
- Vì sao dùng `videoId` làm `jobId` (idempotency) và retry/backoff.
