export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('Fetching REGISTRY_HOST:', process.env.REGISTRY_HOST);

  return Response.json({
    registryHost: process.env.REGISTRY_HOST || 'your-private-registry',
  });
}
