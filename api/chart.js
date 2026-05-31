export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbols = ['^NDX', '^GSPC']; // 나스닥100, S&P500
  const result = {};

  for (const sym of symbols) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://finance.yahoo.com'
        }
      });
      if (!r.ok) continue;
      const data = await r.json();
      const chart = data?.chart?.result?.[0];
      if (!chart) continue;

      const timestamps = chart.timestamp || [];
      const closes = chart.indicators?.quote?.[0]?.close || [];
      const labels = timestamps.map(t => {
        const d = new Date(t * 1000);
        return `${d.getMonth()+1}/${d.getDate()}`;
      });

      result[sym] = {
        name: sym === '^NDX' ? '나스닥 100' : 'S&P 500',
        labels,
        data: closes.map(v => v ? Math.round(v * 100) / 100 : null),
        current: closes[closes.length - 1],
        prev: closes[closes.length - 2],
      };
    } catch(e) {}
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json(result);
}