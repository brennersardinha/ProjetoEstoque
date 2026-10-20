# Aplicativo mobile Estoque

Este é o cliente instalado nos celulares dos vendedores, compatível com Android e iOS.

## Teste na rede local

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.1.50:3000/api"
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
