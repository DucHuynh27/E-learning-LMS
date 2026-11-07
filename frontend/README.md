# Learning frontend

Next.js cho giao diện học viên, kết nối API NestJS qua proxy `/api/*`. Gồm đăng nhập, cập nhật tiến độ hai bài học, quiz có đếm giờ và trang xác thực chứng chỉ. Thời gian xem video được mô phỏng bằng thanh trượt; chưa có phát video.

## Chạy bản demo local

Yêu cầu: đã cài dependencies theo `pnpm-lock.yaml` của backend/frontend, tạo `backend/.env`, chạy hạ tầng Compose và migration nền tảng theo README gốc. Không cần cài package toàn cục để chạy các lệnh dưới đây.

Terminal backend, từ root repo:

```powershell
cd backend
npm run demo:seed
npm run demo:start
```

`demo:seed` build backend, tạo fixtures trong schema PostgreSQL `learning_demo`, chạy migration Learning và tạo tài khoản mẫu. Chạy lại không xoá tiến độ, chứng chỉ hoặc lượt quiz đã có. Script không thêm dữ liệu vào các bảng người dùng của schema `public`; bảng `public.users` cần tồn tại để tạo cấu trúc users cho demo.

Terminal frontend, từ root repo:

```powershell
cd frontend
Copy-Item .env.example .env.local
# Đổi LMS_API_URL trong .env.local thành http://127.0.0.1:3002 cho bản demo
npm run dev -- --port 3100
```

- Frontend: `http://localhost:3100`
- Backend demo: `http://localhost:3002/v1/health`
- Học viên: `student@lms.demo` / `LmsDemo2026!` (đã điền sẵn trên giao diện).
- Giảng viên seed: `teacher@lms.demo` / `LmsDemo2026!`.

Course/Lesson/Enrolment là fixtures theo contract Catalog, không phải implementation của nhóm Content. Progress, Quiz, Attempt, Certificate và Auth gọi backend NestJS thật. Các UUID trong `lib/learning-demo.ts` khớp với script seed; màn hình này dành cho khóa demo cố định, chưa có danh sách khóa học động.

Mỗi quiz tối đa 3 lượt; các lượt hết giờ vẫn tính vào giới hạn. Frontend giữ token trong bộ nhớ, cần đăng nhập lại sau khi tải lại trang. Lượt quiz đang mở được lưu theo user trong `sessionStorage` để tiếp tục sau khi đăng nhập lại.

## Kết nối backend thông thường

`.env.example` mặc định trỏ tới API port 3000. `LMS_API_URL` là cấu hình phía server của Next.js; thay đổi cần khởi động lại frontend. Mọi request `/api/...` được proxy tới `/v1/...`, nên không cần thêm CORS chỉ để chạy giao diện local. Các luồng học tập vẫn cần dữ liệu Catalog/enrolment tương ứng.

## Kiểm tra

```powershell
npm run lint
npm run build
```

Sử dụng dependencies trong `frontend/node_modules`; không đưa `.env.local`, token, cache hoặc `node_modules` vào Git.
