import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import { getProjectBySlug } from "@/server/projects";
import { readSeedreamCatalog } from "@/server/seedream-catalog";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  const { selection, ...rest } = project;
  const seedream = readSeedreamCatalog(rest.schemes.map((scheme) => scheme.key));
  return <ProjectWorkspace project={{ ...rest, seedream }} mode="designer" initialSelection={selection} />;
}
