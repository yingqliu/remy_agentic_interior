import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import { getProjectByToken } from "@/server/projects";
import { readSeedreamCatalog } from "@/server/seedream-catalog";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const project = await getProjectByToken(token);
  if (!project) notFound();
  const { selection, ...rest } = project;
  const seedream = readSeedreamCatalog(rest.schemes.map((scheme) => scheme.key));
  return <ProjectWorkspace project={{ ...rest, seedream }} mode="client" initialSelection={selection} />;
}
