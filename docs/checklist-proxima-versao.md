# Checklist da próxima versão — Estoque / Atacadista Silva

Este roteiro reúne as mudanças desta próxima versão em entregas verificáveis. O checklist histórico de QR e vendedores continua em [checklist-funcionalidade-qr-e-vendedores.md](checklist-funcionalidade-qr-e-vendedores.md).

Estados: `[x]` implementado e validado; `[~]` implementado, aguardando validação no ambiente de uso; `[ ]` pendente.

## Identidade visual

- [x] Recriar a marca Atacadista Silva a partir da referência enviada, removendo o fundo cinza e mantendo transparência.
- [x] Gerar variantes SVG e PNG para web e mobile: logo completa, horizontal, símbolo e versão clara.
- [x] Configurar ícone e splash do Expo com a marca.
- [ ] Conferir a logo e o ícone em telas reais e no instalador final.

## Entrada no sistema

- [~] Exibir uma página de espera com a marca enquanto o servidor web recupera e valida a sessão.
- [~] Exibir uma página de espera com a marca ao iniciar e após autenticar no mobile.
- [ ] Validar em navegador e aparelho que a tela aparece durante a restauração da sessão, login e conexão lenta.

## Catálogo em pastas por categoria

- [~] Organizar a listagem web em pastas expansíveis por categoria, com quantidade de produtos.
- [~] Manter ações de produto dentro da categoria correspondente e impressão de QR por categoria.
- [~] Carregar catálogo completo com paginação da API para que categorias grandes não sejam truncadas.
- [ ] Conferir categorias sem produtos, catálogo grande e permissões no servidor em uso.

## Impressão de QR Codes

- [~] Adicionar botão para imprimir os QR Codes de uma categoria.
- [~] Paginar a impressão em folhas A4 com grade de 4 por 5: no máximo 20 QR Codes em cada página.
- [~] Manter impressão de etiquetas selecionadas e individual.
- [ ] Validar em impressora real a legibilidade do QR, quebra de página e escala em papel A4.

## Relatório individual de balanço

- [~] Disponibilizar ao ADMIN a impressão do relatório em cada balanço, inclusive encerrado ou cancelado.
- [~] Incluir cabeçalho com identificação, estado, responsável, datas e motivo de cancelamento quando houver.
- [~] Dividir itens em tabelas por categoria e incluir contagens, operadores, horários, recontagens, aprovação e quantidade final.
- [~] Restringir endpoint de relatório e acesso ao histórico completo a ADMIN.
- [ ] Conferir balanços abertos, encerrados, cancelados, vazios e com muitas categorias em navegador e impressão física.

## Destinação de vendedores e contagem por QR

- [~] Exigir um ou mais vendedores ativos ao criar um balanço e impedir a abertura de rascunho sem vendedor.
- [~] Permitir corrigir os vendedores destinados enquanto o balanço ainda é rascunho.
- [~] Mostrar ao vendedor somente os balanços que lhe foram destinados; validar também a autorização na API ao consultar itens e registrar contagens.
- [~] No mobile, ler o identificador dentro do balanço selecionado, resolver o produto exato e abrir a tela de quantidade correspondente.
- [x] Preservar os balanços abertos antigos atribuindo-os aos vendedores ativos existentes; rascunhos antigos podem receber vendedores pela tela ADMIN.
- [ ] Validar no uso: ADMIN cria e abre um balanço com vendedores; vendedor destinado conta pelo QR; vendedor não destinado não lista nem conta nele.

## Fechamento da versão

- [x] Executar builds de API, web e mobile; corrigir erros e registrar resultados abaixo.
- [~] Exercitar as rotas de histórico e relatório com conta ADMIN e confirmar bloqueio para vendedor. A proteção ADMIN está aplicada no código; falta validação autenticada no ambiente com contas de teste.
- [x] Alinhar a versão do servidor, painel, desktop e mobile em 0.3.2 (Android versionCode 6); gerar o instalador Windows com a tag 0.3.2.
- [x] Registrar os links dos artefatos Expo e do pacote de implantação do servidor nesta seção.

### Artefatos desta versão

- Expo Android preview: https://expo.dev/accounts/brennersardinha/projects/estoque-inventario/builds/9c53a593-f8da-4d78-8cb8-aee549d0c479
- Instalador Windows do painel e servidor 0.3.2: `release/Estoque Setup 0.3.2.exe`.
- Expo Android preview 0.3.2: build enviado, ainda aguardando início/conclusão na fila EAS.

### Evidências

- Build API aprovado com `npm run build --workspace @estoque/api`; build web aprovado com `npm run build --workspace @estoque/web`; verificação TypeScript mobile aprovada com `npm run build --workspace @estoque/mobile`.
- API local respondeu `GET /api/health` com `status: ok`; Docker Compose não pôde ser consultado porque o Docker Desktop negou acesso ao engine nesta sessão.
- Migration `20261020160000_product_photos` adiciona URL da foto do produto; o Compose preserva imagens no volume `estoque-product-photos`.
- Migration de destinação aplicada no banco local em 17/10/2026, depois de gerar backup; API e banco confirmados ativos.
- Testes existentes da API: 4 aprovados. Não há teste automatizado cobrindo o novo fluxo de relatório ou impressão.
- Implementações anteriores registradas em 16/10/2026; esta atualização registrada em 20/10/2026. Validações visuais em aparelho, impressão física e autorização com contas reais continuam pendentes.
