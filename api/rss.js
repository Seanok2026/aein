export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { type } = req.query;
  const feedUrls = {
    ai_news: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fnews.google.com%2Frss%2Fsearch%3Fq%3DChatGPT%2BGemini%2BClaude%2BAI%2B%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8%26hl%3Dko%26gl%3DKR%26ceid%3DKR%3Ako&count=5',
    ai_stock: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fnews.google.com%2Frss%2Fsearch%3Fq%3DAI%2B%EC%A3%BC%EC%8B%9D%2B%EB%82%98%EC%8A%A4%EB%8B%A5%2B%EB%B0%98%EB%8F%84%EC%B2%B4%2B%ED%88%AC%EC%9E%90%2B%EC%A0%84%EB%A7%9D%26hl%3Dko%26gl%3DKR%26ceid%3DKR%3Ako&count=5',
  };
  const url = feedUrls[type];
  if (!url) return res.status(400).json({ error: 'invalid type' });
  try {
    const r = await fetch(url);
    const data = await r.json();
    if (data.status !== 'ok') throw new Error(data.message);
    const items = (data.items || []).slice(0, 5).map(item => ({
      title: item.title?.replace(/\s*-\s*[^-]{2,30}$/, '').trim() || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      source: '구글 뉴스',
      description: item.description?.replace(/<[^>]+>/g, '').trim().slice(0, 100) || ''
    }));
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.status(200).json({ items, sourceName: '구글 뉴스' });
  } catch(e) {
    return res.status(200).json({ items: [], error: e.message });
  }
}
