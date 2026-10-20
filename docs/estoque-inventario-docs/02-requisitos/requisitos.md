# Requisitos do sistema

## 1. Prioridades

- **MUST:** necessário para o MVP/piloto.
- **SHOULD:** importante, pode ser faseado se houver restrição, sem comprometer integridade.
- **COULD:** melhoria posterior.

## 2. Requisitos funcionais

| ID | Prioridade | Requisito |
|---|---|---|
| RF-01 | MUST | O sistema deve autenticar usuários individuais e identificar seu papel. |
| RF-02 | MUST | Administrador deve criar, editar e desativar categorias. |
| RF-03 | MUST | Administrador deve cadastrar, editar e desativar produtos com código interno único, nome, categoria e unidade. |
| RF-04 | MUST | Administrador deve importar XLSX/CSV por fluxo de mapeamento, validação, prévia, correção/relatório de erros e confirmação. |
| RF-05 | MUST | A importação deve preservar zeros à esquerda nos códigos e evitar criar duplicatas em reimportações. |
| RF-06 | MUST | Administrador deve associar um ou mais identificadores a um produto, desde que cada identificador ativo seja único. |
| RF-07 | MUST | Sistema deve gerar token QR único e etiqueta para produto sem identificador adequado. |
| RF-08 | MUST | Administrador deve criar balanço em rascunho e selecionar categorias/produtos participantes. |
| RF-09 | MUST | Ao abrir balanço, sistema deve congelar a quantidade de referência de cada item participante. |
| RF-10 | MUST | Vendedor autenticado deve ver balanços abertos e lista de itens pendentes autorizados. |
| RF-11 | MUST | App deve ler QR/barcode suportados, resolver produto no servidor e exibir nome, categoria e unidade. |
| RF-12 | MUST | Vendedor deve registrar quantidade física para item pendente, com autoria e horário obtidos no servidor. |
| RF-13 | MUST | Sistema deve recusar contagem normal duplicada; recontagem exige autorização e cria novo registro. |
| RF-14 | MUST | Administrador autorizado deve revisar divergências, selecionar/aprovar resultado e encerrar balanço. |
| RF-15 | MUST | Sistema deve preservar histórico e auditoria; encerramento não altera balanços anteriores. |
| RF-16 | MUST | Relatório deve listar referências, quantidades finais, diferenças, status, vendedor e data/hora. |
| RF-17 | SHOULD | Dashboard deve mostrar progresso, contados, pendentes, em revisão e divergentes. |
| RF-18 | MUST | Administrador deve exportar relatório para XLSX e PDF. |
| RF-19 | MUST | App deve comunicar falha de conexão/gravação sem indicar sucesso falso. |
| RF-20 | MUST | Sistema deve oferecer backup automatizável e procedimento documentado de restauração. |
| RF-21 | SHOULD | Sistema deve permitir pesquisa de produtos por código interno, nome e identificador. |
| RF-22 | SHOULD | Administrador deve poder cancelar balanço com motivo, preservando auditoria e histórico. |
| RF-23 | COULD | Sistema poderá suportar fila offline sincronizável em versão futura, com política de conflitos explícita. |

## 3. Requisitos não funcionais

| ID | Categoria | Requisito verificável |
|---|---|---|
| RNF-01 | Segurança | Senhas armazenadas somente como hash robusto; nunca persistir senha em texto puro. |
| RNF-02 | Segurança | Toda rota protegida valida autenticação, papel e autorização no backend. |
| RNF-03 | Segurança | API inicialmente acessível apenas pela LAN; firewall restritivo; não encaminhar porta para internet. |
| RNF-04 | Segurança | Tráfego e confiança de certificado devem ser definidos antes do piloto; não usar exceção insegura de TLS em produção. |
| RNF-05 | Integridade | Referência por item/balanço é imutável após abertura, salvo processo administrativo auditado definido. |
| RNF-06 | Integridade | Quantidades usam decimal (por exemplo, `NUMERIC(14,3)`), nunca ponto flutuante binário para cálculo financeiro/estoque. |
| RNF-07 | Integridade | Operações críticas são transacionais e repetição de requisição não duplica contagem. |
| RNF-08 | Auditoria | Alterações administrativas, importações, recontagens, aprovações e transições do balanço são auditáveis. |
| RNF-09 | Confiabilidade | Confirmação de gravação só após commit do servidor; erro de rede deve ser recuperável sem duplicação. |
| RNF-10 | Recuperação | Backups ficam em local/dispositivo diferente do servidor e restauração é exercitada antes do piloto. |
| RNF-11 | Usabilidade | Fluxo de contagem deve ser operável com uma mão e minimizar digitação; feedback de leitura/salvamento é claro. |
| RNF-12 | Compatibilidade | App será testado em dispositivos Android e iOS reais representativos da loja. Versões mínimas ficam PENDENTES. |
| RNF-13 | Desempenho | Pesquisa e resolução de código devem retornar em até 2 s em condições normais da LAN para catálogo previsto; validar por teste com volume real. |
| RNF-14 | Manutenibilidade | TypeScript, migrações versionadas, testes automatizados, lint e configuração documentada. |
| RNF-15 | Privacidade | Coletar apenas dados necessários (identidade interna e registros operacionais); definir retenção e acesso conforme política da loja. |
| RNF-16 | Observabilidade | Logs técnicos não devem conter senha/token e devem permitir diagnosticar erros de API, banco e importação. |

## 4. Perfis e permissões mínimas

| Ação | ADMIN | VENDEDOR |
|---|---:|---:|
| Consultar balanços abertos e itens permitidos | Sim | Sim |
| Registrar primeira contagem | Sim, se autorizado | Sim |
| Criar/editar categoria e produto | Sim | Não |
| Importar catálogo | Sim | Não |
| Criar/abrir/cancelar/encerrar balanço | Sim | Não |
| Autorizar recontagem/aprovar resultado | Sim | Não |
| Consultar relatórios completos/exportar | Sim | Não (salvo decisão futura) |
| Gerenciar usuários | Sim | Não |

**PENDENTE:** decidir se um administrador também pode atuar como contador e se vendedores podem ver contagens de outros vendedores.