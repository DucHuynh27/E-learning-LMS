import {cva, type VariantProps} from "class-variance-authority";
import {cn} from "cn";
import type {ComponentPropsWithoutRef, ComponentType} from "react";

const textVariants = cva("", {
  variants: {
    variant: {
      body: "text-base",
      sidebar: "text-sm font-medium",
      label: "text-sm font-medium",
      caption: "text-xs",
      table: "text-sm",
      stat: "text-3xl font-bold",
    },
  },
  defaultVariants: {variant: "body"},
});

type TextTag = "p" | "span" | "label";

type TextProps<C extends TextTag = "p"> = { as?: C } &
  VariantProps<typeof textVariants> &
  ComponentPropsWithoutRef<C>;

function Text<C extends TextTag = "p">({
                                         as,
                                         variant = "body",
                                         className,
                                         ...props
                                       }: TextProps<C>) {
  const Tag = (as ?? "p") as unknown as ComponentType<Record<string, unknown>>;
  return <Tag className={cn(textVariants({variant}), className)} {...props} />;
}

export {Text, textVariants};