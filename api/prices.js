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

  // ② 한국 주식 — Yahoo Finance (.KS)
  const krSymbols = symbolList.filter(s => s.includes('.KS') || s.includes('.KQ'));
  if (krSymbols.length > 0) {
    try {
      const krQuery = krSymbols.join(',');
      const urls = [
        `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(krQuery)}`,
        `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(krQuery)}`,
      ];
      for (const url of urls) {
        try {
          const r = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Referer': 'https://finance.yahoo.com',
              'Origin': 'https://finance.yahoo.com'
            }
          });
          if (!r.ok) continue;
          const d = await r.json();
          const quotes = d?.quoteResponse?.result || [];
          if (quotes.length === 0) continue;
          for (const q of quotes) {
            if (q.regularMarketPrice > 0) {
              prices[q.symbol] = {
                price: q.regularMarketPrice,
                change: q.regularMarketChange || 0,
                changePercent: q.regularMarketChangePercent || 0,
                currency: 'KRW'
              };
            }
          }
          if (Object.keys(prices).filter(k => k.includes('.KS')).length > 0) break;
        } catch(e) { continue; }
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
          prices[sym] = { price: d.c, change: d.d || 0, changePercent: d.dp || 0, currency: 'USD' };
        }
      } catch(e) {}
      await new Promise(r => setTimeout(r, 80));
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ prices, count: Object.keys(prices).length });
}
