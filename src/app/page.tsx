import { AppShell } from "@/components/jaldrishti/AppShell";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  return <AppShell projectId={project ?? null} />;
}
