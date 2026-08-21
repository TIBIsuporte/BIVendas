const SUPABASE_URL = 'https://cwmofpwuihrnifsvqhik.supabase.co';
const SUPABASE_KEY = 'sb_publishable_biWjIRo9x6maeZXcoKX6Lw_l-fjV0wP';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const COLUNAS_VALORES_TOTALIZAR = [
  'QUANTIDADE',
  'QUANTIDADETOTAL',
  'VALORBRUTOPRODUTO',
  'DESCPRODUTO',
  'LIQUIDOPRODUTO',
  'CUSTO'
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

  const dataInicial = formatarDataISOparaBR(document.getElementById("dataInicial").value);
  const dataFinal = formatarDataISOparaBR(document.getElementById("dataFinal").value);
  const lojas = document.getElementById("lojas").value;
  const tipodata = document.getElementById("tipodata").value || "VENDA";

  const bodyReq = {
    DATAINICIAL: dataInicial,
    DATAFINAL: dataFinal,
    LOJAS: lojas,
    TIPODATA: tipodata,
    TIPOVENDA: ""
  };

  try {
    // 1. Executa a consulta principal da Grid e a consulta de Devoluções em paralelo
    const [resGrid, resDevolucoes] = await Promise.all([
      fetch("/consulta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyReq)
      }),
      fetch("/consultadevolucoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyReq)
      })
    ]);

    if (!resGrid.ok) throw new Error("Erro na requisição da Grid: " + resGrid.status);
    
    const dadosBrutos = await resGrid.json();
    let dadosDevolucoes = [];

    if (resDevolucoes.ok) {
      dadosDevolucoes = await resDevolucoes.json();
    }

    processarDadosBI(dadosBrutos, dadosDevolucoes);
    renderizarGridTodosCampos(dadosBrutos);
  } catch (error) {
    document.getElementById("resultado").innerHTML = "<p class='erro'>" + error.message + "</p>";
    limparTabela();
  } finally {
    document.getElementById("loadingOverlay").style.display = "none";
  }
}

function processarDadosBI(dados, dadosDevolucoes) {
  if (!dados || dados.length === 0) {
    document.getElementById("biCardsContainer").style.display = "none";
    return;
  }

  const lojasDigitadas = document.getElementById("lojas").value.trim();
  let dadosFiltrados = dados;

  if (lojasDigitadas) {
    const idsFiltro = lojasDigitadas.split(",").map(id => id.trim());
    dadosFiltrados = dados.filter(item => {
      const textoLojaCompleto = String(item.LOJANOME ?? item.CODIGOLOJA ?? item.LOJA ?? "").trim();
      const matchCodigo = textoLojaCompleto.match(/^0*(\d+)/);
      const codigoExtraido = matchCodigo ? matchCodigo[1] : textoLojaCompleto;
      const codigoSemZeroEsquerda = matchCodigo ? String(parseInt(matchCodigo[1], 10)) : codigoExtraido;

      return idsFiltro.includes(codigoExtraido) || 
             idsFiltro.includes(codigoSemZeroEsquerda) || 
             idsFiltro.some(id => textoLojaCompleto.toLowerCase().includes(id.toLowerCase()));
    });
  }

  const osMap = {};

  dadosFiltrados.forEach(item => {
    const osId = String(item.OS || item.CODIGODAVENDA || "").trim();
    if (!osId) return;

    if (!osMap[osId]) {
      osMap[osId] = {
        os: osId,
        valorBrutoOS: 0,
        somaDescontoItens: 0,
        liquidoOS: 0,
        descontoVendaGlobal: parseNumeroBR(item.DESCONTOVENDA),
        liquidoVendaGlobal: parseNumeroBR(item.VLRLIQUIDOVENDA || item.VALORLIQUIDOPRODUTO || 0),
        tipoVenda: String(item.TIPOVENDA || "").trim().toUpperCase()
      };
    }

    osMap[osId].valorBrutoOS += parseNumeroBR(item.VALORBRUTOPRODUTO);
    osMap[osId].somaDescontoItens += parseNumeroBR(item.DESCPRODUTO);
    osMap[osId].liquidoOS += parseNumeroBR(item.LIQUIDOPRODUTO);
  });

  let totalBrutoGeral = 0;
  let totalDescontoGeral = 0;
  let qtdeVendasNormais = 0;

  Object.keys(osMap).forEach(osId => {
    const venda = osMap[osId];

    if (venda.tipoVenda === "TROCA") {
      totalBrutoGeral += venda.valorBrutoOS;
      if (venda.liquidoVendaGlobal > 0) qtdeVendasNormais++;
      return;
    }

    totalBrutoGeral += venda.valorBrutoOS;

    let descontoEfetivo = venda.somaDescontoItens;
    if (venda.descontoVendaGlobal > descontoEfetivo) {
      descontoEfetivo = venda.descontoVendaGlobal;
    }

    totalDescontoGeral += descontoEfetivo;

    if (venda.liquidoVendaGlobal > 0) {
      qtdeVendasNormais++;
    }
  });

  // Cálculo dedicado para o total de devoluções usando PRECOTOTALPRODUTO da API de Devoluções
  let totalDevolucaoGeral = 0;
  if (Array.isArray(dadosDevolucoes) && dadosDevolucoes.length > 0) {
    dadosDevolucoes.forEach(itemDev => {
      // Filtra por loja também caso venha misturado
      const textoLojaDev = String(itemDev.LOJANOME ?? itemDev.CODIGOLOJA ?? itemDev.LOJA ?? "").trim();
      const matchDev = textoLojaDev.match(/^0*(\d+)/);
      const codDev = matchDev ? matchDev[1] : textoLojaDev;
      const codDevSemZero = matchDev ? String(parseInt(matchDev[1], 10)) : codDev;

      const atendeLoja = !lojasDigitadas || 
        lojasDigitadas.split(",").map(id => id.trim()).includes(codDev) ||
        lojasDigitadas.split(",").map(id => id.trim()).includes(codDevSemZero) ||
        lojasDigitadas.split(",").map(id => id.trim()).some(id => textoLojaDev.toLowerCase().includes(id.toLowerCase()));

      if (atendeLoja) {
        totalDevolucaoGeral += parseNumeroBR(itemDev.PRECOTOTALPRODUTO);
      }
    });
  }

  let totalLiquidoGeral = totalBrutoGeral - totalDescontoGeral - totalDevolucaoGeral;
  let qtdeVendasGeral = qtdeVendasNormais;

  document.getElementById("cardValorBruto").textContent = formatarMoedaBR(totalBrutoGeral);
  document.getElementById("cardDesconto").textContent = formatarMoedaBR(totalDescontoGeral);
  
  // INVERTIDOS AQUI PARA BATER CORRETAMENTE COM A ORDEM VISUAL DOS CARDS:
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
      const textoLojaCompleto = String(item.LOJANOME ?? item.CODIGOLOJA ?? item.LOJA ?? "").trim();
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

      const colunaUpper = coluna.toUpperCase();
      if (COLUNAS_VALORES_TOTALIZAR.includes(colunaUpper)) {
        totais[colunaUpper] += parseNumeroBR(valor);
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
      if (colunaUpper.includes('QUANTIDADE')) {
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
