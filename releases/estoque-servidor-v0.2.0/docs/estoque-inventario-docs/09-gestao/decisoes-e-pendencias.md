# Decisões e pendências

## 1. Decisões consolidadas do planejamento

| ID | Decisão | Base |
|---|---|---|
| D-01 | MVP para Android e iOS via Expo/React Native | Decisão atualizada pelo solicitante; o mesmo cliente mobile atende as duas plataformas. |
| D-02 | Administrador usa painel web; vendedor usa app Android/iOS | Planejamento funcional/técnico. |
| D-03 | Computador da loja é servidor central; uso inicial na LAN | Arquitetura proposta. |
| D-04 | PostgreSQL como banco; API Node/Express; React/Vite; Expo/React Native e TypeScript | Stack sugerida no planejamento. |
| D-05 | Importação inicial via planilha, com cadastro manual disponível | Fluxo de catálogo. |
| D-06 | Reutilizar barcodes existentes; gerar QR próprio para produto sem identificador adequado | Decisão técnica posterior substitui ideia anterior de usar apenas QR. |
| D-07 | Balanço congela a referência na abertura e preserva histórico | Regra central do domínio. |
| D-08 | Vendedor é identificado por login individual; autoria não é nome livre enviado pelo app | Especificação técnica. |
| D-09 | MVP não inclui vendas/compras nem sincronização offline completa | Delimitação de escopo. |
| D-10 | Relatórios não somam unidades incompatíveis | Regra de unidade. |

## 2. Pendências bloqueadoras ou importantes

| ID | Pergunta | Recomendação inicial | Bloqueia |
|---|---|---|---|
| P-01 | Como formar a referência do primeiro balanço? | Importar saldos como saldo-base auditável e gerar o primeiro conjunto de itens a partir deles; validar com a loja. | Banco, importação, abertura |
| P-02 | Encerramento permite itens pendentes? | Por padrão, bloquear encerramento ou exigir decisão explícita de “não contado” aprovada; não converter pendente em zero. | Fechamento/relatório |
| P-03 | Como aprovar contagens divergentes/recontagens? | Registrar contagens imutáveis; ADMIN seleciona uma contagem e justifica ajustes. Sem média automática. | Modelo de dados/UI |
| P-04 | Pode haver balanços simultâneos contendo o mesmo produto? | Proibir sobreposição para o MVP, salvo necessidade real validada. | Integridade de referência |
| P-05 | Quais unidades e precisão por unidade? | Dicionário controlado; precisão configurável (proposta NUMERIC 14,3). | Banco/importação/UX |
| P-06 | Quais versões mínimas de Android/iOS e modelos de telefone? | Levantar aparelhos da loja e testar câmera antes da decisão. | App/entrega |
| P-07 | Como estabelecer HTTPS confiável na LAN? | Prototipar domínio/certificado e confiança no Android/iOS antes de produção. | Segurança/implantação |
| P-08 | Qual formato/tamanho de etiqueta e impressora? | Testar etiqueta real com distância/iluminação e leitura de todos os aparelhos. | QR/implantação |
| P-09 | Vendedor vê apenas suas contagens ou todas? Pode ADMIN contar? | Menor privilégio: vendedor vê dados necessários; admin conta somente se explicitamente habilitado. | Permissões/UI |
| P-10 | Política de backup, retenção, RPO/RTO e criptografia? | Cópia automática diária em destino separado, restauração ensaiada; validar tolerância da loja. | Operação/piloto |
| P-11 | Qual volume máximo de produtos/linhas importadas? | Medir planilha real e fixar limite de upload/paginação por teste. | API/desempenho |
| P-12 | Como recuperar senha/desativar usuário? | Definir fluxo administrativo auditado e processo de criação inicial sem senha padrão. | Autenticação |

## 3. Registro para decisões futuras

Use este formato para adicionar decisão: **ID, data, contexto, alternativas consideradas, decisão, justificativa, impactos e responsável**. Não apagar decisão substituída; registrar nova decisão referenciando a anterior.

## 4. Premissas editoriais desta documentação

Quando o planejamento tinha trechos divergentes, prevaleceu o trecho de especificação posterior e mais detalhado. Onde o planejamento não dava resposta, a questão foi marcada como PENDENTE ou apresentada como recomendação, não como decisão já aprovada.