import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const web = createRequire(path.join(root, 'apps/web/package.json'));
const sharp = createRequire(web.resolve('next/package.json'))('sharp');
const React = web('react');
const { renderToStaticMarkup } = web('react-dom/server');
const icons = web('lucide-react');

const C = { bg: '#FCFCFC', ink: '#27272A', muted: '#64646C', faint: '#98989F', line: '#E7E7EB', orange: '#F26B38', link: '#B9471C', selected: '#FFF2EB' };
const esc = (v) => renderToStaticMarkup(String(v));
let nodes = [];
function rect(x, y, w, h, fill, stroke = 'none', radius = 0, extra = '') {
  nodes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" ${extra}/>`);
}
function text(v, x, y, size = 14, color = C.ink, weight = 400, extra = '') {
  nodes.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" ${extra}>${esc(v)}</text>`);
}
function line(x, y, x2, y2, color = C.line) { nodes.push(`<path d="M${x} ${y}H${x2}V${y2}" stroke="${color}" fill="none"/>`); }
function icon(name, x, y, size = 18, color = C.muted) {
  const component = icons[name];
  if (!component) throw new Error(`Unknown Lucide icon: ${name}`);
  nodes.push(`<g transform="translate(${x},${y})">${renderToStaticMarkup(React.createElement(component, { size, color, strokeWidth: 1.6 }))}</g>`);
}
function width(v, size) { return [...v].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? size : size * 0.55), 0); }
function truncate(v, max, size) {
  if (width(v, size) <= max) return v;
  let s = '';
  for (const ch of v) { if (width(s + ch + '…', size) > max) break; s += ch; }
  return s + '…';
}
function wrapped(v, x, y, max, size = 14, color = C.muted, limit = 2) {
  let rest = v;
  for (let i = 0; i < limit && rest; i++) {
    let s = '';
    for (const ch of rest) { if (width(s + ch, size) > max) break; s += ch; }
    if (!s) break;
    text(i === limit - 1 && s.length < rest.length ? truncate(rest, max, size) : s, x, y + i * 22, size, color);
    rest = rest.slice(s.length);
  }
}
function chip(label, x, y, selected = false, symbol) {
  const w = Math.ceil(width(label, 12)) + (symbol ? 43 : 20);
  rect(x, y, w, 28, selected ? C.selected : '#FFFFFF', selected ? '#F0C6B2' : C.line, 4);
  if (symbol) icon(symbol, x + 9, y + 7, 14, selected ? C.link : C.muted);
  text(label, x + (symbol ? 29 : 10), y + 19, 12, selected ? C.link : C.muted);
  return w;
}
const sites = [
  ['ChatGPT', 'chatgpt.com', '用于日常问答、资料整理、内容创作与代码协作。', 'Sparkles', '#127B68'],
  ['Claude', 'claude.ai', '适合长文阅读、内容创作与复杂问题分析的智能助手。', 'Asterisk', '#B46445'],
  ['DeepSeek', 'chat.deepseek.com', '面向通用问答、数学推理与编程任务的智能助手。', 'Waves', '#4266E9'],
  ['Perplexity', 'perplexity.ai', '结合来源引用进行检索，快速查找和整理相关信息。', 'ScanSearch', '#207E82'],
  ['Gemini', 'gemini.google.com', '探索灵感、处理多模态内容，辅助完成日常工作。', 'Sparkle', '#5372D9'],
  ['Microsoft Copilot', 'copilot.microsoft.com', '提供搜索、对话和内容创作的日常智能助手。', 'Command', '#9B4FA7'],
  ['通义千问', 'tongyi.aliyun.com', '面向中文写作、文档阅读和知识问答的智能助手。', 'MessageSquare', '#665BC9'],
  ['豆包', 'doubao.com', '围绕学习、工作和生活展开自然对话与内容创作。', 'Bot', '#398DA4'],
  ['GitHub', 'github.com', '代码托管与团队协作，发现开源项目并参与开发。', 'Github', '#35353D'],
  ['GitLab', 'gitlab.com', '覆盖代码管理、协作和持续交付的软件开发平台。', 'GitBranch', '#D56835'],
  ['Visual Studio Code', 'code.visualstudio.com', '轻量的代码编辑器，支持扩展与多语言开发。', 'CodeXml', '#2684C8'],
  ['Stack Overflow', 'stackoverflow.com', '查找编程问题的解答，与开发者交流技术经验。', 'Layers', '#B95A29'],
  ['CodePen', 'codepen.io', '在线构建和分享前端界面，探索交互设计灵感。', 'Codepen', '#34343C'],
  ['Vercel', 'vercel.com', '预览、部署和交付现代 Web 应用。', 'Triangle', '#34343C'],
  ['npm', 'npmjs.com', '查找 JavaScript 软件包，管理项目依赖。', 'Package', '#BD3842'],
  ['掘金', 'juejin.cn', '阅读开发实践，分享技术文章与项目经验。', 'Layers', '#3471DB'],
  ['MDN Web Docs', 'developer.mozilla.org', '开放的 Web 技术文档与 HTML、CSS、JavaScript 参考。', 'BookOpen', '#35353D'],
  ['Next.js', 'nextjs.org', '用于构建全栈 Web 应用的 React 框架。', 'Triangle', '#35353D'],
  ['FastAPI', 'fastapi.tiangolo.com', '基于 Python 类型提示构建高性能 API。', 'Zap', '#12897C'],
  ['React', 'react.dev', '通过组件构建 Web 与原生用户界面。', 'Atom', '#247F9D'],
  ['Hugging Face', 'huggingface.co', '探索开源模型、数据集与 AI 应用。', 'Smile', '#AE861B'],
  ['Poe', 'poe.com', '在同一平台体验不同的 AI 对话助手。', 'MessageCircle', '#7857B8'],
  ['Kimi', 'kimi.com', '阅读长文档、搜索资料并辅助完成写作。', 'Moon', '#464E64'],
  ['Coze', 'coze.com', '搭建智能体和工作流，连接知识与应用。', 'Workflow', '#6554D5'],
];
const cats = [['全部站点', 'LayoutGrid'], ['AI 智能', 'Sparkles'], ['代码开发', 'CodeXml'], ['技术文档', 'BookOpen'], ['云服务与部署', 'Cloud'], ['效率工具', 'Wrench'], ['设计资源', 'Palette'], ['社交媒体', 'MessagesSquare'], ['生活日常', 'Coffee'], ['其他站点', 'Folder']];
function logo(site, x, y, size = 44) {
  rect(x, y, size, size, site[4] + '10', site[4] + '20', 6);
  icon(site[3], x + size * .23, y + size * .23, size * .54, site[4]);
}
function card(site, x, y, w = 352, h = 144) {
  rect(x, y + 2, w, h, '#F2F2F3', 'none', 8);
  rect(x, y, w, h, '#FFFFFF', C.line, 8);
  logo(site, x + 16, y + 16);
  text(truncate(site[0], w - 116, 14), x + 72, y + 35, 14, C.ink, 650);
  text(truncate(site[1], w - 116, 12), x + 72, y + 57, 12, C.muted);
  icon('ExternalLink', x + w - 32, y + 21, 16);
  wrapped(site[2], x + 16, y + 94, w - 32, 13, C.muted);
}
function shell(active = 0, logged = false) {
  rect(0, 0, 1920, 1080, C.bg);
  rect(0, 0, 1920, 64, '#FFFFFF');
  line(0, 64, 1920, 64);
  rect(0, 65, 240, 1015, '#FEFEFE'); line(240, 0, 240, 1080);
  text('Pinjie Nav', 24, 41, 23, C.orange, 700, 'font-family="Georgia"');
  if (logged) { icon('UserRound', 1705, 24, 16); text('管理员', 1732, 39, 13, C.muted); icon('LogOut', 1870, 24, 17); }
  else { icon('LogIn', 1771, 24, 17); text('管理员登录', 1798, 39, 13, C.muted); }
  rect(16, 88, 208, 42, '#FFFFFF', '#DADADF', 6); icon('Search', 28, 101, 16); text('搜索站点…', 53, 115, 14, C.faint);
  cats.forEach(([label, name], i) => {
    const y = 151 + i * 46;
    if (i === active) { rect(12, y, 216, 40, C.selected, 'none', 6); rect(12, y + 10, 3, 20, C.orange, 'none', 1); }
    icon(name, 26, y + 11, 18, i === active ? C.link : '#777780');
    text(label, 56, y + 26, 14, i === active ? C.link : C.muted, i === active ? 650 : 400);
  });
  line(20, 627, 220, 627); text('标签', 24, 657, 12, C.faint);
  let tx = 22, ty = 675;
  ['AI', '开发', '工具', '文档', '设计', '开源', '学习', '效率'].forEach(v => {
    const w = width(v, 12) + 20;
    if (tx + w > 220) { tx = 22; ty += 36; }
    chip(v, tx, ty); tx += w + 6;
  });
  text('© 2026 Pinjie Nav', 120, 1037, 12, C.muted, 400, 'text-anchor="middle"');
}
function section(title, count, y, rows) {
  text(title, 344, y + 20, 16, C.ink, 650);
  text(String(count), 344 + width(title, 16) + 14, y + 19, 12, C.faint);
  text('查看全部', 1710, y + 19, 12, C.link); icon('ArrowRight', 1771, y + 5, 15, C.link);
  line(344, y + 36, 1800, y + 36);
  rows.forEach((s, i) => card(s, 344 + (i % 4) * 368, y + 53 + Math.floor(i / 4) * 160));
}
function home(logged = false) {
  shell(0, logged);
  section('AI 智能', 32, 94, sites.slice(0, 8));
  section('代码开发', 24, 492, sites.slice(8, 16));
  section('技术文档', 18, 890, sites.slice(16, 20));
}
function listing() {
  shell(1);
  text('全部站点', 344, 114, 12, C.muted); icon('ChevronRight', 410, 101, 14, C.faint); text('AI 智能', 438, 114, 12, C.link);
  text('AI 智能', 344, 164, 24, C.ink, 650); text('32 个站点', 451, 162, 13, C.muted);
  chip('AI 智能', 344, 188, true, 'Sparkles'); text('清除筛选', 462, 207, 12, C.link);
  text('标签', 1485, 207, 12, C.muted); rect(1528, 184, 176, 36, '#FFFFFF', C.line, 6); text('全部标签', 1541, 207, 13, C.muted); icon('ChevronDown', 1678, 194, 15);
  line(344, 240, 1800, 240);
  [...sites.slice(0, 8), ...sites.slice(20, 24)].forEach((s, i) => card(s, 344 + (i % 4) * 368, 260 + Math.floor(i / 4) * 160));
  const py = 802;
  rect(914, py, 36, 36, '#F5F5F6', C.line, 6); icon('ChevronLeft', 924, py + 10, 16, '#B8B8BE');
  rect(966, py, 36, 36, C.selected, '#F0C6B2', 6); text('1', 980, py + 24, 13, C.link, 650);
  text('2', 1032, py + 24, 13, C.muted); text('3', 1084, py + 24, 13, C.muted);
  rect(1114, py, 36, 36, '#FFFFFF', C.line, 6); icon('ChevronRight', 1124, py + 10, 16);
  text('共 32 个站点', 1176, py + 24, 12, C.muted);
}
function account(label, username, password, note, y) {
  text(label, 632, y + 18, 14, C.ink, 650);
  [['用户名', username], ['密码', password], ['备注', note]].forEach(([field, value], i) => {
    const yy = y + 53 + i * 39;
    text(field, 632, yy, 12, C.muted);
    text(value, 711, yy, 14, C.ink, 400, field === '密码' ? 'font-family="Consolas"' : '');
    icon('Copy', 1257, yy - 14, 16);
  });
}
function detail(logged) {
  home(logged);
  rect(0, 0, 1920, 1080, '#1F2027', 'none', 0, 'opacity="0.30"');
  const x = 600, y = logged ? 198 : 420, w = 720, h = logged ? 684 : 240;
  rect(x - 2, y + 8, w + 4, h, '#202027', 'none', 8, 'opacity="0.09"');
  rect(x, y, w, h, '#FFFFFF', '#DDDEE2', 8);
  icon('X', x + w - 40, y + 20, 20);
  logo(sites[0], x + 32, y + 40, 64);
  text('ChatGPT', x + 116, y + 61, 22, C.ink, 650);
  const demoUrl = 'https://chatgpt.com/?source=design-preview&workspace=example&conversation=sample-only';
  text(truncate(demoUrl, 500, 13), x + 116, y + 92, 13, C.muted);
  icon('ExternalLink', x + w - 48, y + 78, 16, C.link);
  text('用于日常问答、资料整理、写作与代码协作的 AI 助手。', x + 32, y + 136, 14, C.muted);
  text('支持持续对话与上下文理解，帮助整理思路、提炼信息并完成日常工作。', x + 32, y + 158, 14, C.muted);
  icon('Folder', x + 32, y + 191, 16, C.link);
  text('AI 智能', x + 56, y + 204, 13, C.link);
  const tags = ['AI', '效率', '写作', '开发'];
  const gap = 20;
  const tagWidths = tags.map(label => 24 + width(label, 13));
  let tx = x + w - 32 - tagWidths.reduce((sum, item) => sum + item, 0) - gap * (tags.length - 1);
  tags.forEach((label, i) => {
    icon('Tag', tx, y + 191, 16, C.link);
    text(label, tx + 24, y + 204, 13, C.link);
    tx += tagWidths[i] + gap;
  });
  if (logged) {
    line(x + 32, y + 242, x + w - 32, y + 242);
    text('帐号资料', x + 32, y + 274, 15, C.ink, 650); text('2 个帐号', x + w - 90, y + 274, 12, C.faint);
    account('日常使用', 'demo.reader@example.com', 'Demo-Only-2026!', '日常问答与资料整理。', y + 299);
    line(x + 32, y + 464, x + w - 32, y + 464);
    account('工作资料', 'demo.work@example.com', 'Sample-Only-0824!', '项目资料与工作文档。', y + 484);
  }
}

function mobileShell(query = '', logged = false) {
  rect(0, 0, 390, 844, C.bg);
  rect(0, 0, 390, 64, '#FFFFFF');
  line(0, 64, 390, 64);
  icon('Menu', 18, 22, 22);
  text('Pinjie Nav', 60, 42, 22, C.orange, 700, 'font-family="Georgia"');
  icon(logged ? 'UserRound' : 'LogIn', 292, 24, 17);
  text(logged ? '管理员' : '登录', 318, 40, 13, C.muted);
  rect(16, 80, 358, 44, '#FFFFFF', '#DADADF', 6);
  icon('Search', 30, 94, 17);
  text(query || '搜索站点名称', 58, 108, 14, query ? C.ink : C.faint);
  if (query) icon('X', 342, 94, 17);
}
function mobileHome(logged = false) {
  mobileShell('', logged);
  text('AI 智能', 16, 163, 16, C.ink, 650);
  text('32', 89, 162, 12, C.faint);
  text('查看全部', 297, 162, 12, C.link); icon('ArrowRight', 358, 148, 16, C.link);
  line(16, 181, 374, 181);
  sites.slice(0, 4).forEach((site, i) => card(site, 16, 198 + i * 160, 358));
}
function mobileList(search = false) {
  mobileShell(search ? 'git' : '');
  text(search ? '搜索结果' : 'AI 智能', 16, 165, 20, C.ink, 650);
  text(search ? '2 个站点' : '32 个站点', search ? 110 : 103, 164, 12, C.muted);
  if (search) {
    text('名称包含“git”', 16, 200, 13, C.muted);
    text('清除搜索', 318, 200, 13, C.link);
  } else {
    text('全部站点', 16, 200, 13, C.link);
    text('全部标签', 294, 200, 13, C.muted); icon('ChevronDown', 359, 186, 15);
  }
  line(16, 219, 374, 219);
  (search ? sites.slice(8, 10) : sites.slice(0, 3)).forEach((site, i) => card(site, 16, 236 + i * 160, 358));
  if (!search) {
    icon('ChevronLeft', 79, 749, 18, C.faint);
    text('1 / 11', 195, 764, 13, C.muted, 400, 'text-anchor="middle"');
    icon('ChevronRight', 293, 749, 18);
  }
}
function mobileDrawer() {
  mobileHome();
  rect(0, 0, 390, 844, '#1F2027', 'none', 0, 'opacity="0.30"');
  rect(0, 0, 310, 844, '#FFFFFF');
  text('Pinjie Nav', 20, 42, 22, C.orange, 700, 'font-family="Georgia"');
  icon('X', 269, 22, 21);
  line(0, 64, 310, 64);
  cats.forEach(([label, symbol], i) => {
    const y = 80 + i * 47;
    if (!i) { rect(12, y, 286, 44, C.selected, 'none', 6); rect(12, y + 11, 3, 22, C.orange, 'none', 1); }
    icon(symbol, 26, y + 13, 18, i ? C.muted : C.link);
    text(label, 58, y + 29, 14, i ? C.muted : C.link, i ? 400 : 650);
  });
  line(20, 564, 290, 564);
  text('标签', 24, 596, 12, C.faint);
  ['AI', '开发', '工具', '文档', '设计', '开源', '学习', '效率'].forEach((label, i) => {
    const x = 24 + (i % 4) * 70, y = 613 + Math.floor(i / 4) * 46;
    icon('Tag', x, y, 14); text(label, x + 21, y + 12, 12, C.muted);
  });
  text('© 2026 Pinjie Nav', 155, 812, 12, C.muted, 400, 'text-anchor="middle"');
}
function mobileAccount(label, username, password, note, y) {
  text(label, 28, y, 14, C.ink, 650);
  [['用户名', username], ['密码', password], ['备注', note]].forEach(([field, value], i) => {
    const yy = y + 27 + i * 48;
    text(field, 28, yy, 11, C.muted);
    text(value, 28, yy + 21, 13, C.ink, 400, field === '密码' ? 'font-family="Consolas"' : '');
    icon('Copy', 338, yy + 4, 17);
  });
}
function mobileDetail(logged) {
  mobileHome(logged);
  rect(0, 0, 390, 844, '#1F2027', 'none', 0, 'opacity="0.30"');
  const y = logged ? 44 : 270, h = logged ? 756 : 304;
  rect(12, y, 366, h, '#FFFFFF', C.line, 8);
  icon('X', 342, y + 16, 20);
  logo(sites[0], 28, y + 48, 56);
  text('ChatGPT', 100, y + 68, 20, C.ink, 650);
  text(truncate('https://chatgpt.com/?source=design-preview', 227, 12), 100, y + 94, 12, C.muted);
  icon('ExternalLink', 342, y + 81, 16, C.link);
  wrapped('用于日常问答、资料整理、写作与代码协作的 AI 助手。支持持续对话与上下文理解，帮助提炼信息并完成日常工作。', 28, y + 136, 334, 14, C.muted, 4);
  icon('Folder', 28, y + 206, 16, C.link); text('AI 智能', 52, y + 219, 13, C.link);
  let tagX = 28;
  ['AI', '效率', '写作', '开发'].forEach(label => {
    icon('Tag', tagX, y + 250, 16, C.link); text(label, tagX + 24, y + 263, 13, C.link);
    tagX += 24 + width(label, 13) + 20;
  });
  if (logged) {
    line(28, y + 290, 362, y + 290);
    text('帐号资料', 28, y + 318, 15, C.ink, 650);
    text('2 个帐号', 312, y + 318, 12, C.faint);
    mobileAccount('日常使用', 'demo.reader@example.com', 'Demo-Only-2026!', '日常问答与资料整理。', y + 350);
    line(28, y + 511, 362, y + 511);
    mobileAccount('工作资料', 'demo.work@example.com', 'Sample-Only-0824!', '项目资料与工作文档。', y + 540);
  }
}
function svg(w = 1920, h = 1080) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>text { font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif; letter-spacing:0; }</style>${nodes.join('')}</svg>`;
}
for (const [name, draw] of [['01-home', home], ['02-list', listing], ['03-detail-admin', () => detail(true)], ['04-detail-guest', () => detail(false)]]) {
  if (process.argv.includes('--mobile-only')) continue;
  if (process.argv.includes('--details-only') && !name.includes('detail')) continue;
  nodes = [];
  draw();
  const file = path.join(output, `${name}.png`);
  await sharp(Buffer.from(svg())).png().toFile(file);
  const meta = await sharp(file).metadata();
  const stats = await sharp(file).stats();
  if (meta.width !== 1920 || meta.height !== 1080 || stats.channels[0].stdev < 8) throw new Error(`Invalid render: ${name}`);
  console.log(`${name}.png: ${meta.width}x${meta.height}, pixel standard deviation ${stats.channels[0].stdev.toFixed(1)}`);
}
const mobileViews = [
  ['05-mobile-home', '首页', mobileHome],
  ['06-mobile-list', '分类列表', mobileList],
  ['07-mobile-search', '名称搜索', () => mobileList(true)],
  ['08-mobile-drawer', '分类与标签抽屉', mobileDrawer],
  ['09-mobile-detail-admin', '管理员详情', () => mobileDetail(true)],
  ['10-mobile-detail-guest', '未登录详情', () => mobileDetail(false)],
];
if (!process.argv.includes('--details-only')) {
  for (const [name, , draw] of mobileViews) {
    nodes = []; draw();
    const file = path.join(output, `${name}.png`);
    await sharp(Buffer.from(svg(390, 844))).png().toFile(file);
    const meta = await sharp(file).metadata(), stats = await sharp(file).stats();
    if (meta.width !== 390 || meta.height !== 844 || stats.channels[0].stdev < 8) throw new Error(`Invalid render: ${name}`);
    console.log(`${name}.png: ${meta.width}x${meta.height}, pixel standard deviation ${stats.channels[0].stdev.toFixed(1)}`);
  }
  nodes = [];
  rect(0, 0, 1266, 1872, '#F0F1F3');
  text('Pinjie Nav · 手机端设计稿', 24, 42, 24, C.ink, 650);
  const panels = [];
  mobileViews.forEach(([name, label], i) => {
    const left = 24 + (i % 3) * 414, top = 100 + Math.floor(i / 3) * 900;
    text(label, left, top - 14, 15, C.muted, 650);
    panels.push({ input: path.join(output, `${name}.png`), left, top });
  });
  await sharp(Buffer.from(svg(1266, 1872))).composite(panels).png().toFile(path.join(output, '11-mobile-overview.png'));
}
