# E-Learning frontend

Trang chủ `/` dùng scaffold của nhóm. Không gian Learning ở `/learning`, có CSS riêng để giữ giao diện trang chủ khi chuyển trang.

Next.js kết nối API NestJS qua proxy `/api/*`. Trang Courses tìm kiếm khóa học đã xuất bản và cho học viên ghi danh. Login và Register dùng tài khoản PostgreSQL qua API Auth. Trang Learning cung cấp lớp học mẫu với hai bài học, quiz có đếm giờ và tra cứu chứng chỉ. Thời gian xem video được mô phỏng bằng thanh trượt.

## Chạy frontend với backend chính

Yêu cầu: đã cài dependencies theo `pnpm-lock.yaml` của backend/frontend, tạo `backend/.env`, chạy hạ tầng Compose và migration nền tảng theo README gốc. Không cần cài package toàn cục để chạy các lệnh dưới đây.

Terminal backend, từ root repo:

```powershell
cd backend
npm run demo:seed:catalog
pnpm start:dev
```

`demo:seed:catalog` thêm tài khoản, khóa học đã xuất bản, bài học, ghi danh và quiz mẫu vào schema `public` sau khi chạy migration theo README gốc. Lệnh dành cho database phát triển local và có thể chạy lại để bổ sung bản ghi còn thiếu mà giữ tiến độ, chứng chỉ và lượt quiz.

Terminal frontend, từ root repo:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm run dev -- --port 3100
```

- Danh mục: `http://localhost:3100/courses`
- Lớp học mẫu: `http://localhost:3100/learning`
- Backend chính: `http://localhost:3000/v1/health`
- Học viên: `student@lms.demo` / `LmsDemo2026!` (đã điền sẵn trên giao diện).
- Giảng viên seed: `teacher@lms.demo` / `LmsDemo2026!`.

Đăng nhập bằng tài khoản giảng viên để mở **Quản lý** ở menu hoặc truy cập `/admin/courses`. Tạo bản nháp, sau đó chọn khóa học để thêm chương và bài học trước khi xuất bản. Giảng viên quản lý khóa học của mình, còn tài khoản quản trị viên xem được toàn bộ danh mục quản lý.

Để soạn quiz, thêm bài học loại **Trắc nghiệm** rồi mở **Soạn câu hỏi trắc nghiệm** trong bài học đó. Mỗi câu có 2–8 lựa chọn và một đáp án đúng. Có thể cấu hình điểm đạt và giới hạn thời gian. Học viên đã ghi danh làm quiz ở trang chi tiết khóa học sau khi khóa học và bài học được xuất bản.

Courses đọc dữ liệu Catalog từ PostgreSQL. Các UUID trong `lib/learning-demo.ts` khớp với lệnh seed. Màn hình Learning hiển thị khóa mẫu; học viên mới ghi danh từ trang chi tiết trước khi lưu tiến độ.

Mỗi quiz tối đa 3 lượt; các lượt hết giờ vẫn tính vào giới hạn. Frontend chia sẻ phiên đăng nhập giữa các trang khi điều hướng và giữ token trong bộ nhớ, nên cần đăng nhập lại sau khi tải lại trang. Lượt quiz đang mở được lưu theo user trong `sessionStorage` để tiếp tục sau khi tải lại trang và đăng nhập lại. Đăng xuất chủ động xoá key attempt của user; attempt hết hạn/không hợp lệ cũng bị loại khi khôi phục.

Nếu trình duyệt chặn storage hoặc hết dung lượng, bắt đầu/nộp quiz và đăng xuất vẫn hoạt động trong phiên hiện tại. Khi đó không bảo đảm khôi phục lượt sau khi tải lại trang. Dữ liệu lưu được kiểm tra cả cấu trúc câu hỏi/đáp án và thời gian trước khi khôi phục; deadline luôn tính từ `expiresAt` của server.

Đồng hồ quiz dùng `expiresAt` do backend trả khi bắt đầu lượt; không cộng lại thời gian từ lúc nhận response. `expiresAt: null` là lượt không giới hạn. Backend vẫn kiểm tra deadline độc lập khi nộp bài.

## Chạy riêng demo Learning

Để dùng schema demo riêng, chạy `npm run demo:seed` và `npm run demo:start` trong backend, rồi đặt `LMS_API_URL=http://127.0.0.1:3002` và khởi động lại Next.js. Chế độ này phục vụ trang Learning với fixtures trong `learning_demo`. Dùng cổng 3000 cho danh mục, ghi danh và các màn hình kết nối schema chính. Next.js chuyển mọi request `/api/...` tới `/v1/...` của backend đã cấu hình.

## Kiểm tra

```powershell
npm run lint
npm test
npm run typecheck
npm run build
```

Sử dụng dependencies trong `frontend/node_modules`; không đưa `.env.local`, token, cache hoặc `node_modules` vào Git.

Dashboard dùng CSS Module local trong components/learning-dashboard.module.css, không có :global. Root layout và components/ui/* thuộc owner scaffold (Lead); exception lint duy nhất cho effect đồng bộ Embla nằm ở generated carousel. Thiếu quiz (404) chỉ hiển thị thông báo chưa có quiz, không chặn tiến độ/chứng chỉ.
