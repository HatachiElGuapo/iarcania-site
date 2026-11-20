import { execSync } from "node:child_process";

// deploymentId estable por build (el commit) — Next.js lo usa para que un
// bundle viejo en el navegador (de un deploy anterior) nunca intente
// resolver una Server Action contra el server nuevo: detecta el cambio de
// versión y fuerza una navegación dura en vez del "Failed to find Server
// Action" que antes solo se podía atrapar a mano (ver stale-action-guard.tsx
// para la red de seguridad del lado del cliente). Usa NEXT_DEPLOYMENT_ID si
// el pipeline de deploy ya lo define (ej. el SHA del commit en CI); si no,
// cae al commit actual del repo — estable mientras no se vuelva a buildear.
function resolveDeploymentId() {
  if (process.env.NEXT_DEPLOYMENT_ID) return process.env.NEXT_DEPLOYMENT_ID;
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return undefined;
  }
}

const deploymentId = resolveDeploymentId();
if (deploymentId) process.env.NEXT_DEPLOYMENT_ID = deploymentId;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  deploymentId,
};

export default nextConfig;
