import Link from "next/link";
import { Heading } from "@/components/heading";

export default function HelpPage() {
  return (
    <div className="site-container site-content space-y-6">
      <Heading>Hỗ trợ học tập</Heading>
      <section id="faq" className="site-panel scroll-mt-28 p-6">
        <h2 className="mb-4 text-xl font-semibold">Câu hỏi thường gặp</h2>
        <dl className="space-y-4">
          <div>
            <dt className="font-semibold">Làm sao để ghi danh?</dt>
            <dd>
              Sau khi đăng nhập, chọn một{" "}
              <Link className="text-primary underline" href="/courses">
                khóa học
              </Link>{" "}
              và bấm Ghi danh.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">
              Có thể thử lưu tiến độ và làm quiz ở đâu?
            </dt>
            <dd>
              Mở{" "}
              <Link className="text-primary underline" href="/learning">
                Học tập
              </Link>{" "}
              để vào khóa mẫu. Tiến độ và kết quả quiz được lưu theo tài khoản.
            </dd>
          </div>
        </dl>
      </section>
      <section id="bai-viet" className="site-panel scroll-mt-28 p-6">
        <h2 className="mb-4 text-xl font-semibold">Bài viết mới nhất</h2>
        <article>
          <h3 className="font-semibold">Bắt đầu với lớp học mẫu</h3>
          <p>
            Mở bài Theo dõi tiến độ, lưu thời lượng đã học, rồi làm quiz ở bài
            tiếp theo. Bạn có thể tra cứu chứng chỉ từ trang Học tập khi hoàn
            thành các điều kiện.
          </p>
        </article>
      </section>
    </div>
  );
}
