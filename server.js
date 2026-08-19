// server.js
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Servir a página index.html e arquivos estáticos da pasta
app.use(express.static(__dirname));

// Configuração do Supabase
const SUPABASE_URL = "https://cwmofpwuihrnifsvqhik.supabase.co";
const SUPABASE_KEY = "sb_publishable_biWjIRo9x6maeZXcoKX6Lw_l-fjV0wP";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Rota que recebe os parâmetros e chama o endpoint correto ProdutosPorOSGrid
app.post("/consulta", async (req, res) => {
  const body = {
    DATAINICIAL: req.body.DATAINICIAL || "",
    DATAFINAL: req.body.DATAFINAL || "",
    LOJAS: req.body.LOJAS || ""
  };

  // LOG para verificar o body que está indo
  console.log("Body enviado para ProdutosPorOSGrid:", body);

  try {
    //const response = await fetch("https://api.savwinweb.com.br/api/APIRelatoriosCR/ProdutosPorOSGrid", {
    const response = await fetch("https://api.savwinweb.com.br/api/APIDados/RetornaVendasPendentesCompletas{
      
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

// Porta dinâmica para Render / Local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
