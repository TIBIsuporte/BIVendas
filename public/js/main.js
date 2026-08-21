function processarDadosBI(dados) {
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

  // Agrupamento por OS para evitar duplicidades de totais de cabeçalho
  const osMap = {};

  dadosFiltrados.forEach(item => {
    const osId = String(item.OS || item.CODIGODAVENDA || "").trim();
    if (!osId) return;

    if (!osMap[osId]) {
      osMap[osId] = {
        valorBrutoOS: 0,
        descontoOS: 0,
        liquidoOS: 0,
        ehDevolucao: String(item.EHDEVOLUCAO || "").trim().toUpperCase() === "D",
        tipoVenda: String(item.TIPOVENDA || "").trim().toUpperCase()
      };
    }

    // Somamos os valores dos produtos que pertencem a esta mesma OS
    osMap[osId].valorBrutoOS += parseNumeroBR(item.VALORBRUTOPRODUTO);
    osMap[osId].descontoOS += parseNumeroBR(item.DESCPRODUTO);
    osMap[osId].liquidoOS += parseNumeroBR(item.LIQUIDOPRODUTO);
  });

  let totalBrutoGeral = 0;
  let totalDescontoGeral = 0;
  let totalDevolucaoGeral = 0;
  let qtdeVendasNormais = 0;
  let qtdeDevolucoes = 0;

  // Percorre cada OS única consolidada
  Object.keys(osMap).forEach(osId => {
    const venda = osMap[osId];
    const eDevolucao = venda.ehDevolucao || venda.tipoVenda.includes("DEV") || venda.tipoVenda.includes("ESTORNO") || venda.liquidoOS < 0;

    if (eDevolucao) {
      totalDevolucaoGeral += Math.abs(venda.liquidoOS > 0 ? venda.liquidoOS : venda.valorBrutoOS);
      qtdeDevolucoes++;
      return;
    }

    totalBrutoGeral += venda.valorBrutoOS;
    totalDescontoGeral += venda.descontoOS;
    qtdeVendasNormais++;
  });

  let totalLiquidoGeral = totalBrutoGeral - totalDescontoGeral - totalDevolucaoGeral;
  let qtdeVendasGeral = qtdeVendasNormais - qtdeDevolucoes;
  if (qtdeVendasGeral < 0) qtdeVendasGeral = 0;

  // Atualiza os cards na tela
  document.getElementById("cardValorBruto").textContent = formatarMoedaBR(totalBrutoGeral);
  document.getElementById("cardDesconto").textContent = formatarMoedaBR(totalDescontoGeral);
  document.getElementById("cardValorLiquido").textContent = formatarMoedaBR(totalLiquidoGeral);
  document.getElementById("cardDevolucao").textContent = formatarMoedaBR(totalDevolucaoGeral);
  document.getElementById("cardQtdeVendas").textContent = qtdeVendasGeral.toLocaleString('pt-BR');

  document.getElementById("biCardsContainer").style.display = "grid";
}
