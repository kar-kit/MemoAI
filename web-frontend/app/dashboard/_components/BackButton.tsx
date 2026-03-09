"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  label?: string;
  routeName?: string;
};

export default function BackButton({
  label = "Back",
  routeName,
}: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (routeName) {
          router.push(routeName);
        } else {
          router.back();
        }
      }}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
        "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--app-fg)]",
        "shadow-[0_10px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_25px_rgba(0,0,0,0.35)]",
        "backdrop-blur transition active:scale-[0.98]",
        "hover:bg-black/[0.06] dark:hover:bg-white/10",
        "focus:outline-none focus:ring-4 focus:ring-indigo-500/20",
      ].join(" ")}
      aria-label={label}
    >
      <span className="text-lg leading-none">←</span>
      <span>{label}</span>
    </button>
  );
}
