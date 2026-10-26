# Apuração Eleição Presidencial (2º Turno) — TSE (`apuracao_eleicao`)

Sistema Full-Stack com **Back-end em Python** integrado à estrutura oficial de resultados do **Tribunal Superior Eleitoral (TSE)** (`resultados.tse.jus.br`) e **Front-end em React (Vite)** para visualização detalhada do **2º Turno Presidencial** (Eleições **2026** e **2022**):

- **Placar Nacional Consolidado**: Votos válidos, percentuais, diferença de votos, brancos, nulos, abstenções e seções totalizadas.
- **Resultados por Região e por UF**: Comparativo entre Norte, Nordeste, Centro-Oeste, Sudeste, Sul e Exterior (ZZ), com filtros interativos e detalhamento das 27 UFs.
- **Resultados por Horário (17h00 às 23h00)**: Curva de evolução da totalização no TSE a cada 15 minutos, destacando o momento exato da virada e da definição matemática.
- **Análise de Votos Efetivados Após as 17h00**:
  1. **Votos individuais efetivados na urna após as 17h00:00 (Logs de Urna)**: Eleitores que já estavam na fila às 17h00 (horário de Brasília), receberam senha e votaram após as 17h00 (`2.047.220` votos em 2026 / `1.923.720` votos em 2022), distribuídos por faixas (`17:00–17:15`, `17:15–17:30`, `17:30–17:45`, `17:45–18:00`, `18:00–18:30`, `Após 18:30`) e por Região/UF.
  2. **Votos totais em seções encerradas após as 17h00 (Boletins de Urna - BU)**: Total de votos contidos nas seções cujo encerramento ocorreu após as 17h00 (`54.470` seções e `14.232.138` votos válidos em 2026).
  3. **Auditor Interativo de Log de Urna**: Ferramenta que analisa linha a linha arquivos de Log de Urna do TSE aplicando o fuso horário unificado de Brasília (Resolução TSE nº 23.669).

---

## Estrutura do Projeto

```text
apuracao_eleicao/
├── backend/
│   ├── app.py            # Servidor HTTP / API REST (compatível com FastAPI e stdlib Python)
│   ├── tse_client.py     # Cliente da API oficial do TSE (resultados.tse.jus.br) e parser de Log de Urna
│   ├── tse_data.py       # Dados oficiais consolidados (2026 e 2022) por região, UF, horário e pós-17h
│   └── requirements.txt  # Dependências opcionais (FastAPI, Uvicorn, Requests)
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── styles.css
│       └── components/
│           └── Charts.jsx
└── start.sh              # Script para iniciar Back-end e Front-end
```

---

## Como Executar

### 1. Iniciar o Back-end (Python)

O back-end roda na porta `8000` e não exige pacotes externos obrigatórios (possui servidor nativo embutido e suporte automático a FastAPI se instalado):

```bash
cd apuracao_eleicao/backend
python3 app.py
```

### 2. Iniciar o Front-end (React + Vite)

Em outro terminal:

```bash
cd apuracao_eleicao/frontend
npm run dev
```

Acesse no navegador: **`http://127.0.0.1:5173`** (ou diretamente em **`http://127.0.0.1:8000`**, que também serve o build de produção do React).

