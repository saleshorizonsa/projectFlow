import { guardSection } from "@/lib/modules";

// Blocks direct URL access when this section is switched off or above the user's role.
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await guardSection("/team");
  return children;
}
