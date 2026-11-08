# AGENTS.md — Dev Learning

> Đọc [`prompt/AGENTS.md`](../AGENTS.md) trước. File này chỉ nói phần riêng của vai trò Dev Learning.
> **Hợp đồng API (implement đúng theo):** [`../../docs/learning-api.md`](../../docs/learning-api.md)
> **Scope hiện tại:** theo [`../../TASKLIST.md`](../../TASKLIST.md), chứng chỉ chỉ gồm record và trang tra cứu; PDF/email và CertificateQueue đã cắt. Không triển khai lại các phần này theo luồng dự kiến cũ.

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
     → nếu hoàn thành đủ mọi lesson published (>0) → cấp Certificate record idempotent
        → tra cứu public JSON/HTML theo serialNo
```

## Nguyên tắc tối ưu
- Không `COUNT(*)` toàn bảng mỗi request — giữ tổng lesson published trong **Redis**.
- Chứng chỉ idempotent nhờ unique `(userId, courseId)` trong PostgreSQL; serial và ngày cấp được giữ nguyên khi gọi lại.
- Quiz **chấm server-side tuyệt đối**, giới hạn số lần & thời gian.

## Phụ thuộc
- **Dev Content** (`Enrolment`, `Lesson`), **Dev Media** (`Video` cho duration).
- Khi tích hợp Catalog thật: chốt FK/cascade và invalidation cache tổng bài published với `@content`/Lead.
- BullMQ/CertificateQueue không phải phụ thuộc của scope chứng chỉ record hiện tại.

## Definition of Done
Progress cập nhật đúng %, chứng chỉ tự phát khi đạt 100%, quiz chấm đúng + chống gian lận cơ bản.

## Trạng thái và việc còn lại
- [x] Công thức `progressPct`: đếm lesson published, làm tròn phần trăm; chứng chỉ yêu cầu hoàn thành đủ mọi bài, không chỉ phần trăm đã làm tròn.
- [x] Chính sách quiz: tối đa 3 lượt bắt đầu, tính cả hết giờ; chấm server-side, kiểm tra deadline và chống nộp trùng.
- [x] Implementation Progress/Certificate/Quiz/Attempt/Health, wiring, migration và bản demo local.
- [x] Test HTTP module với Auth/JWT/role/DTO thật và test hồi quy snapshot quiz, timeout Redis, cache cũ; vẫn dùng fixtures Catalog riêng.
- [ ] Tích hợp với Course/Lesson/Enrolment thật và FK/cascade — phối hợp `@content` + Lead; nhánh Content hiện chưa có implementation.
- [ ] Lead review thay đổi cross-cutting và QA nghiệm thu e2e toàn hệ thống.

Xem tiến độ chi tiết tại `TASKLIST.md`; unit/integration của Dev không thay thế xác nhận e2e của QA.
