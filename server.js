const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());

// Serve os arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post("/consulta", async (req, res) => {
  const body = {
    DATAINICIAL: req.body.DATAINICIAL || "",
    DATAFINAL: req.body.DATAFINAL || "",
    LOJAS: req.body.LOJAS || "",
    TIPODATA: req.body.TIPODATA || "VENDA",
    TIPOVENDA: req.body.TIPOVENDA || ""
  };

  console.log("Processando requisição de relatório ProdutosPorOSGrid no servidor...");

  try {
    const response = await fetch("https://api.savwinweb.com.br/api/APIRelatoriosCR/ProdutosPorOSGrid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 4AE83C98E8315579579F297C8F8BDE2C6ACF269E57D85DD37EF2647DCA77733",
        "Identificador": "09983-0000"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Erro na API externa: Status ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Erro interno ao chamar a API da SavwinWeb:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando profissionalmente na porta ${PORT}`);
});
