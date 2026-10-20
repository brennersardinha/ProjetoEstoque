# Glossário

| Termo | Definição |
|---|---|
| **Balanço / inventário** | Sessão de contagem com lista de produtos, referências congeladas, contagens, revisão e encerramento. |
| **Quantidade de referência** | Valor base registrado no início do balanço, usado para comparar a contagem física. Não é atualizado durante a contagem. |
| **Contagem** | Registro imutável de quantidade física informada por usuário autenticado em determinado item de balanço. |
| **Recontagem** | Nova contagem autorizada para um item já contado; não apaga a contagem anterior. |
| **Quantidade final** | Resultado escolhido/aprovado para o item no encerramento. Pode corresponder a uma contagem ou ajuste justificado. |
| **Divergência** | Quantidade final menos quantidade de referência, apresentada na unidade do produto. |
| **Produto** | Registro permanente do item do catálogo, identificado por ID e código interno. |
| **Identificador** | Barcode comercial ou token QR associado a um produto; deve ser único enquanto ativo. |
| **Código interno** | Identificador permanente atribuído no sistema à loja; não deve ser confundido com o nome ou barcode. |
| **QR próprio** | QR Code que codifica token opaco para localizar o produto no servidor. Não carrega saldo ou dado sensível. |
| **Item de balanço** | Associação entre um produto e um balanço, incluindo quantidade de referência e resultado final. |
| **Importação em prévia** | Etapa que valida e apresenta resultados/erros sem efetivar alterações definitivas. |
| **Idempotência** | Propriedade de repetir a mesma requisição sem duplicar ou alterar o efeito já confirmado. |
| **LAN** | Rede local da loja; acesso inicial previsto para computador e celulares conectados à rede autorizada. |
| **MVP** | Versão mínima para completar inventário confiável, sem movimentações de venda/compra ou sincronização offline completa. |
| **ADMIN** | Perfil com permissão administrativa para catálogo, preparação, revisão e encerramento de balanços. |
| **VENDEDOR** | Perfil que realiza contagens autorizadas no aplicativo Android. |