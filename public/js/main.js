/**
 * Módulo Principal de Execução e Regras de Negócio do BI
 * Gerencia o carregamento de lojas, o envio de requisições paralelas para as APIs
 * e a renderização completa com suporte a abas.
 */

const SUPABASE_URL = 'https://cwmofpwuihrnifsvqhik.supabase.co';
const SUPABASE_KEY = 'sb_publishable_biWjIRo9x6maeZXcoKX6Lw_l-fjV0wP';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let lojasDisponiveis = [];

window.onload = async () => {
  await carregarLojasSupabase();
};

// --- FUNÇÃO DE CONTROLE DE ABAS ---
function mudarAba(aba) {
  const btnCards = document.getElementById("btnAbaCards");
  const btnGraficos = document.getElementById("btnAbaGraficos");
  const conteudoCards = document.getElementById("conteudoAbaCards");
  const conteudoGraficos = document.getElementById("conteudoAbaGraficos");

  if (aba === 'cards') {
    conteudoCards.style.display = "flex";
    conteudoGraficos.style.display = "none";
    
    btnCards.style.background = "#0078d7";
    btnCards.style.color = "#fff";
    btnGraficos.style.background = "#e0e0e0";
    btnGraficos.style.color = "#333";
  } else {
    conteudoCards.style.display = "none";
    conteudoGraficos.style.display = "flex";
    
    btnGraficos.style.background = "#0078d7";
    btnGraficos.style.color = "#fff";
    btnCards.style.background = "#e0e0e0";
    btnCards.style.color = "#333";
  }
}

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
  
  const containerResultado = document.getElementById("resultado");
  if (containerResultado) containerResultado.innerHTML = "";

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

    if (!resGrid.ok) throw new Error("Erro na requisição dos dados de produtos: " + resGrid.status);
    
    const dadosBrutos = await resGrid.json();
    let dadosPagamentos = [];

    if (resPagamentos.ok) {
      dadosPagamentos = await resPagamentos.json();
    }

    processarDadosBI(dadosBrutos, dadosPagamentos);

  } catch (error) {
    if (containerResultado) {
      containerResultado.innerHTML = "<p class='erro'>" + error.message + "</p>";
    }
    document.getElementById("biTabsHeader").style.display = "none";
    document.getElementById("biCardsContainer").style.display = "none";
  } finally {
    document.getElementById("loadingOverlay").style.display = "none";
  }
}

function processarDadosBI(dados, dadosPagamentos) {
  if (!dados || dados.length === 0) {
    document.getElementById("biTabsHeader").style.display = "none";
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

  const totaisPorLoja = {};
  const osPorLojaEId = {}; 

  dadosFiltrados.forEach((item) => {
    const bruto = parseNumeroBR(item.VALORBRUTOPRODUTO);
    const desconto = parseNumeroBR(item.DESCPRODUTO);
    const liquido = parseNumeroBR(item.LIQUIDOPRODUTO);

    totalBrutoGeral += bruto;
    totalDescontoGeral += desconto;
    totalLiquidoGeral += liquido;

    const textoLoja = String(item.LOJANOME ?? item.CODIGOLOJA ?? item.LOJA ?? "").trim();
    const matchLoja = textoLoja.match(/^0*(\d+)/);
    const idLoja = matchLoja ? matchLoja[1] : textoLoja;

    if (!totaisPorLoja[idLoja]) {
      totaisPorLoja[idLoja] = { bruto: 0, desconto: 0, liquido: 0 };
    }
    totaisPorLoja[idLoja].bruto += bruto;
    totaisPorLoja[idLoja].desconto += desconto;
    totaisPorLoja[idLoja].liquido += liquido;

    const numeroOS = String(item.OS || "").trim();
    if (numeroOS) {
      if (!osPorLojaEId[idLoja]) {
        osPorLojaEId[idLoja] = {};
      }
      if (!osPorLojaEId[idLoja][numeroOS]) {
        osPorLojaEId[idLoja][numeroOS] = 0; 
      }
      osPorLojaEId[idLoja][numeroOS] += bruto;
    }
  });

  const osUnicasValidasPorLoja = {};
  Object.keys(osPorLojaEId).forEach(idLoja => {
    osUnicasValidasPorLoja[idLoja] = new Set();
    const listaOSsDaLoja = osPorLojaEId[idLoja];
    
    Object.keys(listaOSsDaLoja).forEach(numeroOS => {
      const valorTotalDaOS = listaOSsDaLoja[numeroOS];
      if (valorTotalDaOS > 0) {
        osUnicasValidasPorLoja[idLoja].add(numeroOS);
      }
    });
  });

  let htmlBrutoPorLoja = "";
  let htmlDescontoPorLoja = "";
  let htmlLiquidoPorLoja = "";
  let htmlQtdeVendasPorLoja = "";
  let htmlTicketMedioPorLoja = "";
  let totalGeralVendasOS = 0;

  Object.keys(totaisPorLoja).forEach(id => {
    const t = totaisPorLoja[id];
    const qtdVendasLoja = osUnicasValidasPorLoja[id] ? osUnicasValidasPorLoja[id].size : 0;
    totalGeralVendasOS += qtdVendasLoja;

    const ticketMedioLoja = qtdVendasLoja > 0 ? (t.liquido / qtdVendasLoja) : 0;

    htmlBrutoPorLoja += `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px;"><span><strong>${id}</strong></span> <span>${formatarMoedaBR(t.bruto)}</span></div>`;
    htmlDescontoPorLoja += `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px;"><span><strong>${id}</strong></span> <span>${formatarMoedaBR(t.desconto)}</span></div>`;
    htmlLiquidoPorLoja += `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px;"><span><strong>${id}</strong></span> <span>${formatarMoedaBR(t.liquido)}</span></div>`;
    htmlQtdeVendasPorLoja += `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px;"><span><strong>${id}</strong></span> <span>${qtdVendasLoja}</span></div>`;
    htmlTicketMedioPorLoja += `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px;"><span><strong>${id}</strong></span> <span>${formatarMoedaBR(ticketMedioLoja)}</span></div>`;
  });

  const ticketMedioGeral = totalGeralVendasOS > 0 ? (totalLiquidoGeral / totalGeralVendasOS) : 0;

  // --- PROCESSAMENTO DA API DE PAGAMENTOS ---
  let htmlPagamentos = "";
  if (Array.isArray(dadosPagamentos) && dadosPagamentos.length > 0) {
    let pagamentosFiltrados = dadosPagamentos;
    if (lojasDigitadas) {
      const idsFiltro = lojasDigitadas.split(",").map(id => id.trim());
      pagamentosFiltrados = dadosPagamentos.filter(pgto => {
        const textoLojaPgto = String(pgto.LOJA || pgto.CODIGOLOJA || "").trim();
        const matchPgto = textoLojaPgto.match(/^0*(\d+)/);
        const codPgto = matchPgto ? matchPgto[1] : textoLojaPgto;
        const codPgtoSemZero = matchPgto ? String(parseInt(matchPgto[1], 10)) : codPgto;

        return idsFiltro.includes(codPgto) || 
               idsFiltro.includes(codPgtoSemZero) || 
               idsFiltro.some(id => textoLojaPgto.toLowerCase().includes(id.toLowerCase()));
      });
    }

    if (pagamentosFiltrados.length > 0) {
      const agrupadoPagamentos = {};

      pagamentosFiltrados.forEach(pgto => {
        const meio = (pgto.MEIO_PAGAMENTO || pgto.MEIOPAGAMENTO || "NÃO ESPECIFICADO").trim();
        const parcelas = (pgto.N_PARCELAS || "1").trim();
        const chave = `${meio}|${parcelas}`;

        const textoLojaPgto = String(pgto.LOJA || pgto.CODIGOLOJA || "Geral").trim();
        const matchLojaPgto = textoLojaPgto.match(/^0*(\d+)/);
        const idLoja = matchLojaPgto ? matchLojaPgto[1] : textoLojaPgto;

        const qtdUso = parseNumeroBR(pgto.QTDE_USO || 1);
        const valorTotalPgto = parseNumeroBR(pgto.VENDAS_VALOR || 0);

        if (!agrupadoPagamentos[chave]) {
          agrupadoPagamentos[chave] = {
            meioPagamento: meio,
            nParcelas: parcelas,
            lojas: {}
          };
        }

        if (!agrupadoPagamentos[chave].lojas[idLoja]) {
          agrupadoPagamentos[chave].lojas[idLoja] = { quantidadeVendas: 0, vendasValor: 0 };
        }

        agrupadoPagamentos[chave].lojas[idLoja].quantidadeVendas += qtdUso;
        agrupadoPagamentos[chave].lojas[idLoja].vendasValor += valorTotalPgto;
      });

      htmlPagamentos = Object.values(agrupadoPagamentos).map(item => {
        let totalGeralValorGrupo = 0;
        let totalGeralQtdGrupo = 0;

        let linhasLojasHTML = Object.keys(item.lojas).map(idLoja => {
          const dadosLoja = item.lojas[idLoja];
          totalGeralValorGrupo += dadosLoja.vendasValor;
          totalGeralQtdGrupo += dadosLoja.quantidadeVendas;

          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed #eee; font-size: 13px;">
              <span style="font-weight: bold; min-width: 50px;">${idLoja}</span>
              <span style="color: #333;">${formatarMoedaBR(dadosLoja.vendasValor)}</span>
              <span style="color: #666; font-size: 12px;">Qtd Vendas: <strong>${dadosLoja.quantidadeVendas}</strong></span>
            </div>
          `;
        }).join("");

        return `
          <div style="margin-bottom: 15px; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid #eee;">
            <div style="font-size: 13px; font-weight: bold; color: #333; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
              <span>Meio Pagamento: <strong style="color: #0078d7;">${item.meioPagamento}</strong></span>
              <span>Parcelas: <strong style="color: #0078d7;">${item.nParcelas}</strong></span>
              <span>Total vendas: <strong>${totalGeralQtdGrupo}</strong></span>
              <span>Valor Total: <strong style="color: #0078d7;">${formatarMoedaBR(totalGeralValorGrupo)}</strong></span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              ${linhasLojasHTML}
            </div>
          </div>
        `;
      }).join("");

    } else {
      htmlPagamentos = "Nenhum registro de pagamento para a(s) loja(s) selecionada(s).";
    }
  } else {
    htmlPagamentos = "Nenhum registro de pagamento retornado para o período.";
  }
  
  // Atualiza os cards no HTML
  document.getElementById("cardValorBruto").innerHTML = `${htmlBrutoPorLoja}<hr style="border:0; border-top:1px solid #ddd; margin: 8px 0;"><div style="font-size: 15px; font-weight: bold;">${formatarMoedaBR(totalBrutoGeral)}</div>`;
  document.getElementById("cardDesconto").innerHTML = `${htmlDescontoPorLoja}<hr style="border:0; border-top:1px solid #ddd; margin: 8px 0;"><div style="font-size: 15px; font-weight: bold;">${formatarMoedaBR(totalDescontoGeral)}</div>`;
  document.getElementById("cardValorLiquido").innerHTML = `${htmlLiquidoPorLoja}<hr style="border:0; border-top:1px solid #ddd; margin: 8px 0;"><div style="font-size: 15px; font-weight: bold;">${formatarMoedaBR(totalLiquidoGeral)}</div>`;
  
  const cardQtdeVendasEl = document.getElementById("cardQtdeVendas");
  if (cardQtdeVendasEl) {
    cardQtdeVendasEl.innerHTML = `${htmlQtdeVendasPorLoja}<hr style="border:0; border-top:1px solid #ddd; margin: 8px 0;"><div style="font-size: 15px; font-weight: bold;">Total vendas: ${totalGeralVendasOS}</div>`;
  }

  const cardTicketMedioEl = document.getElementById("cardTicketMedio");
  if (cardTicketMedioEl) {
    cardTicketMedioEl.innerHTML = `${htmlTicketMedioPorLoja}<hr style="border:0; border-top:1px solid #ddd; margin: 8px 0;"><div style="font-size: 15px; font-weight: bold;">Ticket Médio: ${formatarMoedaBR(ticketMedioGeral)}</div>`;
  }

  document.getElementById("cardResumoPagamento").innerHTML = htmlPagamentos;
  
  // Exibe os botões de abas e o container mantendo a aba de cards ativa por padrão
  document.getElementById("biTabsHeader").style.display = "flex";
  document.getElementById("biCardsContainer").style.display = "flex";
  mudarAba('cards');
}
