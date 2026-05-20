export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const prices = {};

  // ① 환율
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    if (d?.rates?.KRW) {
      prices['USDKRW=X'] = { price: d.rates.KRW, change: 0, changePercent: 0, currency: 'KRW' };
    }
  } catch(e) {}

  // ② 한국 주식 — 서버에서 직접 네이버 금융 호출 (CORS 없음)
  const krSymbols = symbolList.filter(s => s.includes('.KS') || s.includes('.KQ'));
  for (const sym of krSymbols) {
    const code = sym.replace('.KS','').replace('.KQ','');
    try {
      const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Referer': 'https://m.stock.naver.com/',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9'
        }
      });
      if (!r.ok) continue;
      const d = await r.json();
      const price = parseFloat((d?.closePrice || '0').replace(/,/g,''));
      if (price > 0) {
        prices[sym] = {
          price,
          change: parseFloat((d?.compareToPreviousClosePrice||'0').replace(/,/g,'')),
          changePercent: parseFloat(d?.fluctuationsRatio||'0'),
          currency: 'KRW'
        };
      }
    } catch(e) {}
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

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ prices, count: Object.keys(prices).length });
}
