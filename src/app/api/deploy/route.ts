import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import * as vercel from "@/lib/deploy/vercel";
import * as railway from "@/lib/deploy/railway";
import { collectFiles } from "@/lib/deploy/fileCollector";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const deployments = await db.collection("deployments")
    .find({ userId: user.id })
    .toArray();

  return NextResponse.json({
    deployments: deployments.map((d) => ({
      id: d._id.toString(),
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
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, provider, githubRepo } = await req.json();
  if (!projectId || !provider) {
    return NextResponse.json({ error: "projectId and provider required" }, { status: 400 });
  }

  const db = await getDb();

  // Get user's token
  const userDoc = await db.collection("users").findOne({ _id: new ObjectId(user.id) });
  const token = provider === "vercel" ? userDoc?.vercelToken : userDoc?.railwayToken;
  if (!token) {
    return NextResponse.json({ error: `No ${provider} token configured` }, { status: 400 });
  }

  // Get the project
  const project = await db.collection("projects").findOne({
    _id: new ObjectId(projectId),
    userId: user.id,
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Check for existing deployment
  const existing = await db.collection("deployments").findOne({
    userId: user.id,
    projectId,
  });

  const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50);

  try {
    if (provider === "vercel") {
      return await deployVercel(db, user.id, projectId, sanitizedName, token, project.workingDirectory, existing);
    } else {
      if (!githubRepo) {
        return NextResponse.json({ error: "githubRepo required for Railway deployments" }, { status: 400 });
      }
      return await deployRailway(db, user.id, projectId, sanitizedName, token, githubRepo, existing);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Deployment failed";

    // Save error state
    if (existing) {
      await db.collection("deployments").updateOne(
        { _id: existing._id },
        { $set: { status: "error", error: message, updatedAt: Date.now() } }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function deployVercel(
  db: ReturnType<Awaited<ReturnType<typeof getDb>>["collection"]> extends never ? never : Awaited<ReturnType<typeof getDb>>,
  userId: string,
  projectId: string,
  name: string,
  token: string,
  workingDir: string,
  existing: { _id: ObjectId; providerProjectId?: string } | null
) {
  // Collect files from the project directory
  const files = await collectFiles(workingDir);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files found in project directory" }, { status: 400 });
  }

  // Upload each file to Vercel
  const uploadedFiles: Array<{ file: string; sha: string; size: number }> = [];
  for (const f of files) {
    const sha = await vercel.uploadFile(token, f.content);
    uploadedFiles.push({ file: f.relativePath, sha, size: f.size });
  }

  // Create or use existing project name
  const projectName = existing?.providerProjectId || name;

  // Create the deployment
  const deployment = await vercel.createDeployment(token, projectName, uploadedFiles);

  const now = Date.now();
  if (existing) {
    // Update existing deployment record
    await db.collection("deployments").updateOne(
      { _id: existing._id },
      {
        $set: {
          status: "building",
          url: deployment.url,
          providerDeploymentId: deployment.id,
          lastDeployedAt: now,
          error: null,
          updatedAt: now,
        },
      }
    );
    return NextResponse.json({
      deployment: {
        id: existing._id.toString(),
        projectId,
        provider: "vercel",
        providerProjectId: projectName,
        status: "building",
        url: deployment.url,
        providerDeploymentId: deployment.id,
        lastDeployedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  } else {
    // Create new deployment record
    const result = await db.collection("deployments").insertOne({
      userId,
      projectId,
      provider: "vercel",
      providerProjectId: projectName,
      providerDeploymentId: deployment.id,
      status: "building",
      url: deployment.url,
      lastDeployedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      deployment: {
        id: result.insertedId.toString(),
        projectId,
        provider: "vercel",
        providerProjectId: projectName,
        providerDeploymentId: deployment.id,
        status: "building",
        url: deployment.url,
        lastDeployedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

async function deployRailway(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  projectId: string,
  name: string,
  token: string,
  githubRepo: string,
  existing: { _id: ObjectId; providerProjectId?: string; providerServiceId?: string; providerEnvironmentId?: string } | null
) {
  const now = Date.now();

  if (existing?.providerServiceId && existing?.providerEnvironmentId) {
    // Redeploy existing service
    await railway.redeployService(token, existing.providerServiceId, existing.providerEnvironmentId);

    await db.collection("deployments").updateOne(
      { _id: existing._id },
      { $set: { status: "building", error: null, lastDeployedAt: now, updatedAt: now } }
    );

    return NextResponse.json({
      deployment: {
        id: existing._id.toString(),
        projectId,
        provider: "railway",
        providerProjectId: existing.providerProjectId,
        providerServiceId: existing.providerServiceId,
        providerEnvironmentId: existing.providerEnvironmentId,
        githubRepo,
        status: "building",
        lastDeployedAt: now,
        updatedAt: now,
      },
    });
  }

  // Create new Railway project + service + connect repo
  const proj = await railway.createProject(token, name);
  const prodEnv = proj.environments.find((e) => e.name === "production") || proj.environments[0];
  if (!prodEnv) throw new Error("No environment found in Railway project");

  const service = await railway.createService(token, proj.id, name);
  await railway.connectRepo(token, service.id, githubRepo, "main");

  // Generate a domain
  const domain = await railway.generateServiceDomain(token, service.id, prodEnv.id);

  const result = await db.collection("deployments").insertOne({
    userId,
    projectId,
    provider: "railway",
    providerProjectId: proj.id,
    providerServiceId: service.id,
    providerEnvironmentId: prodEnv.id,
    githubRepo,
    status: "building",
    url: domain,
    lastDeployedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({
    deployment: {
      id: result.insertedId.toString(),
      projectId,
      provider: "railway",
      providerProjectId: proj.id,
      providerServiceId: service.id,
      providerEnvironmentId: prodEnv.id,
      githubRepo,
      status: "building",
      url: domain,
      lastDeployedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });
}
