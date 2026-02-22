import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const db = await getDb();
  const deployment = await db.collection("deployments").findOne({
    userId: user.id,
    projectId,
  });

  if (!deployment) {
    return NextResponse.json({ deployment: null });
  }

  return NextResponse.json({
    deployment: {
      id: deployment._id.toString(),
      projectId: deployment.projectId,
      provider: deployment.provider,
      providerProjectId: deployment.providerProjectId,
      providerServiceId: deployment.providerServiceId,
      providerEnvironmentId: deployment.providerEnvironmentId,
      githubRepo: deployment.githubRepo,
      status: deployment.status,
      url: deployment.url,
      providerDeploymentId: deployment.providerDeploymentId,
      lastDeployedAt: deployment.lastDeployedAt,
      error: deployment.error,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
    },
  });
}
