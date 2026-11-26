# Dữ liệu danh mục khóa học mẫu

`demo-catalog.sql` chứa 40 khóa học miễn phí đã xuất bản, 80 chương và 160 đề mục bài học bằng tiếng Việt. Dữ liệu bao phủ lập trình, thiết kế, phân tích dữ liệu, kỹ năng nghề nghiệp và kỹ năng học tập. Khóa mẫu dùng để thử quiz và chứng chỉ được tạo riêng bằng seed Learning.

## Nạp trên Windows

Từ thư mục gốc repo, cài dependencies theo [README](../../README.md), khởi động PostgreSQL bằng Docker Compose rồi áp dụng migration. Chạy các lệnh dưới đây từ thư mục `backend`. Các lệnh dùng tên database và user mặc định trong `.env.example`.

```powershell
docker compose up -d --wait
pnpm migration:run
docker compose cp ./seeds/demo-catalog.sql postgres:/tmp/lms-demo-catalog.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d elearning_lms -f /tmp/lms-demo-catalog.sql
pnpm start:dev
```

Nếu đã đổi cấu hình local, thay `postgres` sau `-U` bằng `DB_USERNAME` và `elearning_lms` sau `-d` bằng `DB_NAME`. Có thể chạy cùng file SQL từ Query Tool của pgAdmin hoặc SQL Editor của DBeaver trên database đã migrate.

Kiểm tra qua [API khóa học](http://localhost:3000/v1/courses) hoặc chạy truy vấn sau trong PostgreSQL:

```sql
SELECT count(*) FROM public.courses
WHERE "instructorId" = '70b790d0-f72d-4eb4-929f-d58b003afe1e';
```

Có thể nạp lại seed. Lệnh thêm bản ghi mẫu còn thiếu và giữ nguyên các bản ghi đã có. Mỗi khóa học có hai chương và bốn đề mục bài học, đủ để thử danh mục và ghi danh qua API. Các tài khoản học viên được tạo khi người dùng đăng ký trên máy local.
