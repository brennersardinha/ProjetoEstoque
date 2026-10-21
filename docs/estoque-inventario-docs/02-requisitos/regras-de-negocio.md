# Regras de negócio e invariantes

## 1. Produtos e identificadores

- **RN-01:** cada produto possui ID interno permanente e `codigo_interno` único; o nome não é identificador.
- **RN-02:** produto inativo permanece no histórico, mas não participa de novos balanços, salvo ação explícita de administrador.
- **RN-03:** um identificador ativo (barcode ou token QR normalizado) só pode estar ligado a um produto.
- **RN-04:** QR contém token aleatório opaco, sem quantidade, preço ou dado sensível; identificadores revogados são recusados.
- **RN-05:** zeros à esquerda em códigos são preservados; código de barras é tratado como texto.

## 2. Unidades e quantidades

- **RN-06:** cada produto tem uma unidade definida (ex.: `UN`, `MT`, `ROLO`, `CX`).
- **RN-07:** quantidades não podem ser negativas; escala decimal permitida depende da unidade e deve ser configurável/documentada. Sugestão inicial `NUMERIC(14,3)`.
- **RN-08:** totais agregados só combinam produtos da mesma unidade; não somar metros, caixas e unidades.
- **RN-09:** divergência absoluta = `quantidade_final − quantidade_referencia`, apresentada na unidade do produto.
- **RN-10:** percentual = `(final − referência) / referência × 100`, somente se referência > 0. Para referência zero, mostrar “N/A” e a diferença absoluta.

## 3. Ciclo do balanço

Estados propostos: `RASCUNHO → ABERTO → EM_REVISAO → ENCERRADO`, com `CANCELADO` como estado terminal permitido conforme regra de transição.

- **RN-11:** somente ADMIN cria e altera seleção de itens em `RASCUNHO`.
- **RN-11a:** balanço por categorias (`CATEGORIA`) deve ter pelo menos uma categoria ativa selecionada e inclui todos os produtos ativos dessas categorias no momento da criação.
- **RN-11b:** balanço personalizado (`PERSONALIZADO`) pode combinar categorias inteiras e produtos avulsos; a seleção persistida mantém as categorias escolhidas e os produtos dentro delas para acesso e auditoria.
- **RN-11c:** vendedores destinados podem ser corrigidos enquanto qualquer balanço permanecer em `RASCUNHO`; depois da abertura, a destinação fica congelada.
- **RN-12:** ao abrir, o sistema congela no item do balanço a quantidade de referência aprovada para cada produto. A fonte do saldo-base deve ser explicitamente escolhida (balanço encerrado mais recente, importação inicial, ou entrada administrativa auditada).
- **RN-13:** uma vez aberto, não alterar a referência nem a lista de itens silenciosamente. Mudança excepcional exige operação administrativa auditada e política definida.
- **RN-14:** contagem só é aceita para item de balanço aberto/em revisão e para usuário autenticado autorizado.
- **RN-15:** autoria vem do usuário da sessão; horário vem do servidor, não do relógio do celular.
- **RN-16:** uma primeira contagem só pode ser submetida uma vez por item, salvo retry idempotente da mesma operação. Recontagem cria novo registro.
- **RN-17:** política para decidir resultado final deve ser explícita: ADMIN aprova uma das contagens ou registra ajuste motivado. Não calcular média automaticamente.
- **RN-18:** encerrar exige revisão do estado dos itens conforme política aprovada. A referência do próximo balanço usa somente resultado final aprovado de balanço encerrado.
- **RN-19:** balanço encerrado é imutável. Correção posterior é novo registro/ajuste auditado, sem apagar resultado original.
- **RN-20:** cancelar não remove contagens ou auditoria; motivo obrigatório recomendado.

## 4. Importação

- **RN-21:** prévia e validação precedem qualquer gravação definitiva.
- **RN-22:** confirmação usa lote/identificador de prévia e deve detectar arquivo/dados alterados após a validação.
- **RN-23:** erros de linha são apresentados com número e motivo; importação rejeitada não aplica linhas parcialmente sem uma escolha explícita de política.
- **RN-24:** reimportação identifica chave do produto de forma determinística (`codigo_interno`) e mostra conflitos; não sobrescreve quantidades de balanços encerrados.
- **RN-25:** categoria e unidade ausentes/inválidas devem ser corrigidas ou mapeadas antes da confirmação.
- **RN-26:** a quantidade inicial importada é base inicial/estoque-base, não contagem física posterior; a origem deve ficar registrada.

## 5. Concorrência, falhas e auditoria

- **RN-27:** cada gravação de contagem tem chave de idempotência ou controle equivalente; retry da mesma operação não cria duplicata.
- **RN-28:** requisição concorrente para item já contado retorna conflito claro; nunca sobrescreve silenciosamente.
- **RN-29:** auditoria de ação crítica registra usuário, ação, objeto, data/hora do servidor e contexto essencial, sem segredos.
- **RN-30:** app distingue `salvo`, `não salvo` e `estado desconhecido`; em caso de timeout consulta servidor antes de oferecer reenvio.
- **RN-31:** sistema não mantém fila offline no MVP. Contagem não confirmada deve ser refeita após reconexão, com orientação para evitar duplicidade.

## 6. Decisões pendentes que afetam regras

1. Como inicializar referência se não houver balanço anterior encerrado: importação como primeiro balanço ou saldos-base separados?
2. Balanço pode ser encerrado com itens pendentes? Se sim, qual status/resultante desses itens?
3. Quais unidades e precisões decimais serão aceitas na loja?
4. Em que condição é necessária recontagem e quem aprova o resultado final?
5. Permitir balanços simultâneos para os mesmos produtos? Recomendação inicial: não, salvo desenho deliberado de congelamento e priorização.