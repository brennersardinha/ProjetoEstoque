# Implantação e operação

## 1. Topologia de produção inicial

O computador da loja executa API e PostgreSQL; painel é acessado pelo navegador; Android acessa a API na LAN. A API e o banco não devem ser expostos diretamente à internet. O banco só aceita conexões locais/de containers autorizados.

## 2. Pré-requisitos a confirmar

- Computador dedicado ou estável, sistema operacional suportado, espaço e memória suficientes.
- IP reservado no roteador; Wi-Fi com cobertura no local de contagem.
- Androids suportados e câmera funcional.
- Política aprovada de HTTPS e certificado confiável para Android.
- Destino de backup fora do computador principal, retenção e pessoa responsável.
- Impressora e consumíveis para etiquetas se QR próprio for usado.

## 3. Sequência de implantação

1. Preparar host e contas de serviço com privilégio mínimo.
2. Instalar runtime/containerização conforme decisão da equipe; proteger acesso ao host.
3. Configurar variáveis/segredos fora do repositório; revisar `.env.example`.
4. Iniciar PostgreSQL e aplicar migrações versionadas.
5. Criar primeiro ADMIN por fluxo seguro; não usar credenciais padrão permanentes.
6. Configurar API, firewall, hostname/IP e certificado TLS; validar de cada Android.
7. Abrir painel local, importar planilha de teste e revisar erros antes de produção.
8. Importar catálogo aprovado e gerar/imprimir etiquetas necessárias.
9. Criar contas individuais, abrir balanço piloto e treinar equipe.
10. Verificar backup inicial, monitoramento e procedimento de retorno/rollback.

## 4. Operação diária

- Antes do balanço: confirmar host, API, banco, Wi-Fi, bateria dos aparelhos e backup recente.
- Durante o balanço: acompanhar contagens, conflitos e pendências; não desligar host; vendedores devem aguardar confirmação de gravação.
- No encerramento: revisar itens pendentes/em revisão, aprovar resultados conforme política e exportar relatório.
- Após o balanço: confirmar estado ENCERRADO, validar relatório e manter exportação/backup conforme política.

## 5. Backup e restauração

**Política a definir antes do piloto:** frequência, retenção, criptografia, destino, responsável e tempo aceitável de recuperação/perda de dados (RTO/RPO). Recomendação mínima: backup automatizado diário e cópia independente do host, além de backup antes de atualização/migração relevante.

### Verificação periódica

- Confirmar que o job terminou com código de sucesso e tamanho plausível.
- Registrar data, versão, destino e resultado.
- Restaurar periodicamente em ambiente isolado, nunca sobrescrevendo produção durante teste.
- Conferir quantidade de produtos, balanços, itens e contagens; testar login e relatório.
- Revogar/copiar segredos apenas conforme procedimento seguro; backups devem ser protegidos.

### Recuperação de falha

1. Interromper gravações se houver risco de corrupção e comunicar responsáveis.
2. Preservar logs e cópia do estado atual antes de restaurar.
3. Identificar último backup íntegro e impacto desde então.
4. Restaurar em host/ambiente controlado, validar integridade e obter autorização operacional.
5. Reabrir serviço, validar cliente Android/painel e registrar incidente, causa e ações preventivas.

## 6. Atualização e rollback

- Fazer backup verificado antes de atualizar.
- Aplicar migrações compatíveis e em ordem; testar em cópia antes da produção.
- Planejar manutenção e impedir novas contagens durante migração.
- Validar endpoints, login, leitura, gravação, relatório e backup após atualização.
- Se falhar, seguir procedimento de rollback documentado; não editar dados diretamente no banco sem auditoria/plano de recuperação.

## 7. Incidentes comuns

| Sintoma | Verificação inicial | Ação |
|---|---|---|
| App não encontra servidor | Wi-Fi, IP reservado, processo da API, firewall/TLS | Não contar como salvo; restaurar conectividade e consultar estado antes de reenviar. |
| QR/barcode não resolve | Identificador ativo, foco/iluminação, associação do produto | Corrigir vínculo no painel; não usar nome como substituto ambíguo. |
| Contagem já registrada | Estado do item e chave de requisição | Não sobrescrever; solicitar recontagem autorizada se necessário. |
| Importação apresenta erros | Colunas, zeros à esquerda, categorias/unidades e duplicatas | Baixar relatório, corrigir fonte e gerar nova prévia. |
| Banco/host indisponível | Espaço, serviço, logs e integridade | Suspender contagem; restaurar conforme procedimento. |

## 8. Checklist de encerramento do piloto

- [ ] Operadores conseguem resolver problemas básicos sem registrar contagem falsa.
- [ ] Backup fora do host e restauração ensaiada.
- [ ] Contas/permissões revisadas e contas inativas desativadas.
- [ ] Exportação bate com dados da tela e unidades.
- [ ] Pendências e decisões abertas registradas para próxima versão.