import { BookOpen, ImageOff } from "lucide-react";
import { useState } from "react";

const brandByKeyword: [string, string][] = [
  ["javascript", "javascript"], ["typescript", "typescript"],
  ["html", "html5"], ["css", "css"], ["react", "react"],
  ["next.js", "nextdotjs"], ["nextjs", "nextdotjs"], ["nestjs", "nestjs"],
  ["postgres", "postgresql"], ["sql", "postgresql"], ["typeorm", "typeorm"],
  ["github", "github"], ["git", "git"], ["docker", "docker"],
  ["python", "python"], ["node.js", "nodedotjs"], ["nodejs", "nodedotjs"],
  ["redis", "redis"], ["figma", "figma"], ["excel", "microsoftexcel"],
  ["pandas", "pandas"], ["numpy", "numpy"], ["tailwind", "tailwindcss"],
  ["mongodb", "mongodb"], ["mysql", "mysql"], ["java", "openjdk"],
  ["linux", "linux"], ["aws", "amazonaws"], ["kubernetes", "kubernetes"],
];

const topicPhotos: [string[], string][] = [
  [["thiết kế", "design", "figma", "ui", "ux", "màu sắc", "typography"], "photo-1561070791-2526d30994b5"],
  [["dữ liệu", "data", "thống kê", "excel", "pandas", "sql"], "photo-1551288049-bebda4e38f71"],
  [["kỹ năng", "học tập", "nghề nghiệp", "quản lý"], "photo-1521737711867-e3b97375f902"],
];

function inferredImage(title: string) {
  const normalized = title.toLocaleLowerCase("vi");
  const brand = brandByKeyword.find(([keyword]) => normalized.includes(keyword));
  if (brand) return { src: `https://cdn.simpleicons.org/${brand[1]}`, brand: true };
  const photo = topicPhotos.find(([keywords]) => keywords.some((keyword) => normalized.includes(keyword)));
  const imageId = photo?.[1] ?? "photo-1516321318423-f06f85e504b3";
  return { src: `https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=640&q=80`, brand: false };
}

export function CourseLogo({
  title,
  imageUrl,
  className = "",
}: {
  title: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const inferred = inferredImage(title);
  const source = imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : inferred.src;
  const fallbackImage = `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=640&q=80`;
  const displaySource = failedUrl === source && inferred.brand && !imageUrl ? fallbackImage : source;
  const usableImage = failedUrl !== displaySource;

  return (
    <div
      role="img"
      aria-label={`Ảnh khóa học ${title}`}
      className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-primary/15 via-muted to-accent/20 ${className}`}
    >
      {usableImage ? (
        // Course images are user supplied URLs; using img avoids a fixed host allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySource}
          alt={`Ảnh khóa học ${title}`}
          className={imageUrl || !inferred.brand || displaySource === fallbackImage ? "size-full object-cover" : "size-full bg-white p-7 object-contain"}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(displaySource)}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 p-3 text-center text-primary">
          {imageUrl ? <ImageOff className="size-7" aria-hidden="true" /> : <BookOpen className="size-8" aria-hidden="true" />}
          <span className="text-xs font-medium">Chưa có ảnh bìa</span>
        </div>
      )}
    </div>
  );
}
