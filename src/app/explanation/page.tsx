import { AppShell } from "@/components/jaldrishti/AppShell";

export default async function ExplanationPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  return <AppShell view="explanation" projectId={project ?? null} />;
}
