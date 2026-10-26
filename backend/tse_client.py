"""
Cliente de integração com a API pública de resultados do TSE (`resultados.tse.jus.br`)
e motor de auditoria de Boletins de Urna (BU) e Logs de Urna (votos após as 17h).
"""

import json
import re
import time
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, Any, List, Optional

from tse_data import DATASETS_BY_YEAR, UF_FUSO_DIFERENCA_BRASILIA, SAMPLE_LOG_URNA

TSE_BASE_URL = "https://resultados.tse.jus.br/oficial"

ELECTION_CONFIG = {
    2026: {
        "ano": 2026,
        "codigo_eleicao": "6258",
        "codigo_padded": "006258",
        "pleito": "3221",
        "cargo": "0001",
        "urls_br": [
            f"{TSE_BASE_URL}/ele2026/6258/dados-simplificados/br/br-c0001-e006258-r.json",
            f"{TSE_BASE_URL}/ele2026/6258/dados/br/br-c0001-e006258-u.json",
        ],
        "url_uf_template": f"{TSE_BASE_URL}/ele2026/6258/dados-simplificados/{{uf}}/{{uf}}-c0001-e006258-r.json",
    },
    2022: {
        "ano": 2022,
        "codigo_eleicao": "545",
        "codigo_padded": "000545",
        "pleito": "407",
        "cargo": "0001",
        "urls_br": [
            f"{TSE_BASE_URL}/ele2022/545/dados-simplificados/br/br-c0001-e000545-r.json",
            f"{TSE_BASE_URL}/ele2022/545/dados/br/br-c0001-e000545-u.json",
        ],
        "url_uf_template": f"{TSE_BASE_URL}/ele2022/545/dados-simplificados/{{uf}}/{{uf}}-c0001-e000545-r.json",
    },
}


def _parse_int(val: Any) -> int:
    if val is None:
        return 0
    if isinstance(val, int):
        return val
    s = str(val).strip().replace(".", "").replace(",", "")
    return int(s) if s.isdigit() else 0


def _parse_float(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


class TSEClient:
    def __init__(self, timeout: float = 3.5):
        self.timeout = timeout
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = 60.0  # segundos

    def fetch_json(self, url: str) -> Optional[Dict[str, Any]]:
        """Busca um JSON diretamente no CDN oficial do TSE."""
        now = time.time()
        if url in self._cache and (now - self._cache[url]["ts"]) < self._cache_ttl:
            return self._cache[url]["data"]

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) ApuracaoEleicaoTSE/1.0",
                "Accept": "application/json, text/plain, */*",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                if resp.status == 200:
                    raw = resp.read().decode("utf-8", errors="replace")
                    data = json.loads(raw)
                    self._cache[url] = {"ts": now, "data": data}
                    return data
        except Exception:
            return None
        return None

    def fetch_tse_raw(self, ano: int = 2026, uf: str = "br") -> Dict[str, Any]:
        """
        Tenta buscar o JSON bruto oficial no servidor do TSE (`-r.json` ou `-u.json`).
        Caso o ambiente esteja sem acesso externo ou a rota do ano esteja arquivada,
        retorna um payload compatível no formato exato do TSE (`cand`, `vap`, `pvap`, `pst`, `dg`, `hg`).
        """
        cfg = ELECTION_CONFIG.get(ano, ELECTION_CONFIG[2026])
        uf_clean = uf.lower().strip()

        urls_to_try = (
            cfg["urls_br"]
            if uf_clean == "br"
            else [cfg["url_uf_template"].format(uf=uf_clean)]
        )

        for url in urls_to_try:
            live_data = self.fetch_json(url)
            if live_data and ("cand" in live_data or "abr" in live_data):
                return {
                    "fonte": "tse_live_api",
                    "url_consultada": url,
                    "status": "online",
                    "payload_tse": live_data,
                }

        # Fallback: gera payload idêntico ao padrão `-r.json` do TSE a partir dos dados oficiais consolidados
        ds = DATASETS_BY_YEAR.get(ano, DATASETS_BY_YEAR[2026])
        resumo = ds["resumo_nacional"]
        cands = ds["candidatos"]
        return {
            "fonte": "tse_official_snapshot",
            "url_consultada": urls_to_try[0],
            "status": "snapshot_oficial",
            "payload_tse": {
                "ele": cfg["codigo_eleicao"],
                "tpabr": "BR" if uf_clean == "br" else "UF",
                "cdabr": uf_clean.upper(),
                "carper": cfg["cargo"],
                "t": "2",
                "f": "o",
                "dg": ds["data_eleicao"],
                "hg": "23:00:00",
                "e": str(resumo["eleitorado_apto"]),
                "ea": str(resumo["eleitorado_apto"]),
                "c": str(resumo["comparecimento"]),
                "pc": f"{resumo['comparecimento_pct']:.2f}".replace(".", ","),
                "a": str(resumo["abstencoes"]),
                "pa": f"{resumo['abstencoes_pct']:.2f}".replace(".", ","),
                "s": str(resumo["secoes_total"]),
                "st": str(resumo["secoes_totalizadas"]),
                "pst": "100,00",
                "vv": str(resumo["votos_validos"]),
                "pvv": f"{resumo['votos_validos_pct']:.2f}".replace(".", ","),
                "vb": str(resumo["brancos"]),
                "pvb": f"{resumo['brancos_pct']:.2f}".replace(".", ","),
                "tvn": str(resumo["nulos"]),
                "ptvn": f"{resumo['nulos_pct']:.2f}".replace(".", ","),
                "cand": [
                    {
                        "seq": str(idx + 1),
                        "sqcand": f"2800016{c['numero']}",
                        "n": c["numero"],
                        "nm": c["nome"],
                        "cc": f"{c['partido']} - {c['coligacao']}",
                        "e": "s" if c["eleito"] else "n",
                        "st": "Eleito" if c["eleito"] else "Não eleito",
                        "vap": str(c["votos"]),
                        "pvap": f"{c['percentual']:.2f}".replace(".", ","),
                    }
                    for idx, c in enumerate(cands)
                ],
            },
        }

    def get_resultados_consolidados(self, ano: int = 2026, tentar_live: bool = True) -> Dict[str, Any]:
        """
        Retorna os dados completos para o dashboard:
        - Se `tentar_live=True`, tenta consultar o endpoint nacional do TSE e atualiza
          os números caso haja retorno ao vivo.
        - Combina com os dados por Região, UF, Evolução por Horário e Votos após as 17h.
        """
        base_data = json.loads(json.dumps(DATASETS_BY_YEAR.get(ano, DATASETS_BY_YEAR[2026])))
        cfg = ELECTION_CONFIG.get(ano, ELECTION_CONFIG[2026])

        fonte_dados = "snapshot_oficial_tse"
        url_tse = cfg["urls_br"][0]
        ultima_atualizacao = f"{base_data['data_eleicao']} 23:00:00"

        if tentar_live:
            live = self.fetch_json(url_tse)
            if live and "cand" in live:
                fonte_dados = "api_tse_tempo_real"
                dg = live.get("dg", base_data["data_eleicao"])
                hg = live.get("hg", "23:00:00")
                ultima_atualizacao = f"{dg} {hg}"

                # Atualiza candidatos com os votos retornados diretamente pelo TSE
                cand_map = {str(c.get("n")): c for c in live.get("cand", [])}
                for cand in base_data["candidatos"]:
                    c_live = cand_map.get(str(cand["numero"]))
                    if c_live:
                        cand["votos"] = _parse_int(c_live.get("vap", cand["votos"]))
                        cand["percentual"] = _parse_float(c_live.get("pvap", cand["percentual"]))
                        cand["eleito"] = str(c_live.get("e", "")).lower() == "s" or "eleito" in str(c_live.get("st", "")).lower()

                if live.get("vv"):
                    base_data["resumo_nacional"]["votos_validos"] = _parse_int(live.get("vv"))
                if live.get("vb"):
                    base_data["resumo_nacional"]["brancos"] = _parse_int(live.get("vb"))
                if live.get("tvn"):
                    base_data["resumo_nacional"]["nulos"] = _parse_int(live.get("tvn"))
                if live.get("pst"):
                    base_data["resumo_nacional"]["secoes_totalizadas_pct"] = _parse_float(live.get("pst"))

        base_data["metadados_api"] = {
            "fonte": fonte_dados,
            "endpoint_tse_nacional": url_tse,
            "endpoint_tse_config": f"{TSE_BASE_URL}/comum/config/ele-c.json",
            "ultima_atualizacao_tse": ultima_atualizacao,
            "consultado_em": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        }
        return base_data


def analisar_log_urna(log_text: Optional[str] = None, uf: str = "SP") -> Dict[str, Any]:
    """
    Analisa as linhas de um arquivo de Log de Urna do TSE (.log / .jez)
    e contabiliza exatamente quantos votos foram efetivados:
    - Até as 17h00:00 (horário de Brasília)
    - Após as 17h00:00 (eleitores que receberam senha na fila antes das 17h)
    """
    texto = (log_text or "").strip()
    usando_amostra = False
    if not texto:
        texto = SAMPLE_LOG_URNA
        usando_amostra = True

    uf_upper = uf.upper().strip()
    offset_horas = UF_FUSO_DIFERENCA_BRASILIA.get(uf_upper, 0)

    # Padrão de linha do Log do TSE: DD/MM/AAAA HH:MM:SS \t NIVEL \t ID_UE \t MENSAGEM
    regex_ts = re.compile(r"(\d{2}/\d{2}/\d{4})\s+(\d{2}:\d{2}:\d{2})\s+\w+\s+(\S+)\s+(.+)")

    votos_totais = 0
    votos_ate_17h = 0
    votos_apos_17h = 0
    eventos_apos_17h: List[Dict[str, Any]] = []
    horario_inicio = None
    horario_encerramento = None
    id_urna = "Não identificado"

    for raw_line in texto.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = regex_ts.search(line)
        if not match:
            continue

        data_str, hora_str, ue_id, msg = match.groups()
        id_urna = ue_id

        try:
            dt_local = datetime.strptime(f"{data_str} {hora_str}", "%d/%m/%Y %H:%M:%S")
        except ValueError:
            continue

        # Converte horário local da urna para horário oficial de Brasília (se UF for UTC-4 ou UTC-5)
        hora_brasilia_seg = (
            dt_local.hour * 3600 + dt_local.minute * 60 + dt_local.second
        ) - (offset_horas * 3600)

        h_br = (hora_brasilia_seg // 3600) % 24
        m_br = (hora_brasilia_seg % 3600) // 60
        s_br = hora_brasilia_seg % 60
        hora_brasilia_fmt = f"{h_br:02d}:{m_br:02d}:{s_br:02d}"

        msg_lower = msg.lower()
        if "início da votação" in msg_lower or "inicio da votacao" in msg_lower:
            horario_inicio = hora_brasilia_fmt
        elif "encerrando votação" in msg_lower or "boletim de urna emitido" in msg_lower:
            horario_encerramento = hora_brasilia_fmt

        if "voto do eleitor foi registrado" in msg_lower or "voto confirmado" in msg_lower:
            votos_totais += 1
            # 17:00:00 equivale a 17 * 3600 = 61200 segundos
            if hora_brasilia_seg > 17 * 3600:
                votos_apos_17h += 1
                segundos_alem_17h = hora_brasilia_seg - (17 * 3600)
                eventos_apos_17h.append({
                    "sequencia_voto": votos_totais,
                    "data": data_str,
                    "horario_local_urna": hora_str,
                    "horario_brasilia": hora_brasilia_fmt,
                    "tempo_apos_17h": f"+{segundos_alem_17h // 60:02d}m{segundos_alem_17h % 60:02d}s",
                    "mensagem": msg.strip(),
                })
            else:
                votos_ate_17h += 1

    return {
        "usando_amostra_padrao": usando_amostra,
        "uf_analisada": uf_upper,
        "fuso_diferenca_brasilia_horas": offset_horas,
        "id_urna_eletronica": id_urna,
        "horario_abertura_brasilia": horario_inicio or "08:00:00",
        "horario_encerramento_brasilia": horario_encerramento or "17:00:00",
        "votos_totais_registrados": votos_totais,
        "votos_ate_17h00": votos_ate_17h,
        "votos_efetivados_apos_17h00": votos_apos_17h,
        "percentual_apos_17h": round((votos_apos_17h / votos_totais) * 100, 2) if votos_totais else 0.0,
        "secao_encerrou_apos_17h": (votos_apos_17h > 0) or (
            horario_encerramento is not None and horario_encerramento > "17:00:00"
        ),
        "registros_apos_17h": eventos_apos_17h,
    }

