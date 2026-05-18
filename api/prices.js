export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);

  // 미국 주식과 한국 주식 분리
  const usSymbols = symbolList.filter(s => !s.includes('.KS') && !s.includes('.KQ'));
  const krSymbols = symbolList.filter(s => s.includes('.KS') || s.includes('.KQ'));

  const allSymbols = [...usSymbols, ...krSymbols];
  const joinedSymbols = allSymbols.join(',');

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(joinedSymbols)}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketChange,currency,shortName`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Yahoo Finance 응답 오류: ${response.status}`);

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];

    const prices = {};
    for (const q of quotes) {
      prices[q.symbol] = {
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent,
        currency: q.currency,
        name: q.shortName
      };
    }

    res.setHeader('Cache-Control', 'public, max-age=300'); // 5분 캐시
    return res.status(200).json({ prices });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
