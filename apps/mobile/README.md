# Aplicativo mobile Estoque

Este é o cliente instalado nos celulares dos vendedores, compatível com Android e iOS.

## Conexão com o servidor

O aplicativo encontra o servidor sozinho, sem IP fixo no build. A cada abertura ele tenta, nesta ordem:

1. o último servidor que funcionou (salvo no aparelho);
2. `EXPO_PUBLIC_API_URL`, se definido no build;
3. o host do Metro, quando rodando pelo Expo Go;
4. uma varredura da rede Wi-Fi do celular (`/24`) procurando `http://IP:3000/api/health` com `service: "estoque-api"`.

Se o computador da loja mudar de IP, a próxima requisição que falhar dispara uma nova busca automaticamente. Na tela de login há ainda **Procurar novamente** e **Informar endereço** (por exemplo `192.168.0.10`), caso a rede bloqueie a varredura. O inicializador `Iniciar Estoque.cmd` mostra o IP atual do computador.

Se a API for publicada em outra porta (`API_PORT` no `.env`), gere o aplicativo com `EXPO_PUBLIC_API_PORT` com o mesmo valor. A porta precisa estar liberada no Firewall do Windows para a rede privada.

```powershell
npm --workspace apps/mobile run start
```

`localhost` aponta para o próprio celular, não para o computador da loja. Em produção, use HTTPS com certificado confiável nos aparelhos.

## Gerar aplicativo instalável

O projeto usa EAS Build:

```powershell
npm install --global eas-cli
eas login
```

APK de teste para Android:

```powershell
$env:EXPO_PUBLIC_API_URL="https://estoque.local/api"
npm --workspace apps/mobile run build:android:preview
```

Pacote Android para publicação:

```powershell
npm --workspace apps/mobile run build:android:production
```

Build iOS para TestFlight/ad hoc:

```powershell
$env:EXPO_PUBLIC_API_URL="https://estoque.local/api"
npm --workspace apps/mobile run build:ios:preview
```

A distribuição iOS exige Apple Developer e a distribuição Android exige uma conta Google Play para publicação. Os identificadores `com.projetoestoque.inventario` são provisórios e devem ser substituídos pelo identificador oficial da empresa antes da publicação.
