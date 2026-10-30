import { Button } from "@/components/ui/button";
import { Text } from "@/components/text";
import {Heading} from "@/components/heading";

export default function Home() {
  return (
    <>
      <section className="bg-linear-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-6xl mx-auto grid items-center gap-10 px-4 py-20 lg:grid-cols-2">

          <div className="flex flex-col gap-6">
            <Heading level="h1">Học đi các con vợ</Heading>
            <Text variant="body" className="text-muted-foreground max-w-md">
              Cái gì đó...
            </Text>
            <div><Button size="lg">Khóa học miễn phí</Button></div>
          </div>

          <div className="…">{/* ảnh minh hoạ */}</div>

        </div>
      </section>
    </>
  );
}