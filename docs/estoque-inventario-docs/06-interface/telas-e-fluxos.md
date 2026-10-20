# Telas e fluxos de interface

## Princípios

- Priorizar legibilidade, rapidez de contagem e uso em ambiente de loja.
- Exibir unidade junto de toda quantidade; nunca mostrar valor sem unidade.
- Diferenciar claramente pendente, contado, em revisão e falha de sincronização.
- Nunca indicar “salvo” antes de confirmação do servidor.
- Confirmar ações irreversíveis (abrir/encerrar/cancelar balanço) e explicar consequências.

## Aplicativo Android/iOS — vendedor

### M-01 Login

Campos: usuário e senha. Estados: carregando, credencial inválida, servidor indisponível, sessão expirada. Não armazenar senha em texto puro; disponibilizar logout.

### M-02 Balanços disponíveis

Cartões: nome, estado, progresso conhecido, pendentes e última atualização. Ações: abrir/retomar. Exibir aviso de conexão e horário da última consulta.

### M-03 Lista de itens

Filtros: pendentes/contados (escopo e visibilidade a confirmar), busca por código/nome e categoria se definido. Mostrar status por produto. Paginação/atualização sem apagar estado local ainda não confirmado.

### M-04 Leitor

Solicita permissão de câmera com explicação. Aceita formatos suportados. Resultado: encontrado, código desconhecido, revogado, fora do balanço, já contado ou falha de rede. Fornecer opção de digitar código manualmente se aprovada.

### M-05 Detalhe e contagem

Exibir nome, código interno, categoria, identificador lido, unidade e referência congelada. Campo numérico com casas decimais conforme unidade. Antes de enviar, vendedor revisa. Após envio, mostrar confirmação com horário do servidor.

### M-06 Recontagem

Apenas se autorizada. Exibir que esta é uma nova contagem e preservar resultado anterior; capturar observação/motivo quando exigido.

## Painel web — ADMIN

### W-01 Login

Autenticação e feedback de falha/indisponibilidade.

### W-02 Dashboard

Balanços abertos, percentual contado, pendentes, itens em revisão e divergências. Informar unidade nos indicadores e não agregar unidades incompatíveis.

### W-03 Produtos e categorias

Tabela pesquisável; criar/editar/ativar/inativar; cadastro de identificadores; prevenção/feedback de duplicidades.

### W-04 Importação

Etapas: selecionar arquivo → mapear colunas → validar → revisar erros/avisos → confirmar → resultado. Exibir linhas válidas/ inválidas e nunca efetivar antes da confirmação explícita.

### W-05 QR e etiquetas

Selecionar produtos, gerar/revogar identificador, pré-visualizar etiqueta com nome/código interno e QR, imprimir em formato definido após teste de impressora.

### W-06 Criar/abrir balanço

Nome, seleção de categorias/produtos, número de itens, origem da referência e resumo de conflitos. Confirmação explícita antes de congelar referências.

### W-07 Revisão do balanço

Filtros: pendentes, divergentes, em revisão, contados. Abrir detalhe do produto com histórico de contagens, responsável, horário e justificativa; autorizar recontagem; aprovar resultado conforme política.

### W-08 Encerramento

Resumo de cobertura, itens sem resultado e pendências. Bloquear encerramento se regra da loja exigir completude; pedir confirmação e registrar operador/data.

### W-09 Relatórios/exportação

Filtros por categoria/produto/vendedor/status; tabela detalhada e resumo por unidade; baixar Excel/PDF.

### W-10 Usuários

Criar/desativar vendedor e redefinir acesso. **PENDENTE:** estabelecer política de redefinição de senha e administrador inicial.

## Estados globais importantes

- **Carregando:** feedback visível, impedir submissões duplicadas.
- **Sem conexão:** banner fixo; desativar operações que exigem servidor; nunca enfileirar silenciosamente no MVP.
- **Erro de gravação:** preservar entrada local temporária até usuário resolver; distinguir falha confirmada de timeout incerto; consultar estado antes de retry.
- **Sem resultados:** orientar filtro/pesquisa e evitar parecer falha.
- **Sem permissão:** informar ação não autorizada sem vazar informação de outro usuário.

## Acessibilidade/usabilidade a validar

Contraste adequado, alvos de toque, fonte escalável, mensagens simples, leitor utilizável em iluminação variável, resposta tátil/sonora configurável e operação com luvas se necessário. Testar com vendedores da loja antes de concluir a UI.