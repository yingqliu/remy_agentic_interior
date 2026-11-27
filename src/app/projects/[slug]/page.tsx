import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import { getProjectBySlug } from "@/server/projects";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  const { selection, ...rest } = project;
  return <ProjectWorkspace project={rest} mode="designer" initialSelection={selection} />;
}
