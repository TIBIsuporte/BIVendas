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

let lojasDisponiveis = [];

window.onload = async () => {
  await carregarLojasSupabase();
};

// --- FUNÇÕES DO MODAL DE LOJAS ---
async function carregarLojasSupabase() {
  try {
    const { data, error } = await supabaseClient
      .from('lojas')
      .select('id, nome, gerente')
      .order('id', { ascending: true });
    
    if (error) throw error;
    lojasDisponiveis = data || [];
  } catch (err) {
    console.error("Erro ao carregar lojas do Supabase:", err.message);
  }
}

function abrirModalLojas() {
  const inputFiltro = document.getElementById("inputFiltroGerenteModal");
  if (inputFiltro) inputFiltro.value = "";
  renderizarListaLojasModal(lojasDisponiveis);
  const modal = document.getElementById("modalLojas");
  if (modal) modal.style.display = "flex";
}

function renderizarListaLojasModal(lista) {
  const container = document.getElementById("listaLojasModal");
  if (!container) return;
  container.innerHTML = "";
  
  const inputLojas = document.getElementById("lojas");
  const idsAtuais = inputLojas ? inputLojas.value.split(",").map(s => s.trim()) : [];
  const listaOrdenada = [...lista].sort((a, b) => Number(a.id) - Number(b.id));

  listaOrdenada.forEach(loja => {
    const checked = idsAtuais.includes(String(loja.id)) ? "checked" : "";
    container.innerHTML += `
      <label class="item-loja-modal" data-texto="[${loja.id}] ${loja.nome} ${loja.gerente || ''}" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-bottom: 1px solid #eee; cursor: pointer;">
        <div>
          <input type="checkbox" value="${loja.id}" ${checked} style="width: auto; margin-right: 8px;"> 
          <strong>[${loja.id}]</strong> ${loja.nome}
        </div>
        <span style="color: #666; font-size: 11px;">Gerente: ${loja.gerente || '-'}</span>
      </label>
    `;
  });
}

function filtrarLojasNoModal() {
  const termo = document.getElementById("inputFiltroGerenteModal").value.trim().toUpperCase();
  const labels = document.querySelectorAll("#listaLojasModal .item-loja-modal");
  labels.forEach(label => {
    const texto = label.getAttribute("data-texto").toUpperCase();
    label.style.display = (texto.includes(termo) || termo === "") ? "flex" : "none";
  });
}

function fecharModalLojas() { 
  const modal = document.getElementById("modalLojas");
  if (modal) modal.style.display = "none"; 
}

function toggleSelecionarTodasLojas(master) {
  document.querySelectorAll("#listaLojasModal .item-loja-modal").forEach(label => {
    if (label.style.display !== "none") {
      const cb = label.querySelector("input[type='checkbox']");
      if (cb) cb.checked = master.checked;
    }
  });
}

function confirmarSelecaoLojas() {
  const ids = [];
  document.querySelectorAll("#listaLojasModal input[type='checkbox']").forEach(cb => { 
    if (cb.checked) ids.push(cb.value); 
  });
  const inputLojas = document.getElementById("lojas");
  if (inputLojas) inputLojas.value = ids.join(",");
  fecharModalLojas();
}
// ---------------------------------

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

  let totalBrutoGeral = 0;
  let totalDescontoGeral = 0;
  let totalLiquidoTabela = 0;
  let totalDevolucaoGeral = 0; 
  const osSet = new Set();

  console.group("🔍 [DEBUG] Analisando itens da API Principal");

  // --- 1. PROCESSAMENTO DA API PRINCIPAL (ProdutosPorOSGRID) ---
  dadosFiltrados.forEach((item, index) => {
    const osId = String(item.OS || item.CODIGODAVENDA || "").trim();
    if (osId) osSet.add(osId);

    const brutoItem = parseNumeroBR(item.VALORBRUTOPRODUTO);
    const descItem = parseNumeroBR(item.DESCPRODUTO);
    const liquidoItem = parseNumeroBR(item.LIQUIDOPRODUTO);
    const tipoVendaPrincipal = String(item.TIPOVENDA || "").trim().toUpperCase();

    totalBrutoGeral += brutoItem;
    totalDescontoGeral += descItem;
    totalLiquidoTabela += liquidoItem;

    // Log individual se for TROCA para inspecionar os campos
    if (tipoVendaPrincipal === "TROCA") {
      console.log(`[TROCA ENCONTRADA] OS: ${osId} | TIPOVENDA: ${tipoVendaPrincipal} | LIQUIDO: ${liquidoItem} | DESCONTOVENDA: ${item.DESCONTOVENDA}`, item);
      
      // Aqui testamos a captura do valor da troca
      let valorTroca = parseNumeroBR(item.DESCONTOVENDA || item.LIQUIDOPRODUTO || 0);
      if (valorTroca > 0) valorTroca = -valorTroca; // Mantém negativo para abater corretamente
      totalDevolucaoGeral += valorTroca;
    }
  });

  console.groupEnd();

  // --- 2. PROCESSAMENTO DA API DE DEVOLUÇÕES (consultadevolucoes) ---
  console.group("🔄 [DEBUG] Analisando API de Devoluções");
  if (Array.isArray(dadosDevolucoes) && dadosDevolucoes.length > 0) {
    dadosDevolucoes.forEach(itemDev => {
      const tipoVendaDev = String(itemDev.TIPOVENDA || itemDev.TIPO || "").trim().toUpperCase();
      
      if (!tipoVendaDev.includes("DEVOLUCAO")) {
        return; 
      }

      const textoLojaDev = String(itemDev.LOJANOME ?? itemDev.CODIGOLOJA ?? itemDev.LOJA ?? "").trim();
      const matchDev = textoLojaDev.match(/^0*(\d+)/);
      const codDev = matchDev ? matchDev[1] : textoLojaDev;
      const codDevSemZero = matchDev ? String(parseInt(matchDev[1], 10)) : codDev;

      const atendeLoja = !lojasDigitadas || 
        lojasDigitadas.split(",").map(id => id.trim()).includes(codDev) ||
        lojasDigitadas.split(",").map(id => id.trim()).includes(codDevSemZero) ||
        lojasDigitadas.split(",").map(id => id.trim().toLowerCase()).some(id => textoLojaDev.toLowerCase().includes(id));

      if (!atendeLoja) {
        return;
      }

      let valorDevolucaoItem = parseNumeroBR(itemDev.LIQUIDOPRODUTO || itemDev.VALORBRUTOPRODUTO || itemDev.PRECOTOTALPRODUTO || 0);
      if (valorDevolucaoItem > 0) valorDevolucaoItem = -valorDevolucaoItem;
      
      console.log(`[DEVOLUÇÃO ENCONTRADA] Valor: ${valorDevolucaoItem}`, itemDev);
      totalDevolucaoGeral += valorDevolucaoItem;
    });
  }
  console.groupEnd();

  // --- 3. CÁLCULO FINAL ---
  let totalLiquidoFinal = totalLiquidoTabela + totalDevolucaoGeral;
  let qtdeVendasGeral = osSet.size;

  console.log("📊 [RESUMO FINAL DOS CÁLCULOS]");
  console.log("Total Bruto:", totalBrutoGeral);
  console.log("Total Desconto:", totalDescontoGeral);
  console.log("Total Líquido da Tabela:", totalLiquidoTabela);
  console.log("Total Devolução/Troca Acumulado:", totalDevolucaoGeral);
  console.log("Total Líquido Final (Tabela + Devolução Negativa):", totalLiquidoFinal);

  document.getElementById("cardValorBruto").textContent = formatarMoedaBR(totalBrutoGeral);
  document.getElementById("cardDesconto").textContent = formatarMoedaBR(totalDescontoGeral);
  document.getElementById("cardValorLiquido").textContent = formatarMoedaBR(totalLiquidoFinal);
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

  console.group("📋 [INSPEÇÃO DE COLUNAS E TOTALIZAÇÃO DA TABELA]");
  dadosFiltrados.forEach((item, index) => {
    let tr = document.createElement("tr");
    colunas.forEach(coluna => {
      let td = document.createElement("td");
      let valor = item[coluna];

      td.textContent = (valor === null || valor === undefined) ? "-" : valor;
      tr.appendChild(td);

      const colunaUpper = coluna.toUpperCase();
      if (COLUNAS_VALORES_TOTALIZAR.includes(colunaUpper)) {
        const numParsed = parseNumeroBR(valor);
        totais[colunaUpper] += numParsed;
      }
    });
    tbody.appendChild(tr);
  });
  console.log("Valores Finais Somados por Variável na Tabela:", totais);
  console.groupEnd();

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
