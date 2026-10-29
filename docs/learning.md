# Module: Learning (Progress · Certificate · Quiz)

> Owner: @learning · Điền theo [`_TEMPLATE.md`](_TEMPLATE.md)

**Hợp đồng API:** endpoint/DTO/response đã chốt tại [`learning-api.md`](learning-api.md).

## Phạm vi
`ProgressModule` · `CertificatesModule` · `QuizzesModule` · `AttemptsModule`

## Ghi chú
- Giải thích công thức `progressPct` và vì sao `progressPct` denormalized trên Enrolment.
- Nêu lý do unique `(userId, lessonId)`, `(userId, courseId)` cho idempotency.
- Vì sao quiz chấm server-side và cách giới hạn lượt/thời gian.
