import "dotenv/config";
import { createApp } from "./app.js";

const { app, environment } = createApp();

app.listen(environment.PORT, "0.0.0.0", () => {
  console.log(`API do estoque ouvindo na porta ${environment.PORT}`);
});
