const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

async function railwayQuery(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors?.length) {
    throw new Error(data.errors[0]?.message || "Railway API error");
  }
  return data.data;
}

export async function verifyToken(token: string): Promise<{ name: string; email: string }> {
  const data = await railwayQuery(token, `query { me { name email } }`);
  return { name: data.me.name, email: data.me.email };
}

export async function createProject(token: string, name: string): Promise<{ id: string; environments: Array<{ id: string; name: string }> }> {
  const data = await railwayQuery(token, `
    mutation($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        id
        environments { edges { node { id name } } }
      }
    }
  `, { input: { name } });
  const proj = data.projectCreate;
  return {
    id: proj.id,
    environments: proj.environments.edges.map((e: { node: { id: string; name: string } }) => e.node),
  };
}

export async function createService(token: string, projectId: string, name: string): Promise<{ id: string }> {
  const data = await railwayQuery(token, `
    mutation($input: ServiceCreateInput!) {
      serviceCreate(input: $input) { id }
    }
  `, { input: { projectId, name } });
  return { id: data.serviceCreate.id };
}

export async function connectRepo(token: string, serviceId: string, repo: string, branch: string = "main"): Promise<void> {
  await railwayQuery(token, `
    mutation($id: String!, $input: ServiceConnectInput!) {
      serviceConnect(id: $id, input: $input) { id }
    }
  `, { id: serviceId, input: { repo, branch } });
}

export async function getServiceDomain(token: string, serviceId: string, environmentId: string): Promise<string | null> {
  const data = await railwayQuery(token, `
    query($projectId: String!, $serviceId: String!, $environmentId: String!) {
      domains(
        projectId: $projectId
        serviceId: $serviceId
        environmentId: $environmentId
      ) {
        serviceDomains { domain }
        customDomains { domain }
      }
    }
  `.replace("$projectId: String!, ", ""), {
    serviceId,
    environmentId,
  });

  // Try service-generated domains first, then custom
  const serviceDomains = data.domains?.serviceDomains;
  if (serviceDomains?.length) return `https://${serviceDomains[0].domain}`;
  const customDomains = data.domains?.customDomains;
  if (customDomains?.length) return `https://${customDomains[0].domain}`;
  return null;
}

export async function generateServiceDomain(token: string, serviceId: string, environmentId: string): Promise<string> {
  const data = await railwayQuery(token, `
    mutation($input: ServiceDomainCreateInput!) {
      serviceDomainCreate(input: $input) { domain }
    }
  `, { input: { serviceId, environmentId } });
  return `https://${data.serviceDomainCreate.domain}`;
}

export async function getDeployments(token: string, projectId: string): Promise<Array<{ id: string; status: string }>> {
  const data = await railwayQuery(token, `
    query($input: DeploymentListInput!) {
      deployments(input: $input, first: 1) {
        edges { node { id status } }
      }
    }
  `, { input: { projectId } });
  return data.deployments.edges.map((e: { node: { id: string; status: string } }) => e.node);
}

export async function redeployService(token: string, serviceId: string, environmentId: string): Promise<void> {
  await railwayQuery(token, `
    mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
  `, { serviceId, environmentId });
}
