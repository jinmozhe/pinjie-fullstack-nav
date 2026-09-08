import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const web = createRequire(path.join(root, 'apps/web/package.json'));
const sharp = createRequire(web.resolve('next/package.json'))('sharp');
const source = await readFile(path.join(output, 'logo.svg'), 'utf8');
const white = source.replaceAll('#F26B38', '#FFFFFF').replaceAll('#27272A', '#FFFFFF');

for (const size of [16, 32, 64, 512, 1024]) {
  await sharp(Buffer.from(source), { density: 384 }).resize(size, size).png().toFile(path.join(output, `logo-${size}.png`));
}
await writeFile(path.join(output, 'logo-white.svg'), white, 'utf8');
await sharp(Buffer.from(white), { density: 384 }).resize(512, 512).png().toFile(path.join(output, 'logo-white-512.png'));

// Multi-resolution ICO; each entry contains a lossless PNG image.
const frames = await Promise.all([16, 32, 64].map(size => readFile(path.join(output, `logo-${size}.png`))));
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, index) => {
  const pos = 6 + index * 16;
  const size = [16, 32, 64][index];
  header[pos] = size;
  header[pos + 1] = size;
  header.writeUInt16LE(1, pos + 4);
  header.writeUInt16LE(32, pos + 6);
  header.writeUInt32LE(frame.length, pos + 8);
  header.writeUInt32LE(offset, pos + 12);
  offset += frame.length;
});
await writeFile(path.join(output, 'favicon.ico'), Buffer.concat([header, ...frames]));

function icon(x, y, size, inverted = false) {
  const data = Buffer.from(inverted ? white : source).toString('base64');
  return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/svg+xml;base64,${data}"/>`;
}
function svg(width, height, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g font-family="Microsoft YaHei, sans-serif">${content}</g></svg>`;
}
const lockup = svg(960, 240, `${icon(8, 8, 224)}<text x="264" y="151" font-size="104" font-weight="700" fill="#27272A">拾径导航</text>`);
await sharp(Buffer.from(lockup), { density: 144 }).resize(960, 240).png().toFile(path.join(output, 'logo-horizontal.png'));
const preview = svg(1400, 960, `
  <rect width="1400" height="960" fill="#FCFCFC"/>
  <text x="72" y="76" font-size="18" fill="#64646C" letter-spacing="3">SHIJING / BRAND IDENTITY</text>
  <text x="72" y="132" font-size="34" fill="#27272A" font-weight="700">拾径导航</text>
  <text x="1328" y="128" text-anchor="end" font-size="20" fill="#64646C">常用好站，一处直达</text>
  <path d="M72 164H1328" stroke="#E7E7EB"/>
  ${icon(150, 213, 330)}
  <text x="630" y="351" font-size="78" fill="#27272A" font-weight="700">拾径导航</text>
  <text x="633" y="410" font-size="26" fill="#64646C">常用好站，一处直达</text>
  <text x="633" y="471" font-size="16" fill="#64646C">起点 · 路径 · 抵达</text>
  <path d="M72 591H1328" stroke="#E7E7EB"/>
  <text x="72" y="640" font-size="17" fill="#64646C">网站标识</text>
  <rect x="72" y="667" width="520" height="80" rx="6" fill="#FFFFFF" stroke="#E7E7EB"/>
  ${icon(93, 691, 32)}
  <text x="136" y="718" font-size="22" font-weight="700" fill="#F26B38">拾径导航</text>
  <text x="72" y="805" font-size="17" fill="#64646C">实际像素尺寸</text>
  ${icon(73, 837, 16)}${icon(138, 829, 32)}${icon(225, 813, 64)}
  <text x="72" y="905" font-size="14" fill="#64646C">16 px</text>
  <text x="138" y="905" font-size="14" fill="#64646C">32 px</text>
  <text x="225" y="905" font-size="14" fill="#64646C">64 px</text>
  <rect x="648" y="637" width="300" height="270" rx="12" fill="#27272A"/>
  ${icon(727, 666, 142, true)}
  <text x="798" y="861" text-anchor="middle" font-size="18" fill="#FFFFFF">深色背景反白版</text>
  <rect x="988" y="637" width="340" height="124" rx="12" fill="#F26B38"/>
  <text x="1016" y="687" font-size="20" fill="#27272A">导航橙</text>
  <text x="1016" y="727" font-size="18" fill="#27272A">#F26B38</text>
  <rect x="988" y="783" width="340" height="124" rx="12" fill="#27272A"/>
  <text x="1016" y="833" font-size="20" fill="#FFFFFF">墨灰</text>
  <text x="1016" y="873" font-size="18" fill="#FFFFFF">#27272A</text>
`);
await sharp(Buffer.from(preview)).png().toFile(path.join(output, 'brand-preview.png'));
console.log('Brand assets rendered from logo.svg.');
