// Genkit API is disabled for this deployment
export async function GET() {
  return new Response('Genkit endpoint disabled - using local simulation', { status: 501 });
}

export async function POST() {
  return new Response('Genkit endpoint disabled - using local simulation', { status: 501 });
}
