export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const apiKey = process.env.FINNHUB_API_KEY;
  const prices = {};

  // ① 환율 (무료 API)
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    if (d?.rates?.KRW) {
      prices['USDKRW=X'] = { price: d.rates.KRW, change: 0, changePercent: 0, currency: 'KRW' };
    }
  } catch(e) {}

  if (!apiKey) {
    return res.status(200).json({ prices, error: 'No API key' });
  }

  // ② 전 종목 Finnhub으로 통일
  // 한국 주식: 005930.KS → Finnhub에서는 "005930.KS" 형식 지원
  const symbolList = symbols.split(',')
    .map(s => s.trim())
    .filter(s => s && s !== 'USDKRW=X');

  // Finnhub 심볼 변환
  // 한국 KOSPI: 005930.KS → KS:005930
  // 미국: GOOGL → GOOGL
  const getFinnhubSymbol = (sym) => {
    if (sym.endsWith('.KS')) return 'KS:' + sym.replace('.KS', '');
    if (sym.endsWith('.KQ')) return 'KQ:' + sym.replace('.KQ', '');
    return sym;
  };

  for (const sym of symbolList) {
    const finnhubSym = getFinnhubSymbol(sym);
    try {
      const r = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSym)}&token=${apiKey}`
      );
      const d = await r.json();
      if (d?.c && d.c > 0) {
        prices[sym] = {
          price: d.c,
          change: d.d || 0,
          changePercent: d.dp || 0,
          currency: sym.includes('.KS') || sym.includes('.KQ') ? 'KRW' : 'USD'
        };
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 80));
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ prices, count: Object.keys(prices).length });
}
