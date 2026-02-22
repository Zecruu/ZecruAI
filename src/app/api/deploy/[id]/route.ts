import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import * as vercel from "@/lib/deploy/vercel";
import * as railway from "@/lib/deploy/railway";

function toDeployment(d: Record<string, unknown>) {
  return {
    id: (d._id as ObjectId).toString(),
    projectId: d.projectId,
    provider: d.provider,
    providerProjectId: d.providerProjectId,
    providerServiceId: d.providerServiceId,
    providerEnvironmentId: d.providerEnvironmentId,
    githubRepo: d.githubRepo,
    status: d.status,
    url: d.url,
    providerDeploymentId: d.providerDeploymentId,
    lastDeployedAt: d.lastDeployedAt,
    error: d.error,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const deployment = await db.collection("deployments").findOne({
    _id: new ObjectId(id),
    userId: user.id,
  });

  if (!deployment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch latest status from provider
  const userDoc = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
  const updates: Record<string, unknown> = {};

  try {
    if (deployment.provider === "vercel" && deployment.providerDeploymentId) {
      const token = userDoc?.vercelToken;
      if (token) {
        const d = await vercel.getDeployment(token, deployment.providerDeploymentId as string);
        const statusMap: Record<string, string> = {
          QUEUED: "building",
          BUILDING: "building",
          INITIALIZING: "deploying",
          READY: "ready",
          ERROR: "error",
          CANCELED: "error",
        };
        const newStatus = statusMap[d.readyState] || deployment.status;
        if (newStatus !== deployment.status) updates.status = newStatus;
        if (d.url && d.url !== deployment.url) updates.url = d.url;
      }
    } else if (deployment.provider === "railway" && deployment.providerProjectId) {
      const token = userDoc?.railwayToken;
      if (token) {
        const deps = await railway.getDeployments(token, deployment.providerProjectId as string);
        if (deps.length > 0) {
          const latest = deps[0];
          const statusMap: Record<string, string> = {
            BUILDING: "building",
            DEPLOYING: "deploying",
            SUCCESS: "ready",
            FAILED: "error",
            CRASHED: "error",
            REMOVED: "error",
          };
          const newStatus = statusMap[latest.status] || deployment.status;
          if (newStatus !== deployment.status) updates.status = newStatus;
        }
      }
    }
  } catch {
    // Provider API check failed — return cached data
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = Date.now();
    await db.collection("deployments").updateOne({ _id: deployment._id }, { $set: updates });
  }

  return NextResponse.json({
    deployment: toDeployment({ ...deployment, ...updates }),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  await db.collection("deployments").deleteOne({
    _id: new ObjectId(id),
    userId: user.id,
  });

  return NextResponse.json({ success: true });
}
