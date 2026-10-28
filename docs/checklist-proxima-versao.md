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
- [~] Editar produtos existentes e trocar sua foto pela lista de ações, validando a senha do ADMIN autenticado na API.
- [~] Excluir produtos com botão vermelho e confirmação por senha; a exclusão lógica desativa QR Codes e preserva históricos de balanço.
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

## Seleção de categorias e produtos no balanço

- [x] Permitir uma ou mais categorias em balanços por categoria, exigindo pelo menos uma categoria.
- [x] Permitir, em balanços personalizados, combinar categorias inteiras e produtos avulsos.
- [x] Persistir categorias selecionadas e produtos incluídos dentro delas, preservando a seleção para edição e relatório.
- [x] Permitir corrigir os vendedores destinados em qualquer rascunho antes da abertura.
- [ ] Validar no uso categorias múltiplas, categorias vazias, produtos avulsos e edição de rascunhos.

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
- [x] Servidor/painel/desktop na versão 0.3.3; mobile 0.3.2 (Android versionCode 6). Instalador Windows 0.3.3 gerado com as novas ações de produto.
- [x] Registrar os links dos artefatos Expo e do pacote de implantação do servidor nesta seção.

### Artefatos desta versão

- Versão 0.3.5 (28/10/2026): instalador Windows do painel e servidor `release/Estoque Setup 0.3.5.exe`; Expo Android preview 0.3.5 (versionCode 9) com descoberta automática do servidor na rede, sem IP fixo: https://expo.dev/accounts/brennersardinha/projects/estoque-inventario/builds/3fad7d95-5ec6-4c94-bbd5-c54b73f15ee9
- Expo Android preview 0.3.2 com API em 192.168.15.8: https://expo.dev/accounts/brennersardinha/projects/estoque-inventario/builds/6c8d0869-2468-4c73-a029-713467765594 (build enviado; aguarda conclusão na fila EAS).
- Instalador Windows do painel e servidor 0.3.3: `release/Estoque Setup 0.3.3.exe`.

### Evidências

- Build API aprovado com `npm run build --workspace @estoque/api`; build web aprovado com `npm run build --workspace @estoque/web`; verificação TypeScript mobile aprovada com `npm run build --workspace @estoque/mobile`.
- Em 21/10/2026, builds API e web aprovados; instalador `Estoque Setup 0.3.3.exe` gerado com o painel atualizado e a API incluída.
- Em 21/10/2026, os containers foram confirmados ativos e saudáveis: API na porta 3000 e PostgreSQL na 5433. `GET /api/health` respondeu em `192.168.15.8:3000`; `192.168.15.9:3000` expirou. Build mobile atualizado para apontar ao IP atual; reservar esse IP no roteador evita nova divergência.
- Migration `20261020160000_product_photos` adiciona URL da foto do produto; o Compose preserva imagens no volume `estoque-product-photos`.
- Migration de destinação aplicada no banco local em 17/10/2026, depois de gerar backup; API e banco confirmados ativos.
- Testes existentes da API: 4 aprovados. Não há teste automatizado cobrindo o novo fluxo de relatório ou impressão.
- Implementações anteriores registradas em 16/10/2026; esta atualização registrada em 20/10/2026. Validações visuais em aparelho, impressão física e autorização com contas reais continuam pendentes.
