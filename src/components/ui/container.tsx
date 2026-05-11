import type { HTMLAttributes } from "react";

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className ?? ""}`.trim()}
      {...props}
    />
  );
}
