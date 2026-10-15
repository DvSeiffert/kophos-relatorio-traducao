# Relatório de Tradução — Novo Testamento em Libras (Missão Kophós)

Página do relatório do Projeto Bíblia TPS, gerada automaticamente a partir da
[planilha de acompanhamento](https://docs.google.com/spreadsheets/d/1_5r5Iv9iSHfSa_QAIrfOwk5I9neJB-CSFZ3NwRKpN4U/edit).

## Como a atualização automática funciona

```
Google Sheets ──(a cada 5 min)──▶ GitHub Action
      └─ baixa CSV → data/planilha.csv → commit → publica no GitHub Pages
```

- **`.github/workflows/sync.yml`** — roda a cada 5 minutos. Se a planilha mudou,
  commita `data/planilha.csv` e republica o site.
- **Todos os números** (totais, médias simples e ponderadas, extremos, gráficos,
  frases do texto) são recalculados no navegador a partir do CSV (`assets/app.js`).
- **`data/config.json`** — o que *não* está na planilha: datas exatas de início/encerramento,
  composição da equipe e observações. Edite direto no GitHub quando precisar.

### Atualizar na hora (opcional)
1. Rode manualmente em **Actions → Sincronizar planilha → Run workflow**; ou
2. Instale o gatilho do Google Sheets em `apps-script/gatilho.gs` (instruções no arquivo).

## Requisitos da planilha
- A planilha precisa continuar com acesso "qualquer pessoa com o link pode ver".
- Mantenha os nomes das colunas (a ordem pode mudar). Novas linhas = novos livros.

## Visualizar localmente
```bash
python3 -m http.server 8765
```
