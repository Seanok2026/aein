export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type } = req.query;

  const feedUrls = {
    ai_news: 'https://news.google.com/rss/search?q=ChatGPT+Gemini+Claude+AI+업데이트&hl=ko&gl=KR&ceid=KR:ko',
    ai_stock: 'https://news.google.com/rss/search?q=AI+주식+나스닥+반도체+투자+전망&hl=ko&gl=KR&ceid=KR:ko',
  };

  const feedUrl = feedUrls[type];
  if (!feedUrl) return res.status(400).json({ error: 'invalid type' });

  // rss2json 서비스 사용 (서버 차단 없음, 무료)
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&api_key=undefined&count=5`;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(t);

    if (!r.ok) throw new Error(`rss2json 오류: ${r.status}`);

    const data = await r.json();
    if (data.status !== 'ok') throw new Error('rss2json 실패: ' + data.message);

    const items = (data.items || []).slice(0, 5).map(item => ({
      title: item.title?.replace(/\s*-\s*[^-]{2,30}$/, '').trim() || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      source: item.author || '구글 뉴스',
      description: item.description?.replace(/<[^>]+>/g, '').trim().slice(0, 100) || ''
    }));

    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.status(200).json({ items, sourceName: '구글 뉴스' });

  } catch(e) {
    console.error('RSS error:', e.message);
    return res.status(200).json({ items: [], error: e.message });
  }
}
