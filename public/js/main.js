/**
 * Módulo Principal de Execução e Regras de Negócio do BI
 * Gerencia o carregamento de lojas, o envio de requisições paralelas para as APIs
 * e a renderização completa da Grid e dos Cards de Indicadores.
 */

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
    // Chamada simultânea da Grid de Produtos e da API de Resumo de Formas de Pagamento
    const [resGrid, resPagamentos] = await Promise.all([
      fetch("/consulta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyReq)
      }),
      fetch("/consultapagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyReq)
      })
    ]);

    if (!resGrid.ok) throw new Error("Erro na requisição da Grid: " + resGrid.status);
    
    const dadosBrutos = await resGrid.json();
    let dadosPagamentos = [];

    if (resPagamentos.ok) {
      dadosPagamentos = await resPagamentos.json();
    }

    processarDadosBI(dadosBrutos, dadosPagamentos);
    renderizarGridTodosCampos(dadosBrutos);
  } catch (error) {
    document.getElementById("resultado").innerHTML = "<p class='erro'>" + error.message + "</p>";
    limparTabela();
  } finally {
    document.getElementById("loadingOverlay").style.display = "none";
  }
}

function processarDadosBI(dados, dadosPagamentos) {
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
  let totalLiquidoGeral = 0;

  // Objeto para armazenar os totais separados por ID de Loja (Desejado na Imagem 2)
  const totaisPorLoja = {};

  // --- 1. LOOP DE SOMA E DETALHAMENTO POR LOJA (API ProdutosPorOSGRID) ---
  dadosFiltrados.forEach((item) => {
    const bruto = parseNumeroBR(item.VALORBRUTOPRODUTO);
    const desconto = parseNumeroBR(item.DESCPRODUTO);
    const liquido = parseNumeroBR(item.LIQUIDOPRODUTO);

    totalBrutoGeral += bruto;
    totalDescontoGeral += desconto;
    totalLiquidoGeral += liquido;

    // Extrai o código da loja para o detalhamento individual
    const textoLoja = String(item.LOJANOME ?? item.CODIGOLOJA ?? item.LOJA ?? "").trim();
    const matchLoja = textoLoja.match(/^0*(\d+)/);
    const idLoja = matchLoja ? matchLoja[1] : textoLoja;

    if (!totaisPorLoja[idLoja]) {
      totaisPorLoja[idLoja] = { bruto: 0, desconto: 0, liquido: 0 };
    }
    totaisPorLoja[idLoja].bruto += bruto;
    totaisPorLoja[idLoja].desconto += desconto;
    totaisPorLoja[idLoja].liquido += liquido;
  });

  // Gera o HTML interno para exibir os valores detalhados por loja no topo de cada card
  let htmlBrutoPorLoja = "";
  let htmlDescontoPorLoja = "";
  let htmlLiquidoPorLoja = "";

  Object.keys(totaisPorLoja).forEach(id => {
    const t = totaisPorLoja[id];
    htmlBrutoPorLoja += `<div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px;"><span><strong>${id}</strong></span> <span>${formatarMoedaBR(t.bruto)}</span></div>`;
    htmlDescontoPorLoja += `<div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px;"><span><strong>${id}</strong></span> <span>${formatarMoedaBR(t.desconto)}</span></div>`;
    htmlLiquidoPorLoja += `<div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px;"><span><strong>${id}</strong></span> <span>${formatarMoedaBR(t.liquido)}</span></div>`;
  });

  // --- 2. PROCESSAMENTO E AGRUPAMENTO DA API DE PAGAMENTOS ---
  let htmlPagamentos = "";
  if (Array.isArray(dadosPagamentos) && dadosPagamentos.length > 0) {
    let pagamentosFiltrados = dadosPagamentos;
    if (lojasDigitadas) {
      const idsFiltro = lojasDigitadas.split(",").map(id => id.trim());
      pagamentosFiltrados = dadosPagamentos.filter(pgto => {
        const textoLojaPgto = String(pgto.LOJA || "").trim();
        const matchPgto = textoLojaPgto.match(/^0*(\d+)/);
        const codPgto = matchPgto ? matchPgto[1] : textoLojaPgto;
        const codPgtoSemZero = matchPgto ? String(parseInt(matchPgto[1], 10)) : codPgto;

        return idsFiltro.includes(codPgto) || 
               idsFiltro.includes(codPgtoSemZero) || 
               idsFiltro.some(id => textoLojaPgto.toLowerCase().includes(id.toLowerCase()));
      });
    }

    if (pagamentosFiltrados.length > 0) {
      // Objeto para agrupar por Meio de Pagamento + Número de Parcelas
      const agrupado = {};

      pagamentosFiltrados.forEach(pgto => {
        const meio = (pgto.MEIO_PAGAMENTO || pgto.MEIOPAGAMENTO || "NÃO ESPECIFICADO").trim();
        const parcelas = (pgto.N_PARCELAS || "1").trim();
        
        // Chave única para consolidar (ex: "CARTAO|3 - PARCELAS")
        const chave = `${meio}|${parcelas}`;

        const qtdUso = parseNumeroBR(pgto.QTDE_USO || 1);
        const valorTotalPgto = parseNumeroBR(pgto.VENDAS_VALOR || 0);

        if (!agrupado[chave]) {
          agrupado[chave] = {
            meioPagamento: meio,
            nParcelas: parcelas,
            quantidadeVendas: 0,
            vendasValor: 0
          };
        }

        agrupado[chave].quantidadeVendas += qtdUso;
        agrupado[chave].vendasValor += valorTotalPgto;
      });

      // Transforma o objeto agrupado em HTML limpo e consolidado
      htmlPagamentos = Object.values(agrupado).map(item => {
        return `
          <div style="margin-bottom: 8px;">
            <strong>Meio Pagamento:</strong> ${item.meioPagamento}<br>
            <strong>Parcelas:</strong> ${item.nParcelas}<br>
            <strong>Total vendas:</strong> ${item.quantidadeVendas}<br>
            <strong>Valor Total:</strong> ${formatarMoedaBR(item.vendasValor)}
          </div>
        `;
      }).join("<hr style='border:0; border-top:1px dashed #ccc; margin:8px 0;'>");

    } else {
      htmlPagamentos = "Nenhum registro de pagamento para a(s) loja(s) selecionada(s).";
    }
  } else {
    htmlPagamentos = "Nenhum registro de pagamento retornado para o período.";
  }

  // --- 3. ATUALIZAÇÃO DOS CARDS NO HTML COM DETALHAMENTO E TOTAIS ---
  document.getElementById("cardValorBruto").innerHTML = `${htmlBrutoPorLoja}<hr style="border:0; border-top:1px solid #ddd; margin: 8px 0;"><div style="font-size: 16px; font-weight: bold;">${formatarMoedaBR(totalBrutoGeral)}</div>`;
  document.getElementById("cardDesconto").innerHTML = `${htmlDescontoPorLoja}<hr style="border:0; border-top:1px solid #ddd; margin: 8px 0;"><div style="font-size: 16px; font-weight: bold;">${formatarMoedaBR(totalDescontoGeral)}</div>`;
  document.getElementById("cardValorLiquido").innerHTML = `${htmlLiquidoPorLoja}<hr style="border:0; border-top:1px solid #ddd; margin: 8px 0;"><div style="font-size: 16px; font-weight: bold;">${formatarMoedaBR(totalLiquidoGeral)}</div>`;
  document.getElementById("cardResumoPagamento").innerHTML = htmlPagamentos;

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

  dadosFiltrados.forEach((item) => {
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
