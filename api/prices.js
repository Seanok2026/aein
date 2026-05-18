export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
 
  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });
 
  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const prices = {};
 
  try {
    // Step 1: Yahoo Finance 쿠키 획득
    const cookieRes = await fetch('https://finance.yahoo.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    const cookies = cookieRes.headers.get('set-cookie') || '';
 
    // Step 2: crumb 획득
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookies,
      }
    });
    const crumb = await crumbRes.text();
 
    // Step 3: 주가 조회
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList.join(','))}&crumb=${encodeURIComponent(crumb)}`;
    const quoteRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookies,
        'Accept': 'application/json',
      }
    });
 
    if (quoteRes.ok) {
      const data = await quoteRes.json();
      const quotes = data?.quoteResponse?.result || [];
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
    }
 
    // 주가 획득 성공
    if (Object.keys(prices).length > 0) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).json({ prices, source: 'yahoo' });
    }
  } catch (e) {
    console.error('Yahoo Finance error:', e.message);
  }
 
  // Yahoo 실패 시 — 환율만 별도 제공
  try {
    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD');
    if (fxRes.ok) {
      const fxData = await fxRes.json();
      const krwRate = fxData?.rates?.KRW;
      if (krwRate) {
        prices['USDKRW=X'] = { price: krwRate, change: 0, changePercent: 0, currency: 'KRW', name: 'USD/KRW' };
      }
    }
  } catch (e) {}
 
  return res.status(200).json({ prices, error: Object.keys(prices).length === 0 ? '주가 데이터를 가져오지 못했습니다.' : null });
