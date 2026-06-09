import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function trafficLight(dueDate: Date | string, status?: string) {
  const due = new Date(dueDate).getTime();
  const now = Date.now();
  if (status === "COMPLETED" || status === "CLOSED") return "green";
  if (due < now) return "red";
  if (due - now < 1000 * 60 * 60 * 24 * 7) return "yellow";
  return "green";
}
