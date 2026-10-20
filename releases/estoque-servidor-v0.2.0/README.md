# Sistema de Inventário

Monorepo do sistema local de inventário da loja. A implementação segue a documentação em `docs/estoque-inventario-docs`.

## Estado atual

A fundação executável está criada com:

- API Express em TypeScript com health check, CORS restrito e headers de segurança.
- Banco PostgreSQL local via Docker Compose.
- Pacote compartilhado com unidades, papéis, estados e validação inicial de quantidades.
- Ciclo de balanço com abertura, referência congelada, contagem idempotente, recontagem autorizada, aprovação e encerramento protegido.
- Importação CSV/XLSX com prévia, hash, validação por linha e confirmação transacional.
- Painel web administrativo com login, dashboard, catálogo, importação e abertura de balanços.
- Aplicativo Expo multiplataforma para Android e iOS com login, balanços, leitura de QR/barcode e registro confirmado de contagem.

Os módulos de autenticação, catálogo, importação, balanços, relatórios e clientes serão implementados sobre essa base. O sistema não deve ser usado em produção antes da conclusão dos testes e do checklist de implantação.

## Desenvolvimento

1. Copie `.env.example` para `.env` e altere os segredos.
2. Para desenvolvimento, inicie o banco com `docker compose up -d postgres` (a porta local deste projeto é `5433`).
3. Instale dependências com `npm install`.
4. Inicie a API com `npm run dev:api`.
5. Verifique `http://localhost:3000/api/health`.

Para subir o backend e o banco juntos em container, copie `.env.example` para `.env`, defina um `JWT_SECRET` real e execute `docker compose up -d --build`. O container aplica as migrações automaticamente antes de iniciar a API, que fica em `http://localhost:3000` e usa o PostgreSQL interno do Compose. `WEB_ORIGIN` aceita uma lista de origens separadas por vírgula.

Para executar o painel web em desenvolvimento, em outro terminal use `npm --workspace apps/web run dev`. Ele ficará disponível em `http://localhost:5173` e consumirá a API em `http://localhost:3000/api`. Para apontar para outro endereço, defina `VITE_API_URL`.

## Uso diário no Windows

Depois da instalação inicial, não é necessário abrir o projeto nem executar comandos manualmente. Dê duplo clique em `Iniciar Estoque.cmd` na raiz do projeto. O inicializador sobe o PostgreSQL e a API no Docker, inicia o painel web e abre `http://localhost:5173` no navegador. Para encerrar, use `Parar Estoque.cmd`; os dados do banco são preservados.

O Docker Desktop precisa estar aberto. Na primeira execução, o arquivo `.env` precisa existir e conter um `JWT_SECRET` real. Para acesso pelos celulares, use o IP do computador na rede local e libere as portas TCP 3000 e 5173 no firewall privado do Windows.

Para executar o aplicativo mobile, use um endereço acessível pelo aparelho na rede local, não `localhost`:

`$env:EXPO_PUBLIC_API_URL="http://IP-DO-COMPUTADOR:3000/api"`

Depois execute `npm --workspace apps/mobile run start`. O mesmo projeto Expo pode abrir no Android ou iOS com `npm --workspace apps/mobile run android` e `npm --workspace apps/mobile run ios` (o comando iOS requer macOS/Xcode para build nativo; no Windows, use Expo Go em um iPhone para desenvolvimento). A API deve estar acessível pelo Wi-Fi da loja e o firewall deve permitir a porta da API somente na LAN.

Para criar o primeiro administrador, configure `DATABASE_URL` e `JWT_SECRET` no ambiente da API e execute:

`npm --workspace apps/api run create-admin -- "Nome do administrador" login "uma-senha-com-no-minimo-12-caracteres"`

Para criar vendedores, use o mesmo comando e informe `VENDEDOR` como último argumento:

`npm --workspace apps/api run create-admin -- "Nome do vendedor" login "uma-senha-com-no-minimo-12-caracteres" VENDEDOR`

Use um login exclusivo e uma senha individual para cada pessoa. Não compartilhe senhas entre vendedores nem as coloque no código. Não existe usuário ou senha padrão no código. O logout invalida a sessão no cliente; o token JWT expira em oito horas.

Ao cadastrar um produto manualmente ou por importação, o servidor gera um QR Code opaco e único automaticamente. No painel, use `Produtos > Imprimir QR` para abrir uma etiqueta pronta para impressão com o QR Code, nome e código interno. Ao escanear a etiqueta no aplicativo, o vendedor é direcionado ao produto do balanço; ao salvar, a quantidade, o vendedor e o horário do servidor ficam registrados.

O banco não deve ser exposto à internet. Antes do piloto, ainda é necessário configurar HTTPS confiável na LAN, contas reais, política de backup e restauração.

## Aplicativo desktop instalável

Para gerar o instalador Windows do painel, execute `npm run build:desktop`. O arquivo será criado em `release/Estoque Setup 0.1.0.exe`. O instalador cria atalhos no Menu Iniciar e na Área de Trabalho e abre o painel em uma janela própria do aplicativo. O Docker Desktop continua sendo necessário para executar o banco e a API localmente.
