# Template — Tài liệu giải thích module

> Copy file này thành `docs/<module>.md` rồi điền. Mục đích: chứng minh **độ hiểu code**
> của người viết — không phải liệt kê file, mà giải thích **vì sao** làm như vậy.
> Giữ ngắn gọn, ưu tiên "why" hơn "what".

## 1. Tổng quan
Module này làm gì, giải quyết vấn đề gì. 2–4 câu.

## 2. Luồng dữ liệu / kiến trúc
Sơ đồ text hoặc mô tả luồng request → service → DB (và queue/WS nếu có).

```
Client → Controller → Service → Repository → DB
```

## 3. Các file chính
| File | Trách nhiệm |
|---|---|
| `x.controller.ts` | ... |
| `x.service.ts` | ... |

## 4. Quyết định thiết kế & lý do (phần ăn điểm)
- **Vì sao chọn ... thay vì ...?**
- **Đánh đổi gì?** (performance / đơn giản / an toàn)
- **Ràng buộc DB này để chống lỗi gì?** (unique/index)

## 5. Cơ sở dữ liệu liên quan
| Entity | Trường quan trọng | Index / Unique | Lý do |
|---|---|---|---|

## 6. API endpoints
| Method | Path | Quyền | Input (DTO) | Output |
|---|---|---|---|---|

## 7. Xử lý lỗi & edge case
Các trường hợp biên đã xử lý và cách xử lý.

## 8. Test
Đã viết test gì (unit / e2e), kiểm chứng điều gì.

## 9. Điểm nhấn kỹ thuật
1–3 thứ đáng trình bày nhất với giảng viên.

## 10. Hạn chế / chưa làm
Nói thẳng phần cắt scope và lý do — thể hiện hiểu biết.
