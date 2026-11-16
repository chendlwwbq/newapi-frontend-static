export function GET() {
  return Response.json({ status: 'ok', service: 'eva-frontend' }, { headers: { 'Cache-Control': 'no-store' } })
}
