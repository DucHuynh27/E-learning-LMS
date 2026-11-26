import { Button } from "@/components/ui/button";
import { Text } from "@/components/text";
import {Heading} from "@/components/heading";
import Link from "next/link";

export default function Home() {
  return (
    <section className="site-container site-content">
      <div className="site-panel bg-linear-to-br from-primary/10 via-card to-card p-6 sm:p-10">
        <div className="flex max-w-xl flex-col items-start gap-5">
          <Heading>Khám phá khóa học</Heading>
          <Text className="text-muted-foreground">
            Chọn khóa học, theo dõi tiến độ và kiểm tra kiến thức bằng quiz.
          </Text>
          <Button size="lg" nativeButton={false} render={<Link href="/courses" />}>
            Xem khóa học
          </Button>
        </div>
      </div>
    </section>
  );
}
