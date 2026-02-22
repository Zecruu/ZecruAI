const VERCEL_API = "https://api.vercel.com";

async function vercelFetch(token: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${VERCEL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function verifyToken(token: string): Promise<{ username: string; email: string }> {
  const data = await vercelFetch(token, "/v2/user");
  return { username: data.user.username, email: data.user.email };
}

export async function createProject(token: string, name: string): Promise<{ id: string; name: string }> {
  const data = await vercelFetch(token, "/v10/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return { id: data.id, name: data.name };
}

export async function uploadFile(token: string, content: Buffer): Promise<string> {
  const crypto = await import("crypto");
  const sha = crypto.createHash("sha1").update(content).digest("hex");

  const res = await fetch(`${VERCEL_API}/v2/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "x-vercel-digest": sha,
      "Content-Length": String(content.length),
    },
    body: new Uint8Array(content),
  });

  if (!res.ok && res.status !== 409) {
    // 409 means file already uploaded (same SHA) — that's fine
    const body = await res.text();
    throw new Error(`Vercel file upload error ${res.status}: ${body}`);
  }

  return sha;
}

export async function createDeployment(
  token: string,
  projectName: string,
  files: Array<{ file: string; sha: string; size: number }>
): Promise<{ id: string; url: string; readyState: string }> {
  const data = await vercelFetch(token, "/v13/deployments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: projectName,
      files,
      target: "production",
      projectSettings: {
        framework: null, // auto-detect
      },
    }),
  });
  return {
    id: data.id,
    url: data.url ? `https://${data.url}` : "",
    readyState: data.readyState,
  };
}

export async function getDeployment(
  token: string,
  deploymentId: string
): Promise<{ id: string; readyState: string; url: string }> {
  const data = await vercelFetch(token, `/v13/deployments/${deploymentId}`);
  return {
    id: data.id,
    readyState: data.readyState, // QUEUED, BUILDING, READY, ERROR, CANCELED
    url: data.url ? `https://${data.url}` : "",
  };
}
