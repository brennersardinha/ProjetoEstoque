# Visão e escopo do produto

## 1. Resumo

Sistema de inventário para a loja: vendedores fazem o levantamento de produtos usando um celular Android/ios e a câmera; um servidor no computador da loja mantém o catálogo, os balanços e o histórico; administradores usam um painel web para preparar balanços, administrar dados e analisar/exportar resultados.

## 2. Problema

A contagem manual em planilhas dificulta identificar quem contou cada item, preservar a quantidade de referência, evitar duplicidades e revisar divergências. O sistema deve tornar o balanço rastreável e confiável, sem pretender substituir um ERP ou registrar movimentações de estoque nesta primeira versão.

## 3. Objetivos

- Reutilizar o catálogo existente por importação de XLSX/CSV e desenvolver uma interface para cadastro de produtos.
- Identificar produtos por código de barras comercial ou QR Code interno.
- Organizar o trabalho em balanços com conjunto de itens definido.
- Registrar quantidades físicas com identidade autenticada e horário do servidor.
- Preservar referência, contagens, recontagens e resultados aprovados por balanço.
- Apresentar progresso, pendências e divergências, com relatórios por categoria, produto e vendedor.
- Viabilizar operação na rede local, com backups e recuperação testada.

## 4. Usuários e ambiente

- **Administrador:** prepara dados e balanços, administra usuários, revisa resultados e encerra balanços.
- **Vendedor:** autentica-se no Android/iOS, consulta pendências, lê identificadores e registra contagens.
- **Operador técnico:** instala/atualiza servidor, banco, rede e backups; pode coincidir com o administrador.
- **Ambiente:** computador da loja como host, banco PostgreSQL, Wi-Fi/LAN, celulares Android e navegador no painel.

## 5. Escopo do MVP

### Incluído

1. Login individual e papéis `ADMIN`/`VENDEDOR`.
2. Cadastro, edição e ativação/inativação de categorias e produtos.
3. Importação XLSX/CSV com associação de colunas, validação, prévia e confirmação.
4. Associação de códigos existentes; criação e impressão de QR Code/token para produtos sem identificador adequado.
5. Criação de balanço em rascunho, seleção de itens, abertura com fotografia das referências e encerramento/cancelamento controlado.
6. Lista de itens pendentes e contagem por leitura/código; recontagem autorizada mantendo histórico.
7. Dashboard simples de progresso e relatórios por categoria, produto e vendedor.
8. Exportação para Excel e PDF.
9. Auditoria de ações críticas, backup e procedimento de restauração.
10. Tratamento explícito de perda de conexão: nenhuma contagem aparece como salva sem confirmação do servidor.

### Fora do MVP

- Baixa/entrada automática por vendas, compras ou devoluções.
- Integração com ERP, PDV ou contabilidade.
- Sincronização offline completa/fila local de contagens.
- Acesso remoto pela internet ou exposição da API pública.
- Aplicativo móvel administrativo.
- Valoração financeira automática de diferenças.
- Multi-loja, multi-depósito ou transferência entre depósitos.
- Previsão, reposição automática, alertas inteligentes ou analytics avançado.

## 6. Critérios de sucesso do produto

- Uma pessoa autorizada consegue importar e revisar produtos sem corromper o catálogo.
- Cada item do balanço mantém uma referência imutável desde a abertura até o encerramento.
- O sistema identifica autoria e horário de cada contagem, sem permitir atribuição por nome livre.
- Repetições de requisição e conflitos não sobrescrevem silenciosamente contagens.
- Admin consegue acompanhar itens contados, pendentes e em revisão e exportar resultados.
- O procedimento de backup e restauração funciona em teste documentado.
- Um balanço piloto em uma categoria é concluído sem perda de dados ou ambiguidade de unidade.

## 7. Indicadores de acompanhamento

- Percentual de produtos importados sem erro (medido após saneamento da planilha).
- Percentual de itens do balanço contados.
- Número de itens pendentes/em revisão e divergências.
- Contagens rejeitadas por código inexistente, duplicidade ou conflito.
- Duração do balanço piloto e taxa de falhas de conexão.
- Resultado e duração do último teste de restauração.

## 8. Premissas e dependências

- O computador servidor permanece ligado durante o balanço e tem IP local reservado.
- Há cobertura Wi-Fi suficiente e dispositivos Android/iOS compatíveis com câmera.
- O catálogo de origem possui, ou poderá receber, código interno único, nome, categoria e unidade.
- Operação inicial apenas na rede local; a configuração de HTTPS e confiança de certificado em Android será definida e testada antes de produção.
- A loja designará quem pode abrir/encerrar balanços e aprovar recontagens.

## 9. Definição de pronto do MVP

Além de implementar as funções, o produto só estará pronto para piloto quando os critérios de aceite em `../07-testes-e-qualidade/testes-e-aceite.md` forem aprovados, houver backup restaurável, contas individuais configuradas, rede testada e um responsável da loja aceitar o fluxo operacional.