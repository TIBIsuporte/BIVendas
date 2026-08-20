// Configuração exclusiva do Supabase (apenas chave pública / anon)
const SUPABASE_URL = 'https://cwmofpwuihrnifsvqhik.supabase.co';
const SUPABASE_KEY = 'sb_publishable_biWjIRo9x6maeZXcoKX6Lw_l-fjV0wP';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const COLUNAS_VALORES_TOTALIZAR = [
  'QUANTIDADETOTAL',
  'VALORBRUTO',
  'DESCONTOVALORPRODUTO',
  'VALORLIQUIDOTOTALVENDA'
];

window.onload = async () => {
  await carregarLojasSupabase(supabaseClient);
};

function formatarDataISOparaBR(dataISO) {
  if (!dataISO) return "";
  const partes = dataISO.split("-");
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function parseNumeroBR(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === 'number') return valor;
  const n = parseFloat(String(valor).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function formatarMoedaBR(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function consultar() {
  document.getElementById("loadingOverlay").style.display = "flex";
  document.getElementById("resultado").innerHTML = "";

  const body = {
    DATAINICIAL: formatarDataISOparaBR(document.getElementById("dataInicial").value),
    DATAFINAL: formatarDataISOparaBR(document.getElementById("dataFinal").value),
    LOJAS: document.getElementById("lojas").value,
    TIPODATA: document.getElementById("tipodata").value || "VENDA",
    TIPOVENDA: ""
  };

  try {
    const response = await fetch("/consulta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error("Erro na requisição: " + response.status);

    const dadosBrutos = await response.json();
    processarDadosBI(dadosBrutos);
    renderizarGridTodosCampos(dadosBrutos);
  } catch (error) {
    document.getElementById("resultado").innerHTML = "<p class='erro'>" + error.message + "</p>";
    limparTabela();
  } finally {
    document.getElementById("loadingOverlay").style.display = "none";
  }
}

function processarDadosBI(dados) {
  if (!dados || dados.length === 0) {
    document.getElementById("biCardsContainer").style.display = "none";
    return;
  }

  // DEBUG: Abre o console do navegador (F12) para inspecionar os dados retornados pela API
  console.log("=== DADOS RECEBIDOS DA API ===", dados);

  const lojasDigitadas = document.getElementById("lojas").value.trim();
  let dadosFiltrados = dados;

  if (lojasDigitadas) {
    const idsFiltro = lojasDigitadas.split(",").map(id => id.trim());
    dadosFiltrados = dados.filter(item => {
      const textoLojaCompleto = String(item.LOJANOME ?? item.CODIGOLOJA ?? item.LOJA ?? item.loja ?? item.IdLoja ?? "").trim();
      const matchCodigo = textoLojaCompleto.match(/^0*(\d+)/);
      const codigoExtraido = matchCodigo ? matchCodigo[1] : textoLojaCompleto;
      const codigoSemZeroEsquerda = matchCodigo ? String(parseInt(matchCodigo[1], 10)) : codigoExtraido;

      return idsFiltro.includes(codigoExtraido) || 
             idsFiltro.includes(codigoSemZeroEsquerda) || 
             idsFiltro.some(id => textoLojaCompleto.toLowerCase().includes(id.toLowerCase()));
    });
  }

  const lojasMap = {};

  dadosFiltrados.forEach(item => {
    const lojaNome = item.LOJANOME || "LOJA GERAL";
    const osId = item.CODIGODAVENDA;
    const tipoVenda = String(item.TIPOVENDA || "").trim().toUpperCase();

    // DEBUG individual por O.S./Item no console
    console.log(`O.S: ${osId} | Tipo Venda: '${tipoVenda}' | Eh Devolucao: '${item.EHDEVOLUCAO}' | Valor Líquido: ${item.VALORLIQUIDOTOTALVENDA}`);

    if (!lojasMap[lojaNome]) {
      lojasMap[lojaNome] = {};
    }

    if (!lojasMap[lojaNome][osId]) {
      lojasMap[lojaNome][osId] = {
        VALORBRUTO: 0,
        DESCONTOVALORPRODUTO: 0,
        VALORLIQUIDOTOTALVENDA: 0,
        TIPOVENDA: tipoVenda,
        EHDEVOLUCAO: String(item.EHDEVOLUCAO || "").trim().toUpperCase()
      };
    }

    lojasMap[lojaNome][osId].VALORBRUTO += parseNumeroBR(item.VALORBRUTO);
    lojasMap[lojaNome][osId].DESCONTOVALORPRODUTO += parseNumeroBR(item.DESCONTOVALORPRODUTO);
    lojasMap[lojaNome][osId].VALORLIQUIDOTOTALVENDA = parseNumeroBR(item.VALORLIQUIDOTOTALVENDA);
  });

  let totalBrutoGeral = 0;
  let totalDescontoGeral = 0;
  let totalLiquidoGeral = 0;
  let totalDevolucaoGeral = 0;
  let qtdeVendasGeral = 0;

  Object.keys(lojasMap).forEach(loja => {
    const ordensServico = lojasMap[loja];

    Object.keys(ordensServico).forEach(os => {
      const venda = ordensServico[os];
      
      const vBruto = venda.VALORBRUTO;
      const vDesconto = venda.DESCONTOVALORPRODUTO;
      const vLiquido = venda.VALORLIQUIDOTOTALVENDA;

      const tVenda = venda.TIPOVENDA;
      const ehDev = venda.EHDEVOLUCAO;
      
      // Validação ampliada para capturar variações de devolução e valores negativos
      const eDevolucao = tVenda.includes("DEV") || tVenda.includes("ESTORNO") || ehDev === "S" || ehDev === "SIM" || vLiquido < 0;

      if (eDevolucao) {
        totalDevolucaoGeral += Math.abs(vLiquido);
        console.log(`-> O.S. ${os} CLASSIFICADA COMO DEVOLUÇÃO. Valor Absoluto: ${Math.abs(vLiquido)}`);
        return; 
      }

      totalBrutoGeral += vBruto;
      totalDescontoGeral += vDesconto;
      totalLiquidoGeral += vLiquido;

      if (vLiquido > 0) {
        qtdeVendasGeral++;
      }
    });
  });

  // Atualiza os cards na tela
  document.getElementById("cardValorBruto").textContent = formatarMoedaBR(totalBrutoGeral);
  document.getElementById("cardDesconto").textContent = formatarMoedaBR(totalDescontoGeral);
  document.getElementById("cardValorLiquido").textContent = formatarMoedaBR(totalLiquidoGeral);
  document.getElementById("cardDevolucao").textContent = formatarMoedaBR(totalDevolucaoGeral);
  document.getElementById("cardQtdeVendas").textContent = qtdeVendasGeral.toLocaleString('pt-BR');

  document.getElementById("biCardsContainer").style.display = "grid";
}

function renderizarGridTodosCampos(dados) {
  const thead = document.getElementById("cabecalhoTabela");
  const tbody = document.getElementById("corpoTabela");
  const tfoot = document.getElementById("rodapeTabela");
  const labelTotal = document.getElementById("totalRegistros");

  thead.innerHTML = "";
  tbody.innerHTML = "";
  tfoot.innerHTML = "";

  if (!dados || dados.length === 0) {
    labelTotal.textContent = "0 registros encontrados";
    thead.innerHTML = "<tr><th>Mensagem</th></tr>";
    tbody.innerHTML = "<tr><td style='text-align: center;'>Nenhum registro encontrado.</td></tr>";
    return;
  }

  const lojasDigitadas = document.getElementById("lojas").value.trim();
  let dadosFiltrados = dados;

  if (lojasDigitadas) {
    const idsFiltro = lojasDigitadas.split(",").map(id => id.trim());
    dadosFiltrados = dados.filter(item => {
      const textoLojaCompleto = String(item.LOJANOME ?? item.CODIGOLOJA ?? item.LOJA ?? item.loja ?? item.IdLoja ?? "").trim();
      const matchCodigo = textoLojaCompleto.match(/^0*(\d+)/);
      const codigoExtraido = matchCodigo ? matchCodigo[1] : textoLojaCompleto;
      const codigoSemZeroEsquerda = matchCodigo ? String(parseInt(matchCodigo[1], 10)) : codigoExtraido;

      return idsFiltro.includes(codigoExtraido) || 
             idsFiltro.includes(codigoSemZeroEsquerda) || 
             idsFiltro.some(id => textoLojaCompleto.toLowerCase().includes(id.toLowerCase()));
    });
  }

  if (dadosFiltrados.length === 0) {
    labelTotal.textContent = "0 registros encontrados";
    thead.innerHTML = "<tr><th>Mensagem</th></tr>";
    tbody.innerHTML = "<tr><td style='text-align: center;'>Nenhum registro encontrado para a(s) loja(s) informada(s).</td></tr>";
    return;
  }

  labelTotal.textContent = `${dadosFiltrados.length.toLocaleString('pt-BR')} registros encontrados`;

  const colunas = Object.keys(dadosFiltrados[0]);

  let trHead = document.createElement("tr");
  colunas.forEach(coluna => {
    let th = document.createElement("th");
    th.textContent = coluna;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const totais = {};
  COLUNAS_VALORES_TOTALIZAR.forEach(col => totais[col] = 0);

  dadosFiltrados.forEach(item => {
    let tr = document.createElement("tr");
    colunas.forEach(coluna => {
      let td = document.createElement("td");
      let valor = item[coluna];

      td.textContent = (valor === null || valor === undefined) ? "-" : valor;
      tr.appendChild(td);

      if (COLUNAS_VALORES_TOTALIZAR.includes(coluna.toUpperCase())) {
        totais[coluna.toUpperCase()] += parseNumeroBR(valor);
      }
    });
    tbody.appendChild(tr);
  });

  let trFoot = document.createElement("tr");
  colunas.forEach((coluna, index) => {
    let td = document.createElement("td");
    const colunaUpper = coluna.toUpperCase();

    if (index === 0) {
      td.textContent = "TOTAL";
    } else if (COLUNAS_VALORES_TOTALIZAR.includes(colunaUpper)) {
      if (colunaUpper === 'QUANTIDADETOTAL') {
        td.textContent = totais[colunaUpper].toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      } else {
        td.textContent = formatarMoedaBR(totais[colunaUpper]);
      }
      td.classList.add("text-right");
    } else {
      td.textContent = "-";
    }
    trFoot.appendChild(td);
  });
  tfoot.appendChild(trFoot);
}

function limparTabela() {
  document.getElementById("totalRegistros").textContent = "0 registros encontrados";
  document.getElementById("cabecalhoTabela").innerHTML = "<tr><th>Status</th></tr>";
  document.getElementById("corpoTabela").innerHTML = "<tr><td style='text-align: center; color: red;'>Erro ao carregar dados.</td></tr>";
  document.getElementById("rodapeTabela").innerHTML = "";
  document.getElementById("biCardsContainer").style.display = "none";
}
