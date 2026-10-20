# Roadmap, estimativas e riscos

## 1. Roadmap sugerido

| Fase | Entregas | Dependências/saída |
|---|---|---|
| 0. Decisões | Planilha real, unidades, origem do primeiro saldo, encerramento/recontagem, rede/HTTPS | Decisões críticas registradas em `decisoes-e-pendencias.md` |
| 1. Fundação | Monorepo, TypeScript, PostgreSQL, Prisma, migrações, CI, observabilidade | Ambiente reproduzível e migrações testadas |
| 2. Identidade e catálogo | Login, papéis, categorias, produtos, identificadores | Testes de autorização e unicidade aprovados |
| 3. Importação | Mapeamento, prévia, validação, confirmação, relatório de erros | Testado com arquivo real anonimizado |
| 4. QR/barcode | Resolução, geração e etiqueta | Leitura validada em Android e impressora reais |
| 5. Domínio do balanço | Rascunho, abertura, referência, contagens, recontagem, aprovação, encerramento | Regras de concorrência/idempotência aprovadas |
| 6. Aplicações | Fluxos Android e painel web | Integração via contrato API |
| 7. Relatórios | Dashboard, filtros, XLSX/PDF | Totais/unidades validados com usuário |
| 8. Qualidade e implantação | Segurança, restauração, treinamento e piloto | Aceite do MVP e plano de operação |

## 2. Estimativas indicativas da fonte

O planejamento estima **17–29 dias úteis** para desenvolvimento individual, com reserva de **4–6 semanas** para ajustes e testes. As estimativas dependem do estado do catálogo, experiência da equipe, compatibilidade de câmera/HTTPS e qualidade da planilha. Não incluem integração ERP/PDV nem saneamento manual extenso; não são compromisso de entrega.

## 3. Riscos

| Risco | Probabilidade/impacto | Mitigação |
|---|---|---|
| Planilha inconsistente/duplicada | Alta/alto | Amostra antecipada, prévia, relatório de erros e piloto. |
| Referência inicial ambígua | Média/alto | Decidir origem do saldo-base antes de criar balanços. |
| Perda de Wi-Fi/servidor | Média/alto | Feedback explícito, sem confirmação falsa, rede testada e plano de contingência; offline completo fora do MVP. |
| Certificado HTTPS difícil em Android local | Média/alto | Prototipar TLS na primeira fase; não relaxar segurança em produção. |
| Contagem duplicada/conflito | Média/alto | Unique constraints, idempotência, transações e testes concorrentes. |
| QR ilegível em etiqueta/ambiente | Média/médio | Testar impressora, dimensões e celulares reais. |
| Recontagem sem regra clara | Alta/alto | Definir política de autorização/aprovação antes do módulo de revisão. |
| Host único falha | Média/alto | Backup fora do host, restauração testada, controle de energia e disco. |
| Unidades/precisão erradas | Média/alto | Dicionário de unidades e regras de casas decimais; não agregar unidades diferentes. |
| Escopo cresce para ERP | Média/médio | Manter exclusões do MVP e aprovar mudança de escopo conscientemente. |

## 4. Gestão de mudança

Qualquer requisito adicional deve registrar motivo, impacto em dados/API/UI/testes e prazo. Mudanças que alterem referência, concorrência, identificação, offline ou autenticação exigem revisão de arquitetura e plano de migração. Itens marcados PENDENTE não devem ser tratados como decisão já tomada.