-- Local PostgreSQL fixture. Apply the project's migrations before loading.
BEGIN;
SET LOCAL client_encoding = 'UTF8';
SELECT pg_advisory_xact_lock(hashtextextended('lms:demo-catalog', 0));

-- The instructor owns catalog records. Its password was randomly generated and discarded.
INSERT INTO public.users ("id", "email", "passwordHash", "fullName", "role")
VALUES (
  '70b790d0-f72d-4eb4-929f-d58b003afe1e',
  'catalog-instructor@lms.example.invalid',
  '$argon2id$v=19$m=19456,t=2,p=1$C3j8W1LfIRWO4z9IWkEZmw$Boah/IbKvC3+1LT6AnsykmiyAoY2Er6AdYgL+4jj0HM',
  'Giảng viên danh mục mẫu',
  'INSTRUCTOR'
)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE "id" = '70b790d0-f72d-4eb4-929f-d58b003afe1e'
      AND "email" = 'catalog-instructor@lms.example.invalid'
      AND "role" = 'INSTRUCTOR'
  ) THEN
    RAISE EXCEPTION 'Demo catalog instructor conflicts with an existing account';
  END IF;
END
$$;

CREATE TEMP TABLE demo_catalog ON COMMIT DROP AS
SELECT
  entry.*,
  ('42b44a7b-7a7c-4368-bae9-' || lpad(ordinal::text, 12, '0'))::uuid AS course_id,
  'demo-' || slug AS course_slug
FROM (VALUES
  (1, 'html-css', 'HTML và CSS từ đầu', 'Lập trình', 'Xây một trang giới thiệu có bố cục thích ứng với điện thoại.',
   'Cấu trúc HTML có ngữ nghĩa', 'Box model và CSS cascade', 'Bố cục với Grid và Flexbox', 'Hoàn thiện trang giới thiệu'),
  (2, 'javascript', 'JavaScript thực hành', 'Lập trình', 'Thao tác với trang web, xử lý sự kiện và lấy dữ liệu từ API.',
   'Biến, hàm và phạm vi', 'Mảng và đối tượng', 'Sự kiện và thao tác DOM', 'Gọi API bằng fetch'),
  (3, 'typescript', 'TypeScript cho dự án web', 'Lập trình', 'Mô hình hóa dữ liệu và phát hiện lỗi kiểu trước khi chạy ứng dụng.',
   'Kiểu cơ bản và union', 'Interface và type alias', 'Narrowing dữ liệu API', 'Generic cho hàm dùng chung'),
  (4, 'react', 'React với dự án danh sách việc', 'Lập trình', 'Tạo ứng dụng quản lý công việc với component và state.',
   'Chia giao diện thành component', 'State và sự kiện', 'Biểu mẫu có kiểm soát', 'Lọc và đánh dấu công việc'),
  (5, 'nextjs', 'Next.js App Router', 'Lập trình', 'Xây danh mục có layout chung, phân trang và trạng thái tải.',
   'Route và layout', 'Server và Client Components', 'Tìm kiếm qua tham số URL', 'Trang chi tiết và trạng thái lỗi'),
  (6, 'nestjs', 'REST API với NestJS', 'Lập trình', 'Xây API quản lý nội dung với validation và kiểm thử.',
   'Module, controller và provider', 'DTO và ValidationPipe', 'Xử lý lỗi API', 'Kiểm thử HTTP'),
  (7, 'postgresql', 'SQL và PostgreSQL', 'Lập trình', 'Truy vấn dữ liệu học tập và thiết kế lược đồ có khóa ngoại.',
   'SELECT, WHERE và ORDER BY', 'JOIN và GROUP BY', 'Khóa chính và khóa ngoại', 'Index và EXPLAIN'),
  (8, 'typeorm', 'TypeORM và migration', 'Lập trình', 'Quản lý entity, quan hệ và lịch sử thay đổi database.',
   'DataSource và entity', 'Quan hệ nhiều-một', 'Viết migration có rollback', 'QueryBuilder và transaction'),
  (9, 'git-github', 'Git và GitHub theo nhóm', 'Lập trình', 'Sử dụng nhánh, commit và pull request trong dự án chung.',
   'Working tree, staging và commit', 'Nhánh local và remote', 'Giải quyết xung đột merge', 'Review một pull request'),
  (10, 'docker-compose', 'Docker Compose cho môi trường local', 'Lập trình', 'Khởi động web, database và Redis bằng Compose.',
   'Image và container', 'Port, network và volume', 'Khai báo dịch vụ Compose', 'Dùng health check và log'),
  (11, 'python', 'Python qua bài tập nhỏ', 'Lập trình', 'Viết chương trình dòng lệnh đọc và xử lý dữ liệu.',
   'Biến, điều kiện và vòng lặp', 'Hàm và cấu trúc dữ liệu', 'Đọc file CSV', 'Viết chương trình thống kê'),
  (12, 'nodejs', 'Node.js cho backend', 'Lập trình', 'Tạo chương trình bất đồng bộ và phục vụ dữ liệu JSON.',
   'Module và npm scripts', 'Promise và async/await', 'Xây HTTP server', 'Đọc và gửi dữ liệu JSON'),
  (13, 'testing', 'Kiểm thử ứng dụng web', 'Lập trình', 'Kiểm tra hành vi ở mức unit, integration và end-to-end.',
   'Phân loại kiểm thử', 'Kiểm tra đầu vào biên', 'Kiểm thử API với database test', 'Đọc lỗi và tái hiện regression'),
  (14, 'accessibility', 'Khả năng tiếp cận trên web', 'Lập trình', 'Cải thiện biểu mẫu và điều hướng cho bàn phím và trình đọc màn hình.',
   'HTML có ngữ nghĩa', 'Độ tương phản và trạng thái focus', 'Nhãn và thông báo lỗi', 'Kiểm tra bằng bàn phím'),
  (15, 'redis', 'Redis cho ứng dụng web', 'Lập trình', 'Thử cache, TTL và kiểm tra lỗi kết nối Redis trong môi trường local.',
   'Kiểu dữ liệu Redis', 'Khóa và thời gian hết hạn', 'Cache kết quả truy vấn', 'Xử lý lỗi và khôi phục kết nối'),
  (16, 'figma', 'Figma cho người mới', 'Thiết kế', 'Lên bản mẫu giao diện khóa học từ wireframe đến prototype.',
   'Frame và lưới bố cục', 'Auto Layout', 'Component và variant', 'Nối luồng prototype'),
  (17, 'ui-ux', 'Nhập môn UI và UX', 'Thiết kế', 'Nghiên cứu nhu cầu và phác thảo hành trình người học.',
   'Xác định vấn đề người dùng', 'Bản đồ hành trình', 'Wireframe màn hình chính', 'Kiểm tra với người dùng'),
  (18, 'design-system', 'Xây design system', 'Thiết kế', 'Chuẩn hóa màu sắc, khoảng cách, kiểu chữ và component.',
   'Token màu và khoảng cách', 'Thang kích thước chữ', 'Trạng thái của nút và input', 'Viết hướng dẫn dùng component'),
  (19, 'typography', 'Typography cho giao diện', 'Thiết kế', 'Chọn và phối kiểu chữ dễ đọc cho nội dung tiếng Việt.',
   'Họ font và độ đậm', 'Phân cấp tiêu đề', 'Khoảng dòng và độ dài dòng', 'Kiểm tra font trên điện thoại'),
  (20, 'color', 'Màu sắc và độ tương phản', 'Thiết kế', 'Tạo bảng màu và phân biệt các trạng thái bằng nhiều tín hiệu.',
   'Màu chủ đạo và màu trung tính', 'Độ tương phản của văn bản', 'Trạng thái lỗi và thành công', 'Tổ chức màu thành token'),
  (21, 'responsive-design', 'Thiết kế responsive', 'Thiết kế', 'Thích ứng danh mục và điều hướng với nhiều kích thước màn hình.',
   'Bố cục mobile trước', 'Lưới co giãn', 'Điều hướng màn hình nhỏ', 'Kiểm tra tràn ngang'),
  (22, 'information-architecture', 'Kiến trúc thông tin website', 'Thiết kế', 'Nhóm nội dung và đặt tên menu để người dùng tìm đúng trang.',
   'Kiểm kê nội dung', 'Nhóm và đặt tên chủ đề', 'Vẽ sơ đồ trang', 'Kiểm thử đường đi'),
  (23, 'visual-storytelling', 'Kể chuyện bằng hình ảnh', 'Thiết kế', 'Chọn bố cục và hình minh họa cho một bài thuyết trình.',
   'Xác định thông điệp', 'Chọn thứ tự khung hình', 'Cân bằng chữ và hình', 'Rà lại nhịp kể'),
  (24, 'excel', 'Excel cho phân tích dữ liệu', 'Dữ liệu', 'Làm sạch dữ liệu và tổng hợp kết quả bằng bảng tính.',
   'Sắp xếp và lọc dữ liệu', 'Hàm tra cứu và tổng hợp', 'Tạo PivotTable', 'Vẽ biểu đồ và đọc kết quả'),
  (25, 'pandas', 'Phân tích dữ liệu với pandas', 'Dữ liệu', 'Nạp bảng dữ liệu, xử lý giá trị thiếu và tổng hợp theo nhóm.',
   'Đọc CSV thành DataFrame', 'Kiểm tra cột và giá trị thiếu', 'GroupBy và merge', 'Xuất bảng kết quả'),
  (26, 'data-visualization', 'Trực quan hóa dữ liệu', 'Dữ liệu', 'Chọn biểu đồ phù hợp với câu hỏi và làm rõ nguồn dữ liệu.',
   'So sánh các loại biểu đồ', 'Trục, nhãn và đơn vị', 'Màu sắc cho chuỗi dữ liệu', 'Rà lỗi khi diễn giải biểu đồ'),
  (27, 'statistics', 'Thống kê mô tả', 'Dữ liệu', 'Hiểu trung vị, độ phân tán và giới hạn của mẫu quan sát.',
   'Kiểu biến và phân phối', 'Trung bình và trung vị', 'Khoảng tứ phân vị', 'Giải thích kết quả cho người đọc'),
  (28, 'data-cleaning', 'Làm sạch dữ liệu thực hành', 'Dữ liệu', 'Chuẩn hóa trường ngày, loại dữ liệu trùng và ghi lại quy tắc xử lý.',
   'Khảo sát chất lượng dữ liệu', 'Loại bản ghi trùng', 'Chuẩn hóa ngày và văn bản', 'Kiểm tra dữ liệu sau khi sửa'),
  (29, 'dashboard', 'Thiết kế dashboard báo cáo', 'Dữ liệu', 'Xác định chỉ số cần theo dõi và trình bày thay đổi theo thời gian.',
   'Từ câu hỏi đến chỉ số', 'Chọn nguồn và đơn vị đo', 'Phác thảo dashboard', 'Kiểm tra một báo cáo mẫu'),
  (30, 'sql-reporting', 'SQL cho báo cáo học tập', 'Dữ liệu', 'Tổng hợp ghi danh, tiến độ và kết quả quiz từ nhiều bảng.',
   'Đọc lược đồ báo cáo', 'Tổng hợp qua JOIN', 'Cửa sổ và thứ hạng', 'Kiểm tra trường hợp không có dữ liệu'),
  (31, 'product-discovery', 'Khám phá sản phẩm', 'Kỹ năng nghề nghiệp', 'Thu thập phản hồi và chọn giả thuyết để kiểm chứng.',
   'Xác định nhóm người dùng', 'Viết câu hỏi phỏng vấn', 'Nhóm phản hồi', 'Lập kế hoạch thử nghiệm'),
  (32, 'project-planning', 'Lập kế hoạch dự án nhóm', 'Kỹ năng nghề nghiệp', 'Chia phạm vi công việc, xác định phụ thuộc và theo dõi tiến độ.',
   'Xác định mục tiêu và phạm vi', 'Chia công việc và ước lượng', 'Xây lịch theo phụ thuộc', 'Cập nhật tiến độ định kỳ'),
  (33, 'technical-writing', 'Viết tài liệu kỹ thuật', 'Kỹ năng nghề nghiệp', 'Soạn hướng dẫn cài đặt và tài liệu API có ví dụ chạy được.',
   'Xác định đối tượng đọc', 'Viết điều kiện tiên quyết', 'Mô tả request và response', 'Chạy lại ví dụ như người mới'),
  (34, 'presentation', 'Thuyết trình kết quả dự án', 'Kỹ năng nghề nghiệp', 'Chuẩn bị bản demo ngắn và trả lời câu hỏi về quyết định thiết kế.',
   'Lập dàn ý thuyết trình', 'Chọn dữ liệu minh họa', 'Chuẩn bị kịch bản demo', 'Thực hành phần hỏi đáp'),
  (35, 'code-review', 'Code review trong nhóm', 'Kỹ năng nghề nghiệp', 'Đọc thay đổi có hệ thống và viết phản hồi cụ thể.',
   'Hiểu phạm vi pull request', 'Rà luồng dữ liệu và lỗi', 'Viết nhận xét có ví dụ', 'Kiểm tra bản sửa sau review'),
  (36, 'study-planning', 'Lập kế hoạch tự học', 'Kỹ năng học tập', 'Chia mục tiêu thành nhiệm vụ nhỏ và kiểm tra tiến độ mỗi tuần.',
   'Đặt mục tiêu theo tuần', 'Ưu tiên nhiệm vụ học', 'Lên lịch ôn tập', 'Điều chỉnh kế hoạch theo kết quả'),
  (37, 'note-taking', 'Ghi chú để ôn tập', 'Kỹ năng học tập', 'Tạo ghi chú ngắn, đặt câu hỏi và tự kiểm tra kiến thức.',
   'Tách ý chính khỏi ví dụ', 'Tổ chức ghi chú theo chủ đề', 'Viết câu hỏi tự kiểm tra', 'Ôn lại sau một tuần'),
  (38, 'research-basics', 'Tìm và đánh giá tài liệu', 'Kỹ năng học tập', 'Tìm nguồn phù hợp và ghi lại căn cứ cho một kết luận.',
   'Chọn từ khóa tìm kiếm', 'Đọc nguồn và tác giả', 'So sánh nhiều tài liệu', 'Trích dẫn thông tin đã dùng'),
  (39, 'teamwork', 'Làm việc nhóm hiệu quả', 'Kỹ năng học tập', 'Chia vai trò, thống nhất quyết định và tổng kết sau mỗi mốc.',
   'Thỏa thuận vai trò trong nhóm', 'Chuẩn bị cuộc họp ngắn', 'Ghi lại quyết định', 'Tổng kết và cải tiến'),
  (40, 'english-for-it', 'Tiếng Anh đọc tài liệu kỹ thuật', 'Kỹ năng học tập', 'Đọc nhanh hướng dẫn cài đặt, thông báo lỗi và tài liệu API.',
   'Từ vựng về cài đặt', 'Đọc cấu trúc tài liệu API', 'Phân tích thông báo lỗi', 'Tóm tắt hướng dẫn bằng tiếng Việt')
) AS entry(ordinal, slug, title, topic, description, lesson_a, lesson_b, lesson_c, lesson_d);

INSERT INTO public.courses ("id", "slug", "title", "description", "status", "instructorId", "createdAt")
SELECT course_id, course_slug, title, topic || ' · ' || description, 'PUBLISHED',
       '70b790d0-f72d-4eb4-929f-d58b003afe1e', now() - ordinal * interval '1 second'
FROM demo_catalog
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE demo_sections ON COMMIT DROP AS
SELECT
  demo.ordinal,
  demo.course_id,
  ('57ea40d6-3a66-48a2-ad13-' || lpad((demo.ordinal * 10 + section.position)::text, 12, '0'))::uuid AS section_id,
  section.position,
  section.title,
  section.first_lesson,
  section.second_lesson
FROM demo_catalog demo
JOIN public.courses course
  ON course."id" = demo.course_id
  AND course."slug" = demo.course_slug
  AND course."instructorId" = '70b790d0-f72d-4eb4-929f-d58b003afe1e'
CROSS JOIN LATERAL (VALUES
  (0, 'Nền tảng', demo.lesson_a, demo.lesson_b),
  (1, 'Thực hành', demo.lesson_c, demo.lesson_d)
) AS section(position, title, first_lesson, second_lesson);

INSERT INTO public.sections ("id", "courseId", "position", "title")
SELECT section_id, course_id, position, title
FROM demo_sections
ON CONFLICT DO NOTHING;

INSERT INTO public.lessons ("id", "sectionId", "position", "title", "type", "durationSec", "isPublished")
SELECT
  ('b8eb8800-88a2-4491-850c-' || lpad((demo.ordinal * 100 + demo.position * 10 + lesson.position)::text, 12, '0'))::uuid,
  demo.section_id, lesson.position, lesson.title, 'ARTICLE', 600, true
FROM demo_sections demo
JOIN public.sections section
  ON section."id" = demo.section_id AND section."courseId" = demo.course_id
CROSS JOIN LATERAL (VALUES
  (0, demo.first_lesson),
  (1, demo.second_lesson)
) AS lesson(position, title)
ON CONFLICT DO NOTHING;

COMMIT;
