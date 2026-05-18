export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type } = req.query;

  const feedSources = {
    // AI 앱 소식 — 한국 IT 매체 우선
    ai_news: [
      'https://feeds.feedburner.com/bloter',                                          // 블로터
      'https://rss.etnews.com/Section901.xml',                                        // 전자신문 AI
      'https://www.aitimes.com/rss/allArticle.xml',                                   // AI타임스
      'https://news.google.com/rss/search?q=AI+인공지능+ChatGPT+Gemini+Claude+업데이트&hl=ko&gl=KR&ceid=KR:ko',
      'https://news.google.com/rss/search?q=ChatGPT+Gemini+Claude+Perplexity+신기능&hl=ko&gl=KR&ceid=KR:ko',
    ],
    // AI 주식 소식 — Investing.com 1순위, 한국 경제 매체 포함
    ai_stock: [
      'https://www.investing.com/rss/news_285.rss',                                   // Investing.com - AI/기술주
      'https://www.investing.com/rss/news_14.rss',                                    // Investing.com - 주식 전반
      'https://www.hankyung.com/feed/economy',                                        // 한국경제
      'https://rss.mt.co.kr/mt_it.xml',                                               // 머니투데이 IT
      'https://rss.joins.com/joins_economy_list.xml',                                 // 중앙일보 경제
      'https://news.google.com/rss/search?q=AI+주식+반도체+나스닥+엔비디아+AMD+인공지능+투자&hl=ko&gl=KR&ceid=KR:ko',
      'https://news.google.com/rss/search?q=미국주식+AI+테크주+월가+전문가+전망&hl=ko&gl=KR&ceid=KR:ko',
    ]
  };

  const sources = feedSources[type];
  if (!sources) return res.status(400).json({ error: 'invalid type' });

  function parseXML(xml, maxItems) {
    const items = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
      const block = match[1];
      const title = (
        block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        block.match(/<title>([\s\S]*?)<\/title>/)
      )?.[1]?.trim() || '';
      const link = (
        block.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/) ||
        block.match(/<link>(https?:\/\/[^\s<]+)<\/link>/) ||
        block.match(/<link[^>]+href="(.*?)"/)
      )?.[1]?.trim() || '';
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || '';
      const source = (
        block.match(/<source[^>]*><!\[CDATA\[(.*?)\]\]><\/source>/) ||
        block.match(/<source[^>]*>(.*?)<\/source>/)
      )?.[1]?.trim() || '';
      const descRaw = (
        block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
        block.match(/<description>([\s\S]*?)<\/description>/)
      )?.[1] || '';
      const description = descRaw.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim().slice(0, 100);

      if (title && title.length > 5) {
        const cleanTitle = title.replace(/\s*[-–]\s*[^-–]{2,40}$/, '').trim();
        items.push({ title: cleanTitle || title, link, pubDate, source, description });
      }
    }
    return items;
  }

  const sourceNames = {
    'bloter': '블로터',
    'etnews': '전자신문',
    'aitimes': 'AI타임스',
    'hankyung': '한국경제',
    'mt.co.kr': '머니투데이',
    'joins': '중앙일보',
  };

  for (const url of sources) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) continue;

      const xml = await response.text();
      const items = parseXML(xml, 5);
      if (items.length === 0) continue;

      // 소스 이름 매핑
      const sourceName = url.includes('investing.com') ? 'Investing.com'
        : url.includes('hankyung') ? '한국경제'
        : url.includes('mt.co.kr') ? '머니투데이'
        : url.includes('joins') ? '중앙일보'
        : url.includes('bloter') ? '블로터'
        : url.includes('etnews') ? '전자신문'
        : url.includes('aitimes') ? 'AI타임스'
        : '구글 뉴스';

      res.setHeader('Cache-Control', 'public, max-age=900');
      return res.status(200).json({ items, sourceName });
    } catch (e) {
      continue;
    }
  }

  return res.status(200).json({ items: [], error: '뉴스를 가져오지 못했습니다.' });
}
