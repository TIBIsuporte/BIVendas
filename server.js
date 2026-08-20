const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());

app.use(express.static(__dirname + '/public'));

const SUPABASE_URL = "https://cwmofpwuihrnifsvqhik.supabase.co";
const SUPABASE_KEY = "sb_publishable_biWjIRo9x6maeZXcoKX6Lw_l-fjV0wP";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.post("/consulta", async (req, res) => {
  const body = {
    DATAINICIAL: req.body.DATAINICIAL || "",
    DATAFINAL: req.body.DATAFINAL || "",
    LOJAS: req.body.LOJAS || ""
  };

  console.log("Body enviado para RetornaVendasPendentesCompletas:", body);

  try {
    const response = await fetch("https://api.savwinweb.com.br/api/APIDados/RetornaVendasPendentesCompletas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 4AE83C98E8315579579F297C8F8BDE2C6ACF269E57D85DD37EF2647DCA77733",
        "Identificador": "09983-0000"
      },
      body: JSON.stringify(body)
    });

    console.log("Status da resposta da API:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro retornado pela API Savwin:", errorText);
      return res.status(response.status).json({ erro: "Erro na API externa", detalhe: errorText });
    }

    let data = await response.json();

    // FILTRO DE SEGURANÇA NO SERVER
    if (body.LOJAS && Array.isArray(data)) {
      const lojasFiltro = body.LOJAS.split(",").map(id => id.trim());

      data = data.filter(item => {
        // Mapeia os possíveis nomes que a API usa para o código da loja
        const codigoLojaItem = String(item.CODIGOLOJA ?? item.LOJA ?? item.loja ?? item.IdLoja ?? "").trim();
        return lojasFiltro.includes(codigoLojaItem);
      });
    }

    res.json(data);
  } catch (err) {
    console.error("Erro de conexão ou timeout na chamada da API:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
