export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const ano = url.searchParams.get('ano') === '2022' ? '2022' : '2026';
  const uf = (url.searchParams.get('uf') || 'br').toLowerCase();

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };

  if (path === '/api/health') {
    return new Response(
      JSON.stringify({ status: 'ok', servico: 'apuracao_eleicao_cloudflare_edge', eleicoes_suportadas: [2026, 2022] }),
      { status: 200, headers }
    );
  }

  if (path === '/api/resultados' || path === '/api/regioes' || path === '/api/horarios') {
    const assetUrl = new URL(`/data/resultados-${ano}.json`, url.origin);
    const resp = await context.env.ASSETS.fetch(assetUrl);
    return new Response(resp.body, { status: resp.status, headers });
  }

  if (path === '/api/tse-raw') {
    const assetUrl = new URL(`/data/tse-raw-${ano}-${uf}.json`, url.origin);
    const resp = await context.env.ASSETS.fetch(assetUrl);
    return new Response(resp.body, { status: resp.status, headers });
  }

  if (path === '/api/log-exemplo') {
    const assetUrl = new URL(`/data/log-exemplo.json`, url.origin);
    const resp = await context.env.ASSETS.fetch(assetUrl);
    return new Response(resp.body, { status: resp.status, headers });
  }

  return new Response(JSON.stringify({ erro: `Rota não encontrada: ${path}` }), { status: 404, headers });
}

