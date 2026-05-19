export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type } = req.query;

  const feeds = {
    ai_news: [
      'https://news.google.com/rss/search?q=ChatGPT+Gemini+Claude+Perplexity+AI+업데이트+신기능&hl=ko&gl=KR&ceid=KR:ko',
      'https://news.google.com/rss/search?q=인공지능+AI+앱+업데이트+출시&hl=ko&gl=KR&ceid=KR:ko',
    ],
    ai_stock: [
      'https://news.google.com/rss/search?q=AI+주식+나스닥+반도체+엔비디아+테슬라+투자+전망&hl=ko&gl=KR&ceid=KR:ko',
      'https://news.google.com/rss/search?q=미국주식+AI+테크주+월가+전문가+매수+매도&hl=ko&gl=KR&ceid=KR:ko',
    ]
  };

  const sources = feeds[type];
  if (!sources) return res.status(400).json({ error: 'invalid type' });

  function parseXML(xml) {
    const items = [];
    const reg = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = reg.exec(xml)) !== null && items.length < 5) {
      const b = m[1];
      const title = (
        b.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        b.match(/<title>([\s\S]*?)<\/title>/)
      )?.[1]?.trim().replace(/\s*-\s*[^-]{2,30}$/, '').trim() || '';

      const link = (
        b.match(/<link>(https?:\/\/[^\s<]+)/) ||
        b.match(/<link[^>]+href="(.*?)"/)
      )?.[1]?.trim() || '';

      const pubDate = b.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || '';
      const source = b.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.trim() || '';

      if (title.length > 5) items.push({ title, link, pubDate, source });
    }
    return items;
  }

  for (const url of sources) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          'Accept': 'application/rss+xml, text/xml, */*'
        },
        signal: controller.signal
      });
      clearTimeout(t);
      if (!r.ok) continue;

      const xml = await r.text();
      const items = parseXML(xml);
      if (items.length === 0) continue;

      res.setHeader('Cache-Control', 'public, max-age=900');
      return res.status(200).json({ items, sourceName: '구글 뉴스' });
    } catch(e) {
      continue;
    }
  }

  return res.status(200).json({ items: [], error: '뉴스를 가져오지 못했습니다.' });
}
