# Hợp đồng API — Learning (Progress · Quiz · Certificate)

> **Canonical spec.** `@learning` implement theo file này; `@qa` viết e2e dựa trên đây.
> Prompt vai trò: [`../prompt/dev-learning/AGENTS.md`](../prompt/dev-learning/AGENTS.md) · Giải thích module: [`learning.md`](learning.md)

## 1. Quy ước chung
Áp dụng [quy ước chung của Catalog](catalog-api.md#1-quy-ước-chung).

## 2. Quyền
| Vai trò | Quyền |
| --- | --- |
| STUDENT (đã enroll) | Cập nhật progress, làm quiz, xem chứng chỉ của mình |
| INSTRUCTOR (chủ khoá) / ADMIN | Tạo/sửa quiz (kèm đáp án đúng) |
| Public | Tra cứu chứng chỉ theo `serialNo` |

## 3. Entity & ràng buộc DB
| Entity | Trường chính | Ràng buộc |
| --- | --- | --- |
| `LessonProgress` | `userId`, `lessonId`, `watchedSec`, `completed`, `completedAt?` | unique `(userId, lessonId)` · index `(lessonId, completed)` |
| `Quiz` | `lessonId` (unique), `passScore`, `timeLimitSec?` | 1 quiz / lesson |
| `Question` / `Option` | `content`, `position` / `content`, `isCorrect` | unique `(quizId, position)` |
| `QuizAttempt` | `quizId`, `userId`, `score?`, `passed?`, `startedAt`, `submittedAt?` | index `(userId, quizId)` |
| `QuizAnswer` | `attemptId`, `questionId`, `optionId?` | unique `(attemptId, questionId)` |
| `Certificate` | `userId`, `courseId`, `serialNo`, `issuedAt` | unique `(userId, courseId)` · `serialNo` unique |

## 4. Endpoints
| Method | Path | Quyền | Input | Success |
| --- | --- | --- | --- | --- |
| PATCH | `/v1/lessons/:lessonId/progress` | enrolled STUDENT | `{ watchedSec }` | 200 `LessonProgressResponse` |
| GET | `/v1/enrolments/:courseId/progress` | STUDENT (của mình) | — | 200 `{ progressPct, lessons:[...] }` |
| GET | `/v1/lessons/:lessonId/quiz` | Auth | — | 200 `QuizResponse` (không có đáp án đúng) |
| POST | `/v1/lessons/:lessonId/quiz/attempts` | enrolled STUDENT | — | 201 `{ attemptId, questions }` |
| POST | `/v1/quiz-attempts/:id/submit` | STUDENT (của mình) | `SubmitAttemptDto` | 200 `{ score, passed }` |
| GET | `/v1/certificates/me` | Auth | — | 200 `[CertificateResponse]` |
| GET | `/v1/certificates/:serialNo` | **Public** | — | 200 `CertificateResponse` |

## 5. Quy tắc nghiệp vụ
- **Hoàn thành lesson:** `watchedSec >= 0.9 * lesson.durationSec` → `completed = true`.
- **Tiến độ khoá:** `progressPct = round(completedLessons / publishedLessons * 100)` → cập nhật `Enrolment` (denormalized).
- **Chứng chỉ:** khi `progressPct == 100` → cấp 1 chứng chỉ (idempotent nhờ unique `(userId, courseId)`); sinh `serialNo` duy nhất.
- **Quiz:** chấm **server-side tuyệt đối**; `score` = % câu đúng; `passed = score >= passScore`; không trả `isCorrect` cho student; tôn trọng `timeLimitSec`; giới hạn số lần nộp.

## 6. DTO
- **UpdateProgressDto**: `watchedSec` int ≥ 0 (bắt buộc).
- **CreateQuizDto** (INSTRUCTOR): `passScore` int 0..100 · `timeLimitSec?` int ≥ 0 · `questions[]` (content + options có `isCorrect`).
- **SubmitAttemptDto**: `answers[]` gồm `{ questionId, optionId? }`; validate không trùng `questionId`.

## 7. Response shapes
```
LessonProgressResponse { lessonId, watchedSec, completed, completedAt }
QuizResponse           { id, lessonId, passScore, timeLimitSec, questions:[{ id, content, options:[{ id, content }] }] }
                       // KHÔNG có isCorrect
AttemptResultResponse  { attemptId, score, passed, submittedAt }
CertificateResponse    { serialNo, courseId, userId, issuedAt }
```

## 8. Mã lỗi
| Mã | Khi nào |
| --- | --- |
| 400 | DTO sai / `watchedSec` âm / nộp quiz quá thời gian |
| 401 | Chưa login |
| 403 | Chưa enroll, hoặc không phải chủ attempt |
| 404 | Lesson/Quiz/Attempt/Certificate không tồn tại |
| 409 | Nộp attempt đã submit / vượt số lần cho phép |

## 9. Ghi chú cho @qa
- PATCH progress khi **chưa enroll** → **403**.
- `watchedSec` vượt ngưỡng 0.9 → lesson `completed`; cập nhật lại `progressPct` của enrolment.
- Đạt 100% → có chứng chỉ; gọi lại lần nữa → **không** tạo chứng chỉ thứ hai.
- `GET /v1/lessons/:id/quiz` **không** chứa `isCorrect`.
- Nộp attempt 2 lần → lần 2 **409**.
- Tra cứu `GET /v1/certificates/:serialNo` không cần token → 200; sai serial → 404.
