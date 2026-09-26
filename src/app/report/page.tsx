import { AppShell } from "@/components/jaldrishti/AppShell";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  return <AppShell view="report" projectId={project ?? null} />;
}
