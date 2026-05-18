export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
 
  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });
 
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
 
  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const prices = {};
 
  // 환율 먼저 가져오기
  try {
    const fxRes = await fetch(`https://finnhub.io/api/v1/forex/rates?base=USD&token=${apiKey}`);
    if (fxRes.ok) {
      const fxData = await fxRes.json();
      const krw = fxData?.quote?.KRW;
      if (krw) {
        prices['USDKRW=X'] = { price: krw, change: 0, changePercent: 0, currency: 'KRW', name: 'USD/KRW' };
      }
    }
  } catch (e) {}
 
  // 미국 주식 가져오기 (Finnhub)
  const usSymbols = symbolList.filter(s => !s.includes('.KS') && !s.includes('.KQ') && s !== 'USDKRW=X');
  const krSymbols = symbolList.filter(s => s.includes('.KS') || s.includes('.KQ'));
 
  // 병렬로 주가 조회
  const fetchPromises = usSymbols.map(async (symbol) => {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.c && d.c > 0) {
        prices[symbol] = {
          price: d.c,           // 현재가
          change: d.d || 0,     // 변동
          changePercent: d.dp || 0, // 변동률
          currency: 'USD',
          name: symbol
        };
      }
    } catch (e) {}
  });
 
  // 한국 주식 — 코드 변환 (.KS 제거 후 조회)
  const krPromises = krSymbols.map(async (symbol) => {
    const code = symbol.replace('.KS', '').replace('.KQ', '');
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${code}&token=${apiKey}`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.c && d.c > 0) {
        prices[symbol] = {
          price: d.c,
          change: d.d || 0,
          changePercent: d.dp || 0,
          currency: 'KRW',
          name: code
        };
      }
    } catch (e) {}
  });
 
  await Promise.allSettled([...fetchPromises, ...krPromises]);
 
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    prices,
    count: Object.keys(prices).length,
    source: 'finnhub'
  });
}
