import {cva} from "class-variance-authority";
import {cn} from "cn";
import {type ComponentProps} from "react";

const headingVariants = cva("", {
  variants: {
    level: {
      h1: "text-4xl font-bold",
      h2: "text-[28px] font-semibold",
      h3: "text-[22px] font-semibold",
    },
  },
  defaultVariants: {level: "h1"},
});

type HeadingLevel = "h1" | "h2" | "h3";
type HeadingProps = ComponentProps<"h1"> & { level?: HeadingLevel };

function Heading({level = "h1", className, ...props}: HeadingProps) {
  const Tag = level;
  return (
    <Tag className={cn(headingVariants({level}), className)} {...props} />
  );
}

export {Heading, headingVariants};

