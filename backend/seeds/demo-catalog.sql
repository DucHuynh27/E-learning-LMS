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

CREATE TEMP TABLE demo_lesson_theory (
  topic text,
  lesson_index integer,
  content text,
  PRIMARY KEY (topic, lesson_index)
) ON COMMIT DROP;

INSERT INTO demo_lesson_theory (topic, lesson_index, content) VALUES
  ('Lập trình', 0, 'Chương trình biến đổi dữ liệu đầu vào thành kết quả theo một chuỗi quy tắc. Mỗi biến có kiểu và phạm vi sử dụng; hàm nên có trách nhiệm rõ ràng, nhận dữ liệu cần thiết và trả kết quả dễ kiểm tra. Khi đọc một khái niệm mới, hãy lần theo dữ liệu từ lúc được tạo đến lúc được sử dụng để hiểu vì sao đầu ra thay đổi.'),
  ('Lập trình', 1, 'Các phần của ứng dụng cần trao đổi qua giao diện có hợp đồng rõ ràng: dữ liệu nào được nhận, trạng thái nào được trả về và lỗi nào có thể xảy ra. Tách trách nhiệm giữa thành phần giao diện, xử lý nghiệp vụ và lưu trữ giúp thay đổi một phần mà không làm hỏng toàn hệ thống. Kiểu dữ liệu và kiểm tra đầu vào làm hợp đồng này cụ thể hơn.'),
  ('Lập trình', 2, 'Khi áp dụng kiến thức vào một tính năng, hãy chia yêu cầu thành các bước nhỏ: xác định đầu vào, xử lý trường hợp hợp lệ, xử lý ngoại lệ và trình bày kết quả. Thực hiện từng bước giúp dễ phát hiện nguyên nhân khi kết quả sai. Không nên xem việc chạy được một lần là bằng chứng rằng các trường hợp biên đã được xử lý.'),
  ('Lập trình', 3, 'Kiểm thử tốt đối chiếu kết quả thực tế với hành vi mong đợi ở cả trường hợp thông thường, biên và không hợp lệ. Kiểm thử đơn vị tập trung vào logic nhỏ; kiểm thử tích hợp xác nhận các thành phần phối hợp đúng. Khi sửa lỗi, hãy lưu một trường hợp tái hiện thành kiểm thử hồi quy để lỗi không quay lại.'),
  ('Thiết kế', 0, 'Bố cục hiệu quả bắt đầu từ mục tiêu và nội dung quan trọng nhất, sau đó dùng phân cấp thị giác để dẫn mắt người xem. Kích thước, khoảng cách, căn chỉnh và độ tương phản tạo nên thứ tự đọc; các thành phần cùng chức năng nên có cách trình bày nhất quán. Khung bố cục cần thích ứng theo lượng nội dung và kích thước màn hình.'),
  ('Thiết kế', 1, 'Design token và component dùng chung giúp màu sắc, khoảng cách, kiểu chữ và trạng thái tương tác nhất quán giữa nhiều màn hình. Component nên mô tả một mẫu giao diện có ý nghĩa, còn biến thể thể hiện các trạng thái hoặc cấu hình được phép. Thay đổi ở nguồn cần được kiểm tra trên các màn hình đang sử dụng component đó.'),
  ('Thiết kế', 2, 'Prototype mô tả mối liên hệ giữa hành động của người dùng và phản hồi của giao diện. Mỗi luồng cần có điểm bắt đầu, điều kiện kích hoạt, bước chuyển tiếp và trạng thái đích; các trường hợp tải, thành công và lỗi cũng cần được thể hiện. Thử luồng từ đầu đến cuối giúp phát hiện bước thiếu trước khi triển khai thật.'),
  ('Thiết kế', 3, 'Đánh giá giao diện cần dựa trên khả năng hoàn thành tác vụ, không chỉ cảm nhận thẩm mỹ. Quan sát người dùng đại diện, ghi lại điểm mắc kẹt và đối chiếu với tiêu chí đã đặt ra. Kiểm tra bàn phím, nhãn, focus và độ tương phản để bảo đảm thông tin không chỉ phụ thuộc vào màu sắc hoặc thao tác chuột.'),
  ('Dữ liệu', 0, 'Mô hình dữ liệu cần thể hiện đúng ý nghĩa của từng giá trị: kiểu dữ liệu, đơn vị, quan hệ và trạng thái chưa có dữ liệu phải được phân biệt. Khóa chính định danh bản ghi; khóa ngoại bảo vệ quan hệ giữa các bảng. Trước khi phân tích, hãy kiểm tra dữ liệu thiếu, trùng lặp và giá trị nằm ngoài miền hợp lệ.'),
  ('Dữ liệu', 1, 'Một quy trình truy vấn thường gồm lọc bản ghi, nối các nguồn liên quan, biến đổi và tổng hợp theo câu hỏi cần trả lời. JOIN có thể làm tăng số dòng khi quan hệ là một-nhiều, vì vậy cần xác định cấp độ của mỗi bản ghi trước khi đếm hoặc tính tổng. Viết từng bước rõ ràng giúp kiểm tra kết quả trung gian.'),
  ('Dữ liệu', 2, 'Chỉ số cần có định nghĩa, đơn vị, khoảng thời gian và nhóm đối tượng cụ thể. Trung bình nhạy với ngoại lệ, còn trung vị mô tả điểm giữa của dữ liệu đã sắp xếp; lựa chọn nào phù hợp phụ thuộc vào phân phối và câu hỏi phân tích. Biểu đồ phải ghi nhãn trục và không làm sai lệch mức chênh lệch bằng cách cắt trục thiếu giải thích.'),
  ('Dữ liệu', 3, 'Kết quả phân tích đáng tin cậy cần có thể tái tạo từ nguồn, quy tắc biến đổi và phiên bản dữ liệu đã ghi nhận. Hãy kiểm tra số dòng trước và sau mỗi bước, so sánh mẫu với nguồn gốc và lưu các giả định quan trọng. Khi thay đổi pipeline, chạy lại trên dữ liệu đại diện và giải thích những khác biệt quan sát được.'),
  ('Kỹ năng nghề nghiệp', 0, 'Một yêu cầu có thể được hiểu khác nhau nếu chưa xác định người sử dụng, vấn đề cần giải quyết và kết quả mong đợi. Hãy chuyển mong muốn chung thành mục tiêu có thể kiểm chứng, nêu rõ điều kiện hoàn thành và các giới hạn. Việc xác nhận sớm với người có quyền quyết định giúp giảm làm lại khi sản phẩm đã triển khai.'),
  ('Kỹ năng nghề nghiệp', 1, 'Kế hoạch khả thi chia phạm vi thành đầu việc có kết quả kiểm tra được, đồng thời làm rõ thứ tự và phụ thuộc. Ước lượng nên dựa trên phạm vi đã thống nhất và nêu giả định còn chưa chắc chắn. Khi có thay đổi, cập nhật tác động tới thời hạn, nguồn lực và các bên liên quan thay vì chỉ sửa ngày hoàn thành.'),
  ('Kỹ năng nghề nghiệp', 2, 'Trao đổi chuyên môn hiệu quả nêu bối cảnh, bằng chứng, tác động và bước cần thống nhất. Trong review, mô tả điều kiện tái hiện và rủi ro cụ thể giúp người nhận hành động được mà không biến góp ý thành đánh giá cá nhân. Ghi lại quyết định cùng lý do để nhóm có thể hiểu lại lựa chọn sau này.'),
  ('Kỹ năng nghề nghiệp', 3, 'Tài liệu và tổng kết dự án nên giúp người khác tự kiểm tra hoặc lặp lại công việc. Ghi mục đích, điều kiện ban đầu, các bước, kết quả mong đợi và cách xử lý lỗi thường gặp. Sau mỗi mốc, so sánh kết quả với mục tiêu, rút ra bài học có bằng chứng và chuyển thành hành động cải thiện cụ thể.'),
  ('Kỹ năng học tập', 0, 'Mục tiêu học tập hiệu quả mô tả điều người học có thể giải thích hoặc thực hiện sau bài học, thay vì chỉ ghi tên chủ đề. Kiến thức mới thường dựa trên khái niệm tiên quyết; xác định phần nền còn thiếu giúp chọn đúng thứ tự học. Mỗi mục tiêu nên gắn với một bài tập hoặc câu hỏi có thể dùng để tự kiểm tra.'),
  ('Kỹ năng học tập', 1, 'Ôn tập cách quãng và truy hồi chủ động giúp người học tự lấy kiến thức từ trí nhớ thay vì chỉ thấy nội dung quen thuộc khi đọc lại. Hãy thử giải thích hoặc trả lời câu hỏi khi chưa xem tài liệu, sau đó đối chiếu và ghi rõ điểm sai. Lặp lại sau những khoảng thời gian tăng dần giúp nhận ra phần cần ôn thêm.'),
  ('Kỹ năng học tập', 2, 'Tài liệu học cần được đánh giá theo tác giả, thời điểm cập nhật, bằng chứng và mức phù hợp với mục tiêu. Khi ghi chú, phân biệt định nghĩa, ví dụ và kết luận; viết lại bằng lời của mình giúp phát hiện phần chưa hiểu. Với thông tin quan trọng, đối chiếu thêm nguồn độc lập và lưu lại nơi đã tham khảo.'),
  ('Kỹ năng học tập', 3, 'Phản hồi chỉ hữu ích khi được chuyển thành hành động học tập. So sánh bài làm với tiêu chí, phân loại lỗi do thiếu kiến thức hay do cách thực hiện, rồi chọn một nội dung cụ thể để luyện lại. Sau đó tự làm bài tương tự mà không nhìn đáp án để xác nhận rằng cách hiểu đã được cải thiện.');

INSERT INTO public.sections ("id", "courseId", "position", "title")
SELECT section_id, course_id, position, title
FROM demo_sections
ON CONFLICT DO NOTHING;

INSERT INTO public.lessons ("id", "sectionId", "position", "title", "type", "content", "durationSec", "isPublished")
SELECT
  ('b8eb8800-88a2-4491-850c-' || lpad((demo.ordinal * 100 + demo.position * 10 + lesson.position)::text, 12, '0'))::uuid,
  demo.section_id, lesson.position, lesson.title, 'ARTICLE',
  'Trong bài "' || lesson.title || '" thuộc khóa "' || catalog.title || '": ' ||
    CASE
      WHEN demo.ordinal = 16 THEN
        CASE demo.position * 2 + lesson.position
          WHEN 0 THEN 'Frame là vùng chứa cấu trúc và giới hạn bố cục của một màn hình; frame lồng nhau tạo nên thứ bậc từ trang đến thành phần. Lưới cột, lề và khoảng cách giúp căn chỉnh nội dung theo quy tắc thay vì đặt từng phần tử tùy ý. Chọn số cột và gutter theo độ rộng khung, rồi kiểm tra khi kích thước màn hình thay đổi.'
          WHEN 1 THEN 'Auto Layout sắp xếp các phần tử con theo hàng hoặc cột và tự điều chỉnh khi nội dung thay đổi. Padding là khoảng cách từ nội dung đến mép khung; spacing là khoảng cách giữa các phần tử. Hug phù hợp khi khung ôm nội dung, Fill khi phần tử cần chiếm phần không gian còn lại, còn Fixed dùng cho kích thước có chủ đích. Có thể lồng các frame để mô tả bố cục phức tạp.'
          WHEN 2 THEN 'Component gốc định nghĩa cấu trúc và hành vi dùng lại; instance là bản sử dụng có thể nhận cập nhật từ component gốc. Variants gom các trạng thái cùng họ như mặc định, hover hoặc disabled, còn properties giúp cấu hình nội dung và trạng thái mà không tạo nhiều bản sao rời rạc. Đặt tên theo chức năng và giữ các biến thể nhất quán để nhóm dễ tìm và bảo trì.'
          ELSE 'Prototype nối các màn hình thành luồng tương tác có thể thử nghiệm. Mỗi liên kết xác định trigger, action và destination; overlay phù hợp với nội dung xuất hiện tạm thời như menu hoặc hộp thoại. Chọn điểm bắt đầu cho từng luồng, kiểm tra đường đi thành công và quay lại, rồi thử trên kích thước thiết bị dự kiến để phát hiện bước thiếu hoặc trạng thái không thể thoát.'
        END
      WHEN demo.ordinal = 40 THEN
        CASE demo.position * 2 + lesson.position
          WHEN 0 THEN 'Từ vựng kỹ thuật cần được hiểu theo ngữ cảnh và chức năng trong câu, không chỉ ghi nhớ một bản dịch. Chú ý từ loại, cụm từ đi kèm và các từ chỉ điều kiện như required, optional hoặc deprecated. Ghi lại thuật ngữ cùng câu ví dụ và tình huống sử dụng giúp phân biệt nghĩa phổ thông với nghĩa trong tài liệu phần mềm.'
          WHEN 1 THEN 'Tài liệu API thường được chia thành phần tổng quan, xác thực, endpoint, tham số, ví dụ request và cấu trúc response. Đọc method và path trước, sau đó xác định tham số bắt buộc, kiểu dữ liệu, mã trạng thái và lỗi có thể trả về. Một ví dụ chỉ có ý nghĩa khi điều kiện xác thực, phiên bản và dữ liệu đầu vào cũng phù hợp.'
          WHEN 2 THEN 'Thông báo lỗi nên được đọc như một chuỗi bằng chứng: tên lỗi, thành phần liên quan, giá trị hoặc bước thất bại và gợi ý khắc phục. Giữ nguyên tên lớp, mã lỗi và đường dẫn để tra cứu chính xác; chỉ diễn giải phần mô tả. Đối chiếu lỗi với phiên bản công cụ đang dùng trước khi áp dụng hướng dẫn từ nguồn khác.'
          ELSE 'Bản tóm tắt hướng dẫn bằng tiếng Việt cần giữ nguyên lệnh, tên tham số và thuật ngữ quan trọng, đồng thời diễn giải rõ mục đích từng bước. Nêu điều kiện tiên quyết, kết quả mong đợi và cách xử lý lỗi thường gặp. Kiểm chứng bản tóm tắt bằng cách làm theo từ môi trường sạch để phát hiện bước bị lược hoặc giả định chưa được giải thích.'
        END
      ELSE theory.content
    END,
  600, true
FROM demo_sections demo
JOIN public.sections section
  ON section."id" = demo.section_id AND section."courseId" = demo.course_id
JOIN demo_catalog catalog ON catalog.ordinal = demo.ordinal
CROSS JOIN LATERAL (VALUES
  (0, demo.first_lesson),
  (1, demo.second_lesson)
) AS lesson(position, title)
JOIN demo_lesson_theory theory
  ON theory.topic = catalog.topic
  AND theory.lesson_index = demo.position * 2 + lesson.position
ON CONFLICT ("id") DO UPDATE
SET "content" = EXCLUDED."content"
WHERE public.lessons."content" IS NULL;

CREATE TEMP TABLE demo_quiz_lessons ON COMMIT DROP AS
SELECT
  section.ordinal, catalog.topic, section.section_id,
  ('b8eb8800-88a2-4491-850c-' || lpad((section.ordinal * 100 + 12)::text, 12, '0'))::uuid AS lesson_id,
  ('49c4c94d-bd90-4849-bcc0-' || lpad(section.ordinal::text, 12, '0'))::uuid AS quiz_id
FROM demo_sections section
JOIN demo_catalog catalog ON catalog.ordinal = section.ordinal
WHERE section.position = 1;

INSERT INTO public.lessons ("id", "sectionId", "position", "title", "type", "durationSec", "isPublished")
SELECT demo.lesson_id, section."id", 2, 'Trắc nghiệm tổng kết', 'QUIZ', 300, true
FROM demo_quiz_lessons demo
JOIN public.sections section ON section."id" = demo.section_id
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes ("id", "lessonId", "passScore", "timeLimitSec")
SELECT demo.quiz_id, lesson."id", 70, 300
FROM demo_quiz_lessons demo
JOIN public.lessons lesson
  ON lesson."id" = demo.lesson_id
  AND lesson."sectionId" = demo.section_id
  AND lesson."type" = 'QUIZ'
ON CONFLICT ("lessonId") DO NOTHING;

UPDATE public.quiz_options existing_option
SET "isCorrect" = false
FROM public.quiz_questions question
JOIN public.quizzes quiz ON quiz."id" = question."quizId"
JOIN demo_quiz_lessons demo ON demo.lesson_id = quiz."lessonId"
WHERE existing_option."questionId" = question."id";

WITH question_bank(ordinal, topic, position, content, answer_a, answer_b, answer_c, correct_index) AS (
  VALUES
    (NULL, 'Lập trình', 0, 'Một endpoint nhận dữ liệu từ client và phải từ chối payload sai định dạng trước khi gọi nghiệp vụ. Cách xử lý nào phù hợp nhất?',
     'Kiểm tra dữ liệu ở ranh giới API bằng DTO và validation phía server', 'Chỉ kiểm tra trường bắt buộc trong giao diện rồi tin payload gửi lên', 'Lưu payload trước và sửa dữ liệu không hợp lệ ở lần đọc kế tiếp', 0),
    (NULL, 'Lập trình', 1, 'Một thay đổi ảnh hưởng tới xử lý đầu vào, trường hợp biên và thông báo lỗi. Bộ kiểm thử nào cung cấp bằng chứng hồi quy tốt nhất?',
     'Chỉ chạy ứng dụng một lần với dữ liệu hợp lệ phổ biến', 'Kiểm thử đầu vào hợp lệ, biên và không hợp lệ cùng kết quả mong đợi', 'Chỉ xác nhận quá trình biên dịch kết thúc mà không có lỗi', 1),
    (NULL, 'Lập trình', 2, 'Hai request đồng thời có thể tạo cùng một bản ghi ghi danh. Thiết kế nào bảo vệ tính nhất quán ngay cả khi ứng dụng chạy nhiều instance?',
     'Dùng ràng buộc duy nhất trong cơ sở dữ liệu và xử lý xung đột có chủ đích', 'Ẩn nút ghi danh sau lần click đầu tiên trên trình duyệt', 'Tăng thời gian chờ giữa hai request để giảm xác suất trùng lặp', 0),
    (NULL, 'Lập trình', 3, 'Một migration bổ sung trường bắt buộc cho bảng đang có dữ liệu. Trình tự nào giảm rủi ro khi triển khai theo từng bước?',
     'Xóa bảng cũ rồi yêu cầu mọi người nhập lại dữ liệu', 'Thêm trường có giá trị mặc định, cập nhật dữ liệu và chỉ siết ràng buộc sau khi kiểm tra', 'Triển khai code đọc trường mới trước khi schema có trường đó', 1),
    (NULL, 'Lập trình', 4, 'Ứng dụng trả lỗi 500 sau khi triển khai nhưng log hiện tại không cho biết bước nào thất bại. Cải thiện nào giúp điều tra mà không làm lộ bí mật?',
     'Ghi ngữ cảnh request và lỗi đã lọc thông tin nhạy cảm, đồng thời giữ mã tương quan', 'Ghi toàn bộ token và mật khẩu vào log để tái hiện chính xác', 'Chuyển mọi lỗi thành phản hồi thành công để giảm cảnh báo', 0),
    (NULL, 'Lập trình', 5, 'Một API cho phép người dùng xem tài nguyên theo ID. Kiểm tra nào cần thực hiện ở mỗi request để tránh người dùng truy cập dữ liệu của người khác?',
     'Ẩn ID khỏi giao diện và xem đó là cơ chế phân quyền', 'Xác thực quyền sở hữu hoặc quyền truy cập ở phía server trước khi trả dữ liệu', 'Chỉ kiểm tra quyền khi tạo tài khoản rồi tin mọi request sau đó', 1),
    (NULL, 'Lập trình', 6, 'Một hàm bất đồng bộ có thể thất bại khi gọi dịch vụ ngoài. Cách xử lý nào giúp lỗi được ghi nhận và trả về đúng ngữ nghĩa cho caller?',
     'Nuốt mọi lỗi rồi trả về dữ liệu rỗng như thể thao tác thành công', 'Tạo một promise mới nhưng không chờ và không theo dõi kết quả', 'Bắt lỗi tại ranh giới phù hợp, ghi ngữ cảnh an toàn và chuyển lỗi có ý nghĩa lên caller', 2),
    (NULL, 'Lập trình', 7, 'Một endpoint danh sách bị quá tải khi client yêu cầu hàng trăm nghìn kết quả. Biện pháp nào kiểm soát tài nguyên mà vẫn giữ kết quả nhất quán?',
     'Tin mọi giá trị limit client gửi và bỏ phân trang', 'Áp dụng giới hạn kích thước trang và thứ tự sắp xếp ổn định ở phía server', 'Trả dữ liệu ngẫu nhiên theo từng request để giảm thời gian truy vấn', 1),
    (NULL, 'Lập trình', 8, 'Một thay đổi liên quan tới nhiều nhánh điều kiện và dễ bỏ sót trường hợp. Cách tổ chức nào giúp việc bảo trì và review đáng tin cậy hơn?',
     'Gộp toàn bộ xử lý vào một hàm dài để giảm số tệp', 'Xóa các nhánh hiếm gặp mà chưa xác minh yêu cầu nghiệp vụ', 'Tách trách nhiệm rõ ràng, đặt tên theo ý nghĩa và bổ sung kiểm thử cho các nhánh quan trọng', 2),
    (NULL, 'Lập trình', 9, 'Một thao tác thanh toán có thể được client gửi lại khi mạng chập chờn. Thiết kế nào hạn chế tạo giao dịch trùng?',
     'Ẩn nút thanh toán sau lần nhấn đầu tiên nhưng không kiểm tra ở server', 'Dùng khóa idempotency được kiểm tra và lưu nhất quán ở phía server', 'Yêu cầu client chờ một khoảng thời gian cố định trước khi thử lại', 1),
    (NULL, 'Thiết kế', 0, 'Một trạng thái lỗi hiện chỉ được thể hiện bằng màu đỏ. Thay đổi nào giúp giao diện vẫn hiểu được với người khó phân biệt màu?',
     'Thêm nhãn hoặc biểu tượng có ý nghĩa và giữ độ tương phản phù hợp', 'Tăng độ bão hòa màu đỏ mà không thay đổi nội dung', 'Dùng thêm một sắc đỏ gần giống cho từng mức lỗi', 0),
    (NULL, 'Thiết kế', 1, 'Bố cục desktop bị tràn trên điện thoại và nút hành động chính bị đẩy khỏi màn hình. Quy trình nào giúp xử lý vấn đề có căn cứ?',
     'Thu nhỏ toàn bộ chữ và khoảng cách theo cùng một tỷ lệ', 'Kiểm tra luồng nội dung ở các breakpoint và sắp xếp lại thành phần theo ưu tiên', 'Ẩn mọi nút trên màn hình nhỏ để giữ nguyên bố cục', 1),
    (NULL, 'Thiết kế', 2, 'Nhiều màn hình dùng cùng một nút nhưng màu, khoảng cách và trạng thái hover khác nhau. Cách sửa nào cải thiện tính nhất quán lâu dài?',
     'Chuẩn hóa token và component dùng chung, bao gồm cả trạng thái tương tác', 'Chụp ảnh nút hiện tại và yêu cầu mọi người sao chép thủ công', 'Chỉ sửa màu ở màn hình đầu tiên để làm mẫu tham khảo', 0),
    (NULL, 'Thiết kế', 3, 'Một prototype đã hoàn thiện về mặt hình ảnh nhưng người dùng thử không tìm thấy thao tác tiếp theo. Bước nào nên làm trước khi chốt giao diện?',
     'Bổ sung hiệu ứng chuyển động để thu hút sự chú ý', 'Quan sát người dùng thực hiện tác vụ và ghi lại điểm họ bị mắc kẹt', 'Thêm nhiều lựa chọn vào cùng màn hình để tăng tính linh hoạt', 1),
    (NULL, 'Thiết kế', 4, 'Sau khi gửi biểu mẫu, người dùng nhận thông báo lỗi chung nhưng dữ liệu đã nhập bị xóa. Điều chỉnh nào hỗ trợ họ sửa lỗi hiệu quả hơn?',
     'Thông báo lỗi gần trường liên quan, nêu cách sửa và giữ lại dữ liệu hợp lệ', 'Chỉ đổi màu nền toàn trang và tải lại biểu mẫu trống', 'Ẩn thông báo để người dùng thử gửi lại nhiều lần', 0),
    (NULL, 'Thiết kế', 5, 'Nội dung văn bản thường trên nền giao diện khó đọc với nhiều người dùng. Bước nào giúp đánh giá khả năng đọc một cách khách quan?',
     'Tăng kích thước mọi thành phần mà không đo độ tương phản', 'Dùng thêm màu sắc trang trí để người xem tự phân biệt chữ', 'Đo độ tương phản giữa màu chữ và nền, rồi điều chỉnh theo tiêu chuẩn áp dụng', 2),
    (NULL, 'Thiết kế', 6, 'Một hộp thoại mở ra nhưng người dùng bàn phím không biết focus đang ở đâu. Điều chỉnh nào cải thiện khả năng điều hướng?',
     'Giữ focus hiển thị rõ, chuyển focus vào hộp thoại và đưa focus hợp lý khi đóng', 'Ẩn viền focus để giao diện trông gọn hơn', 'Chỉ cho phép đóng hộp thoại bằng thao tác chuột', 0),
    (NULL, 'Thiết kế', 7, 'Nhóm đang phân vân giữa hai cách bố trí nút hoàn tất tác vụ. Cách kiểm chứng nào cung cấp bằng chứng hữu ích nhất?',
     'Chọn phương án được nhiều thành viên trong nhóm thích hơn', 'Cho người dùng đại diện thực hiện tác vụ và quan sát mức độ hoàn thành cùng điểm vướng', 'Đếm số màu trong mỗi phương án rồi chọn phương án có ít màu', 1),
    (NULL, 'Thiết kế', 8, 'Một trang có nhiều cấp tiêu đề nhưng tất cả đều dùng cùng kích thước và độ đậm. Cải thiện nào giúp người đọc quét nội dung tốt hơn?',
     'Tăng độ đậm của mọi đoạn văn để chúng nổi bật như nhau', 'Bỏ tiêu đề phụ để trang có ít kiểu chữ hơn', 'Tạo phân cấp chữ nhất quán về kích thước, độ đậm và khoảng cách theo vai trò nội dung', 2),
    (NULL, 'Thiết kế', 9, 'Khi phóng to trang trên điện thoại, người dùng phải cuộn ngang để đọc từng dòng. Hướng xử lý nào phù hợp với thiết kế thích ứng?',
     'Kiểm tra bố cục ở mức phóng to và cho nội dung chính tự sắp xếp lại trong vùng nhìn', 'Khóa mức phóng to để giữ nguyên bố cục desktop', 'Thu nhỏ chữ cho đến khi toàn bộ trang vừa một màn hình', 0),
    (NULL, 'Dữ liệu', 0, 'Một cột điểm có giá trị NULL vì chưa có bài nộp, trong khi 0 là điểm đã chấm. Cách xử lý nào giữ đúng ý nghĩa dữ liệu?',
     'Giữ riêng trạng thái chưa có kết quả và giá trị điểm bằng 0', 'Thay mọi NULL bằng 0 để phép tính không gặp ngoại lệ', 'Loại mọi dòng có NULL khỏi tất cả báo cáo mà không ghi chú', 0),
    (NULL, 'Dữ liệu', 1, 'Sau khi JOIN ghi danh với nhiều bản ghi tiến độ, tổng số học viên trong báo cáo tăng bất thường. Cần kiểm tra điều gì trước tiên?',
     'Đổi thứ tự các cột trong SELECT để giảm số dòng', 'Xác định quan hệ một-nhiều và kiểm tra phép tổng hợp có đếm trùng bản ghi hay không', 'Sắp xếp kết quả theo tên để gộp các dòng giống nhau', 1),
    (NULL, 'Dữ liệu', 2, 'Một biểu đồ tăng trưởng không ghi đơn vị và cắt trục tung làm thay đổi cảm nhận về mức tăng. Cải thiện nào giúp tránh diễn giải sai?',
     'Ghi rõ đơn vị, khoảng thời gian và lựa chọn trục phù hợp với mục tiêu so sánh', 'Ẩn nhãn trục để người xem tập trung vào đường biểu diễn', 'Chỉ chọn màu khác cho điểm dữ liệu cuối cùng', 0),
    (NULL, 'Dữ liệu', 3, 'Bạn xây dựng mô hình dự báo và muốn đánh giá khả năng tổng quát hóa trên dữ liệu chưa thấy. Cách chia dữ liệu nào giảm rò rỉ thông tin?',
     'Dùng toàn bộ dữ liệu để chọn mô hình rồi báo cáo kết quả trên chính dữ liệu đó', 'Tách tập đánh giá trước và chỉ dùng tập huấn luyện để fit bước tiền xử lý', 'Đưa nhãn của tập kiểm tra vào bước chuẩn hóa để giữ phân phối', 1),
    (NULL, 'Dữ liệu', 4, 'Một báo cáo chỉ đưa ra con số tổng hợp nhưng không ghi nguồn và quy tắc làm sạch. Bổ sung nào giúp kết quả có thể kiểm chứng?',
     'Lưu nguồn dữ liệu, các bước biến đổi và định nghĩa chỉ số đã sử dụng', 'Làm tròn toàn bộ số liệu để tránh người đọc hỏi về sai số', 'Chỉ giữ lại biểu đồ cuối cùng sau khi xóa dữ liệu trung gian', 0),
    (NULL, 'Dữ liệu', 5, 'Một truy vấn lọc theo courseId chạy chậm khi bảng tiến độ tăng lớn. Cách quyết định có nên thêm index nào đáng tin cậy nhất?',
     'Tạo index trên mọi cột để mọi truy vấn đều nhanh hơn', 'Đo truy vấn với dữ liệu đại diện, xem kế hoạch thực thi và cân nhắc chi phí ghi của index', 'Xóa điều kiện lọc để cơ sở dữ liệu phải đọc ít metadata hơn', 1),
    (NULL, 'Dữ liệu', 6, 'Một giao dịch chuyển điểm cần cập nhật hai bản ghi và cả hai phải thành công cùng nhau. Cơ chế nào bảo đảm tính nguyên tử?',
     'Gửi hai câu lệnh độc lập rồi giả định chúng luôn cùng thành công', 'Chỉ ghi bản cập nhật cuối cùng để tránh kiểm tra trạng thái trung gian', 'Thực hiện các cập nhật trong một transaction và rollback nếu một bước thất bại', 2),
    (NULL, 'Dữ liệu', 7, 'Một truy vấn tìm kiếm ghép chuỗi đầu vào trực tiếp vào câu SQL. Thay đổi nào giảm rủi ro và giúp truy vấn an toàn hơn?',
     'Dùng truy vấn tham số hóa để dữ liệu đầu vào không bị diễn giải thành cú pháp SQL', 'Loại bỏ dấu cách khỏi chuỗi rồi tiếp tục ghép vào câu truy vấn', 'Ẩn lỗi SQL khỏi giao diện nhưng vẫn thực thi chuỗi đã ghép', 0),
    (NULL, 'Dữ liệu', 8, 'Bản sao lưu cơ sở dữ liệu đã chạy thành công nhiều tháng nhưng chưa từng được khôi phục thử. Rủi ro chính là gì?',
     'Bản sao lưu chắc chắn quá mới nên không thể dùng khi xảy ra sự cố', 'Chưa có bằng chứng bản sao lưu có thể khôi phục đúng dữ liệu và thời gian cần thiết', 'Việc kiểm tra khôi phục chỉ cần thiết sau khi dữ liệu bị mất', 1),
    (NULL, 'Dữ liệu', 9, 'Một chỉ số thay đổi sau khi pipeline được chạy lại trên cùng dữ liệu đầu vào. Bước điều tra nào nên được ưu tiên?',
     'Làm tròn kết quả cho đến khi hai lần chạy nhìn giống nhau', 'Xóa lịch sử lần chạy trước để tránh so sánh gây nhầm lẫn', 'Kiểm tra tính xác định của các bước biến đổi, nguồn dữ liệu và phiên bản quy tắc đã dùng', 2),
    (NULL, 'Kỹ năng nghề nghiệp', 0, 'Một yêu cầu dự án chỉ ghi “làm báo cáo tốt hơn” nhưng chưa xác định người dùng và tiêu chí thành công. Bước nào giúp giảm hiểu nhầm trước khi ước lượng?',
     'Làm rõ đối tượng sử dụng, quyết định cần hỗ trợ và cách đo kết quả', 'Chọn ngay công cụ quen thuộc rồi để tiêu chí phát sinh sau', 'Chia đều thời gian cho mọi ý tưởng mà chưa xác định phạm vi', 0),
    (NULL, 'Kỹ năng nghề nghiệp', 1, 'Một thay đổi phạm vi phát sinh giữa dự án và ảnh hưởng hai công việc phụ thuộc. Cách cập nhật nào hỗ trợ nhóm ra quyết định?',
     'Ghi tác động, phụ thuộc và lựa chọn đánh đổi rồi thống nhất người chịu trách nhiệm', 'Chỉ sửa ngày kết thúc trên bảng để kế hoạch trông vẫn đúng hạn', 'Để từng thành viên tự chọn một phần thay đổi mà không cập nhật nhóm', 0),
    (NULL, 'Kỹ năng nghề nghiệp', 2, 'Khi review một pull request, bạn phát hiện lỗi chỉ xảy ra với một đầu vào cụ thể. Phản hồi nào giúp tác giả hành động được?',
     'Mô tả điều kiện tái hiện, tác động và hướng kiểm tra mà không quy kết cá nhân', 'Ghi “code chưa tốt” để tác giả tự tìm mọi vấn đề có thể có', 'Yêu cầu viết lại toàn bộ module trước khi nêu ví dụ lỗi', 0),
    (NULL, 'Kỹ năng nghề nghiệp', 3, 'Bài thuyết trình dự án có nhiều chi tiết kỹ thuật nhưng người ra quyết định không thấy kết quả chính. Cách sắp xếp nào phù hợp hơn?',
     'Mở đầu bằng mục tiêu, kết quả và bằng chứng; chuyển chi tiết bổ sung vào phần tham khảo', 'Đọc tuần tự mọi commit để người nghe tự rút ra kết luận', 'Bỏ số liệu và chỉ trình bày các thuật ngữ kỹ thuật', 0),
    (NULL, 'Kỹ năng nghề nghiệp', 4, 'Một hướng dẫn cài đặt đã được cập nhật nhưng nhóm vẫn báo lỗi khi làm theo. Cách kiểm tra nào đáng tin cậy nhất?',
     'Thực hiện lại hướng dẫn trong môi trường mới theo đúng vai trò người đọc dự kiến', 'Chỉ kiểm tra chính tả vì các lệnh đã chạy được trên máy tác giả', 'Thêm nhiều bước tùy chọn mà không xác định bước nào bắt buộc', 0),
    (NULL, 'Kỹ năng nghề nghiệp', 5, 'Có nhiều yêu cầu cùng được đánh dấu khẩn cấp nhưng nhóm không đủ nguồn lực để làm đồng thời. Cách ưu tiên nào giúp quyết định minh bạch?',
     'So sánh tác động, thời hạn, phụ thuộc và chi phí trì hoãn với các bên liên quan', 'Chọn việc được gửi bằng tin nhắn gần nhất mà không cần trao đổi', 'Chia đều thời gian cho mọi yêu cầu dù mức độ ảnh hưởng khác nhau', 0),
    (NULL, 'Kỹ năng nghề nghiệp', 6, 'Sau một sự cố dịch vụ, nhóm cần rút kinh nghiệm mà không quy lỗi cá nhân. Báo cáo nào hữu ích nhất?',
     'Chỉ ghi tên người trực để xác định ai phải chịu trách nhiệm', 'Ghi dòng thời gian, tác động, nguyên nhân hệ thống, cách ứng phó và hành động phòng ngừa', 'Xóa các cảnh báo cũ để bảng theo dõi không còn báo động', 1),
    (NULL, 'Kỹ năng nghề nghiệp', 7, 'Hai bên liên quan đưa ra tiêu chí thành công mâu thuẫn cho cùng một tính năng. Bước tiếp theo nào giúp nhóm tránh triển khai sai kỳ vọng?',
     'Chọn tiêu chí dễ thực hiện nhất mà không thông báo cho bên còn lại', 'Triển khai cả hai yêu cầu cùng lúc dù chúng loại trừ lẫn nhau', 'Làm rõ mục tiêu, người có quyền quyết định và cách xử lý đánh đổi trước khi chốt phạm vi', 2),
    (NULL, 'Kỹ năng nghề nghiệp', 8, 'Một đồng nghiệp thường xuyên trễ phần việc đang chặn tiến độ của nhóm. Cách trao đổi nào hướng tới giải quyết vấn đề?',
     'Nêu tác động cụ thể, hỏi về trở ngại và thống nhất mốc hỗ trợ hoặc điều chỉnh', 'Phê bình công khai để tạo áp lực hoàn thành nhanh hơn', 'Âm thầm nhận toàn bộ việc còn lại mà không cập nhật kế hoạch', 0),
    (NULL, 'Kỹ năng nghề nghiệp', 9, 'Bạn cần chuyển giao một tác vụ định kỳ cho người mới trong nhóm. Tài liệu nào giúp họ tự thực hiện và xử lý ngoại lệ?',
     'Chỉ ghi tên công cụ và yêu cầu người mới tự tìm hiểu mọi bước', 'Nêu mục đích, điều kiện đầu vào, các bước, kết quả mong đợi và cách xử lý tình huống lỗi', 'Lưu ảnh màn hình kết quả cuối mà không giải thích cách tạo ra', 1),
    (NULL, 'Kỹ năng học tập', 0, 'Bạn nhận ra mình quên phần kiến thức đã đọc tuần trước. Cách ôn tập nào giúp kiểm tra khả năng nhớ chủ động thay vì chỉ nhận ra nội dung?',
     'Tự trả lời câu hỏi không nhìn tài liệu rồi đối chiếu và ôn lại theo khoảng cách', 'Đọc lại liên tục cùng một trang cho đến khi thấy quen mắt', 'Đánh dấu trang đã đọc mà không thử nhớ lại khái niệm', 0),
    (NULL, 'Kỹ năng học tập', 1, 'Mục tiêu “học thêm về lập trình” khó đánh giá tiến độ. Cách viết lại nào tạo được mốc kiểm chứng?',
     'Đọc bất kỳ bài viết nào khi có thời gian rảnh', 'Hoàn thành một bài thực hành có tiêu chí đầu ra và tự kiểm tra vào ngày đã định', 'Dành thật nhiều giờ học nhưng không xác định nội dung cần đạt', 1),
    (NULL, 'Kỹ năng học tập', 2, 'Hai tài liệu trực tuyến đưa ra hướng dẫn trái ngược nhau. Bạn nên làm gì trước khi áp dụng một trong hai?',
     'Đánh giá tác giả, ngày cập nhật, bằng chứng và đối chiếu với nguồn độc lập', 'Chọn tài liệu có tiêu đề nổi bật và nhiều lượt xem hơn', 'Kết hợp hai hướng dẫn ngay cả khi giả định nền tảng khác nhau', 0),
    (NULL, 'Kỹ năng học tập', 3, 'Sau bài kiểm tra thử, bạn thường sai ở cùng một dạng bài. Bước tiếp theo nào biến kết quả thành kế hoạch học hiệu quả?',
     'Làm thật nhiều câu khác mà không xem lại nguyên nhân sai', 'Phân loại lỗi, ôn lại kiến thức nền liên quan và thử lại với bài tương tự', 'Bỏ qua dạng bài đó để điểm trung bình không bị ảnh hưởng', 1),
    (NULL, 'Kỹ năng học tập', 4, 'Một bộ ghi chú dài nhưng khó dùng khi ôn tập. Cách chỉnh sửa nào giúp tìm lại và vận dụng kiến thức tốt hơn?',
     'Tổ chức theo câu hỏi và ý chính, viết lại bằng lời của mình, kèm ví dụ ngắn', 'Sao chép toàn bộ tài liệu vào một trang duy nhất', 'Xóa ví dụ và tiêu đề để ghi chú ngắn hơn bằng mọi giá', 0),
    (NULL, 'Kỹ năng học tập', 5, 'Một kỹ năng gồm nhiều bước nhỏ và người học thường quên thứ tự khi tự thực hiện. Cách luyện tập nào giúp chuyển kiến thức thành khả năng thao tác?',
     'Đọc lại hướng dẫn nhiều lần nhưng không thử thao tác', 'Chỉ xem đáp án hoàn chỉnh để ghi nhớ kết quả cuối', 'Thực hành từng bước với phản hồi, sau đó tăng dần mức độc lập và độ phức tạp', 2),
    (NULL, 'Kỹ năng học tập', 6, 'Sau khi nhận phản hồi rằng bài làm thiếu căn cứ, hành động nào giúp cải thiện lần nộp tiếp theo?',
     'Đối chiếu phản hồi với tiêu chí, xác định bằng chứng còn thiếu và sửa phần tương ứng', 'Chỉ thay đổi cách trình bày để bài trông khác bản trước', 'Bỏ qua phản hồi nếu điểm số tổng thể vẫn đạt yêu cầu', 0),
    (NULL, 'Kỹ năng học tập', 7, 'Bạn cần học một chủ đề mới có nhiều khái niệm phụ thuộc lẫn nhau. Cách lập lộ trình nào giảm nguy cơ bỏ sót kiến thức nền?',
     'Chọn bài học theo thứ tự ngẫu nhiên để tạo sự đa dạng', 'Xác định mục tiêu, kiến thức tiên quyết và bài tập kiểm tra sau mỗi chặng', 'Chỉ học phần nâng cao trước vì chúng có vẻ thử thách hơn', 1),
    (NULL, 'Kỹ năng học tập', 8, 'Một bài đọc dài chứa nhiều thuật ngữ mới. Cách kiểm tra mức hiểu nào đáng tin cậy hơn việc chỉ đọc lại?',
     'Đánh dấu mọi câu để chắc chắn không bỏ qua thông tin nào', 'Đếm số trang đã đọc rồi xem đó là mức độ nắm vững', 'Tóm tắt ý chính bằng lời của mình và giải thích một ví dụ không nhìn tài liệu', 2),
    (NULL, 'Kỹ năng học tập', 9, 'Sau nhiều buổi học, bạn chưa biết phương pháp nào đang giúp mình tiến bộ. Thông tin nào nên theo dõi?',
     'Mục tiêu buổi học, thời gian tập trung, lỗi thường gặp và kết quả bài tự kiểm tra', 'Số lượng tab tài liệu đang mở trong trình duyệt', 'Tổng thời gian ngồi trước màn hình mà không ghi nội dung đã học', 0),
    (6, NULL, 0, 'Một endpoint NestJS cần từ chối request tạo tài khoản nếu email sai định dạng trước khi gọi service. Cách triển khai nào phù hợp nhất?',
     'Khai báo DTO và áp dụng ValidationPipe để kiểm tra dữ liệu đầu vào', 'Để service tự đoán định dạng email từ chuỗi bất kỳ', 'Chỉ kiểm tra dữ liệu bằng thuộc tính required trong giao diện', 0),
    (6, NULL, 1, 'Một endpoint POST đã tạo bản ghi mới thành công và trả về tài nguyên vừa tạo. Mã trạng thái nào diễn đạt chính xác nhất kết quả này?',
     '200 OK vì mọi request thành công đều dùng cùng một mã', '201 Created vì một tài nguyên mới đã được tạo', '204 No Content dù response có chứa tài nguyên mới', 1),
    (6, NULL, 2, 'Một API trả về lỗi khi cơ sở dữ liệu tạm thời không phản hồi. Cách phản hồi nào giữ đúng ngữ nghĩa lỗi để client có thể xử lý và thử lại?',
     'Trả về lỗi dịch vụ tạm thời với mã trạng thái phù hợp thay vì giả lập dữ liệu', 'Chuyển ngoại lệ thành HTTP 200 cùng danh sách rỗng', 'Ghi lỗi vào log nhưng trả về bản ghi cũ mà không đánh dấu dữ liệu đã lỗi thời', 0),
    (7, NULL, 0, 'Bạn cần chỉ lấy các đơn hàng có trạng thái đã thanh toán trước khi tính tổng doanh thu. Mệnh đề nào lọc bản ghi đầu vào phù hợp?',
     'WHERE status = paid trước khi thực hiện phép tổng hợp', 'ORDER BY status để loại các đơn chưa thanh toán', 'LIMIT status để chọn đúng nhóm trạng thái', 0),
    (7, NULL, 1, 'Một dòng ghi danh chứa courseId không tồn tại. Ràng buộc nào giúp cơ sở dữ liệu ngăn dữ liệu tham chiếu không hợp lệ?',
     'Index trên createdAt để sắp xếp bản ghi', 'Foreign key từ courseId tới khóa chính của khóa học', 'Unique constraint trên tiêu đề khóa học', 1),
    (7, NULL, 2, 'Một truy vấn báo cáo chạy chậm sau khi dữ liệu tăng mạnh. Bạn cần xem kế hoạch thực thi mà PostgreSQL ước tính trước khi quyết định thay đổi truy vấn. Nên dùng lệnh nào?',
     'ANALYZE để cập nhật thống kê của bộ lập kế hoạch', 'pg_stat_activity để xem các truy vấn đang chạy tại thời điểm hiện tại', 'EXPLAIN để kiểm tra kế hoạch thực thi dự kiến', 2),
    (9, NULL, 0, 'Bạn đã chỉnh sửa ba tệp nhưng chỉ muốn đưa hai tệp vào commit tiếp theo. Lệnh nào đưa đúng các thay đổi được chọn vào staging area?',
     'git add với đường dẫn của hai tệp cần đưa vào commit', 'git commit -a vì lệnh này tự chọn hai tệp vừa thay đổi gần nhất', 'git stash push để thêm các thay đổi vào staging area', 0),
    (9, NULL, 1, 'Một nhánh tính năng đã hoàn thành và cần được nhóm đánh giá trước khi nhập vào nhánh chính. Pull request hỗ trợ công việc nào?',
     'Tạo một nhánh sao lưu nhưng không cung cấp nơi review thay đổi', 'Đề xuất thay đổi để nhóm review và thảo luận trước khi merge', 'Đánh dấu commit đã phát hành để bỏ qua bước tích hợp', 1),
    (9, NULL, 2, 'Bạn cần xác nhận nhánh hiện tại và xem các tệp còn thay đổi chưa được commit. Lệnh nào cung cấp trạng thái làm việc này?',
     'git branch --show-current vì lệnh này cũng liệt kê trạng thái các tệp', 'git diff --cached vì lệnh này hiển thị cả thay đổi chưa stage và tên nhánh', 'git status để xem nhánh và trạng thái working tree', 2)
), quiz_targets AS (
  SELECT demo.ordinal, demo.topic, demo.section_id, demo.lesson_id, quiz.id AS quiz_id
  FROM demo_quiz_lessons demo
  JOIN public.lessons lesson
    ON lesson."id" = demo.lesson_id
    AND lesson."sectionId" = demo.section_id
    AND lesson."type" = 'QUIZ'
  JOIN public.quizzes quiz ON quiz."lessonId" = lesson."id"
), new_questions AS (
  INSERT INTO public.quiz_questions ("quizId", "position", "content")
  SELECT target.quiz_id,
         bank.position + CASE
           WHEN bank.topic IS NOT NULL AND target.ordinal IN (6, 7, 9) THEN 3
           ELSE 0
         END,
         'Trong bối cảnh khóa học "' || catalog.title || '": ' || bank.content
  FROM quiz_targets target
  JOIN demo_catalog catalog ON catalog.ordinal = target.ordinal
  JOIN question_bank bank
    ON bank.topic = target.topic
    OR bank.ordinal = target.ordinal
  ON CONFLICT ("quizId", "position") DO UPDATE
  SET "content" = EXCLUDED."content"
  RETURNING "id", "quizId", "position"
)
INSERT INTO public.quiz_options ("questionId", "position", "content", "isCorrect")
SELECT question."id", option.position, option.content, option.position = bank.correct_index
FROM new_questions question
JOIN quiz_targets target ON target.quiz_id = question."quizId"
JOIN question_bank bank
  ON (
    bank.topic = target.topic
    AND bank.position = question."position" - CASE
      WHEN target.ordinal IN (6, 7, 9) THEN 3
      ELSE 0
    END
  ) OR (
    bank.ordinal = target.ordinal
    AND bank.position = question."position"
  )
CROSS JOIN LATERAL (VALUES
  (0, bank.answer_a),
  (1, bank.answer_b),
  (2, bank.answer_c)
) AS option(position, content)
ON CONFLICT ("questionId", "position") DO UPDATE
SET "content" = EXCLUDED."content",
    "isCorrect" = EXCLUDED."isCorrect";

COMMIT;
