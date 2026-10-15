/**
 * OPCIONAL — atualiza o site segundos depois de uma edição na planilha
 * (sem isso, a atualização acontece em até ~15 minutos).
 *
 * Instalação:
 * 1. Na planilha: Extensões → Apps Script. Cole este código.
 * 2. Crie um token no GitHub: Settings → Developer settings → Fine-grained tokens,
 *    acesso só ao repositório do relatório, permissão "Contents: Read and write".
 * 3. No Apps Script: Configurações do projeto → Propriedades do script →
 *    adicione GITHUB_TOKEN = <seu token>.
 * 4. Gatilhos (ícone de relógio) → Adicionar gatilho → função "avisarGithub",
 *    evento "Da planilha" → "Ao editar".
 */
const REPO = "DvSeiffert/kophos-relatorio-traducao";

function avisarGithub() {
  // Evita disparos em sequência enquanto alguém digita (1 aviso a cada 2 min)
  const cache = CacheService.getScriptCache();
  if (cache.get("avisado")) return;
  cache.put("avisado", "1", 120);

  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  UrlFetchApp.fetch("https://api.github.com/repos/" + REPO + "/dispatches", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
    payload: JSON.stringify({ event_type: "planilha-editada" }),
  });
}
