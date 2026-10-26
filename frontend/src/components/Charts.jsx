import React, { useState, useEffect } from 'react';

const fmtInt = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtPct = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')}%`;

export function Post17hBarChart({ faixas, cand1, cand2 }) {
  // 'TODOS' seleciona o consolidado de todas as faixas pós-17h; 0..N seleciona uma faixa específica
  const [selectedKey, setSelectedKey] = useState('TODOS');
  const [metricMode, setMetricMode] = useState('log'); // 'log' | 'bu'

  if (!faixas || faixas.length === 0) return null;

  // Calcula os totais consolidados de todas as faixas após as 17h
  const totalVotosLog = faixas.reduce((acc, f) => acc + (f.votos_efetivados_log || 0), 0);
  const totalSecoesPos17h = faixas.reduce((acc, f) => acc + (f.secoes_encerradas_na_faixa || 0), 0);
  const totalVotosBu = faixas.reduce((acc, f) => acc + (f.votos_totais_secoes_encerradas || 0), 0);

  // Média ponderada dos candidatos nas seções encerradas após as 17h
  const totalC1VotosBu = faixas.reduce(
    (acc, f) => acc + Math.round((f.votos_totais_secoes_encerradas || 0) * ((f.c1_pct_secoes || 0) / 100)),
    0
  );
  const c1PctConsolidado = totalVotosBu > 0 ? Number(((totalC1VotosBu / totalVotosBu) * 100).toFixed(2)) : 50;
  const c2PctConsolidado = Number((100 - c1PctConsolidado).toFixed(2));

  const itemConsolidado = {
    faixa: 'Todos os Votos Após as 17h (Total)',
    isTotal: true,
    votos_efetivados_log: totalVotosLog,
    secoes_encerradas_na_faixa: totalSecoesPos17h,
    votos_totais_secoes_encerradas: totalVotosBu,
    c1_pct_secoes: c1PctConsolidado,
    c2_pct_secoes: c2PctConsolidado,
    descricao: 'Soma consolidada de todas as faixas horárias após as 17h00 em todo o país',
  };

  const getVal = (f) =>
    metricMode === 'log' ? f.votos_efetivados_log : f.votos_totais_secoes_encerradas;

  const totalMetric = getVal(itemConsolidado) || 1;
  const maxFaixaVal = Math.max(...faixas.map((f) => getVal(f)), 1);

  const activeFaixa =
    selectedKey === 'TODOS' ? itemConsolidado : faixas[selectedKey] || itemConsolidado;

  // Cálculo do gráfico de rosca (Donut SVG) para o item selecionado
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const c1Share = activeFaixa.c1_pct_secoes || 50;
  const c1Stroke = (c1Share / 100) * circumference;
  const faixaShareOfPost17h = ((getVal(activeFaixa) / totalMetric) * 100).toFixed(1);

  // Proporção dentro das seções que fecharam após as 17h:
  // Quantos votos foram dados antes das 17h vs após as 17h nessas mesmas seções
  const votosAntes17hNessasSecoes = Math.max(
    0,
    activeFaixa.votos_totais_secoes_encerradas - activeFaixa.votos_efetivados_log
  );
  const pctApos17hDentroDasSecoes =
    activeFaixa.votos_totais_secoes_encerradas > 0
      ? ((activeFaixa.votos_efetivados_log / activeFaixa.votos_totais_secoes_encerradas) * 100).toFixed(1)
      : '0.0';
  const pctAntes17hDentroDasSecoes = (100 - Number(pctApos17hDentroDasSecoes)).toFixed(1);

  return (
    <div>
      {/* Barra de Controle e Seleção Rápida */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '18px',
          padding: '12px 16px',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.83rem', color: '#475569', fontWeight: 700 }}>
            Escopo selecionado:
          </span>
          <button
            onClick={() => setSelectedKey('TODOS')}
            style={{
              background: selectedKey === 'TODOS' ? 'linear-gradient(135deg, #d97706, #b45309)' : '#ffffff',
              color: selectedKey === 'TODOS' ? '#ffffff' : '#b45309',
              border: '1px solid #f59e0b',
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: selectedKey === 'TODOS' ? '0 3px 10px rgba(217, 119, 6, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            ★ Selecionar Todos os Votos Após as 17h (Total)
          </button>
        </div>

        <div className="year-selector metric-selector">
          <button
            className={`year-btn ${metricMode === 'log' ? 'active' : ''}`}
            onClick={() => setMetricMode('log')}
          >
            Votos na Urna &gt; 17h (Log)
          </button>
          <button
            className={`year-btn ${metricMode === 'bu' ? 'active' : ''}`}
            onClick={() => setMetricMode('bu')}
          >
            Votos Totais nas Seções &gt; 17h (BU)
          </button>
        </div>
      </div>

      <div className="pos17h-interactive-grid">
        {/* Coluna Esquerda: Card Total Consolidado + Lista de Faixas Horárias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          {/* ITEM CONSOLIDADO: TODOS OS VOTOS APÓS AS 17H */}
          <div
            onClick={() => setSelectedKey('TODOS')}
            style={{
              background:
                selectedKey === 'TODOS'
                  ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                  : '#f8fafc',
              border: selectedKey === 'TODOS' ? '2px solid #d97706' : '2px dashed #cbd5e1',
              borderRadius: '14px',
              padding: '15px 18px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow:
                selectedKey === 'TODOS'
                  ? '0 8px 20px rgba(217, 119, 6, 0.15)'
                  : '0 1px 3px rgba(15,23,42,0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: '#b45309',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '0.82rem',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    letterSpacing: '0.02em',
                  }}
                >
                  ∑ TOTAL PÓS-17H (17:00 às 19:00+)
                </span>
                <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                  {itemConsolidado.descricao}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#92400e',
                    background: '#fde68a',
                    padding: '2px 9px',
                    borderRadius: '999px',
                  }}
                >
                  100% do pós-17h
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#b45309' }}>
                  {fmtInt(getVal(itemConsolidado))} votos
                </span>
              </div>
            </div>

            {/* Barra 100% do Total */}
            <div
              style={{
                width: '100%',
                height: '12px',
                background: '#e2e8f0',
                borderRadius: '999px',
                overflow: 'hidden',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #b45309, #d97706, #f59e0b)',
                  borderRadius: '999px',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: '8px',
                fontSize: '0.77rem',
                color: '#475569',
              }}
            >
              <span>
                Votos na Urna &gt; 17h (Log):{' '}
                <strong style={{ color: '#b45309' }}>{fmtInt(totalVotosLog)}</strong> • Total nos BUs ({fmtInt(totalSecoesPos17h)} seções):{' '}
                <strong style={{ color: '#0f172a' }}>{fmtInt(totalVotosBu)}</strong>
              </span>
              <span>
                <strong style={{ color: '#e11d48' }}>
                  {cand1?.nome} {fmtPct(c1PctConsolidado)}
                </strong>{' '}
                •{' '}
                <strong style={{ color: '#2563eb' }}>
                  {cand2?.nome} {fmtPct(c2PctConsolidado)}
                </strong>
              </span>
            </div>
          </div>

          {/* FAIXAS HORÁRIAS INDIVIDUAIS */}
          {faixas.map((f, idx) => {
            const val = getVal(f);
            const widthPct = Math.max((val / maxFaixaVal) * 100, 4);
            const sharePct = ((val / totalMetric) * 100).toFixed(1).replace('.', ',');
            const isSelected = selectedKey === idx;

            return (
              <div
                key={idx}
                onClick={() => setSelectedKey(idx)}
                style={{
                  background: isSelected ? '#fffbeb' : '#ffffff',
                  border: isSelected ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '13px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected
                    ? '0 6px 16px rgba(245, 158, 11, 0.12)'
                    : '0 1px 3px rgba(15,23,42,0.02)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        background: isSelected ? '#d97706' : '#fef3c7',
                        color: isSelected ? '#ffffff' : '#b45309',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        padding: '4px 10px',
                        borderRadius: '8px',
                      }}
                    >
                      {f.faixa}
                    </span>
                    <span style={{ fontSize: '0.81rem', color: '#475569' }}>{f.descricao}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#64748b',
                        background: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}
                    >
                      {sharePct}% do pós-17h
                    </span>
                    <span style={{ fontSize: '1.02rem', fontWeight: 900, color: '#b45309' }}>
                      {fmtInt(val)} votos
                    </span>
                  </div>
                </div>

                {/* Barra animada */}
                <div
                  style={{
                    width: '100%',
                    height: '10px',
                    background: '#e2e8f0',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    marginBottom: '7px',
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      background: isSelected
                        ? 'linear-gradient(90deg, #b45309, #f59e0b)'
                        : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                      borderRadius: '999px',
                      transition: 'width 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: '6px',
                    fontSize: '0.75rem',
                    color: '#64748b',
                  }}
                >
                  <span>
                    Na Urna (Log): <strong style={{ color: '#b45309' }}>{fmtInt(f.votos_efetivados_log)}</strong> • Total BUs ({fmtInt(f.secoes_encerradas_na_faixa)} seções):{' '}
                    <strong style={{ color: '#0f172a' }}>
                      {fmtInt(f.votos_totais_secoes_encerradas)}
                    </strong>
                  </span>
                  <span>
                    <strong style={{ color: '#e11d48' }}>
                      {cand1?.nome} {fmtPct(f.c1_pct_secoes)}
                    </strong>{' '}
                    •{' '}
                    <strong style={{ color: '#2563eb' }}>
                      {cand2?.nome} {fmtPct(f.c2_pct_secoes)}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coluna Direita: Painel Gráfico + Explicação Didática Visual (Urna vs Seção) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <span className="metric-tag tag-amber">
              {activeFaixa.isTotal ? 'Consolidado Nacional Pós-17h' : `Faixa: ${activeFaixa.faixa}`}
            </span>
            <h4 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              Divisão dos Votos e Diferença de Métricas
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
              Representa <strong>{faixaShareOfPost17h.replace('.', ',')}%</strong> do volume total pós-17h
            </p>
          </div>

          {/* Gráfico Donut Central */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '150px', height: '150px' }}>
              <svg viewBox="0 0 140 140" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="16"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="16"
                  strokeDasharray={`${c1Stroke} ${circumference}`}
                  strokeLinecap="butt"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px',
                }}
              >
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Seções &gt; 17h
                </span>
                <span style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0f172a' }}>
                  {fmtInt(activeFaixa.secoes_encerradas_na_faixa)}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 700 }}>
                  urnas c/ fila
                </span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '170px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#ffe4e6',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: '#be123c',
                }}
              >
                <span>{cand1?.nome} (13)</span>
                <span>{fmtPct(activeFaixa.c1_pct_secoes)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#dbeafe',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: '#1d4ed8',
                }}
              >
                <span>{cand2?.nome} (22)</span>
                <span>{fmtPct(activeFaixa.c2_pct_secoes)}</span>
              </div>
              <div style={{ fontSize: '0.73rem', color: '#64748b', textAlign: 'left', lineHeight: 1.4 }}>
                * Percentual apurado nos Boletins de Urna (BUs) das seções encerradas nesse horário.
              </div>
            </div>
          </div>

          {/* QUADRO EXPLICATIVO: VOTOS NA URNA (LOG) vs VOTOS TOTAIS POR SEÇÃO (BU) */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '14px 16px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
              💡 Qual a diferença entre "Votos na Urna &gt; 17h" e "Votos Totais nas Seções &gt; 17h"?
            </div>

            {/* Métrica A: Votos na Urna (Log) */}
            <div
              style={{
                background: '#fffbeb',
                borderLeft: '4px solid #d97706',
                padding: '10px 12px',
                borderRadius: '6px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#b45309' }}>
                  1. Votos Efetivados na Urna Após 17h (Log)
                </strong>
                <strong style={{ fontSize: '0.95rem', color: '#b45309' }}>
                  {fmtInt(activeFaixa.votos_efetivados_log)} votos
                </strong>
              </div>
              <p style={{ fontSize: '0.76rem', color: '#475569', marginTop: '4px', lineHeight: 1.45 }}>
                Contabiliza <strong>exclusivamente os eleitores que digitaram o voto após as 17h00:00</strong> (que estavam na fila com senha). O <code>Log de Urna</code> registra o segundo exato de cada voto, mas <strong>não revela em quem esse eleitor votou</strong> para preservar o sigilo constitucional do voto.
              </p>
            </div>

            {/* Métrica B: Votos Totais por Seção (BU) */}
            <div
              style={{
                background: '#f1f5f9',
                borderLeft: '4px solid #475569',
                padding: '10px 12px',
                borderRadius: '6px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>
                  2. Votos Totais nas Seções Encerradas &gt; 17h (BU)
                </strong>
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                  {fmtInt(activeFaixa.votos_totais_secoes_encerradas)} votos
                </strong>
              </div>
              <p style={{ fontSize: '0.76rem', color: '#475569', marginTop: '4px', lineHeight: 1.45 }}>
                É a <strong>soma de todos os votos do dia inteiro (08h00 até o fechamento)</strong> das <strong>{fmtInt(activeFaixa.secoes_encerradas_na_faixa)} seções</strong> que fecharam após as 17h. Como o <code>Boletim de Urna (BU)</code> consolida a urna inteira, é nele que sabemos o percentual de cada candidato.
              </p>
            </div>

            {/* Barra de Proporção dentro dessas Seções */}
            <div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: '4px',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '5px',
                }}
              >
                <span>Dentro dessas {fmtInt(activeFaixa.secoes_encerradas_na_faixa)} seções:</span>
                <span style={{ color: '#b45309' }}>
                  {pctApos17hDentroDasSecoes.replace('.', ',')}% votaram após 17h
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  height: '10px',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  background: '#cbd5e1',
                }}
              >
                <div
                  style={{
                    width: `${pctAntes17hDentroDasSecoes}%`,
                    background: '#64748b',
                    height: '100%',
                  }}
                  title={`Votos das 08h00 às 17h00 nessas seções: ${fmtInt(votosAntes17hNessasSecoes)}`}
                />
                <div
                  style={{
                    width: `${pctApos17hDentroDasSecoes}%`,
                    background: '#d97706',
                    height: '100%',
                  }}
                  title={`Votos após as 17h00 nessas seções: ${fmtInt(activeFaixa.votos_efetivados_log)}`}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: '4px',
                  fontSize: '0.71rem',
                  color: '#64748b',
                  marginTop: '4px',
                }}
              >
                <span>■ 08h às 17h: {fmtInt(votosAntes17hNessasSecoes)} ({pctAntes17hDentroDasSecoes.replace('.', ',')}%)</span>
                <span style={{ color: '#b45309', fontWeight: 700 }}>
                  ■ Após 17h: {fmtInt(activeFaixa.votos_efetivados_log)} ({pctApos17hDentroDasSecoes.replace('.', ',')}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EvolutionLineChart({ evolucao, cand1, cand2 }) {
  const pontosValidos = (evolucao || []).filter((e) => e.urnas_pct > 0);
  const [activeIdx, setActiveIdx] = useState(pontosValidos.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chartType, setChartType] = useState('curva'); // 'curva' | 'volume'

  useEffect(() => {
    setActiveIdx(pontosValidos.length - 1);
    setIsPlaying(false);
  }, [evolucao]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => {
        if (prev >= pontosValidos.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 900);
    return () => clearInterval(timer);
  }, [isPlaying, pontosValidos.length]);

  if (pontosValidos.length === 0) return null;

  const startReplay = () => {
    setActiveIdx(0);
    setIsPlaying(true);
  };

  const width = 900;
  const height = 310;
  const padLeft = 56;
  const padRight = 30;
  const padTop = 28;
  const padBottom = 44;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const minY = 44;
  const maxY = 56;
  const maxIntervalVotes = Math.max(...pontosValidos.map((p) => p.votos_no_intervalo), 1);

  const getX = (idx) => {
    if (pontosValidos.length <= 1) return padLeft;
    return padLeft + (idx / (pontosValidos.length - 1)) * plotW;
  };

  const getY = (pct) => {
    const clamped = Math.max(minY, Math.min(maxY, pct));
    return padTop + plotH - ((clamped - minY) / (maxY - minY)) * plotH;
  };

  const visiblePoints = pontosValidos.slice(0, activeIdx + 1);

  const pathC1 = visiblePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.c1_pct).toFixed(1)}`)
    .join(' ');

  const pathC2 = visiblePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.c2_pct).toFixed(1)}`)
    .join(' ');

  const y50 = getY(50);
  const currentPoint = pontosValidos[activeIdx] || pontosValidos[pontosValidos.length - 1];

  return (
    <div>
      {/* Barra de Controle de Simulação / Replay */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          padding: '14px 18px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={() => (isPlaying ? setIsPlaying(false) : startReplay())}
          >
            {isPlaying ? '⏸ Pausar Simulação' : '▶ Replay da Apuração (17h → 23h)'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
              Linha do Tempo:
            </span>
            <input
              type="range"
              min={0}
              max={pontosValidos.length - 1}
              value={activeIdx}
              onChange={(e) => {
                setIsPlaying(false);
                setActiveIdx(Number(e.target.value));
              }}
              style={{ width: '160px', accentColor: '#2563eb', cursor: 'pointer' }}
            />
            <span
              style={{
                background: '#2563eb',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.8rem',
                padding: '3px 10px',
                borderRadius: '999px',
              }}
            >
              {currentPoint.horario} ({fmtPct(currentPoint.urnas_pct)} urnas)
            </span>
          </div>
        </div>

        <div className="year-selector">
          <button
            className={`year-btn ${chartType === 'curva' ? 'active' : ''}`}
            onClick={() => setChartType('curva')}
          >
            Curva de % (Virada)
          </button>
          <button
            className={`year-btn ${chartType === 'volume' ? 'active' : ''}`}
            onClick={() => setChartType('volume')}
          >
            Lotes de Votos por Horário
          </button>
        </div>
      </div>

      {/* Placar Instantâneo do Horário Selecionado */}
      <div
        style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #fff1f2 100%)',
          border: '1px solid #cbd5e1',
          borderRadius: '14px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#475569',
              display: 'block',
            }}
          >
            Fotografia às {currentPoint.horario} (Horário de Brasília) • {fmtInt(currentPoint.votos_acumulados)} votos apurados
          </span>
          <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{currentPoint.evento}</strong>
        </div>

        <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#be123c', fontWeight: 700, display: 'block' }}>
              {cand1?.nome} (13)
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#e11d48' }}>
              {fmtPct(currentPoint.c1_pct)}
            </span>{' '}
            <small style={{ color: '#475569' }}>({fmtInt(currentPoint.c1_votos)})</small>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700, display: 'block' }}>
              {cand2?.nome} (22)
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#2563eb' }}>
              {fmtPct(currentPoint.c2_pct)}
            </span>{' '}
            <small style={{ color: '#475569' }}>({fmtInt(currentPoint.c2_votos)})</small>
          </div>
        </div>
      </div>

      {/* Gráfico SVG */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: 'auto',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: 'inset 0 2px 6px rgba(15, 23, 42, 0.02)',
        }}
      >
        {chartType === 'curva' ? (
          <>
            {[45, 47.5, 50, 52.5, 55].map((val) => {
              const y = getY(val);
              return (
                <g key={val}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke={val === 50 ? '#d97706' : '#f1f5f9'}
                    strokeDasharray={val === 50 ? '6,5' : 'none'}
                    strokeWidth={val === 50 ? 1.8 : 1}
                  />
                  <text x={padLeft - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11" fontWeight="600">
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Linhas completas em cinza claro ao fundo durante o replay */}
            {pontosValidos.map((p, i) => {
              if (i === 0) return null;
              return (
                <g key={`ghost-${i}`} opacity={0.18}>
                  <line
                    x1={getX(i - 1)}
                    y1={getY(pontosValidos[i - 1].c1_pct)}
                    x2={getX(i)}
                    y2={getY(p.c1_pct)}
                    stroke="#e11d48"
                    strokeWidth="2"
                  />
                  <line
                    x1={getX(i - 1)}
                    y1={getY(pontosValidos[i - 1].c2_pct)}
                    x2={getX(i)}
                    y2={getY(p.c2_pct)}
                    stroke="#2563eb"
                    strokeWidth="2"
                  />
                </g>
              );
            })}

            {/* Curvas ativas */}
            <path d={pathC1} fill="none" stroke="#e11d48" strokeWidth="3.6" strokeLinecap="round" />
            <path d={pathC2} fill="none" stroke="#2563eb" strokeWidth="3.6" strokeLinecap="round" />

            {/* Crosshair vertical no ponto ativo */}
            <line
              x1={getX(activeIdx)}
              y1={padTop}
              x2={getX(activeIdx)}
              y2={height - padBottom}
              stroke="#64748b"
              strokeDasharray="4,4"
              strokeWidth="1.2"
            />

            {pontosValidos.map((p, i) => {
              const x = getX(i);
              const y1 = getY(p.c1_pct);
              const y2 = getY(p.c2_pct);
              const isVirada = p.evento && p.evento.toUpperCase().includes('VIRADA');
              const isReached = i <= activeIdx;

              return (
                <g
                  key={p.horario}
                  onClick={() => {
                    setIsPlaying(false);
                    setActiveIdx(i);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {isVirada && (
                    <>
                      <line
                        x1={x}
                        y1={padTop}
                        x2={x}
                        y2={height - padBottom}
                        stroke="#059669"
                        strokeDasharray="3,3"
                        strokeWidth="1.8"
                      />
                      <rect
                        x={x - 32}
                        y={padTop - 2}
                        width="64"
                        height="18"
                        rx="5"
                        fill="#d1fae5"
                        stroke="#059669"
                      />
                      <text x={x} y={padTop + 10} textAnchor="middle" fill="#047857" fontSize="9.5" fontWeight="800">
                        VIRADA
                      </text>
                    </>
                  )}
                  <circle
                    cx={x}
                    cy={y1}
                    r={i === activeIdx ? 7 : 4.5}
                    fill={isReached ? '#e11d48' : '#cbd5e1'}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <circle
                    cx={x}
                    cy={y2}
                    r={i === activeIdx ? 7 : 4.5}
                    fill={isReached ? '#2563eb' : '#cbd5e1'}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={x}
                    y={height - 14}
                    textAnchor="middle"
                    fill={i === activeIdx ? '#0f172a' : isVirada ? '#047857' : '#64748b'}
                    fontSize="11"
                    fontWeight={i === activeIdx || isVirada ? '800' : '500'}
                  >
                    {p.horario}
                  </text>
                </g>
              );
            })}

            <text x={width - padRight - 4} y={y50 - 6} textAnchor="end" fill="#b45309" fontSize="10.5" fontWeight="800">
              Linha de 50% (Maioria)
            </text>
          </>
        ) : (
          /* Modo Barras de Volume de Votos Apurados no Intervalo */
          <>
            {pontosValidos.map((p, i) => {
              const x = getX(i);
              const barW = Math.min(38, plotW / pontosValidos.length - 10);
              const barH = (p.votos_no_intervalo / maxIntervalVotes) * (plotH - 20);
              const y = padTop + plotH - barH;
              const isSelected = i === activeIdx;

              return (
                <g
                  key={p.horario}
                  onClick={() => {
                    setIsPlaying(false);
                    setActiveIdx(i);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={x - barW / 2}
                    y={y}
                    width={barW}
                    height={barH}
                    rx="6"
                    fill={isSelected ? '#2563eb' : '#93c5fd'}
                  />
                  <text
                    x={x}
                    y={y - 6}
                    textAnchor="middle"
                    fill="#334155"
                    fontSize="9.5"
                    fontWeight="700"
                  >
                    {(p.votos_no_intervalo / 1000000).toFixed(1).replace('.', ',')}M
                  </text>
                  <text
                    x={x}
                    y={height - 14}
                    textAnchor="middle"
                    fill={isSelected ? '#0f172a' : '#64748b'}
                    fontSize="11"
                    fontWeight={isSelected ? '800' : '500'}
                  >
                    {p.horario}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}
