import { BookOpen } from "lucide-react";

export function CourseLogo({
  title,
  className = "",
}: {
  title: string;
  className?: string;
}) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const monogram =
    words
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("")
      .toLocaleUpperCase("vi") || "KH";
  const hue = Array.from(title).reduce(
    (value, character) => (value * 31 + character.codePointAt(0)!) % 360,
    17,
  );

  return (
    <div
      role="img"
      aria-label={`Logo khóa học ${title}`}
      className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl text-white shadow-inner ${className}`}
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 68% 34%), hsl(${(hue + 36) % 360} 72% 46%))`,
      }}
    >
      <BookOpen
        aria-hidden="true"
        className="absolute right-3 top-3 size-5 opacity-60"
      />
      <span className="text-3xl font-bold tracking-tight drop-shadow-sm">
        {monogram}
      </span>
      <span
        aria-hidden="true"
        className="absolute -bottom-5 -left-4 size-16 rounded-full border border-white/20"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-8 -left-7 size-24 rounded-full border border-white/15"
      />
    </div>
  );
}
