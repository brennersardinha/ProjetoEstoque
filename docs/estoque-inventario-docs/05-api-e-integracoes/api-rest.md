# API REST — contrato inicial

**Prefixo:** `/api` · **Formato:** JSON, exceto upload/download · **Versão:** v1 inicial (contrato a validar)

## 1. Convenções

- Rotas protegidas exigem autenticação; autorização por papel e objeto é aplicada no backend.
- Datas retornadas em ISO 8601 UTC; horário exibido em fuso local configurado.
- IDs UUID; quantidades decimais trafegam como strings decimais ou número validado sem perda de precisão (preferir string no JSON).
- Paginação explícita em listas (`limit`, `cursor`/`page`) e filtros documentados.
- Erro consistente: `{ "error": { "code": "...", "message": "...", "details": [] } }`.
- Requisição de gravação de contagem inclui `Idempotency-Key`; retry da mesma chave devolve resultado original.
- Não confiar em `usuario_id`, papel ou quantidade de referência enviados pelo cliente.

## 2. Rotas propostas

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/auth/login` | Público | Autenticar usuário |
| `POST` | `/auth/logout` | Autenticado | Encerrar sessão/token conforme mecanismo |
| `GET` | `/auth/me` | Autenticado | Usuário e papel atual |
| `GET/POST` | `/categories` | ADMIN para escrita | Consultar/criar categorias |
| `PATCH` | `/categories/:id` | ADMIN | Editar/ativar/inativar |
| `GET/POST` | `/products` | Autenticado/ADMIN escrita | Pesquisar/criar produtos |
| `GET/PATCH` | `/products/:id` | Autenticado/ADMIN escrita | Consultar/editar produto |
| `POST` | `/products/import/preview` | ADMIN | Upload, validar e gerar prévia |
| `POST` | `/products/import/confirm` | ADMIN | Confirmar lote previamente validado |
| `GET` | `/products/import/:batchId/errors` | ADMIN | Baixar relatório de erros |
| `POST` | `/products/:id/identifiers` | ADMIN | Associar barcode/QR |
| `POST` | `/products/:id/identifiers/qr` | ADMIN | Gerar token QR |
| `DELETE` | `/identifiers/:id` | ADMIN | Revogar (soft revoke) |
| `GET` | `/identifiers/resolve?value=...` | Autenticado | Resolver identificador e verificar estado |
| `GET/POST` | `/balances` | ADMIN escrita | Listar/criar balanços |
| `GET/PATCH` | `/balances/:id` | ADMIN/participante | Consultar/editar rascunho |
| `POST` | `/balances/:id/open` | ADMIN | Congelar referências e abrir |
| `GET` | `/balances/:id/items` | Autorizado | Lista paginada, pendências e filtros |
| `POST` | `/balances/:id/items/:itemId/counts` | VENDEDOR autorizado | Registrar primeira contagem |
| `POST` | `/balances/:id/items/:itemId/recounts` | Autorizado + autorização | Criar recontagem |
| `POST` | `/balances/:id/items/:itemId/approve` | ADMIN | Aprovar contagem/ajuste motivado |
| `GET` | `/balances/:id/report` | ADMIN | Resumo e detalhamento |
| `POST` | `/balances/:id/close` | ADMIN | Encerrar com validação |
| `POST` | `/balances/:id/cancel` | ADMIN | Cancelar com motivo |
| `GET` | `/balances/:id/export?format=xlsx\|pdf` | ADMIN | Gerar exportação |
| `GET` | `/health` | LAN/operacional | Estado de serviço sem informação sensível |

### Resolução otimizada para câmera

O app móvel não deve pesquisar o catálogo inteiro depois de cada leitura. O fluxo recomendado é:

1. O leitor aguarda a estabilização do código e ignora leituras repetidas do mesmo valor por um pequeno intervalo.
2. O app envia somente `value` para `GET /identifiers/resolve`, com a sessão autenticada.
3. O backend normaliza espaços externos, preserva zeros à esquerda e executa uma consulta indexada por `normalized_value`.
4. Identificadores revogados, produtos inativos e códigos inexistentes retornam erro acionável; não há fallback silencioso pelo nome.
5. A resposta contém apenas identificador, produto, categoria e unidade, reduzindo latência e dados trafegados.

O endpoint não aceita `produto_id`, quantidade ou referência enviados pelo cliente para resolver o código. A autoridade continua no servidor. O índice de resolução deve ser validado com o volume real da loja e a meta inicial é resposta em até 2 s na LAN.

### Fluxo implementado do balanço

- `POST /balances` cria um rascunho com produtos e referências importadas/cadastradas como saldo-base auditável.
- `POST /balances/:id/open` congela os itens e impede produtos já presentes em balanços abertos ou em revisão.
- `GET /balances/:id/items` retorna pendências; vendedores veem apenas suas próprias contagens e ADMIN vê o histórico necessário para revisão.
- `POST /balances/:balanceId/items/:itemId/counts` exige `Idempotency-Key` UUID e só confirma após transação no servidor.
- `POST /balances/:balanceId/items/:itemId/recounts` autoriza recontagem com motivo; a nova contagem preserva o registro anterior.
- `POST /balances/:balanceId/items/:itemId/approve` permite ao ADMIN selecionar uma contagem ou registrar ajuste com justificativa.
- `POST /balances/:id/close` bloqueia o encerramento se algum item não estiver `APROVADO`.

As referências e contagens não são recebidas do cliente como autoridade: a abertura grava a referência no item, e a contagem usa o usuário autenticado e o horário do servidor.

### Importação implementada

`POST /products/import/preview` recebe `multipart/form-data` com:

- `file`: CSV UTF-8 ou XLSX, limitado inicialmente a 10 MB;
- `mapping`: JSON com os nomes das colunas para `internalCode`, `name`, `category`, `unit` e, opcionalmente, `referenceQuantity` e `barcode`.

A prévia retorna lote, hash SHA-256, validade de 30 minutos, totais e erros por número de linha. Nenhum produto é gravado nessa etapa. Códigos internos são lidos como texto para preservar zeros à esquerda.

`POST /products/import/confirm` recebe `batchId` e `fileHash`. A confirmação rejeita lote expirado, hash divergente, linhas inválidas, categoria inexistente ou identificador duplicado. Linhas válidas são aplicadas em uma única transação: produtos existentes são atualizados por `codigo_interno`, novos produtos são criados e o lote/auditoria são confirmados juntos. Falha em qualquer linha reverte a operação inteira.

Os endpoints são proposta funcional, não esquema OpenAPI final. Criar OpenAPI/Swagger antes de congelar integração mobile/web.

## 3. Exemplo de contagem

```http
POST /api/balances/{balanceId}/items/{itemId}/counts
Authorization: Bearer <token>
Idempotency-Key: 8f5...uuid
Content-Type: application/json
```

```json
{
  "quantity": "132.000",
  "observation": ""
}
```

Resposta `201` (primeira gravação):

```json
{
  "id": "uuid",
  "itemId": "uuid",
  "quantity": "132.000",
  "countedAt": "2026-10-15T16:30:00Z",
  "countedBy": { "id": "uuid", "name": "Carlos" },
  "status": "COUNTED"
}
```

`409 ITEM_ALREADY_COUNTED` para tentativa normal duplicada; `404` para item inexistente/não autorizado conforme política de não exposição; `422` para quantidade inválida; `401/403` para sessão/permissão; timeout sem resposta deve ser tratado como estado desconhecido pelo app e reconciliado por consulta.

## 4. Modelo de erro e validação

Códigos sugeridos: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_IDENTIFIER`, `ITEM_ALREADY_COUNTED`, `BALANCE_NOT_OPEN`, `IDEMPOTENCY_CONFLICT`, `IMPORT_PREVIEW_EXPIRED`, `IMPORT_CONFLICT`, `INTERNAL_ERROR`.

Validar formato e limite de arquivo, extensão e conteúdo real, quantidade de linhas, tamanho máximo, codificação CSV, células/colunas obrigatórias e fórmulas perigosas ao exportar. Limites concretos ficam PENDENTES após testar o tamanho da planilha real.

## 5. Importação em duas etapas

1. `preview`: recebe arquivo/mapeamento; cria lote temporário; devolve contagens de válidas, alertas e erros por linha, sem efetivar catálogo.
2. `confirm`: recebe `batchId`/token de prévia e política de conflitos; revalida validade/autorizações; grava em transação; retorna `created`, `updated`, `skipped`, `rejected` e referência ao relatório.

**PENDENTE:** definir prazo de expiração de prévia, suporte a atualização de produtos existentes e política de importação parcial. Recomendação: confirmação atômica de linhas válidas após resolução de todos os erros bloqueantes.

## 6. Relatórios e exportação

Cada linha exportada inclui código interno, nome, categoria, unidade, quantidade de referência, quantidade final, diferença, percentual quando definido, status, vendedor/contagem aprovada e horário. Cabeçalhos e totais respeitam unidade. Proteger planilhas contra formula injection em texto começando com `=`, `+`, `-`, `@` ou equivalentes.

## 7. Segurança operacional

- Rate limit para login e proteção contra enumeração de usuários.
- Mensagens de erro sem stack trace em produção.
- CORS restrito ao painel local previsto.
- Tamanho de upload limitado; arquivos temporários removidos conforme política.
- Auditoria sem senhas, tokens de sessão ou conteúdo sensível desnecessário.