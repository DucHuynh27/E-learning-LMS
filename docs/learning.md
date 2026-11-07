# Module: Learning (Progress · Certificate · Quiz · Health)

> Owner: @learning · Contract: [`learning-api.md`](learning-api.md)

## 1. Tổng quan

Learning theo dõi tiến độ theo lesson, tính tiến độ khoá, cấp một chứng chỉ khi học đủ bài và chấm quiz trên server. Phần chứng chỉ gồm record và HTML tra cứu; PDF, email và CertificateQueue nằm ngoài scope trong `TASKLIST.md`.

## 2. Luồng dữ liệu

```text
JWT + RolesGuard → Controller + DTO → Service → transaction PostgreSQL
  Progress → kiểm tra Catalog/enrolment → khoá enrolment → lưu LessonProgress
           → đếm bài hoàn thành/published → cập nhật Enrolment → Certificate
  Quiz     → kiểm tra owner → tạo câu hỏi/lựa chọn
  Attempt  → khoá enrolment/quiz khi bắt đầu; khoá attempt khi nộp → chấm → lưu kết quả
Redis: cache tổng bài published trong 30 giây; lỗi cache thì đọc PostgreSQL.
```

## 3. Các file chính

| File/thư mục trong `backend/src/` | Trách nhiệm |
| --- | --- |
| `learning/learning.module.ts` | Điểm nhập các module Learning và Health |
| `learning/learning.entities.ts` | Danh sách entity cần thêm vào DataSource |
| `learning/catalog-access.service.ts` | Adapter SQL theo `catalog-api.md`, không tạo/sửa module của @content |
| `learning/published-lesson-cache.service.ts` | AUTH/GET/SET/DEL/PING Redis qua TCP, timeout 500 ms và fallback |
| `progress/` | Tiến độ, tổng hợp khoá, cấp chứng chỉ trong cùng transaction |
| `quizzes/` | Tạo/thay quiz và response không chứa đáp án đúng |
| `attempts/` | Giới hạn lượt, deadline, kiểm tra câu/option, chấm điểm và chống nộp hai lần |
| `certificates/` | Cấp idempotent, danh sách cá nhân, JSON/HTML tra cứu public |
| `health/` | Kiểm tra PostgreSQL, Redis, MinIO; 503 khi có lỗi |
| `database/migrations/1794050000000-Learning.ts` | Schema Learning, constraints/index và rollback |

## 4. Quyết định thiết kế

- `progressPct = round(completed / published * 100)`, không tính theo thời lượng. Chỉ lesson published được đưa vào cả tử và mẫu; không có bài thì trả 0. Tổng phần trăm lưu trên Enrolment để danh sách enrolment không phải tổng hợp toàn bộ lịch sử.
- PATCH lấy số giây lớn nhất đã nhận, chặn ở duration của lesson; hoàn thành tại ngưỡng 90%. Một request đến muộn không làm mất tiến độ hoặc thay ngày hoàn thành đầu tiên. Duration lấy từ Lesson theo contract hiện tại; Media/Content cần đồng bộ duration sau khi video sẵn sàng.
- Mỗi course/user có một enrolment được khoá trong transaction. Hai lesson hoàn thành đồng thời vẫn cập nhật đúng tổng; insert chứng chỉ lỗi thì rollback cả progress và enrolment.
- Redis giữ tổng bài theo course. Khi một lesson vừa hoàn thành, khi GET tổng tiến độ, hoặc trước khi tổng cache có thể dẫn tới 100%, đọc lại số bài từ DB. Chỉ cấp chứng chỉ khi số bài thực sự bằng tổng bài (>0), tránh 199/200 bị làm tròn thành 100 hoặc cache cũ gây cấp sớm.
- Sau khi thay đổi lesson/publish/section, @content nên gọi `PublishedLessonCache.invalidate(courseId)`; TTL 30 giây là đường dự phòng. COUNT đều giới hạn trong course, không đếm toàn bảng mỗi PATCH xem video.
- Chứng chỉ dùng `INSERT ... ON CONFLICT (userId, courseId) DO NOTHING` trong transaction hoàn thành. Serial UUID được tạo một lần; gọi lại không đổi serial/ngày cấp.
- Quiz chọn một đáp án, tối đa 3 lượt bắt đầu, kể cả lượt hết giờ. 0/null là không giới hạn thời gian. Deadline dùng thời gian PostgreSQL; tới deadline thì không nhận bài.
- Khoá enrolment/quiz tuần tự hoá việc bắt đầu lượt; khoá attempt tuần tự hoá việc submit. Không sửa quiz sau khi có attempt, nên câu hỏi và đáp án không đổi giữa lúc làm bài.
- Điểm dựa trên **tất cả câu hỏi lưu trong DB**. Câu bỏ trống tính sai; question/option khác quiz/câu bị từ chối trước khi lưu. Client không gửi điểm hay userId.
- `Option.isCorrect` có `select: false`; chỉ truy vấn nội bộ lấy trường này để chấm bài. Response luôn chọn rõ field, không trả entity thẳng ra ngoài.

## 5. Ràng buộc DB

| Entity | Ràng buộc/index | Mục đích |
| --- | --- | --- |
| LessonProgress | unique `(userId, lessonId)`, index `(lessonId, completed)` | Một record tiến độ; hỗ trợ lọc bài hoàn thành |
| Quiz | unique `lessonId`, CHECK score/time | Một quiz mỗi lesson, giới hạn hợp lệ |
| Question / Option | unique vị trí; partial unique option đúng mỗi câu | Thứ tự ổn định, không thể có hai option đúng |
| QuizAttempt | index `(userId, quizId)`, CHECK kết quả | Đếm lượt theo user/quiz, trạng thái nộp nhất quán |
| QuizAnswer | unique `(attemptId, questionId)`, FK `(questionId, optionId)` | Không trả lời hai lần; option phải thuộc câu |
| Certificate | unique `(userId, courseId)` và `serialNo` | Cấp idempotent, tra cứu serial duy nhất |

FK nội bộ Learning và FK đến users có trong cả entity metadata lẫn migration. Nhánh này chưa có entities/migrations của Catalog, nên chưa khai báo FK tới `courses`/`lessons`; adapter kiểm tra tồn tại/enrolment trong service. Khi tích hợp Catalog, Lead/@content cần chốt FK/cascade hoặc cơ chế dọn dữ liệu khi xoá lesson/course. Chứng chỉ đã cấp không tự bị thu hồi khi nội dung khoá thay đổi.

## 6. API

Xem bảng endpoint và DTO trong [`learning-api.md`](learning-api.md). API dùng envelope/filter/versioning có sẵn. HTML xác thực nằm ở `/v1/certificates/:serialNo/verify`, có escape HTML và CSP, không hiển thị tên/email học viên.

## 7. Lỗi và trường hợp biên

400 cho input sai, câu/option ngoài quiz hoặc quá giờ; 403 cho sai role/enrolment/owner; 404 khi thiếu lesson/quiz/attempt/chứng chỉ; 409 khi tạo quiz trùng, sửa quiz đã có attempt, còn lượt đang làm, vượt 3 lượt hoặc nộp lần hai. Thiếu schema Catalog trả 503 với thông báo rõ phụ thuộc. Health trả 503 nếu PostgreSQL/Redis/MinIO không sẵn sàng, không lộ mật khẩu hay URL có credentials.

Giá trị `watchedSec` do client báo nên không chứng minh người dùng đã thực sự xem video; chống gian lận xem video không thuộc scope hiện tại. Quiz chưa có reset lượt, random câu hay phiên bản đề thi.

## 8. Kiểm thử

Chạy trong `backend/`, dùng dependencies cục bộ:

```powershell
npm run lint
npm run build
npm test
$env:LEARNING_DB_TESTS = '1'
npm test -- src/learning/learning.integration.spec.ts
```

- Unit/DTO: số giây, whitelist, nested input, UUID, câu trùng cả khác hoa/thường, câu bỏ trống, chấm server-side; Redis reply phân mảnh/auth lỗi/timeout; health thành công, lỗi và timeout.
- Integration: PostgreSQL thật, `synchronize: false`, chạy migration thật; dùng schema ngẫu nhiên `learning_test_<uuid>` và fixtures Catalog theo spec, xoá riêng schema đó sau test. Không dùng/sửa dữ liệu demo hay schema `public`. Mặc định skip khi chưa bật `LEARNING_DB_TESTS`.
- Bao phủ ngưỡng 90%, published/draft, monotonic progress, request đồng thời, idempotency, rollback, ownership, đáp án bị ẩn, deadline, tối đa lượt và migration lên/xuống.
- E2E thuộc @qa; service integration không thay cho e2e HTTP trên ứng dụng đã tích hợp.

Kết quả kiểm tra local ngày 2026-11-07: lint và build thành công; `LEARNING_DB_TESTS=1 npm test` qua 48 test (gồm 19 integration PostgreSQL); e2e nền tảng có sẵn qua 1 test. Probe trực tiếp xác nhận Redis AUTH/SET/GET và health PostgreSQL/Redis/MinIO đều hoạt động. E2E nền tảng chưa bao phủ các route nghiệp vụ Learning; phần này vẫn cần @qa xác nhận.

## 9. Tích hợp cho Lead

Đã import `LearningModule` trong `AppModule` và thêm `LEARNING_ENTITIES` vào `AppDataSource.options.entities` theo yêu cầu chạy thử. [`learning-wiring.patch`](learning-wiring.patch) lưu lại đúng hai thay đổi shared này để Lead review; **không áp dụng lại patch** trên nhánh đã có wiring.

Chạy ứng dụng với dữ liệu Catalog thật sau khi review và tích hợp Content, từ root repo:

```powershell
cd backend
npm run build
node --env-file=.env --import tsx node_modules/typeorm/cli.js migration:run -d src/database/data-source.ts
npm run start:dev
```

Giữ `synchronize: false`; không thêm migrations vào runtime. Dữ liệu/endpoint nghiệp vụ cần Catalog triển khai đúng bảng `courses`, `sections`, `lessons`, `enrolments` với camelCase như `catalog-api.md`. Sau khi Content thay schema, chạy lại integration/e2e với schema thật. `REDIS_HOST`/`MINIO_HOST` tuỳ chọn, mặc định localhost; các port/password lấy từ config sẵn có. Khi chạy app trong container, cấu hình host tương ứng `redis` và `minio`.

Để thử trước khi Content hoàn tất, dùng `npm run demo:seed` rồi `npm run demo:start` trong `backend/`. API port 3002 dùng schema `learning_demo`, gồm fixtures Catalog và implementation Learning thật. Hướng dẫn giao diện Next.js nằm tại [`frontend/README.md`](../frontend/README.md). Bản demo không thay thế e2e với module Content thật.

## 10. Trạng thái bàn giao

Đã có implementation module, migration, wiring, unit/service integration, giao diện Next.js và bản demo local. Chờ Lead review thay đổi cross-cutting, Catalog cung cấp schema thật và @qa xác nhận e2e; chưa đánh dấu Definition of Done toàn hệ thống. Backend không thêm dependency; frontend dùng lại cấu hình Next.js và lockfile có trên main, không cài công cụ toàn cục.
