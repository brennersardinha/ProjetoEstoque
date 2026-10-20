# Testes e critérios de aceite

## 1. Estratégia

A qualidade deve ser verificada em quatro níveis: testes unitários das regras de domínio; testes de integração com PostgreSQL/migrações; testes de API com autenticação e permissões; testes ponta a ponta no Android e painel em rede local. As operações de abertura, contagem, recontagem, aprovação e encerramento exigem testes de concorrência/transação. Antes do piloto, testar em celulares reais e com cópia da planilha representativa.

## 2. Casos de teste prioritários

| ID | Cenário | Resultado esperado |
|---|---|---|
| T-01 | Login válido/inválido | Sessão válida apenas para credencial ativa; erro não revela se login existe. |
| T-02 | Vendedor tenta criar produto/encerrar balanço | `403`; nenhum dado alterado. |
| T-03 | Importação XLSX com zeros à esquerda | Código é preservado literalmente. |
| T-04 | Importação com coluna obrigatória ausente | Prévia aponta erro; nenhum dado definitivo gravado. |
| T-05 | Código interno duplicado na planilha | Conflito apresentado por linha; política de reimportação aplicada sem duplicata. |
| T-06 | Identificador ativo associado a dois produtos | Segundo vínculo é recusado por validação/constraint. |
| T-07 | Importação confirmada e falha intermediária | Transação reverte; não há lote parcial não declarado. |
| T-08 | Abrir balanço | Itens criados uma vez e referências congeladas. |
| T-09 | Alterar saldo-base após abertura | Referência do balanço aberto continua idêntica. |
| T-10 | Ler QR válido / barcode válido | Produto correto localizado, sem depender do nome. |
| T-11 | Ler código desconhecido/revogado | Mensagem clara; nenhuma contagem criada. |
| T-12 | Produto válido fora do balanço | Contagem recusada; usuário pode retornar à lista. |
| T-13 | Quantidade negativa, malformada ou precisão excessiva | Validação bloqueia; nenhum registro inserido. |
| T-14 | Contagem inicial normal | Quantidade, usuário autenticado e timestamp servidor gravados juntos. |
| T-15 | Repetir requisição com mesma chave idempotente | Mesmo resultado, sem contagem duplicada. |
| T-16 | Repetir com chave nova após item contado | Conflito; não sobrescreve primeira contagem. |
| T-17 | Dois celulares contam simultaneamente o mesmo item | Apenas uma primeira contagem efetivada; outra recebe conflito. |
| T-18 | Timeout durante gravação | UI não afirma sucesso; consulta estado antes de sugerir retry. |
| T-19 | Recontagem autorizada | Novo registro mantém contagem anterior e registra motivo/autor. |
| T-20 | Aprovar contagem | Quantidade final aponta para resultado selecionado; auditoria criada. |
| T-21 | Encerrar com pendências | Comportamento segue política definida; não encerra indevidamente. |
| T-22 | Relatório de unidades mistas | Não soma unidades incompatíveis; diferenças usam unidade de cada produto. |
| T-23 | Referência zero | Percentual aparece como N/A; diferença absoluta permanece correta. |
| T-24 | Exportação com texto iniciado por fórmula | Célula neutralizada; não executa fórmula ao abrir planilha. |
| T-25 | Balanço encerrado | Conteúdo histórico não pode ser editado silenciosamente. |
| T-26 | Backup e restauração isolada | Dados restaurados conferem; versão e procedimento registrados. |
| T-27 | API indisponível durante leitura/envio | App informa estado de conexão e não perde/declara gravação inexistente. |
| T-28 | Android: permissão de câmera negada | Fluxo explica como reabilitar; app não trava. |
| T-29 | Impressão/escaneamento de QR em etiqueta | Código legível em dispositivo real sob distância/iluminação usuais. |
| T-30 | Carga de catálogo estimada | Pesquisa/resolução atende meta inicial de até 2 s na LAN, ou meta é revista com medição. |

## 3. Testes de segurança mínimos

- Rotas sem token, token inválido/expirado e papel incorreto.
- Tentativa de alterar `usuario_id`, papel, quantidade de referência ou status pelo cliente.
- Enumeração de produtos/balanços não autorizados.
- Rate limit de autenticação; upload malicioso ou excessivo; validação de MIME/conteúdo.
- CORS/firewall, TLS/certificado no Android e exposição de portas.
- Segredos ausentes de logs e arquivos versionados.
- Backup não acessível por usuários não autorizados.

## 4. Critérios de aceite do MVP

- Catálogo pode ser importado de XLSX/CSV com mapeamento, prévia, validação e tratamento de erros.
- Zeros à esquerda preservados e códigos duplicados tratados sem associação ambígua.
- QR próprio pode ser criado, impresso e lido em Android real; barcode comercial compatível também é validado.
- Balanço aberto captura fotografia imutável de referência para cada item.
- Vendedor autenticado registra contagem; autoria e horário são fornecidos pelo sistema.
- Duplicidade, retry e concorrência não sobrescrevem contagens.
- Recontagens permanecem no histórico e há mecanismo de aprovação definido.
- Relatórios e exportações por categoria/produto/vendedor apresentam referência, final, divergência e unidade.
- Encerramento preserva histórico e resultado aprovado é fonte para balanço posterior.
- Falha de rede nunca gera confirmação falsa de gravação.
- Backup e restauração são testados e documentados.
- Segurança de acesso local e configuração HTTPS/certificados foi validada no ambiente de implantação.

## 5. Evidências de teste

Guardar data, versão/build, dispositivo/ambiente, passos, resultado esperado/observado, evidência (sem dados pessoais desnecessários), defeitos abertos e responsável. Nenhum defeito crítico de integridade, autenticação ou perda de dados pode permanecer aberto no início do piloto.