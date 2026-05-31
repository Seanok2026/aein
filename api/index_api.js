import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  // 캐시 완전 금지
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '-1');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const filePath = path.join(process.cwd(), 'index.html');
  const html = fs.readFileSync(filePath, 'utf-8');
  res.status(200).send(html);
}
