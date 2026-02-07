import type React from "react";

export function Section(props: { children: React.ReactNode }) {
  return <div className="grid gap-1.5 p-2.5 border-t">{props.children}</div>;
}
