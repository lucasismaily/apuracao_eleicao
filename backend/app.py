"""
Servidor Back-end em Python para Apuração de Eleições Presidenciais (2º Turno) - TSE.

Suporta execução dupla:
1. Com FastAPI + Uvicorn (se instalado no ambiente virtual): `uvicorn app:app --reload --port 8000`
2. Nativo (Zero dependências externas, usando biblioteca padrão do Python): `python3 app.py`
"""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from typing import Dict, Any

from tse_client import TSEClient, analisar_log_urna
from tse_data import SAMPLE_LOG_URNA

tse_client = TSEClient(timeout=3.5)


def handle_api_get(path: str, query: Dict[str, Any]) -> Dict[str, Any]:
    ano_str = str(query.get("ano", ["2026"])[0] if isinstance(query.get("ano"), list) else query.get("ano", "2026"))
    ano = int(ano_str) if ano_str in ("2026", "2022") else 2026
    live_param = str(query.get("live", ["true"])[0] if isinstance(query.get("live"), list) else query.get("live", "true")).lower()
    tentar_live = live_param != "false"

    if path == "/api/health":
        return {
            "status": "ok",
            "servico": "apuracao_eleicao_backend",
            "eleicoes_suportadas": [2026, 2022],
        }

    if path == "/api/eleicoes":
        return {
            "eleicoes": [
                {
                    "ano": 2026,
                    "turno": 2,
                    "codigo_tse": "6258",
                    "pleito": "3221",
                    "data": "25/10/2026",
                    "titulo": "Eleições 2026 - 2º Turno Presidencial",
                    "candidatos": "Lula (PT) vs Flávio Bolsonaro (PL)",
                },
                {
                    "ano": 2022,
                    "turno": 2,
                    "codigo_tse": "545",
                    "pleito": "407",
                    "data": "30/10/2022",
                    "titulo": "Eleições 2022 - 2º Turno Presidencial",
                    "candidatos": "Lula (PT) vs Jair Bolsonaro (PL)",
                },
            ]
        }

    if path == "/api/resultados":
        return tse_client.get_resultados_consolidados(ano=ano, tentar_live=tentar_live)

    if path == "/api/regioes":
        dados = tse_client.get_resultados_consolidados(ano=ano, tentar_live=False)
        regiao_filtro = query.get("regiao", [None])[0] if isinstance(query.get("regiao"), list) else query.get("regiao")
        regioes = dados["regioes"]
        ufs = dados["ufs"]
        if regiao_filtro and regiao_filtro.upper() != "TODAS":
            regioes = [r for r in regioes if r["regiao"].lower() == regiao_filtro.lower()]
            ufs = [u for u in ufs if u["regiao"].lower() == regiao_filtro.lower()]
        return {
            "ano": ano,
            "candidatos": dados["candidatos"],
            "regioes": regioes,
            "ufs": ufs,
        }

    if path == "/api/horarios":
        dados = tse_client.get_resultados_consolidados(ano=ano, tentar_live=False)
        return {
            "ano": ano,
            "candidatos": dados["candidatos"],
            "evolucao_apuracao": dados["evolucao_apuracao"],
            "apos_17h": dados["apos_17h"],
            "amostra_log_urna": SAMPLE_LOG_URNA,
        }

    if path == "/api/tse-raw":
        uf = str(query.get("uf", ["br"])[0] if isinstance(query.get("uf"), list) else query.get("uf", "br"))
        return tse_client.fetch_tse_raw(ano=ano, uf=uf)

    if path == "/api/log-exemplo":
        uf = str(query.get("uf", ["SP"])[0] if isinstance(query.get("uf"), list) else query.get("uf", "SP"))
        return {
            "log_bruto": SAMPLE_LOG_URNA,
            "analise": analisar_log_urna(SAMPLE_LOG_URNA, uf=uf),
        }

    return {"erro": f"Rota não encontrada: {path}"}


# ---------------------------------------------------------------------------
# Suporte opcional a FastAPI (caso instalado no ambiente)
# ---------------------------------------------------------------------------
try:
    from fastapi import FastAPI, Query, Body
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(
        title="Apuração Eleição Presidencial (2º Turno) - API TSE",
        description="Back-end em Python para consulta de resultados do 2º turno presidencial por região, UF, horário de totalização e votos efetivados após as 17h.",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def api_health():
        return handle_api_get("/api/health", {})

    @app.get("/api/eleicoes")
    def api_eleicoes():
        return handle_api_get("/api/eleicoes", {})

    @app.get("/api/resultados")
    def api_resultados(ano: int = Query(2026), live: bool = Query(True)):
        return handle_api_get("/api/resultados", {"ano": ano, "live": str(live)})

    @app.get("/api/regioes")
    def api_regioes(ano: int = Query(2026), regiao: str = Query("TODAS")):
        return handle_api_get("/api/regioes", {"ano": ano, "regiao": regiao})

    @app.get("/api/horarios")
    def api_horarios(ano: int = Query(2026)):
        return handle_api_get("/api/horarios", {"ano": ano})

    @app.get("/api/tse-raw")
    def api_tse_raw(ano: int = Query(2026), uf: str = Query("br")):
        return handle_api_get("/api/tse-raw", {"ano": ano, "uf": uf})

    @app.get("/api/log-exemplo")
    def api_log_exemplo(uf: str = Query("SP")):
        return handle_api_get("/api/log-exemplo", {"uf": uf})

    @app.post("/api/analisar-log")
    def api_analisar_log(payload: Dict[str, Any] = Body(...)):
        log_text = payload.get("log_text", "")
        uf = payload.get("uf", "SP")
        return analisar_log_urna(log_text=log_text, uf=uf)

except ImportError:
    app = None


# ---------------------------------------------------------------------------
# Servidor HTTP Nativo (ThreadingHTTPServer) - roda sem depender de pacotes pip
# ---------------------------------------------------------------------------
class ApuracaoHTTPRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, data: Dict[str, Any], status: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            query = parse_qs(parsed.query)
            result = handle_api_get(parsed.path, query)
            status = 404 if "erro" in result else 200
            self._send_json(result, status=status)
            return

        # Serve o build do React (frontend/dist) caso acessado diretamente na porta 8000
        dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
        req_path = parsed.path.lstrip("/") or "index.html"
        full_path = os.path.abspath(os.path.join(dist_dir, req_path))
        if full_path.startswith(dist_dir) and os.path.isfile(full_path):
            ext = os.path.splitext(full_path)[1].lower()
            mime_map = {
                ".html": "text/html; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".json": "application/json; charset=utf-8",
                ".svg": "image/svg+xml",
                ".png": "image/png",
            }
            with open(full_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_map.get(ext, "application/octet-stream"))
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        self._send_json(
            {
                "servico": "Apuração Eleições Presidenciais (2º Turno) - Back-end Python TSE",
                "rotas": [
                    "/api/resultados?ano=2026",
                    "/api/regioes?ano=2026",
                    "/api/horarios?ano=2026",
                    "/api/tse-raw?ano=2026&uf=br",
                    "/api/log-exemplo?uf=SP",
                ],
            },
            status=200,
        )

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/analisar-log":
            content_len = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_len).decode("utf-8", errors="replace") if content_len > 0 else "{}"
            try:
                payload = json.loads(raw_body)
            except json.JSONDecodeError:
                payload = {}
            res = analisar_log_urna(
                log_text=payload.get("log_text", ""),
                uf=payload.get("uf", "SP"),
            )
            self._send_json(res, status=200)
        else:
            self._send_json({"erro": f"Rota POST não encontrada: {parsed.path}"}, status=404)

    def log_message(self, format: str, *args: Any):
        # Log conciso no terminal
        print(f"[TSE-Backend] {self.address_string()} - {format % args}")


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


def run_server(port: int = 8765):
    if app is not None:
        try:
            import uvicorn
            print(f"Iniciando servidor FastAPI/Uvicorn em http://127.0.0.1:{port} ...")
            uvicorn.run(app, host="127.0.0.1", port=port)
            return
        except ImportError:
            pass

    server = ReusableThreadingHTTPServer(("127.0.0.1", port), ApuracaoHTTPRequestHandler)
    print(f"Servidor Python Apuração TSE rodando em http://127.0.0.1:{port}")
    print("Rotas disponíveis:")
    print("  GET  /api/resultados?ano=2026")
    print("  GET  /api/regioes?ano=2026")
    print("  GET  /api/horarios?ano=2026")
    print("  GET  /api/tse-raw?ano=2026&uf=br")
    print("  POST /api/analisar-log")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")
        server.server_close()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    run_server(port=port)
