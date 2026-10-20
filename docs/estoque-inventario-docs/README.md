# Documentação do Sistema de Inventário

**Versão:** 1.0 · **Status:** Base consolidada para desenvolvimento · **Idioma:** pt-BR

Este conjunto transforma o planejamento original em documentação de produto, requisitos, arquitetura, operação e qualidade para um sistema local de inventário de estoque.

## Navegação

| Pasta | Conteúdo |
|---|---|
| `01-visao-e-escopo/` | Objetivo, escopo do MVP, exclusões e critérios de sucesso |
| `02-requisitos/` | Requisitos funcionais, não funcionais e regras de negócio |
| `03-casos-de-uso/` | Atores, casos de uso e fluxos principais/alternativos |
| `04-arquitetura-e-dados/` | Arquitetura, entidades, integridade e decisões técnicas |
| `05-api-e-integracoes/` | Contrato inicial REST e importação/exportação |
| `06-interface/` | Mapa de telas e comportamento esperado |
| `07-testes-e-qualidade/` | Estratégia, casos de teste e critérios de aceite |
| `08-entrega-e-operacao/` | Checklist de desenvolvimento, implantação, backup e suporte operacional |
| `09-gestao/` | Roadmap, riscos, decisões e pendências |

## Ordem recomendada de leitura

1. [Visão e escopo](01-visao-e-escopo/visao-e-escopo.md)
2. [Requisitos funcionais e não funcionais](02-requisitos/requisitos.md)
3. [Regras de negócio](02-requisitos/regras-de-negocio.md)
4. [Casos de uso](03-casos-de-uso/casos-de-uso.md)
5. [Arquitetura e modelo de dados](04-arquitetura-e-dados/arquitetura-e-dados.md)
6. [Contrato da API](05-api-e-integracoes/api-rest.md)
7. [Telas e fluxos](06-interface/telas-e-fluxos.md)
8. [Testes e aceite](07-testes-e-qualidade/testes-e-aceite.md)
9. [Checklist de desenvolvimento](08-entrega-e-operacao/checklist-desenvolvimento.md)

## Premissas consolidadas

- Aplicativo **Android** para vendedores; painel administrativo **web**.
- Servidor e banco ficam no computador da loja; os clientes acessam pela rede local.
- Stack proposta no planejamento: React Native + Expo + TypeScript, React + Vite, Node.js + Express, PostgreSQL + Prisma.
- A identificação aceita códigos de barras existentes e QR Codes próprios para produtos sem código utilizável.
- Importação inicial de XLSX/CSV com mapeamento, prévia, validação e confirmação explícita.
- Um balanço congela a quantidade de referência na abertura. Contagens e recontagens são históricas e auditáveis.
- Não há controle de vendas/compras nem operação offline completa no MVP.

## Convenções e limites

Este material é uma especificação inicial, não substitui validação com a loja nem decisões de implementação. Itens marcados **PENDENTE** precisam ser resolvidos antes da funcionalidade correspondente. Estimativas são indicativas e não garantias de prazo. A segurança de rede/HTTPS, o formato final de etiquetas e a política de recontagem exigem validação técnica no ambiente real.

## Fonte

Consolidado a partir do arquivo `Planejamento.md` fornecido pelo solicitante. Em caso de conflito entre trechos, prevalece a especificação técnica mais recente e explícita: Android, códigos de barras existentes + QR, painel web, servidor local e MVP de inventário.