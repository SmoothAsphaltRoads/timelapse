import type { HTMLAttributes } from "react";

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={mergeClassNames("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}
      {...props}
    />
  );
}
