# Operação local

## Iniciar

Na raiz do projeto, crie `.env` a partir de `.env.example`, defina um `JWT_SECRET` com pelo menos 32 caracteres e execute:

```powershell
docker compose up -d --build
Invoke-RestMethod http://localhost:3000/api/health
```

O container da API aplica as migrações Prisma automaticamente.

No catálogo, administradores podem editar categorias e produtos sem informar a senha novamente durante a sessão autenticada. A exclusão de categorias e produtos continua exigindo a senha do administrador. Uma categoria só pode ser excluída quando não possui produtos ativos nem vínculos com balanços; nesse caso, a API informa o vínculo que precisa ser resolvido.

## Solados com grade de numeração

Produtos com unidade `PAR` são solados contados por numeração, do 34 ao 40. Cadastre cada referência uma única vez (no painel ou pela importação de planilha, informando `PAR` na coluna de unidade); ela recebe um único QR Code. Ao criar um balanço, cada referência em `PAR` gera um item por numeração, sem saldo de referência. No aplicativo, a leitura do QR abre a grade da referência para informar a quantidade de pares de cada numeração; o detalhe e o relatório impresso do balanço mostram a grade com o total de pares por referência.

As portas publicadas podem ser alteradas no `.env` sem mudar as portas internas dos containers:

```dotenv
API_PORT=3000
POSTGRES_PORT=5433
```

Se uma porta estiver ocupada, descubra o processo responsável antes de trocar a configuração:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess
Get-Process -Id <PID>
docker compose ps
docker compose logs --tail=100 api
```

Não use uma porta diferente apenas no Docker sem atualizar também `VITE_API_URL` no build do painel e `EXPO_PUBLIC_API_PORT` no build do aplicativo mobile. O aplicativo descobre o IP do computador sozinho na rede Wi-Fi; não é necessário fixar IP no build.

Para o uso diário no Windows, dê duplo clique em `Iniciar Estoque.cmd` na raiz do projeto. Ele verifica o Docker, sobe os serviços, valida o health check da API, inicia o painel web e abre o navegador. Use `Parar Estoque.cmd` para parar os serviços sem apagar o volume do PostgreSQL.

Para cadastrar um vendedor no servidor local, execute na raiz do projeto:

```powershell
npm --workspace apps/api run create-admin -- "Nome do vendedor" login "senha-com-no-minimo-12-caracteres" VENDEDOR
```

Repita o comando com outro nome, login e senha para o segundo vendedor.

Produtos criados manualmente ou por importação recebem QR Code único automaticamente. No painel administrativo, a ação `Imprimir QR` gera a etiqueta com o nome do produto abaixo do código. O aplicativo resolve o QR contra o servidor e a API registra a quantidade, o usuário autenticado e o horário da operação.

Também é possível usar `Estoque.exe`, gerado para iniciar o mesmo fluxo com duplo clique. Se o executável ainda não estiver presente em uma cópia do projeto, execute `csc.exe /target:exe /out:Estoque.exe scripts\WindowsLauncher.cs` na raiz.

Para gerar o instalador real do painel desktop, execute `npm run build:desktop`. O instalador aparece em `release/` e cria atalhos do aplicativo.

## Backup

Execute antes de importações ou fechamentos importantes:

```powershell
npm run backup:db
```

Os arquivos são gravados em `backups/`, que não é versionado. Copie-os para outro dispositivo ou armazenamento protegido.

Antes de atualizar uma instalação em uso, gere e confira um backup. A API aplica migrations pendentes ao iniciar; portanto, o backup deve ser feito antes de iniciar a nova versão.

## Recuperação de falha em migration

As migrations são aplicadas em ordem e não têm scripts de downgrade automático. A migration `20261016130000_model_integrity_constraints` usa `BEGIN`/`COMMIT` explicitamente para que falhas revertam todas as suas alterações no PostgreSQL. Se ela falhar, preserve os logs e os dados, corrija a causa indicada e marque a tentativa como revertida para o Prisma tentar novamente:

```powershell
docker compose run --rm --no-deps --entrypoint npx api prisma migrate resolve --rolled-back 20261016130000_model_integrity_constraints --schema apps/api/prisma/schema.prisma
```

Em seguida, inicie novamente a mesma versão. Não apague nem edite manualmente registros de `_prisma_migrations`. Para uma migration antiga sem transação explícita, pare e inspecione o estado do banco antes de resolver a migration; não presuma que mudanças parciais foram revertidas.

A migration de integridade do modelo normaliza logins para minúsculas e espaços externos. Antes disso, ela verifica colisões sem diferenciar maiúsculas/minúsculas; em caso de colisão, para sem alterar contas e exige que um administrador escolha os logins corretos. Faça backup antes de resolver a colisão.

Se for necessário voltar à versão anterior depois de uma migration concluída, pare a API, restaure o backup completo feito antes da atualização e só então inicie a versão anterior. A restauração substitui os dados atuais. Use o procedimento de [Restauração](#restauração) e confirme que o arquivo restaurado é o backup correto. Não restaure um backup antigo sobre uma instalação que recebeu novas operações sem antes preservar essas operações.

## Restauração

```powershell
npm run restore:db -- .\backups\estoque-AAAAMMDD-HHMMSS.sql
```

O comando exige a confirmação literal `RESTAURAR` e substitui os dados atuais.

## Mobile

O comando `npm --workspace apps/mobile run build` valida apenas TypeScript. Para gerar os diretórios nativos, execute `npm --workspace apps/mobile run native:prebuild`; o EAS Build também gera esses diretórios automaticamente quando `apps/mobile/android` não existe.
