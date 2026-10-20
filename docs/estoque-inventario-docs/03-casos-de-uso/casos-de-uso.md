# Casos de uso

## Atores

- **Administrador (ADMIN):** mantém catálogo, prepara e encerra balanços, revisa e exporta.
- **Vendedor (VENDEDOR):** conta itens atribuídos em balanço aberto.
- **Servidor/API:** valida permissões e regras, persiste dados e registra auditoria.
- **Operador do sistema:** prepara rede, banco, backup e restauração.

## UC-01 — Importar catálogo

**Ator principal:** ADMIN. **Pré-condições:** sessão ADMIN; planilha XLSX/CSV disponível.

**Fluxo principal:**
1. Abre Produtos > Importar e seleciona o arquivo.
2. Sistema identifica colunas ou solicita mapeamento para código interno, nome, categoria, unidade, barcode opcional e saldo-base opcional.
3. ADMIN confirma mapeamento; sistema valida formatos, obrigatoriedade, duplicidades e categorias/unidades.
4. Sistema mostra resumo e linhas com erros/avisos, sem efetivar importação.
5. ADMIN corrige planilha/mapeamento ou baixa relatório de rejeições e gera nova prévia.
6. ADMIN confirma a prévia válida; servidor grava transacionalmente e retorna resumo.

**Alternativas/exceções:** arquivo inválido/limite excedido; código duplicado; categoria ausente; arquivo alterado; duplicata de código interno; transação falha. Em erro de transação, não deixar catálogo parcialmente aplicado.

**Pós-condição:** produtos importados e autoria/data do lote auditadas. Nenhum balanço encerrado foi alterado.

## UC-02 — Cadastrar ou editar produto

**Ator:** ADMIN. **Fluxo:** informa código interno, nome, categoria e unidade; associa barcode se houver; valida unicidade; grava. Se não houver código utilizável, solicita QR próprio. Alterações relevantes ficam auditadas.

**Exceção:** identificador já associado a outro produto é recusado; não transferir automaticamente.

## UC-03 — Criar e abrir balanço

**Ator:** ADMIN. **Pré-condições:** produtos ativos e base de referência definida.

1. Cria balanço em rascunho, com nome e seleção por categoria/produto.
2. Revê quantidade de itens e origem prevista da referência.
3. Abre balanço; backend verifica duplicidade/sobreposição conforme política.
4. Backend cria itens e fotografa quantidades de referência em transação; status muda para ABERTO.

**Alternativas:** referência inexistente/ambígua; produto inativo; outro balanço aberto conflita. Não abrir até resolver.

## UC-04 — Entrar e consultar pendências (Android)

**Ator:** VENDEDOR. **Fluxo:** autentica; app consulta `/auth/me` e balanços abertos permitidos; seleciona balanço; vê progresso/lista de pendentes. Exibe estado da conexão.

**Exceção:** login inválido, sessão expirada, servidor indisponível. Nenhum dado deve ser apresentado como atualizado se não foi sincronizado; mostrar estado/horário da última atualização.

## UC-05 — Registrar contagem por leitura

**Ator:** VENDEDOR. **Pré-condição:** balanço aberto, item pendente, rede disponível.

1. Abre leitor e lê barcode/QR.
2. App envia identificador ao servidor; servidor resolve produto e confirma que pertence ao balanço.
3. App mostra nome, categoria, unidade e quantidade de referência congelada.
4. Vendedor digita quantidade física, revisa e confirma.
5. Backend valida formato/intervalo/status/permissão e grava com usuário autenticado, horário do servidor e chave idempotente.
6. App confirma sucesso apenas após resposta confirmada.

**Alternativas:** código não encontrado/revogado; produto fora do balanço; item já contado; quantidade inválida; conflito concorrente; timeout; servidor indisponível. Mostrar mensagem acionável, não registrar sucesso falso.

## UC-06 — Registrar recontagem

**Ator:** ADMIN autoriza; VENDEDOR executa (ou ADMIN se permitido). **Fluxo:** ADMIN marca item para revisão e registra motivo/autoriza; contador realiza nova contagem; sistema grava registro distinto sem apagar o anterior; ADMIN escolhe resultado aprovado.

**PENDENTE:** definir gatilhos de recontagem, papel que conta, limite de tentativas e mecanismo de aprovação.

## UC-07 — Revisar relatório e encerrar

**Ator:** ADMIN.
1. Consulta resumo e detalhamento por categoria, produto e usuário.
2. Filtra pendentes, divergências e itens em revisão.
3. Decide por recontagem, aprovação de contagem ou ajuste motivado conforme política.
4. Sistema valida condições para encerramento; ADMIN confirma.
5. Transação registra resultado final, data/usuário, estado ENCERRADO e auditoria.

**Alternativa:** itens pendentes ou sem resultado aprovado bloqueiam o encerramento conforme política a definir. Balanço encerrado não pode ser editado.

## UC-08 — Exportar relatório

**Ator:** ADMIN. Seleciona balanço, formato XLSX/PDF e filtros; sistema gera arquivo com período, unidade, referência, final, diferença, status, autoria e horário. Exportação deve respeitar permissões e registrar evento de exportação quando necessário.

## UC-09 — Gerar/ imprimir QR Code

**Ator:** ADMIN. Seleciona produto; sistema gera token opaco único ou reutiliza identificador ativo; painel apresenta etiqueta com nome e código interno; ADMIN imprime e valida leitura em celular. Revogação invalida usos futuros e é auditada.

## UC-10 — Backup e restauração

**Ator:** Operador. Executa backup automatizado para destino distinto do host; verifica sucesso e retenção; em exercício controlado restaura em ambiente isolado e verifica balanços/contagens. Registrar data, versão e resultado do teste.

## Matriz resumida ator x caso

| Caso | ADMIN | VENDEDOR | Operador |
|---|---:|---:|---:|
| Importar/cadastrar catálogo | Sim | Não | Não |
| Criar/abrir/encerrar balanço | Sim | Não | Não |
| Consultar pendências/contar | Se permitido | Sim | Não |
| Revisar/aprovar recontagem | Sim | Não | Não |
| Relatório/exportação completa | Sim | Pendente | Não |
| Backup/restauração | Opcional | Não | Sim |