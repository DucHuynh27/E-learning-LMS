# Module Learning: Progress, Quiz, Certificate, Health

Owner: Phạm Ngọc Minh Quân (`@ljq-exe`, `@learning`). Contract: [learning-api.md](learning-api.md). Tích hợp: [learning-integration.md](learning-integration.md). Rà soát issue: [learning-review.md](learning-review.md).

## Luồng và ranh giới ghi dữ liệu

- PATCH progress xác thực STUDENT/enrolment và lesson published, khoá enrolment rồi lưu tiến độ, tổng hợp PostgreSQL, cập nhật enrolment và cấp chứng chỉ trong cùng transaction. Gửi hai bài hoàn thành đồng thời vẫn có tiến độ đúng và chỉ một chứng chỉ.
- GET tiến độ chạy snapshot REPEATABLE READ và SET TRANSACTION READ ONLY. Không FOR UPDATE, UPDATE enrolments hoặc cấp chứng chỉ; reader không phải đợi row lock của writer.
- GET tính phần trăm từ danh sách bài published hiện tại. Enrolment denormalized chỉ được đồng bộ khi PATCH; GET không sửa trạng thái lưu trước đó khi nội dung Catalog thay đổi.
- Tổng bài và số bài hoàn thành được tổng hợp từ PostgreSQL trong một câu SQL theo course, không dùng cache vào quyết định hoàn thành. Không còn TTL hoặc phụ thuộc Content gọi invalidate. Đổi lại, mỗi PATCH có một aggregate có điều kiện theo course; Catalog cần index sections.courseId, lessons.sectionId như contract.
- watchedSec không giảm, tối đa durationSec; completedAt giữ ngày hoàn thành đầu tiên. Ngưỡng hoàn thành lesson là 90%. Tỷ lệ được làm tròn nhưng chứng chỉ yêu cầu completed == total > 0, nên 199/200 chưa được cấp.

## Quiz và chứng chỉ

- Quiz chọn một đáp án, mỗi câu có đúng một option đúng. Điểm dựa trên tất cả câu trong DB; câu bỏ trống sai. Client không quyết định điểm hoặc userId.
- Tối đa MAX_QUIZ_ATTEMPTS lượt, tính cả hết giờ; message giới hạn sinh từ cùng hằng. Deadline dùng PostgreSQL và trả startedAt/expiresAt. Nộp tại deadline bị từ chối; 0/null là không giới hạn.
- Khoá enrolment/quiz tuần tự hoá việc bắt đầu; khoá attempt bảo đảm chỉ submit một lần. Không sửa đề sau khi đã có attempt. GET quiz dùng REPEATABLE READ để settings/questions/options thuộc cùng snapshot.
- Option.isCorrect bị ẩn trong select mặc định và mọi response public. Kiểm tra question/option thuộc đúng đề trước khi lưu; bài nộp sai không được lưu một phần.
- Certificate dùng INSERT ON CONFLICT (userId, courseId) DO NOTHING. Serial/ngày cấp không đổi khi PATCH lại. Chứng chỉ đã cấp không tự bị thu hồi khi Catalog thay đổi.
- /certificates/me yêu cầu đăng nhập và có userId của chủ sở hữu. JSON public và HTML verify chỉ có serialNo, courseId, issuedAt; không có định danh học viên. HTML escape nội dung và đặt CSP.

## Redis và health

Redis chỉ còn phục vụ health. RedisHealthProbe dùng client redis chính thức, dùng lại một kết nối multiplexed thay vì tự parse RESP/mở TCP mỗi lệnh. Có cấu hình TLS và ACL, tắt offline queue, hạn tổng mỗi probe 500 ms, gộp request đồng thời, đóng kết nối lỗi và thử kết nối lại ở request sau. Shutdown đóng socket. Không có lệnh Redis trong transaction tiến độ.

REDIS_HOST và MINIO_HOST phải có trong môi trường boot; mẫu local dùng localhost, container dùng redis/minio. REDIS_TLS mặc định false; REDIS_USERNAME hỗ trợ ACL. Không in credentials vào lỗi. /health trả 503 khi PostgreSQL/Redis/MinIO không sẵn sàng.

## File và build

- progress/: đọc snapshot và PATCH tiến độ; certificates/: cấp và tra cứu; quizzes/ và attempts/: đề và chấm bài.
- health/redis-health-probe.service.ts: kết nối Redis chính thức; learning/catalog-access.service.ts: adapter schema Catalog theo contract.
- database/migrations/1794050000000-Learning.ts: migration thật; synchronize luôn false, runtime không nạp migration.
- test-support/http-test-database.ts nằm ngoài src và không xuất hiện trong dist. Spec được loại khỏi production build.
- Wiring AppModule/DataSource đã có trong source. File patch áp dụng lại đã xoá; review trực tiếp source và hướng dẫn tích hợp.

## Kiểm thử hiện tại — 2026-11-19

| Nhóm | Số test | Môi trường và giới hạn |
| --- | ---: | --- |
| Backend unit/DTO/config/health | 34 | Unit; Redis client lifecycle được mock |
| Learning service integration | 22 | PostgreSQL 16 thật, Catalog fixtures |
| Learning HTTP module integration | 10 | Auth/Learning thật, PostgreSQL; Catalog fixtures, health stub |
| Regression GET chỉ đọc/không đợi writer lock | 2 | PostgreSQL 16 thật |
| Tổng npm test backend | 68 | Không có describe.runIf hoặc test bị skip |
| Frontend unit | 17 | Quiz 404, lỗi 401/403/500; storage bị chặn/hết dung lượng, dữ liệu lưu hỏng và deadline server |
| E2E nền tảng (riêng) | 1 | Chỉ GET /v1; không phải nghiệm thu Learning |

68 = 34 unit + 22 service + 10 HTTP + 2 regression. Các số 62/32 trước đây mô tả phiên bản cũ hoặc tập con; không dùng làm tổng của bản hiện tại.

Trong backend: npm test chạy toàn bộ và cần PostgreSQL, lỗi kết nối làm test thất bại. npm run test:unit là lựa chọn explicit không cần DB. Integration tự tạo/dọn schema ngẫu nhiên, không dùng dữ liệu demo/public. Bản kiểm tra local dùng PostgreSQL riêng ở port 55433; không đổi mật khẩu DB đang có.

Đã xác minh [GitHub Actions run #31 của PR #29](https://github.com/DucHuynh27/E-learning-LMS/actions/runs/44504032170) trên head `16c3636` (merge ref `3f4abd0`): cả ba job thành công. Log `lint-and-test` xác nhận 68 test qua, không skip, cùng lint/build; `frontend` xác nhận 9 test, lint/typecheck/build qua; `e2e` xác nhận 1 test nền tảng qua. PostgreSQL service được khởi tạo trong job backend, dependencies được cài bằng frozen lockfile.

Kết quả CI này xác nhận việc thực thi các gate trong nhánh PR. Lead review, required status checks của main và nghiệm thu QA/Catalog thật tiếp tục để mở; một run xanh không thay thế các bước đó.

## Tích hợp và nghiệm thu còn mở

Catalog thật/FK/cascade vẫn chờ Content và Lead. Adapter hiện dựa vào contract courses/sections/lessons/enrolments; không tạo Catalog thay owner. Media cần đồng bộ durationSec vào lesson. QA cần nghiệm thu luồng tạo/publish/enroll/học/quiz/certificate với Catalog thật.

PR #10 đã merge bằng admin bypass theo ghi nhận của Lead; merge không phải bằng chứng có approval hoặc QA ký. Các checkbox implementation mô tả code/test cục bộ; trạng thái tích hợp, review cross-cutting và QA tiếp tục để mở.

Frontend /learning dùng CSS Module local, load quiz 404 không chặn progress/certificates. Đăng xuất xoá attempt của user khỏi sessionStorage; khôi phục sau reload loại bỏ attempt hết hạn hoặc sai cấu trúc câu hỏi/đáp án. Lỗi truy cập storage không làm bắt đầu/nộp bài/đăng xuất thất bại; nếu không lưu được thì lượt chỉ còn trong bộ nhớ trang hiện tại. Layout/root carousel được trả về scaffold trước Learning; owner scaffold là Lead, thay đổi tương lai cần review riêng.

PDF/email chứng chỉ, reset lượt, random đề và anti-cheat nâng cao nằm ngoài scope hiện tại. Demo dùng fixtures Catalog và API Learning thật; xem frontend/README.md.
