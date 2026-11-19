# Bàn giao sửa issue Learning — 2026-11-19

13 issue được gán cho @ljq-exe. Bảng dưới ghi implementation và bằng chứng local, chưa thay thế review/merge hoặc tự đóng issue.

| Issue | Thay đổi | Bằng chứng |
| --- | --- | --- |
| #13 | Quiz 404 trả quiz=null, giữ progress/certificates | Frontend snapshot tests |
| #14 | GET snapshot read-only, không cấp chứng chỉ | Hai regression PostgreSQL |
| #15 | Loại Redis khỏi đường transaction progress | Progress chỉ phụ thuộc PostgreSQL/Certificates; tests concurrency |
| #16 | Bỏ cache tổng published và API invalidate không có caller | Tổng PostgreSQL theo course; test publish thêm bài; không còn phụ thuộc TTL |
| #17 | Tách CertificateResponse cá nhân và PublicCertificateResponse | HTTP kiểm tra shape JSON và không có userId trong HTML |
| #19 | Message dùng MAX_QUIZ_ATTEMPTS | Service integration xác nhận message khi hết lượt |
| #20 | signOut xoá đúng key; không khôi phục attempt hết hạn | Frontend storage tests |
| #21 | Mẫu/fallback LMS_API_URL dùng port demo 3002 | .env.example, next.config.ts và README thống nhất |
| #22 | Xoá wiring patch, sửa các tham chiếu | Wiring được mô tả trực tiếp trong docs tích hợp |
| #23 | Helper chuyển sang backend/test-support | nest build không có helper trong dist |
| #24 | Dùng client redis chính thức, kết nối tái sử dụng, TLS, retry ở probe sau | 6 unit test lifecycle/deadline/ACL/TLS |
| #25 | CSS Module local, không :global, JSX dùng class được hash | Build/typecheck và stylesheet không có global selectors |
| #26 | Hoàn tác thay đổi root layout/carousel từ PR Learning về scaffold PR #9 | So sánh file với commit 4d0b666; Learning dùng chrome chung |

Các issue #11/#12 (CI), #18 (config) và #27 (process) thuộc Lead. Phần cấu hình cần để chạy các regression được chuẩn bị ở commit riêng cho Lead review. Không sửa branch protection, không cấp approval và không ghi nhận QA thay người phụ trách.

Số test hiện tại và giới hạn kiểm chứng xem learning.md. Frontend/shared owner: Lead phụ trách app/layout.tsx và components/ui/*. Learning chỉ sở hữu dashboard/state/stylesheet và route /learning; thay đổi scaffold sau này phải review riêng.
