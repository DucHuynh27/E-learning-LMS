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
| POST | `/v1/lessons/:lessonId/quiz` | owner INSTRUCTOR / ADMIN | `CreateQuizDto` | 201 `QuizResponse` |
| PUT | `/v1/lessons/:lessonId/quiz` | owner INSTRUCTOR / ADMIN | `CreateQuizDto` (thay toàn bộ) | 200 `QuizResponse` |
| POST | `/v1/lessons/:lessonId/quiz/attempts` | enrolled STUDENT | — | 201 `{ attemptId, questions }` |
| POST | `/v1/quiz-attempts/:id/submit` | STUDENT (của mình) | `SubmitAttemptDto` | 200 `{ score, passed }` |
| GET | `/v1/certificates/me` | Auth | — | 200 `[CertificateResponse]` |
| GET | `/v1/certificates/:serialNo` | **Public** | — | 200 `CertificateResponse` |
| GET | `/v1/certificates/:serialNo/verify` | **Public** | — | 200 HTML xác thực chứng chỉ |
| GET | `/v1/health` | **Public** | — | 200 `{ status:"ok", checks:{ postgres, redis, minio } }` hoặc 503 |

## 5. Quy tắc nghiệp vụ
- **Hoàn thành lesson:** `watchedSec >= 0.9 * lesson.durationSec` → `completed = true`.
- `watchedSec` không giảm khi request đến muộn; giới hạn tối đa bằng `durationSec`. Lesson duration 0 hoàn thành với `watchedSec = 0`. `completedAt` được giữ nguyên sau lần hoàn thành đầu tiên.
- **Tiến độ khoá:** `progressPct = round(completedLessons / publishedLessons * 100)` → cập nhật `Enrolment` (denormalized).
- Chỉ đếm lesson `isPublished = true`; khoá không có lesson published có tiến độ 0. GET tiến độ liệt kê mọi lesson published, kể cả lesson chưa học.
- **Chứng chỉ:** khi `progressPct == 100` → cấp 1 chứng chỉ (idempotent nhờ unique `(userId, courseId)`); sinh `serialNo` duy nhất.
- Điều kiện cấp chứng chỉ và đặt Enrolment `COMPLETED` còn yêu cầu `completedLessons == publishedLessons > 0`, tránh cấp sớm khi 199/200 bị làm tròn thành 100. Không sinh PDF/email theo scope đã chốt trong `TASKLIST.md`.
- **Quiz:** chấm **server-side tuyệt đối**; `score` = % câu đúng; `passed = score >= passScore`; không trả `isCorrect` cho student; tôn trọng `timeLimitSec`; giới hạn số lần nộp.
- Quiz chọn một đáp án: 1..100 câu, mỗi câu có 2..8 lựa chọn và **đúng một** lựa chọn đúng. Câu bỏ trống tính sai; điểm phần trăm được làm tròn thành số nguyên trên tổng số câu lưu trong DB.
- Tối đa **3 lượt bắt đầu / user / quiz**, tính cả lượt hết giờ. Mỗi lần chỉ có một lượt còn hiệu lực; bắt đầu thêm khi còn lượt đang làm → 409. `timeLimitSec` bằng 0 hoặc bỏ trống nghĩa là không giới hạn; nộp tại hoặc sau deadline → 400.
- Tạo trùng quiz cho lesson → 409. PUT yêu cầu quiz đã tồn tại, thay toàn bộ nội dung; đã có bất kỳ attempt nào thì không cho sửa → 409 để đáp án không thay đổi giữa lúc làm bài.
- GET quiz cho phép Auth xem lesson/khoá published; chỉ owner INSTRUCTOR hoặc ADMIN được xem quiz của lesson/khoá chưa published. Progress/start/submit yêu cầu STUDENT với enrolment ACTIVE/COMPLETED và nội dung published.

## 6. DTO
- **UpdateProgressDto**: `watchedSec` int 0..2147483647 (bắt buộc); không nhận `completed`, `userId` hay `progressPct` từ client.
- **CreateQuizDto** (INSTRUCTOR): `passScore` int 0..100 · `timeLimitSec?` int ≥ 0 · `questions[]` (content + options có `isCorrect`).
- **SubmitAttemptDto**: `answers[]` gồm `{ questionId, optionId? }`; UUID hợp lệ, tối đa 100 phần tử, không trùng `questionId` (không phân biệt hoa/thường). Có thể gửi mảng rỗng; option bỏ trống/null tính sai. Question/option phải thuộc đúng quiz/câu hỏi. Không nhận điểm hoặc đáp án đúng từ client.
- Param `lessonId`, `courseId`, attempt `id` phải là UUID. `serialNo` dài 1..64, chỉ gồm chữ, số và dấu `-`.

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
| 503 | Catalog chưa có schema cần thiết, hoặc một dịch vụ trong health check không sẵn sàng |

## 9. Ghi chú cho @qa
- PATCH progress khi **chưa enroll** → **403**.
- `watchedSec` vượt ngưỡng 0.9 → lesson `completed`; cập nhật lại `progressPct` của enrolment.
- Đạt 100% → có chứng chỉ; gọi lại lần nữa → **không** tạo chứng chỉ thứ hai.
- `GET /v1/lessons/:id/quiz` **không** chứa `isCorrect`.
- Nộp attempt 2 lần → lần 2 **409**.
- Tra cứu `GET /v1/certificates/:serialNo` không cần token → 200; sai serial → 404.
- Gửi đồng thời hai request hoàn thành hai lesson → tiến độ cuối cùng đúng, một chứng chỉ. Gửi đồng thời hai request submit cùng attempt → một 200, một 409.
- Gửi option của câu khác, câu của quiz khác hoặc `score` từ client → 400; không lưu một phần bài nộp.
- `isCorrect` không có trong cả response GET quiz và response bắt đầu attempt.
