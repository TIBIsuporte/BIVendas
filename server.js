// server.js
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// NOVO: Adicione esta linha para servir a sua página index.html e arquivos da pasta
app.use(express.static(__dirname));

// rota que recebe os parâmetros e chama a API
app.post("/consulta", async (req, res) => {
  const body = {
    DATAINICIAL: req.body.DATAINICIAL || "",
    DATAFINAL: req.body.DATAFINAL || "",
    LOJAS: req.body.LOJAS || "",
    TIPODATA: req.body.TIPODATA || "VENDA", // padrão VENDA
    TIPOVENDA: req.body.TIPOVENDA || ""     // opcional
  };

  // LOG para verificar o body que está indo
  console.log("Body enviado para API:", body);

  try {
    const response = await fetch("https://api.savwinweb.com.br/api/APIRelatoriosCR/ProdutosPorOS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 4AE83C98E8315579579F297C8F8BDE2C6ACF269E57D85DD37EF2647DCA77733",
        "Identificador": "09983-0000"
      },
      body: JSON.stringify(body)
    });

    console.log("Status da resposta da API:", response.status);

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Erro ao chamar API:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// O Render precisa que o app utilize a porta dinâmica da nuvem (process.env.PORT)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
