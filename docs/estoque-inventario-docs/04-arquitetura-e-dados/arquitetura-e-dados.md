# Arquitetura e dados

## 1. Arquitetura lógica

```text
[App Android/iOS: React Native + Expo]
               \
                \ HTTPS/LAN (API REST)
                 > [Backend Node.js + Express] ---> [PostgreSQL]
                /             |
[Admin Web: React + Vite]      +--> importação/exportação, QR, auditoria
```

Clientes nunca acessam o banco diretamente. Backend é a autoridade para identidade, autorização, validação, estado do balanço, congelamento de referência e consistência concorrente.

## 2. Tecnologias propostas

| Camada | Proposta | Observações |
|---|---|---|
| Android/iOS | React Native, Expo, TypeScript | Validar biblioteca/SDK de câmera em dispositivos reais de ambas as plataformas. |
| Painel | React, Vite, TypeScript | Navegador no computador administrativo. |
| API | Node.js, Express, TypeScript | Modular; validação server-side com Zod. |
| Persistência | PostgreSQL + Prisma | Migrações versionadas; transações para ações críticas. |
| Planilhas | ExcelJS | CSV e XLSX; códigos importados como texto. |
| QR/etiquetas | `qrcode` e layout imprimível | Token opaco, não dado de negócio sensível. |
| Exportação PDF | PDFKit | Evitar dependência em fontes indisponíveis no host. |
| Testes | Vitest + Supertest | Testes unitários, integração e API. |
| Desenvolvimento | Docker Compose | Banco local; política de produção/backup separada. |

Versões de dependências devem ser fixadas no repositório após validação de compatibilidade.

## 3. Módulos sugeridos no backend

`auth`, `users`, `categories`, `products`, `imports`, `identifiers`, `balances`, `counts`, `reports`, `audit`, `health`. Cada módulo deve separar rotas/controladores, schemas de validação, serviços de domínio e acesso a dados. Regras críticas ficam nos serviços de domínio e no banco (constraints), não apenas na UI.

## 4. Modelo lógico de dados

### `categorias`
- `id UUID PK`, `nome` único (normalização definida), `ativo`, timestamps.

### `produtos`
- `id UUID PK`, `codigo_interno` único, `categoria_id FK`, `nome`, `unidade`, `ativo`, timestamps.
- Não armazenar um saldo atual mutável como única fonte histórica.

### `identificadores`
- `id UUID PK`, `produto_id FK`, `tipo`, `valor_normalizado`, `ativo`, timestamps.
- Índice único parcial para identificador ativo (valor normalizado único entre ativos).

### `usuarios`
- `id UUID PK`, `nome`, `login` único, `senha_hash`, `papel`, `ativo`, timestamps.
- Senha nunca é retornada por API.

### `balancos`
- `id UUID PK`, `nome`, `status`, `criado_por FK`, timestamps de criação/abertura/encerramento, `motivo_cancelamento` opcional.

### `itens_balanco`
- `id UUID PK`, `balanco_id FK`, `produto_id FK`, `quantidade_referencia NUMERIC(14,3)`, `quantidade_final NUMERIC(14,3)` nullable, `status`, `contagem_aprovada_id` nullable.
- Unique `(balanco_id, produto_id)`.
- Congelar quantidade de referência no momento da abertura.

### `contagens`
- `id UUID PK`, `item_balanco_id FK`, `usuario_id FK`, `quantidade_informada NUMERIC(14,3)`, `contado_em` timestamp do servidor, `observacao` opcional, `idempotency_key`.
- Imutável; uma recontagem insere outro registro.

### `auditoria`
- `id UUID PK`, `usuario_id FK nullable para eventos de sistema`, `acao`, `tipo_objeto`, `objeto_id`, `criado_em`, metadados não sensíveis.
- Acesso restrito; não usar como log de segredos.

### Entidades possivelmente necessárias

- `lotes_importacao` e `linhas_importacao` para prévia/repetição/auditoria de importações.
- Tabela/configuração de `unidades` para escala decimal válida.
- `sessões`/refresh tokens se escolhida autenticação por token persistente.

## 5. Integridade transacional

1. Abertura: validar seleção e origem de referência; criar itens e referências; alterar estado do balanço na mesma transação.
2. Contagem: validar balanço/item/usuário; aplicar chave idempotente e concorrência; inserir contagem e atualizar status do item atomicamente.
3. Aprovação: selecionar contagem ou ajuste motivado, gravar `quantidade_final` e vínculo aprovado; auditoria na mesma transação.
4. Encerramento: validar itens de acordo com política definida, fixar encerramento e estado em transação.
5. Importação: aplicar lote validado transacionalmente, com política explícita de erros e conflitos.

## 6. Rede, execução e segurança

- Host da loja com IP reservado no roteador; porta de API exposta apenas à LAN e firewall limitado.
- Não abrir encaminhamento de porta para internet. Acesso remoto futuro requer desenho separado.
- Definir solução HTTPS confiável no Android/iOS antes de produção (por exemplo, domínio local/certificado instalável gerido); não contornar validação TLS.
- Segredos em variáveis de ambiente/gerenciador apropriado, nunca no repositório.
- Banco não exposto aos celulares; credenciais mínimas para aplicação.
- Logs, health check e monitoramento de espaço/backup.

## 7. Estrutura sugerida de repositório

```text
estoque-inventario/
├── apps/
│   ├── mobile/       # Android Expo
│   ├── web/          # painel React
│   └── api/          # Express + Prisma
├── packages/shared/  # tipos/esquemas compartilháveis quando apropriado
├── docs/             # esta documentação
├── docker-compose.yml
├── .env.example
└── README.md
```

## 8. Decisões técnicas ainda abertas

- Estratégia de HTTPS/certificado na LAN e descoberta/configuração do endereço da API no app.
- Estratégia de autenticação (sessão/JWT), expiração, logout e gestão de senha.
- Política de origem da quantidade de referência e primeiro saldo.
- Precisões/unidades e regra de arredondamento.
- Se múltiplos balanços abertos podem conter o mesmo produto.
- Política de retenção, destino e criptografia de backups.