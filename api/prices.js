export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
 
  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });
 
  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const prices = {};
 
  // Yahoo Finance 여러 엔드포인트 시도
  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbolList.join(','))}`,
    `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbolList.join(','))}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList.join(','))}`,
  ];
 
  const headers = [
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://finance.yahoo.com/',
      'Origin': 'https://finance.yahoo.com',
    },
    {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': '*/*',
      'Referer': 'https://finance.yahoo.com',
    }
  ];
 
  for (const url of endpoints) {
    for (const header of headers) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
          headers: header,
          signal: controller.signal
        });
        clearTimeout(timeout);
 
        if (!response.ok) continue;
 
        const data = await response.json();
        const quotes = data?.quoteResponse?.result || data?.quote?.result || [];
 
        if (quotes.length === 0) continue;
 
        for (const q of quotes) {
          if (q.regularMarketPrice) {
            prices[q.symbol] = {
              price: q.regularMarketPrice,
              change: q.regularMarketChange || 0,
              changePercent: q.regularMarketChangePercent || 0,
              currency: q.currency || 'USD',
              name: q.shortName || q.symbol
            };
          }
        }
 
        if (Object.keys(prices).length > 0) {
          res.setHeader('Cache-Control', 'public, max-age=300');
          return res.status(200).json({ prices, source: 'yahoo' });
        }
      } catch (e) {
        continue;
      }
    }
  }
 
  // Yahoo 실패 시 — 환율만 별도로 시도
  try {
    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (fxRes.ok) {
      const fxData = await fxRes.json();
      const krwRate = fxData?.rates?.KRW;
      if (krwRate) {
        prices['USDKRW=X'] = {
          price: krwRate,
          change: 0,
          changePercent: 0,
          currency: 'KRW',
          name: 'USD/KRW'
        };
        return res.status(200).json({ prices, source: 'exchangerate', partial: true });
      }
    }
  } catch (e) {}
 
  return res.status(200).json({ prices: {}, error: '주가 데이터를 가져오지 못했습니다.' });
}
