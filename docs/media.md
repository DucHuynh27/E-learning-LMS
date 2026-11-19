# Module: Media & Queue

> Owner: @media · Theo cấu trúc [`_TEMPLATE.md`](_TEMPLATE.md)

**Hợp đồng API:** [`media-api.md`](media-api.md).

> Nhánh Media giữ nguyên các file cấu hình chung theo yêu cầu. Vì vậy `MediaModule`, entity `Video` và env Media chưa được đăng ký vào app; endpoints/worker chỉ hoạt động sau khi Lead tích hợp cấu hình.

## 1. Tổng quan

Media cho phép instructor tải video trực tiếp lên MinIO, lưu metadata trong PostgreSQL và phát URL xem có thời hạn. API không nhận hay truyền tiếp nội dung video; worker xử lý nền để sinh thumbnail và thời lượng.

## 2. Luồng dữ liệu / kiến trúc

```text
Instructor
  → POST /lessons/:lessonId/video/upload-url
  → kiểm tra lesson VIDEO + quyền sở hữu
  → tạo Video{PENDING} + presigned PUT
  → client PUT trực tiếp lên MinIO
  → POST /lessons/:lessonId/video/confirm
  → kiểm tra object + enqueue BullMQ {videoId}
  → API lưu PROCESSING

Media worker (process riêng)
  → tải object từ MinIO
  → FFmpeg sinh thumbnail + đọc duration
  → upload thumbnail + lưu Video{READY}
  → lỗi cuối retry: Video{FAILED, error}

Student / owner / ADMIN
  → GET /videos/:id/playback
  → kiểm tra lesson/course publish và quyền xem
  → trả presigned GET
```

Sau khi worker cập nhật `READY`, việc phát `video.ready` vào room course cần kết nối với `WsGateway` của nhánh QA Realtime.

## 3. Các file chính

| File | Trách nhiệm |
|---|---|
| `src/media/media.controller.ts` | Khai báo upload URL, confirm, metadata và playback endpoints |
| `src/media/media.service.ts` | Quản lý trạng thái Video, presigned URL và job idempotent |
| `src/media/media-access.service.ts` | Kiểm tra owner, lesson VIDEO, publish và enrollment |
| `src/media/s3.service.ts` | MinIO client, bucket, presigned URL và object operations |
| `src/media/media.queue.ts` | Validate payload, chạy FFmpeg, retry và cập nhật trạng thái |
| `src/media/media-worker.module.ts`, `src/media/worker.ts` | Bootstrap worker thành process riêng |
| `src/media/video.entity.ts` | Entity và trạng thái `Video` |
| `src/database/migrations/1795120000000-CreateVideos.ts` | Tạo bảng, enum và index Video |

## 4. Quyết định thiết kế & lý do

- **Presigned URL thay vì proxy qua API:** video không chiếm băng thông, bộ nhớ hoặc kết nối của API; URL PUT/GET có TTL và PUT ký theo `Content-Type`.
- **MinIO `forcePathStyle`:** MinIO local truy cập bucket qua dạng `endpoint/bucket/key`, không cần virtual-host DNS cho từng bucket.
- **`videoId` làm BullMQ `jobId`:** confirm lặp không tạo job trùng; job có tối đa 3 lần thử với exponential backoff.
- **Worker chạy process riêng:** worker có thể chạy và scale độc lập với HTTP API; khởi chạy bằng `pnpm start:worker` hoặc `pnpm start:worker:dev`.
- **Chỉ ghi `FAILED` sau lần thử cuối:** lỗi trung gian vẫn cho phép retry; lỗi cuối được lưu vào `Video.error` để tra cứu.
- **FFmpeg đóng gói cùng dependency:** môi trường chạy không cần cài FFmpeg thủ công.

## 5. Cơ sở dữ liệu liên quan

| Entity | Trường quan trọng | Index / Unique | Lý do |
|---|---|---|---|
| `Video` | `lessonId`, `originalKey`, `thumbnailKey`, `durationSec`, `status`, `error` | unique `lessonId`; index `status` | Một video cho mỗi lesson; tra cứu các video theo trạng thái xử lý |

Migration hiện chưa tạo FK từ `Video.lessonId` sang `Lesson`, vì entity Lesson thuộc nhánh Content và chưa được tích hợp trong nhánh này.

## 6. API endpoints

| Method | Path | Quyền | Input (DTO) | Output |
|---|---|---|---|---|
| POST | `/v1/lessons/:lessonId/video/upload-url` | owner / ADMIN | `UploadUrlDto` | `{ uploadUrl, key, expiresInSec }` |
| POST | `/v1/lessons/:lessonId/video/confirm` | owner / ADMIN | `ConfirmUploadDto` | 202 `VideoResponse` |
| GET | `/v1/lessons/:lessonId/video` | Auth | — | `VideoResponse` |
| GET | `/v1/videos/:id/playback` | enrolled / owner / ADMIN | — | `{ url, expiresInSec }` |

`VideoResponse` không trả `originalKey`. DTO chi tiết và response contract nằm trong [`media-api.md`](media-api.md).

## 7. Xử lý lỗi & edge case

- Lesson không tồn tại → **404**; lesson không phải VIDEO → **400**.
- Instructor không sở hữu course → **403**.
- Upload URL không tạo lại khi video đang `PROCESSING` hoặc `READY`.
- Confirm chỉ nhận key đã cấp cho lesson; confirm lặp dùng cùng `videoId` làm job ID.
- Object chưa có trong MinIO → **404**; playback video chưa `READY` → **409**.
- Playback yêu cầu lesson và course `PUBLISHED`; student cần enrollment `ACTIVE`.
- Lỗi worker được retry; sau lần cuối trạng thái là `FAILED` và nội dung lỗi được lưu.

## 8. Test

- **Unit:** 3 test `MediaService` cho presigned upload, confirm/enqueue và duplicate job.
- **Unit:** 4 test `MediaAccessService` cho quyền owner, instructor khác, enrollment và lesson sai loại.
- **e2e hiện có:** smoke test ứng dụng chung; chưa có e2e riêng cho các Media endpoints.
- **Smoke tích hợp thủ công:** đã xác nhận Redis → worker FFmpeg → MinIO cập nhật `READY` và tạo thumbnail.
- **Còn nợ:** QA viết e2e Media trên schema Content/Enrolment đã tích hợp.

## 9. Điểm nhấn kỹ thuật

1. Presigned PUT/GET giữ luồng file ngoài API.
2. Queue job idempotent có retry/backoff; worker tách process.
3. DTO job được validate lại tại worker; response không để lộ `originalKey`.

## 10. Hạn chế / chưa làm

- Chưa có FK `Video.lessonId` cho tới khi tích hợp schema Content.
- Chưa phát sự kiện `video.ready` tới room course; cần tích hợp với `WsGateway` thuộc nhánh QA.
- **Chờ tích hợp cấu hình chung:** đăng ký `MediaModule`, thêm `Video` vào TypeORM DataSource, bổ sung `REDIS_HOST`, `MINIO_ENDPOINT`, `MINIO_REGION`, `MINIO_BUCKET`, `MINIO_PRESIGNED_TTL` và cấu hình MinIO CORS trong Compose. Các thay đổi này cần Lead review.
- Chưa có Media e2e do QA sở hữu; unit test và smoke test không thay thế bước ký QA.
