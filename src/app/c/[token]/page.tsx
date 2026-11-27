import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import { getProjectByToken } from "@/server/projects";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const project = await getProjectByToken(token);
  if (!project) notFound();
  const { selection, ...rest } = project;
  return <ProjectWorkspace project={rest} mode="client" initialSelection={selection} />;
}
