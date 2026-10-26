import React, { useState, useEffect, useMemo } from 'react';
import { Post17hBarChart, EvolutionLineChart } from './components/Charts.jsx';

const API_BASE = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8765';

const fmtInt = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtPct = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')}%`;

export default function App() {
  const [ano, setAno] = useState(2026);
  const [activeTab, setActiveTab] = useState('pos17h');
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  // Filtros e ordenação de Região / UF
  const [regiaoSelecionada, setRegiaoSelecionada] = useState('TODAS');
  const [buscaUf, setBuscaUf] = useState('');
  const [ordenacaoUf, setOrdenacaoUf] = useState({ campo: 'votos_validos', asc: false });
  const [ufEmFoco, setUfEmFoco] = useState(null);

  // Auditor de Log de Urna (Pós-17h) & JSON bruto TSE
  const [logText, setLogText] = useState('');
  const [ufLog, setUfLog] = useState('SP');
  const [resultadoLog, setResultadoLog] = useState(null);
  const [tseRaw, setTseRaw] = useState(null);
  const [ufRaw, setUfRaw] = useState('br');

  const carregarDados = async (anoAlvo = ano) => {
    setLoading(true);
    setErro(null);
    try {
      const resp = await fetch(`${API_BASE}/api/resultados?ano=${anoAlvo}&live=true`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setDados(json);
      if (json?.ufs?.length > 0) {
        setUfEmFoco(json.ufs[0]);
      }
    } catch (e) {
      setErro(`Não foi possível conectar ao back-end Python em ${API_BASE}. Verifique se o servidor está rodando.`);
    } finally {
      setLoading(false);
    }
  };

  const carregarExemploLog = async (ufAlvo = ufLog) => {
    try {
      const resp = await fetch(`${API_BASE}/api/log-exemplo?uf=${ufAlvo}`);
      if (resp.ok) {
        const json = await resp.json();
        setLogText(json.log_bruto || '');
        setResultadoLog(json.analise || null);
      }
    } catch (_) {
      // ignora erro silenciosamente
    }
  };

  const analisarLogCustom = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/analisar-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_text: logText, uf: ufLog }),
      });
      if (resp.ok) {
        const json = await resp.json();
        setResultadoLog(json);
      }
    } catch (_) {
      // ignora
    }
  };

  const carregarTseRaw = async (anoAlvo = ano, ufAlvo = ufRaw) => {
    try {
      const resp = await fetch(`${API_BASE}/api/tse-raw?ano=${anoAlvo}&uf=${ufAlvo}`);
      if (resp.ok) {
        const json = await resp.json();
        setTseRaw(json);
      }
    } catch (_) {
      // ignora
    }
  };

  useEffect(() => {
    carregarDados(ano);
    carregarTseRaw(ano, ufRaw);
  }, [ano]);

  useEffect(() => {
    carregarExemploLog('SP');
  }, []);

  const cand1 = dados?.candidatos?.[0];
  const cand2 = dados?.candidatos?.[1];
  const resumo = dados?.resumo_nacional;
  const apos17h = dados?.apos_17h;

  const alternarOrdenacao = (campo) => {
    setOrdenacaoUf((prev) => ({
      campo,
      asc: prev.campo === campo ? !prev.asc : false,
    }));
  };

  const ufsFiltradas = useMemo(() => {
    if (!dados?.ufs) return [];
    const filtradas = dados.ufs.filter((u) => {
      const matchRegiao =
        regiaoSelecionada === 'TODAS' || u.regiao.toLowerCase() === regiaoSelecionada.toLowerCase();
      const termo = buscaUf.trim().toLowerCase();
      const matchBusca =
        !termo ||
        u.uf.toLowerCase().includes(termo) ||
        u.nome.toLowerCase().includes(termo) ||
        u.regiao.toLowerCase().includes(termo);
      return matchRegiao && matchBusca;
    });

    return [...filtradas].sort((a, b) => {
      const valA = a[ordenacaoUf.campo];
      const valB = b[ordenacaoUf.campo];
      if (typeof valA === 'string') {
        return ordenacaoUf.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return ordenacaoUf.asc ? valA - valB : valB - valA;
    });
  }, [dados, regiaoSelecionada, buscaUf, ordenacaoUf]);

  if (loading && !dados) {
    return (
      <div className="app-container" style={{ textAlign: 'center', paddingTop: '90px' }}>
        <h2>Carregando dados oficiais de apuração do TSE...</h2>
      </div>
    );
  }

  if (erro && !dados) {
    return (
      <div className="app-container" style={{ paddingTop: '60px' }}>
        <div className="section-card" style={{ borderColor: '#e11d48' }}>
          <h2 style={{ color: '#e11d48', marginBottom: '10px' }}>Erro de conexão com o Back-end Python</h2>
          <p style={{ marginBottom: '16px' }}>{erro}</p>
          <button className="btn-primary" onClick={() => carregarDados(ano)}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Cabeçalho Glassmorphic Fixo */}
      <header className="top-header">
        <div className="brand-area">
          <div className="tse-badge">TSE • 2º Turno</div>
          <div className="brand-title">
            <h1>Apuração Presidencial — Região, Horário e Pós-17h</h1>
            <p>
              {dados?.descricao} • Pleito TSE <strong>#{dados?.codigo_eleicao}</strong> •{' '}
              <strong>{dados?.data_eleicao}</strong>
            </p>
          </div>
        </div>

        <div className="header-controls">
          <div className="year-selector">
            <button
              className={`year-btn ${ano === 2026 ? 'active' : ''}`}
              onClick={() => setAno(2026)}
            >
              Eleição 2026 (2ºT)
            </button>
            <button
              className={`year-btn ${ano === 2022 ? 'active' : ''}`}
              onClick={() => setAno(2022)}
            >
              Eleição 2022 (2ºT)
            </button>
          </div>

          <div className="status-pill" title={`Endpoint: ${dados?.metadados_api?.endpoint_tse_nacional}`}>
            <span className="status-dot" />
            <span>
              {dados?.metadados_api?.fonte === 'api_tse_tempo_real'
                ? 'API TSE Online'
                : '100% Seções Totalizadas'}
            </span>
          </div>

          <button className="btn-refresh" onClick={() => carregarDados(ano)}>
            ↻ Atualizar
          </button>
        </div>
      </header>

      {/* Hero Scoreboard + Cabo de Guerra */}
      <section className="hero-scoreboard">
        <div className="scoreboard-grid">
          {cand1 && (
            <div className="candidate-card cand-1">
              <div className="candidate-top">
                <div className="cand-avatar-row">
                  <div className="cand-avatar">{cand1.numero}</div>
                  <div>
                    <span className="cand-number-badge">{cand1.partido} • Nº {cand1.numero}</span>
                    <div className="cand-name">{cand1.nome}</div>
                    <div className="cand-party">{cand1.nome_completo}</div>
                  </div>
                </div>
                {cand1.eleito && <span className="eleito-badge">✓ Eleito</span>}
              </div>
              <div className="cand-stats">
                <div className="cand-pct">{fmtPct(cand1.percentual)}</div>
                <div className="cand-votes">{fmtInt(cand1.votos)} votos válidos</div>
              </div>
            </div>
          )}

          {cand2 && (
            <div className="candidate-card cand-2">
              <div className="candidate-top">
                <div className="cand-avatar-row">
                  <div className="cand-avatar">{cand2.numero}</div>
                  <div>
                    <span className="cand-number-badge">{cand2.partido} • Nº {cand2.numero}</span>
                    <div className="cand-name">{cand2.nome}</div>
                    <div className="cand-party">{cand2.nome_completo}</div>
                  </div>
                </div>
                {cand2.eleito && <span className="eleito-badge">✓ Eleito</span>}
              </div>
              <div className="cand-stats">
                <div className="cand-pct">{fmtPct(cand2.percentual)}</div>
                <div className="cand-votes">{fmtInt(cand2.votos)} votos válidos</div>
              </div>
            </div>
          )}
        </div>

        {/* Barra Cabo de Guerra (50% Maioria no Centro) */}
        {cand1 && cand2 && resumo && (
          <div className="tug-of-war-wrapper">
            <div className="tug-header">
              <span style={{ color: '#e11d48' }}>
                ◀ {cand1.nome} ({fmtPct(cand1.percentual)})
              </span>
              <span>
                Maioria Absoluta (50%+1) • Vantagem de{' '}
                <strong style={{ color: '#0f172a' }}>{fmtInt(resumo.diferenca_votos)} votos</strong> ({fmtPct(resumo.diferenca_pct)})
              </span>
              <span style={{ color: '#2563eb' }}>
                ({fmtPct(cand2.percentual)}) {cand2.nome} ▶
              </span>
            </div>
            <div className="tug-bar-outer">
              <div className="tug-fill-c1" style={{ width: `${cand1.percentual}%` }} />
              <div className="tug-fill-c2" style={{ width: `${cand2.percentual}%` }} />
              <div className="tug-center-marker" title="Marca de 50,00% dos votos válidos" />
            </div>
          </div>
        )}
      </section>

      {/* Strip de Indicadores Gerais */}
      {resumo && (
        <section className="kpi-strip">
          <div className="kpi-box">
            <div className="kpi-label">Votos Válidos</div>
            <div className="kpi-value">{fmtInt(resumo.votos_validos)}</div>
            <div className="kpi-sub">{fmtPct(resumo.votos_validos_pct)} do comparecimento</div>
          </div>
          <div
            className="kpi-box"
            style={{ borderColor: '#f59e0b', background: '#fffdf5', cursor: 'pointer' }}
            onClick={() => setActiveTab('pos17h')}
          >
            <div className="kpi-label" style={{ color: '#b45309' }}>⏱ Votos na Urna Após 17h00</div>
            <div className="kpi-value" style={{ color: '#b45309' }}>
              {fmtInt(apos17h?.votos_efetivados_na_urna_apos_17h)}
            </div>
            <div className="kpi-sub">
              {fmtPct(apos17h?.pct_sobre_comparecimento)} dos eleitores (fila com senha)
            </div>
          </div>
          <div
            className="kpi-box"
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('pos17h')}
          >
            <div className="kpi-label">Seções Encerradas &gt; 17h</div>
            <div className="kpi-value">{fmtInt(apos17h?.secoes_encerradas_apos_17h)}</div>
            <div className="kpi-sub">
              {fmtPct(apos17h?.pct_secoes_encerradas_apos_17h)} de {fmtInt(resumo.secoes_total)} seções
            </div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Votos em Seções &gt; 17h (BU)</div>
            <div className="kpi-value">
              {fmtInt(apos17h?.votos_totais_em_secoes_encerradas_apos_17h)}
            </div>
            <div className="kpi-sub">
              {fmtPct(apos17h?.pct_votos_secoes_apos_17h)} dos votos válidos do país
            </div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Brancos e Nulos</div>
            <div className="kpi-value">{fmtInt(resumo.brancos + resumo.nulos)}</div>
            <div className="kpi-sub">
              Brancos: {fmtPct(resumo.brancos_pct)} • Nulos: {fmtPct(resumo.nulos_pct)}
            </div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Comparecimento / Abstenção</div>
            <div className="kpi-value">{fmtPct(resumo.comparecimento_pct)}</div>
            <div className="kpi-sub">Abstenção: {fmtPct(resumo.abstencoes_pct)} ({fmtInt(resumo.abstencoes)})</div>
          </div>
        </section>
      )}

      {/* Abas de Navegação Segmentadas */}
      <nav className="nav-tabs">
        <button
          className={`tab-btn highlight-17h ${activeTab === 'pos17h' ? 'active' : ''}`}
          onClick={() => setActiveTab('pos17h')}
        >
          <span>⏱</span> Votos Após as 17h (Destaque)
        </button>
        <button
          className={`tab-btn ${activeTab === 'regioes' ? 'active' : ''}`}
          onClick={() => setActiveTab('regioes')}
        >
          <span>🗺</span> Resultados por Região e UF
        </button>
        <button
          className={`tab-btn ${activeTab === 'horarios' ? 'active' : ''}`}
          onClick={() => setActiveTab('horarios')}
        >
          <span>📈</span> Evolução por Horário (Replay)
        </button>
        <button
          className={`tab-btn ${activeTab === 'auditor' ? 'active' : ''}`}
          onClick={() => setActiveTab('auditor')}
        >
          <span>🔍</span> Auditor de Log de Urna & API TSE
        </button>
      </nav>

      {/* ABA 1: VOTOS EFETIVADOS APÓS AS 17H */}
      {activeTab === 'pos17h' && apos17h && (
        <div className="fade-in">
          <div className="pos17h-banner">
            <div className="pos17h-header">
              <div className="pos17h-title">
                <span>⏱</span>
                <span>Quantos votos foram efetivados após as 17h00?</span>
              </div>
              <span className="region-share-badge">
                Horário Unificado de Brasília (Resolução TSE nº 23.669)
              </span>
            </div>

            <p className="pos17h-desc">{apos17h.explicacao_tecnica}</p>

            <div className="pos17h-metrics-grid">
              <div className="pos17h-metric-card primary-highlight">
                <span className="metric-tag tag-amber">1. Voto Individual na Urna (&gt; 17:00:00)</span>
                <div className="metric-big-number">
                  {fmtInt(apos17h.votos_efetivados_na_urna_apos_17h)} votos
                </div>
                <div className="metric-explain">
                  <strong>{fmtPct(apos17h.pct_sobre_comparecimento)}</strong> do comparecimento total. Eleitores que já estavam na fila às 17h00, receberam senha da mesa receptora e confirmaram o voto na urna eletrônica após as 17h00:00 (auditado via <code>Log de Urna</code>).
                </div>
              </div>

              <div className="pos17h-metric-card">
                <span className="metric-tag tag-purple">2. Seções com BU Emitido Após 17h00</span>
                <div className="metric-big-number">
                  {fmtInt(apos17h.votos_totais_em_secoes_encerradas_apos_17h)} votos
                </div>
                <div className="metric-explain">
                  Votos válidos contidos nas <strong>{fmtInt(apos17h.secoes_encerradas_apos_17h)} seções</strong> ({fmtPct(apos17h.pct_secoes_encerradas_apos_17h)} das urnas) cujo Boletim de Urna foi encerrado após as 17h00. Nessas seções: <strong style={{ color: '#e11d48' }}>{cand1?.nome} {fmtPct(apos17h.c1_pct_secoes_apos_17h)}</strong> vs <strong style={{ color: '#2563eb' }}>{cand2?.nome} {fmtPct(apos17h.c2_pct_secoes_apos_17h)}</strong>.
                </div>
              </div>

              <div className="pos17h-metric-card">
                <span className="metric-tag tag-emerald">3. Totalização Oficial TSE Após 17h00</span>
                <div className="metric-big-number">
                  {fmtInt(apos17h.votos_totalizados_tse_apos_17h)} votos
                </div>
                <div className="metric-explain">
                  <strong>100,00%</strong> dos votos válidos foram apurados/totalizados pelos servidores do TSE após as 17h00, pois a transmissão e abertura da totalização só inicia após o fechamento nacional às 17h00 (Brasília).
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico Interativo + Donut por Faixa Horária Pós-17h */}
          <div className="section-card">
            <div className="section-header">
              <div>
                <h3 className="section-title">
                  Análise Dinâmica por Faixa de Horário Pós-17h00
                </h3>
                <p className="section-subtitle">
                  Interaja com as faixas de horário abaixo para visualizar o volume de votos e a divisão por candidato
                </p>
              </div>
            </div>
            <Post17hBarChart faixas={apos17h.faixas_horarias} cand1={cand1} cand2={cand2} />
          </div>

          {/* Tabela de Votos Pós-17h por Região */}
          <div className="section-card">
            <div className="section-header">
              <div>
                <h3 className="section-title">Votos Efetivados Após as 17h00 por Região</h3>
                <p className="section-subtitle">
                  Clique em uma região para abrir diretamente o detalhamento de seus estados
                </p>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Região</th>
                    <th>Total de Seções</th>
                    <th>Seções Encerradas &gt; 17h</th>
                    <th>% Seções &gt; 17h</th>
                    <th>Votos na Urna Após 17h (Log)</th>
                    <th>Votos Totais nas Seções &gt; 17h (BU)</th>
                    <th>Placar Regional ({cand1?.nome} vs {cand2?.nome})</th>
                  </tr>
                </thead>
                <tbody>
                  {apos17h.por_regiao.map((r) => (
                    <tr
                      key={r.regiao}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setRegiaoSelecionada(r.regiao);
                        setActiveTab('regioes');
                      }}
                    >
                      <td>
                        <strong style={{ color: '#2563eb' }}>{r.regiao} ↗</strong>
                      </td>
                      <td>{fmtInt(r.secoes_total)}</td>
                      <td>{fmtInt(r.secoes_encerradas_apos_17h)}</td>
                      <td>{fmtPct(r.pct_secoes_apos_17h)}</td>
                      <td style={{ color: '#b45309', fontWeight: 800 }}>
                        {fmtInt(r.votos_log_apos_17h)}
                      </td>
                      <td>{fmtInt(r.votos_secoes_apos_17h)}</td>
                      <td>
                        <div className="dual-bar-container">
                          <div className="dual-bar-labels">
                            <span style={{ color: '#e11d48' }}>{fmtPct(r.c1_pct_regiao)}</span>
                            <span style={{ color: '#2563eb' }}>{fmtPct(r.c2_pct_regiao)}</span>
                          </div>
                          <div className="dual-bar-track">
                            <div className="dual-bar-c1" style={{ width: `${r.c1_pct_regiao}%` }} />
                            <div className="dual-bar-c2" style={{ width: `${r.c2_pct_regiao}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: RESULTADOS POR REGIÃO E UF */}
      {activeTab === 'regioes' && dados?.regioes && (
        <div className="fade-in">
          <div className="regions-grid">
            {dados.regioes.map((reg) => {
              const isSelected = regiaoSelecionada.toLowerCase() === reg.regiao.toLowerCase();
              return (
                <div
                  key={reg.regiao}
                  className={`region-card ${isSelected ? 'selected' : ''}`}
                  onClick={() =>
                    setRegiaoSelecionada(isSelected ? 'TODAS' : reg.regiao)
                  }
                >
                  <div className="region-card-header">
                    <span className="region-name">{reg.regiao}</span>
                    <span className="region-share-badge">
                      {fmtPct(reg.participacao_nacional_pct)} do país
                    </span>
                  </div>

                  <div className="dual-bar-container" style={{ marginBottom: '12px' }}>
                    <div className="dual-bar-labels">
                      <span style={{ color: '#e11d48' }}>
                        {cand1?.nome}: {fmtPct(reg.c1_pct)} ({fmtInt(reg.c1_votos)})
                      </span>
                      <span style={{ color: '#2563eb' }}>
                        {cand2?.nome}: {fmtPct(reg.c2_pct)} ({fmtInt(reg.c2_votos)})
                      </span>
                    </div>
                    <div className="dual-bar-track" style={{ height: '10px' }}>
                      <div className="dual-bar-c1" style={{ width: `${reg.c1_pct}%` }} />
                      <div className="dual-bar-c2" style={{ width: `${reg.c2_pct}%` }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
                    <span>Votos válidos: <strong style={{ color: '#0f172a' }}>{fmtInt(reg.votos_validos)}</strong></span>
                    <span>Vantagem: <strong style={{ color: '#0f172a' }}>{fmtInt(reg.diferenca_votos)}</strong></span>
                  </div>

                  <div className="region-pos17h-box">
                    <span>⏱ Votos após 17h (Log): <strong>{fmtInt(reg.votos_log_apos_17h)}</strong></span>
                    <span>Seções &gt; 17h: <strong>{fmtInt(reg.secoes_encerradas_apos_17h)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h3 className="section-title">
                  Detalhamento por UF — {regiaoSelecionada === 'TODAS' ? 'Todas as Regiões' : regiaoSelecionada}
                </h3>
                <p className="section-subtitle">
                  Clique nos cabeçalhos da tabela para ordenar por qualquer métrica (ex: Votos &gt; 17h ou Votos Válidos)
                </p>
              </div>

              <div className="filter-bar">
                {['TODAS', 'Nordeste', 'Sudeste', 'Sul', 'Norte', 'Centro-Oeste', 'Exterior'].map((r) => (
                  <button
                    key={r}
                    className={`filter-pill ${regiaoSelecionada === r ? 'active' : ''}`}
                    onClick={() => setRegiaoSelecionada(r)}
                  >
                    {r}
                  </button>
                ))}
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar UF ou Estado (ex: MG, Bahia)..."
                  value={buscaUf}
                  onChange={(e) => setBuscaUf(e.target.value)}
                />
              </div>
            </div>

            {/* Card de Destaque da UF Selecionada */}
            {ufEmFoco && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  marginBottom: '18px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div>
                  <span className="metric-tag tag-amber">Estado Selecionado: {ufEmFoco.nome} ({ufEmFoco.uf})</span>
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    Região <strong>{ufEmFoco.regiao}</strong> • Vencedor no Estado:{' '}
                    <strong style={{ color: ufEmFoco.c1_votos > ufEmFoco.c2_votos ? '#e11d48' : '#2563eb' }}>
                      {ufEmFoco.vencedor}
                    </strong>{' '}
                    • Comparecimento: <strong>{fmtInt(ufEmFoco.comparecimento)}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div>
                    <small style={{ color: '#64748b', display: 'block', fontWeight: 700 }}>Votos na Urna &gt; 17h (Log)</small>
                    <strong style={{ color: '#b45309', fontSize: '1.1rem' }}>{fmtInt(ufEmFoco.votos_log_apos_17h)}</strong>
                  </div>
                  <div>
                    <small style={{ color: '#64748b', display: 'block', fontWeight: 700 }}>Votos em Seções &gt; 17h (BU)</small>
                    <strong style={{ color: '#0f172a', fontSize: '1.1rem' }}>{fmtInt(ufEmFoco.votos_secoes_apos_17h)}</strong>
                  </div>
                  <div>
                    <small style={{ color: '#64748b', display: 'block', fontWeight: 700 }}>Seções Encerradas &gt; 17h</small>
                    <strong style={{ color: '#0f172a', fontSize: '1.1rem' }}>
                      {fmtInt(ufEmFoco.secoes_encerradas_apos_17h)} ({fmtPct(ufEmFoco.pct_secoes_apos_17h)})
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => alternarOrdenacao('uf')}>
                      UF {ordenacaoUf.campo === 'uf' ? (ordenacaoUf.asc ? '↑' : '↓') : ''}
                    </th>
                    <th className="sortable" onClick={() => alternarOrdenacao('nome')}>
                      Estado {ordenacaoUf.campo === 'nome' ? (ordenacaoUf.asc ? '↑' : '↓') : ''}
                    </th>
                    <th>Região</th>
                    <th>Fuso (vs Brasília)</th>
                    <th className="sortable" onClick={() => alternarOrdenacao('c1_pct')}>
                      {cand1?.nome} (13) {ordenacaoUf.campo === 'c1_pct' ? (ordenacaoUf.asc ? '↑' : '↓') : ''}
                    </th>
                    <th className="sortable" onClick={() => alternarOrdenacao('c2_pct')}>
                      {cand2?.nome} (22) {ordenacaoUf.campo === 'c2_pct' ? (ordenacaoUf.asc ? '↑' : '↓') : ''}
                    </th>
                    <th>Proporção</th>
                    <th className="sortable" onClick={() => alternarOrdenacao('votos_validos')}>
                      Votos Válidos {ordenacaoUf.campo === 'votos_validos' ? (ordenacaoUf.asc ? '↑' : '↓') : ''}
                    </th>
                    <th className="sortable" onClick={() => alternarOrdenacao('votos_log_apos_17h')}>
                      Votos &gt; 17h (Log) {ordenacaoUf.campo === 'votos_log_apos_17h' ? (ordenacaoUf.asc ? '↑' : '↓') : ''}
                    </th>
                    <th className="sortable" onClick={() => alternarOrdenacao('pct_secoes_apos_17h')}>
                      Seções &gt; 17h {ordenacaoUf.campo === 'pct_secoes_apos_17h' ? (ordenacaoUf.asc ? '↑' : '↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ufsFiltradas.map((u) => (
                    <tr
                      key={u.uf}
                      onClick={() => setUfEmFoco(u)}
                      style={{
                        cursor: 'pointer',
                        background: ufEmFoco?.uf === u.uf ? '#eff6ff' : undefined,
                      }}
                    >
                      <td><strong>{u.uf}</strong></td>
                      <td><strong>{u.nome}</strong></td>
                      <td>{u.regiao}</td>
                      <td>
                        <span style={{ fontSize: '0.77rem', fontWeight: u.fuso_brasilia !== 0 ? 700 : 400, color: u.fuso_brasilia !== 0 ? '#b45309' : '#64748b' }}>
                          {u.fuso_brasilia === 0 ? 'Brasília (UTC-3)' : `${u.fuso_brasilia}h (Fechou ${17 + u.fuso_brasilia}h local)`}
                        </span>
                      </td>
                      <td style={{ color: '#e11d48', fontWeight: u.c1_votos > u.c2_votos ? 800 : 500 }}>
                        {fmtPct(u.c1_pct)} <br />
                        <small style={{ color: '#64748b' }}>{fmtInt(u.c1_votos)}</small>
                      </td>
                      <td style={{ color: '#2563eb', fontWeight: u.c2_votos > u.c1_votos ? 800 : 500 }}>
                        {fmtPct(u.c2_pct)} <br />
                        <small style={{ color: '#64748b' }}>{fmtInt(u.c2_votos)}</small>
                      </td>
                      <td>
                        <div className="dual-bar-container">
                          <div className="dual-bar-track">
                            <div className="dual-bar-c1" style={{ width: `${u.c1_pct}%` }} />
                            <div className="dual-bar-c2" style={{ width: `${u.c2_pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{fmtInt(u.votos_validos)}</td>
                      <td style={{ color: '#b45309', fontWeight: 800 }}>{fmtInt(u.votos_log_apos_17h)}</td>
                      <td>
                        {fmtInt(u.secoes_encerradas_apos_17h)} ({fmtPct(u.pct_secoes_apos_17h)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: EVOLUÇÃO DA APURAÇÃO POR HORÁRIO (17H ÀS 23H) */}
      {activeTab === 'horarios' && dados?.evolucao_apuracao && (
        <div className="fade-in">
          <div className="section-card">
            <div className="section-header">
              <div>
                <h3 className="section-title">
                  Simulador & Curva de Evolução da Totalização no TSE por Horário (17h00 às 23h00)
                </h3>
                <p className="section-subtitle">
                  Use o botão de Replay ou arraste o controle deslizante para acompanhar como os votos entraram após as 17h00
                </p>
              </div>
            </div>

            <EvolutionLineChart
              evolucao={dados.evolucao_apuracao}
              cand1={cand1}
              cand2={cand2}
            />
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h3 className="section-title">
                  Tabela Cronológica de Lotes de Votos Totalizados Após as 17h00
                </h3>
                <p className="section-subtitle">
                  Evolução minuto a minuto da chegada dos Boletins de Urna aos servidores do TSE
                </p>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Horário (Brasília)</th>
                    <th>% Urnas Totalizadas</th>
                    <th>Votos no Intervalo</th>
                    <th>Votos Acumulados</th>
                    <th>{cand1?.nome} (13)</th>
                    <th>{cand2?.nome} (22)</th>
                    <th>Marco / Evento na Apuração</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.evolucao_apuracao.map((ev) => {
                    const isMarco =
                      ev.evento.toUpperCase().includes('VIRADA') ||
                      ev.evento.toUpperCase().includes('DEFINIDA');
                    return (
                      <tr
                        key={ev.horario}
                        style={
                          isMarco
                            ? { background: '#ecfdf5', fontWeight: 700 }
                            : undefined
                        }
                      >
                        <td><strong>{ev.horario}</strong></td>
                        <td>{fmtPct(ev.urnas_pct)}</td>
                        <td style={{ color: '#b45309', fontWeight: 700 }}>+{fmtInt(ev.votos_no_intervalo)}</td>
                        <td>{fmtInt(ev.votos_acumulados)}</td>
                        <td style={{ color: '#e11d48', fontWeight: 700 }}>
                          {ev.urnas_pct > 0 ? `${fmtPct(ev.c1_pct)} (${fmtInt(ev.c1_votos)})` : '—'}
                        </td>
                        <td style={{ color: '#2563eb', fontWeight: 700 }}>
                          {ev.urnas_pct > 0 ? `${fmtPct(ev.c2_pct)} (${fmtInt(ev.c2_votos)})` : '—'}
                        </td>
                        <td>{ev.evento}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: AUDITOR DE LOG DE URNA & INSPETOR JSON TSE */}
      {activeTab === 'auditor' && (
        <div className="fade-in">
          <div className="section-card">
            <div className="section-header">
              <div>
                <h3 className="section-title">
                  Auditor de Log de Urna do TSE — Contagem Exata de Votos Após as 17h00:00
                </h3>
                <p className="section-subtitle">
                  O back-end Python analisa linha a linha o arquivo de Log da Urna Eletrônica, aplica o fuso horário unificado de Brasília e separa os votos confirmados até 17:00:00 dos votos confirmados após 17:00:00.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 700 }}>UF da Urna:</label>
                <select
                  className="select-input"
                  value={ufLog}
                  onChange={(e) => setUfLog(e.target.value)}
                >
                  <option value="SP">SP (Horário de Brasília - UTC-3)</option>
                  <option value="MG">MG (Horário de Brasília - UTC-3)</option>
                  <option value="BA">BA (Horário de Brasília - UTC-3)</option>
                  <option value="AM">AM (Manaus -1h vs Brasília - UTC-4)</option>
                  <option value="MT">MT (Cuiabá -1h vs Brasília - UTC-4)</option>
                  <option value="AC">AC (Rio Branco -2h vs Brasília - UTC-5)</option>
                </select>
                <button className="btn-primary" onClick={analisarLogCustom}>
                  Analisar Votos Após 17h
                </button>
              </div>
            </div>

            <div className="auditor-grid">
              <div>
                <div style={{ marginBottom: '8px', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                  Conteúdo do Log da Urna (padrão TSE: <code>DD/MM/AAAA HH:MM:SS INFO ID_UE MENSAGEM</code>):
                </div>
                <textarea
                  className="log-textarea"
                  value={logText}
                  onChange={(e) => setLogText(e.target.value)}
                />
              </div>

              <div>
                {resultadoLog && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '20px',
                    }}
                  >
                    <h4 style={{ marginBottom: '12px', color: '#b45309', fontWeight: 800 }}>
                      Resultado da Auditoria da Seção (Urna #{resultadoLog.id_urna_eletronica})
                    </h4>

                    <div className="kpi-strip" style={{ marginBottom: '16px' }}>
                      <div className="kpi-box">
                        <div className="kpi-label">Total na Seção</div>
                        <div className="kpi-value">{resultadoLog.votos_totais_registrados}</div>
                        <div className="kpi-sub">Votos computados</div>
                      </div>
                      <div className="kpi-box">
                        <div className="kpi-label">Até 17h00:00</div>
                        <div className="kpi-value" style={{ color: '#059669' }}>
                          {resultadoLog.votos_ate_17h00}
                        </div>
                        <div className="kpi-sub">Horário regular</div>
                      </div>
                      <div className="kpi-box" style={{ borderColor: '#f59e0b', background: '#fffdf5' }}>
                        <div className="kpi-label" style={{ color: '#b45309' }}>
                          Efetivados Após 17h00
                        </div>
                        <div className="kpi-value" style={{ color: '#b45309' }}>
                          {resultadoLog.votos_efetivados_apos_17h00}
                        </div>
                        <div className="kpi-sub">
                          {fmtPct(resultadoLog.percentual_apos_17h)} da seção
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '10px' }}>
                      Abertura (Brasília): <strong style={{ color: '#0f172a' }}>{resultadoLog.horario_abertura_brasilia}</strong> • Encerramento BU (Brasília):{' '}
                      <strong style={{ color: '#b45309' }}>{resultadoLog.horario_encerramento_brasilia}</strong>
                    </div>

                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th># Voto</th>
                            <th>Hora Local Urna</th>
                            <th>Hora Brasília</th>
                            <th>Tempo Após 17h</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadoLog.registros_apos_17h?.map((reg) => (
                            <tr key={reg.sequencia_voto}>
                              <td><strong>Voto #{reg.sequencia_voto}</strong></td>
                              <td>{reg.horario_local_urna}</td>
                              <td style={{ color: '#b45309', fontWeight: 800 }}>
                                {reg.horario_brasilia}
                              </td>
                              <td>{reg.tempo_apos_17h}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Inspetor do JSON Oficial do TSE (-r.json) */}
          <div className="section-card">
            <div className="section-header">
              <div>
                <h3 className="section-title">
                  Inspetor do Payload JSON Oficial do TSE (<code>-c0001-e00{dados?.codigo_eleicao}-r.json</code>)
                </h3>
                <p className="section-subtitle">
                  Estrutura retornada pela API do TSE em <code>resultados.tse.jus.br</code> consumida pelo back-end Python
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  className="select-input"
                  value={ufRaw}
                  onChange={(e) => {
                    setUfRaw(e.target.value);
                    carregarTseRaw(ano, e.target.value);
                  }}
                >
                  <option value="br">BR (Consolidado Nacional)</option>
                  <option value="sp">SP (São Paulo)</option>
                  <option value="mg">MG (Minas Gerais)</option>
                  <option value="ba">BA (Bahia)</option>
                  <option value="rj">RJ (Rio de Janeiro)</option>
                  <option value="rs">RS (Rio Grande do Sul)</option>
                </select>
              </div>
            </div>

            {tseRaw && (
              <div>
                <div style={{ marginBottom: '10px', fontSize: '0.83rem', color: '#475569' }}>
                  URL TSE: <code>{tseRaw.url_consultada}</code> • Modo: <strong>{tseRaw.status}</strong>
                </div>
                <pre className="code-pre">{JSON.stringify(tseRaw.payload_tse, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
