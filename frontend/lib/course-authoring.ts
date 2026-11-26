import { ApiError } from "@/lib/learning-api";

export function managementError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Phiên đã hết hạn. Hãy đăng xuất và đăng nhập lại.";
    if (error.status === 403)
      return "Bạn không có quyền thực hiện thao tác này.";
    if (error.status === 404)
      return "Không tìm thấy khóa học hoặc nội dung đã chọn.";
    if (
      error.status === 409 &&
      error.message.includes("at least one section and one lesson")
    ) {
      return "Thêm ít nhất một chương và một bài học trước khi xuất bản.";
    }
  }
  return error instanceof Error
    ? error.message
    : "Thao tác không thành công. Vui lòng thử lại.";
}
