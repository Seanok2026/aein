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

  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=5`;

  try {
    const r = await fetch(apiUrl);
    if (!r.ok) throw new Error(`오류: ${r.status}`);
    const data = await r.json();
    if (data.status !== 'ok') throw new Error('실패: ' + data.message);

    const items = (data.items || []).slice(0, 5).map(item => ({
      title: item.title?.replace(/\s*-\s*[^-]{2,30}$/, '').trim() || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      source: item.author || '구글 뉴스',
      de
