# Estoque — pacote do servidor 0.2.0

Este pacote contém os fontes da API e painel web, a migration da foto do produto e os arquivos para implantação local com Docker Compose. Requer Windows com Docker Desktop e Node.js 20 ou superior para o painel local.

1. Extraia o ZIP para uma pasta permanente.
2. Copie `.env.example` para `.env` e configure `JWT_SECRET` com uma chave aleatória forte. Ajuste `WEB_ORIGIN` se acessar por outro endereço.
3. No primeiro uso, instale dependências com `npm ci`.
4. Inicie com duplo clique em `Iniciar Estoque.cmd`; a API executa as migrations pendentes automaticamente.
5. Para atualizar uma instalação anterior, faça backup do banco antes, substitua os fontes e execute `Iniciar Estoque.cmd`. O Docker preserva os volumes do banco e das fotos dos produtos.

O link Expo do APK Android é separado. Este ZIP é o pacote de implantação do servidor/painel, não um instalador Windows autônomo.
