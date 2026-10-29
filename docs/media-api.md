# Hợp đồng API — Media & Queue

> **Canonical spec.** `@media` implement theo file này; `@qa` viết e2e dựa trên đây.
> Prompt vai trò: [`../prompt/dev-media/AGENTS.md`](../prompt/dev-media/AGENTS.md) · Giải thích module: [`media.md`](media.md)

## 1. Quy ước chung
Áp dụng [quy ước chung của Catalog](catalog-api.md#1-quy-ước-chung): `/v1`, auth mặc định bật, response bọc `{ data }`, lỗi theo shape thống nhất, validation qua `ValidationPipe`.

## 2. Quyền
| Vai trò | Quyền |
| --- | --- |
| INSTRUCTOR (chủ khoá) / ADMIN | Tạo upload URL, confirm, xoá video |
| STUDENT (đã enroll) | Lấy playback URL của lesson đã `PUBLISHED` |

## 3. Entity & ràng buộc DB
| Entity | Trường | Ràng buộc |
| --- | --- | --- |
| `Video` | `id`, `lessonId`, `originalKey`, `thumbnailKey?`, `durationSec?`, `status`, `error?` | `lessonId` unique · index `(status)` |

`status` ∈ `PENDING | PROCESSING | READY | FAILED`.

> **Phạm vi:** KHÔNG transcode HLS (đã cắt) — chỉ lưu file gốc + **1 job sinh thumbnail**. Không có trường `hlsKey`.

## 4. Endpoints
| Method | Path | Quyền | Input | Success |
| --- | --- | --- | --- | --- |
| POST | `/v1/lessons/:lessonId/video/upload-url` | owner / ADMIN | `UploadUrlDto` | 200 `{ uploadUrl, key, expiresInSec }` |
| POST | `/v1/lessons/:lessonId/video/confirm` | owner / ADMIN | `ConfirmUploadDto` | 202 `VideoResponse` |
| GET | `/v1/lessons/:lessonId/video` | Auth | — | 200 `VideoResponse` |
| GET | `/v1/videos/:id/playback` | enrolled / owner / ADMIN | — | 200 `{ url, expiresInSec }` |

- `upload-url` tạo `Video{status: PENDING}` nếu chưa có, trả **presigned PUT** (không proxy file qua API).
- `confirm` đặt `PROCESSING` và enqueue job (jobId = `videoId` để idempotent).
- `playback` trả **presigned GET**; chỉ khi lesson `PUBLISHED` và user đã enroll (hoặc owner/ADMIN).

## 5. DTO
- **UploadUrlDto**: `contentType` string (bắt buộc) · `sizeBytes?` int ≥ 0.
- **ConfirmUploadDto**: `key` string (bắt buộc).
- Validate cả **job payload** khi worker nhận (không tin dữ liệu từ queue).

## 6. Response shapes
```
VideoResponse { id, lessonId, status, thumbnailKey, durationSec, error, createdAt, updatedAt }
               // KHÔNG trả originalKey thô ra ngoài
```

## 7. Luồng (data flow)
```
POST upload-url → { uploadUrl, key }
Client PUT thẳng file lên MinIO (không qua API)
POST confirm → enqueue { videoId } → status PROCESSING
Worker: sinh thumbnail → upload MinIO → status READY + durationSec
        → emit WS "video.ready" tới room course
Lỗi worker → status FAILED + ghi error (retry/backoff có giới hạn)
```

## 8. Mã lỗi
| Mã | Khi nào |
| --- | --- |
| 400 | DTO sai / lesson không phải type VIDEO |
| 401 | Chưa login |
| 403 | Không phải chủ sở hữu |
| 404 | Lesson/Video không tồn tại |
| 409 | Video đã `READY` mà confirm lại |

## 9. Ghi chú cho @qa
- Cấp upload-url cho lesson người khác → **403**.
- Confirm 2 lần (idempotency): không tạo job trùng, không lỗi.
- Playback khi lesson chưa `PUBLISHED` → **403/404**; khi chưa enroll → **403**.
- Job fail → `status = FAILED` và có `error`.
