# AGENTS.md — Dev Learning

> Đọc [`prompt/AGENTS.md`](../AGENTS.md) trước. File này chỉ nói phần riêng của vai trò Dev Learning.

## Vai trò
Sở hữu logic nghiệp vụ dày nhất: **tiến độ học tập + chứng chỉ + quiz**.

## Phạm vi module sở hữu
`ProgressModule` · `CertificatesModule` · `QuizzesModule` · `AttemptsModule`

## Entity cần tạo
- **LessonProgress**: `id`, `userId`, `lessonId`, `watchedSec`, `completed`, `completedAt?`. Unique `(userId, lessonId)`. Index `(lessonId, completed)`.
- **Quiz**: `id`, `lessonId` (unique), `passScore`, `timeLimitSec?`.
- **Question** / **Option**: câu hỏi + đáp án (`isCorrect`).
- **QuizAttempt**: `id`, `quizId`, `userId`, `score?`, `passed?`, `startedAt`, `submittedAt?`. Index `(userId, quizId)`.
- **QuizAnswer**: `id`, `attemptId`, `questionId`, `optionId?`. Unique `(attemptId, questionId)`.
- **Certificate**: `id`, `userId`, `courseId`, `serialNo` (unique), `pdfKey?`, `issuedAt`. Unique `(userId, courseId)`.

## Luồng cốt lõi
```
Xem video → PATCH progress {watchedSec}
  watchedSec >= 0.9*duration → completed = true
     → đếm lesson published (cache Redis) & đã hoàn thành (index sẵn)
     → progressPct = round(completed/published*100) → update Enrolment
     → nếu 100% → enqueue CertificateQueue → worker render PDF + upload S3 + email
```

## Nguyên tắc tối ưu
- Không `COUNT(*)` toàn bảng mỗi request — giữ tổng lesson published trong **Redis**.
- Chứng chỉ idempotent nhờ `@@unique([userId, courseId])` (PDF/serial sinh 1 lần).
- Quiz **chấm server-side tuyệt đối**, giới hạn số lần & thời gian.

## Phụ thuộc
- **Dev Content** (`Enrolment`, `Lesson`), **Dev Media** (`Video` cho duration).
- **BullMQ** cho `CertificateQueue` (Dev Media cấu hình `BullModule` nền tảng).

## Definition of Done
Progress cập nhật đúng %, chứng chỉ tự phát khi đạt 100%, quiz chấm đúng + chống gian lận cơ bản.

## TODO (đào sâu sau)
- [ ] Công thức `progressPct` (đếm lesson hay theo thời lượng?)
- [ ] Sinh PDF chứng chỉ (thư viện nào)
- [ ] Chính sách retry quiz
