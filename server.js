// server.js
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());
app.use(cors());

// Servir a página index.html e arquivos estáticos da pasta
app.use(express.static(__dirname));

// Configuração do Supabase (use suas credenciais reais do projeto ossemcrm-db)
const SUPABASE_URL = "https://cwmofpwuihrnifsvqhik.supabase.co";       // Ex: https://xxxx.supabase.co
const SUPABASE_KEY = "sb_publishable_biWjIRo9x6maeZXcoKX6Lw_l-fjV0wP";  // Chave pública ou de serviço
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Rota que recebe os parâmetros, chama a nova API e salva no Supabase
app.post("/consulta", async (req, res) => {
  const body = {
    DATAINICIAL: req.body.DATAINICIAL || "",
    DATAFINAL: req.body.DATAFINAL || "",
    LOJAS: req.body.LOJAS || "",
    TIPODATA: req.body.TIPODATA || "VENDA", // padrão VENDA
    TIPOVENDA: req.body.TIPOVENDA || ""     // opcional
  };

  // LOG para verificar o body que está indo
  console.log("Body enviado para API de Vendas Pendentes:", body);

  try {
    // URL alterada para o novo endpoint correto
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

    const data = await response.json();

    // Opcional: Se quiser salvar o log/resultado das vendas consultadas no Supabase
    /*
    const { error: supabaseError } = await supabase
      .from('vendas_pendentes_log')
      .insert([{ parametros: body, resposta_api: data, criado_em: new Date() }]);
      
    if (supabaseError) {
      console.error("Erro ao salvar no Supabase:", supabaseError.message);
    }
    */

    res.json(data);
  } catch (err) {
    console.error("Erro ao chamar API:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// Porta dinâmica para Render / Heroku / Local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
