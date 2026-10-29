# Hợp đồng API — Realtime Q&A & Notifications

> **Canonical spec.** `@qa` implement theo file này; đồng thời `@qa` viết e2e dựa trên đây.
> Prompt vai trò: [`../prompt/qa-realtime/AGENTS.md`](../prompt/qa-realtime/AGENTS.md) · Giải thích module: [`qa-realtime.md`](qa-realtime.md)

## 1. Quy ước chung
REST áp dụng [quy ước chung của Catalog](catalog-api.md#1-quy-ước-chung). Riêng **WebSocket** có quy ước ở mục 5.

## 2. Quyền
| Vai trò | Quyền |
| --- | --- |
| STUDENT / INSTRUCTOR (đã enroll / chủ khoá) | Đọc thread, đăng thread/post trong khoá |
| INSTRUCTOR (chủ khoá) / ADMIN | Đánh dấu thread `resolved` |
| Auth (bất kỳ) | Xem thông báo của mình |

> **Không enroll → 403** khi đọc/đăng Q&A của khoá đó.

## 3. Entity & ràng buộc DB
| Entity | Trường | Ràng buộc |
| --- | --- | --- |
| `QnaThread` | `id`, `courseId`, `lessonId?`, `authorId`, `title`, `resolved`, `createdAt` | index `(courseId, createdAt)` |
| `QnaPost` | `id`, `threadId`, `authorId`, `content`, `createdAt` | index `(threadId, createdAt)` · FK cascade |
| `Notification` | `id`, `userId`, `type`, `payload` (json), `read`, `createdAt` | index `(userId, read, createdAt)` |

## 4. REST endpoints
| Method | Path | Quyền | Input | Success |
| --- | --- | --- | --- | --- |
| POST | `/v1/courses/:courseId/threads` | enrolled / chủ khoá | `CreateThreadDto` | 201 `ThreadResponse` |
| GET | `/v1/courses/:courseId/threads` | enrolled / chủ khoá | `?page&limit&resolved` | 200 `{ items, meta }` |
| GET | `/v1/threads/:id` | enrolled / chủ khoá | — | 200 `{ thread, posts }` |
| POST | `/v1/threads/:id/posts` | enrolled / chủ khoá | `CreatePostDto` | 201 `PostResponse` |
| PATCH | `/v1/threads/:id/resolve` | chủ khoá / ADMIN | — | 200 `ThreadResponse` |
| GET | `/v1/notifications/me` | Auth | `?page&limit&read` | 200 `{ items, meta }` |
| PATCH | `/v1/notifications/:id/read` | Auth (của mình) | — | 200 `NotificationResponse` |

## 5. WebSocket (Socket.io)

- **Xác thực lúc handshake:** client gửi `auth: { token: <accessToken> }`; server verify bằng `JwtService` (cùng `JWT_ACCESS_SECRET`). Sai/thiếu → **ngắt kết nối ngay**.
- **Room:** mỗi khoá là 1 room `course:{courseId}`.
- **Join:** client gửi `join_course { courseId }` → server kiểm tra enrollment → join; không hợp lệ → trả ack lỗi, **không** join.
- **Redis adapter** để chạy nhiều instance.

**Server → client (event + payload):**
| Event | Payload |
| --- | --- |
| `qna.thread.created` | `{ thread: ThreadResponse }` |
| `qna.post.created` | `{ threadId, post: PostResponse }` |
| `notification.created` | `{ notification: NotificationResponse }` |
| `video.ready` | `{ lessonId, videoId }` *(do @media emit)* |
| `progress.updated` | `{ courseId, progressPct }` *(do @learning emit)* |

**Client → server:**
| Message | Payload | Ack |
| --- | --- | --- |
| `join_course` | `{ courseId }` | `{ ok: true }` hoặc `{ ok: false, error }` |
| `leave_course` | `{ courseId }` | `{ ok: true }` |

## 6. DTO
- **CreateThreadDto**: `title` string 1..200 (bắt buộc) · `lessonId?` uuid.
- **CreatePostDto**: `content` string 1..5000 (bắt buộc).

## 7. Response shapes
```
ThreadResponse       { id, courseId, lessonId, authorId, title, resolved, createdAt }
PostResponse         { id, threadId, authorId, content, createdAt }
NotificationResponse { id, type, payload, read, createdAt }
```

## 8. Mã lỗi
| Mã | Khi nào |
| --- | --- |
| 400 | DTO sai / nội dung rỗng |
| 401 | Chưa login (REST) hoặc handshake WS thiếu/sai token |
| 403 | Không thuộc khoá (chưa enroll) hoặc không phải chủ sở hữu |
| 404 | Thread / Notification không tồn tại |

## 9. Ghi chú cho @qa (e2e)
- POST thread khi **chưa enroll** → **403**.
- Người ngoài khoá `GET /v1/threads/:id` → **403**.
- `resolve` bởi student → **403**; bởi chủ khoá → 200.
- WS với token sai → bị ngắt kết nối; `join_course` khoá không enroll → ack lỗi.
- Đăng post → các client khác trong cùng room nhận `qna.post.created`.
- `GET /v1/notifications/me` chỉ trả thông báo của chính mình.
