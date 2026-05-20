export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const prices = {};
  const log = [];

  // ① 환율
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    if (d?.rates?.KRW) {
      prices['USDKRW=X'] = { price: d.rates.KRW, change: 0, changePercent: 0, currency: 'KRW' };
      log.push(`환율OK: ${d.rates.KRW}`);
    }
  } catch(e) { log.push(`환율실패: ${e.message}`); }

  // ② 한국 주식 — Naver Finance
  const krSymbols = symbolList.filter(s => s.includes('.KS') || s.includes('.KQ'));
  log.push(`한국주식요청: ${krSymbols.join(',')}`);
  
  for (const sym of krSymbols) {
    const code = sym.replace('.KS','').replace('.KQ','');
    try {
      const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://m.stock.naver.com/',
          'Accept': 'application/json'
        }
      });
      log.push(`${code} 응답코드: ${r.status}`);
      if (!r.ok) continue;
      const d = await r.json();
      const price = parseFloat((d?.closePrice || '0').replace(/,/g,''));
      log.push(`${code} 가격: ${price}`);
      if (price > 0) {
        prices[sym] = { price, change: 0, changePercent: 0, currency: 'KRW' };
      }
    } catch(e) { log.push(`${code} 오류: ${e.message}`); }
  }

  // ③ 미국 주식 — Finnhub
  const usSymbols = symbolList.filter(s => !s.includes('.KS') && !s.includes('.KQ') && s !== 'USDKRW=X');
  if (finnhubKey) {
    for (const sym of usSymbols) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${finnhubKey}`);
        const d = await r.json();
        if (d?.c > 0) {
          prices[sym] = { price: d.c, change: d.d||0, changePercent: d.dp||0, currency: 'USD' };
        }
      } catch(e) {}
      await new Promise(r => setTimeout(r, 80));
    }
  }

  console.log('PRICES_LOG:', JSON.stringify(log));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ prices, count: Object.keys(prices).length, log });
}
