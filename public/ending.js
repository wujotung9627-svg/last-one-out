// The night ends on a page of a Taiwanese contact book (聯絡簿), drawn in the browser:
// printed green grid, vertical handwriting read right to left, the teacher's red ink.
// The player's name only exists on this device unless they choose to share the image.

const W = 1600;
const H = 1200;
const PAGE = { left: 40, right: 1560, top: 52, bottom: 1040 };
const GRID = '#4f7f74'; // printed form ink
const PENCIL = '#2b3440';
const RED = '#b8322a';
const MUTED = '#8a8a80';
const SANS = '"Noto Serif TC", "PMingLiU", serif'; // the form's printed labels
const KAI = '"LXGW WenKai TC", "BiauKai", "Kaiti TC", serif'; // handwriting
const MONO = '"Courier Prime", "Courier New", monospace';
const DIGITS = '〇一二三四五六七八九';
const WEEKDAYS = '日一二三四五六';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// 26 -> 二十六, 11 -> 十一, 4 -> 四
function zhNumber(n) {
  if (n < 10) return DIGITS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens === 1 ? '' : DIGITS[tens]}十${ones ? DIGITS[ones] : ''}`;
}

// Taiwan's ROC calendar: 2026 is 民國一一五年.
function rocDate(date) {
  const year = [...String(date.getFullYear() - 1911)].map((d) => DIGITS[Number(d)]).join('');
  return [`${year}年`, `${zhNumber(date.getMonth() + 1)}月`, `${zhNumber(date.getDate())}日`, `星期${WEEKDAYS[date.getDay()]}`];
}

// A little seeded randomness so the page looks the same every time it is drawn.
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function paper(c, rand) {
  // Torn top edge.
  c.beginPath();
  c.moveTo(PAGE.left, PAGE.top + 12);
  for (let x = PAGE.left; x <= PAGE.right; x += 18) c.lineTo(x, PAGE.top + rand() * 16);
  c.lineTo(PAGE.right, PAGE.bottom);
  c.lineTo(PAGE.left, PAGE.bottom);
  c.closePath();
  const fill = c.createLinearGradient(0, PAGE.top, 0, PAGE.bottom);
  fill.addColorStop(0, '#ece3cb');
  fill.addColorStop(1, '#ddd1b2');
  c.fillStyle = fill;
  c.fill();
  c.save();
  c.clip();
  // Age stains and speckles.
  for (let i = 0; i < 7; i++) {
    const x = PAGE.left + rand() * (PAGE.right - PAGE.left);
    const y = PAGE.top + rand() * (PAGE.bottom - PAGE.top);
    const stain = c.createRadialGradient(x, y, 0, x, y, 80 + rand() * 160);
    stain.addColorStop(0, 'rgba(150, 115, 60, 0.12)');
    stain.addColorStop(1, 'rgba(150, 115, 60, 0)');
    c.fillStyle = stain;
    c.fillRect(PAGE.left, PAGE.top, PAGE.right - PAGE.left, PAGE.bottom - PAGE.top);
  }
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(90, 70, 40, ${0.04 + rand() * 0.08})`;
    c.fillRect(PAGE.left + rand() * (PAGE.right - PAGE.left), PAGE.top + rand() * (PAGE.bottom - PAGE.top), 1.5, 1.5);
  }
  c.restore();
}

function box(c, x, y, w, h, width = 2) {
  c.strokeStyle = GRID;
  c.lineWidth = width;
  c.strokeRect(x, y, w, h);
}

function printed(c, text, x, y, size = 22, align = 'center') {
  c.fillStyle = GRID;
  c.font = `bold ${size}px ${SANS}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
}

// Writes text top to bottom, columns right to left, one character per cell.
// English is written across, the way a student writes English on Chinese grid paper.
function horizontal(c, text, { left, top, width, lineHeight, color, size, maxLines }) {
  c.fillStyle = color;
  c.font = `${size}px ${KAI}`;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => c.fillText(l, left, top + lineHeight * (i + 1)));
}

function vertical(c, text, { right, top, cell, rows, cols, color, size, rand, marks = false }) {
  const chars = [...text.replace(/\s+/g, '')];
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const placed = [];
  for (let i = 0; i < chars.length && i < rows * cols; i++) {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = right - cell * col - cell / 2 + (rand() - 0.5) * 3;
    const y = top + cell * row + cell / 2 + (rand() - 0.5) * 3;
    const ch = chars[i];
    const punct = '，。、！？：；'.includes(ch);
    c.fillStyle = color;
    c.font = `${punct ? size * 0.8 : size}px ${KAI}`;
    c.fillText(ch, punct ? x + cell * 0.22 : x, punct ? y - cell * 0.22 : y);
    placed.push({ x, y, punct });
  }
  if (marks) {
    // The teacher's red ticks and one circled character.
    c.strokeStyle = RED;
    c.lineWidth = 3;
    const words = placed.filter((p) => !p.punct);
    for (let k = 0; k < 3 && words.length; k++) {
      const p = words[Math.floor(rand() * words.length)];
      c.beginPath();
      c.moveTo(p.x + cell * 0.35, p.y - cell * 0.1);
      c.lineTo(p.x + cell * 0.48, p.y + cell * 0.12);
      c.lineTo(p.x + cell * 0.72, p.y - cell * 0.35);
      c.stroke();
    }
    if (words.length) {
      const p = words[Math.floor(rand() * words.length)];
      c.beginPath();
      c.ellipse(p.x, p.y, cell * 0.46, cell * 0.42, 0.2, 0, Math.PI * 2);
      c.stroke();
    }
  }
}

function tapedPhoto(c, img, x, y, w, h, angle, caption) {
  c.save();
  c.translate(x + w / 2, y + h / 2);
  c.rotate(angle);
  c.shadowColor = 'rgba(0, 0, 0, 0.35)';
  c.shadowBlur = 12;
  c.shadowOffsetY = 4;
  c.fillStyle = '#f4f1e8';
  c.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 46);
  c.shadowColor = 'transparent';
  if (img) c.drawImage(img, -w / 2, -h / 2, w, h);
  else {
    c.fillStyle = '#666';
    c.fillRect(-w / 2, -h / 2, w, h);
  }
  c.fillStyle = PENCIL;
  c.font = `26px ${KAI}`;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(caption, -w / 2, h / 2 + 18);
  c.fillStyle = 'rgba(235, 225, 190, 0.65)'; // tape
  c.fillRect(-w / 2 - 30, -h / 2 - 22, 90, 30);
  c.fillRect(w / 2 - 60, -h / 2 - 22, 90, 30);
  c.restore();
}

function stamp(c, x, y) {
  c.save();
  c.translate(x, y);
  c.rotate(-0.16);
  c.strokeStyle = RED;
  c.lineWidth = 5;
  c.beginPath();
  c.arc(0, 0, 44, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = RED;
  c.font = `bold 50px ${KAI}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('閱', 0, 3);
  c.restore();
}

function englishStrip(c, book, hideName) {
  c.fillStyle = '#0b0c0b';
  c.fillRect(0, PAGE.bottom + 20, W, H - PAGE.bottom - 20);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#b9b5a8';
  c.font = `700 22px ${MONO}`;
  c.fillText('Contact book · Last One Out', PAGE.left, PAGE.bottom + 62);
  c.font = `20px ${MONO}`;
  c.fillStyle = '#8f8c82';
  const lines = [
    `On duty: ${hideName ? '—' : book.name}.  What you remembered: ${book.memories.join(' / ') || '—'}`,
    `What it became: ${(book.changes_en ?? book.changes).join(' · ')}`,
    `Teacher's note: ${book.comment_en ?? book.comment}`,
  ];
  lines.forEach((line, i) => {
    let shown = line;
    while (c.measureText(shown).width > W - 2 * PAGE.left && shown.length > 4) shown = `${shown.slice(0, -2)}…`;
    c.fillText(shown, PAGE.left, PAGE.bottom + 96 + i * 30);
  });
}

export async function drawContactBook(canvas, book, hideName) {
  // Canvas text needs the web fonts loaded first, or it falls back silently.
  await Promise.all(
    [`36px ${KAI}`, `bold 22px ${SANS}`, `20px ${MONO}`].map((font) => document.fonts?.load(font, '值日生 On duty').catch(() => null)),
  );
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  const rand = seeded([...(book.comment ?? 'x')].reduce((a, ch) => a + ch.charCodeAt(0), 7));
  c.fillStyle = '#050605';
  c.fillRect(0, 0, W, H);
  paper(c, rand);

  const top = 150;
  const head = 50;
  const bottom = 1010;
  const split = 800; // where the signature boxes begin

  // Name, top left.
  printed(c, '姓名', 70, 112, 22, 'left');
  c.fillStyle = PENCIL;
  c.font = `36px ${KAI}`;
  c.textAlign = 'left';
  c.fillText(hideName ? '＿＿＿' : book.name, 130, 114);
  c.strokeStyle = GRID;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(128, 134);
  c.lineTo(420, 134);
  c.stroke();

  // Date column (far right).
  box(c, 1440, top, 100, bottom - top);
  const [year, month, day, weekday] = rocDate(new Date());
  vertical(c, `${year}${month}${day}`, { right: 1540, top: top + 20, cell: 50, rows: 12, cols: 1, color: PENCIL, size: 38, rand });
  vertical(c, weekday, { right: 1540, top: top + 20 + 12 * 50 + 10, cell: 50, rows: 3, cols: 1, color: PENCIL, size: 38, rand });

  // Today's work + tomorrow's preview: the duty list.
  box(c, 1190, top, 250, head);
  printed(c, '今天功課＋明天預習', 1315, top + head / 2, 21);
  box(c, 1190, top + head, 250, 450);
  vertical(c, '值日生擦黑板拖地關燈鎖門', { right: 1430, top: top + head + 20, cell: 46, rows: 6, cols: 4, color: PENCIL, size: 34, rand });
  box(c, 1190, top + head + 450, 250, head);
  printed(c, '明天應帶物品', 1315, top + head * 1.5 + 450, 21);
  box(c, 1190, top + head * 2 + 450, 250, bottom - (top + head * 2 + 450));
  vertical(c, '紅色水桶', { right: 1340, top: top + head * 2 + 470, cell: 48, rows: 4, cols: 1, color: PENCIL, size: 36, rand });

  // Diary on manuscript grid: the memories and tonight.
  box(c, 640, top, 550, head);
  printed(c, '生活札記', 915, top + head / 2);
  const cell = 50;
  const cols = 11;
  const rows = 16;
  c.strokeStyle = 'rgba(79, 127, 116, 0.45)';
  c.lineWidth = 1;
  for (let i = 0; i <= cols; i++) {
    c.beginPath();
    c.moveTo(640 + i * cell, top + head);
    c.lineTo(640 + i * cell, top + head + rows * cell);
    c.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    c.beginPath();
    c.moveTo(640, top + head + j * cell);
    c.lineTo(640 + cols * cell, top + head + j * cell);
    c.stroke();
  }
  box(c, 640, top + head, 550, bottom - top - head);
  // Chinese is written down in columns; English across. The page follows the player's language.
  const english = book.lang === 'en';
  if (english) {
    const memories = book.memories_en?.length ? book.memories_en : book.memories;
    const diary = ['Today I was on duty.', ...memories.map((m) => `${m.replace(/[.。!！]$/, '')}.`), `${(book.changes_en ?? book.changes).join('. ')}.`].join(' ');
    horizontal(c, diary, { left: 652, top: top + head + 6, width: 524, lineHeight: cell, color: PENCIL, size: 30, maxLines: rows });
  } else {
    const cjk = (text) => /[\u3400-\u9fff]/.test(text) && !/[A-Za-z]{2,}/.test(text);
    const changes = book.changes.filter(cjk);
    const diary = [
      '今天我是值日生。',
      ...book.memories.filter(cjk).map((m) => `${m.replace(/[。.!！]$/, '')}。`),
      changes.length ? `${changes.join('，')}。` : '',
    ].join('');
    vertical(c, diary, { right: 1190, top: top + head, cell, rows, cols, color: PENCIL, size: 36, rand, marks: true });
  }

  // The teacher's reminder, in red.
  box(c, 450, top, 190, head);
  printed(c, '師長提醒', 545, top + head / 2);
  box(c, 450, top + head, 190, split - top - head);
  if (english) {
    horizontal(c, book.comment_en ?? book.comment ?? '', { left: 462, top: top + head + 4, width: 166, lineHeight: 34, color: RED, size: 25, maxLines: 17 });
  } else {
    vertical(c, book.comment ?? '', { right: 630, top: top + head + 14, cell: 42, rows: 13, cols: 4, color: RED, size: 32, rand });
  }
  box(c, 450, split, 190, head);
  printed(c, '老師核閱', 545, split + head / 2);
  box(c, 450, split + head, 190, bottom - split - head);
  stamp(c, 545, split + head + (bottom - split - head) / 2);

  // Exam results, left blank; the two photos are taped over them.
  box(c, 60, top, 390, head);
  printed(c, '考試成績', 255, top + head / 2);
  const subjects = ['國語', '數學', '社會', '自然', '英語', '健康', '體育', '音樂', '美勞', '生活'];
  const rowH = (split - top - head) / (subjects.length + 1);
  box(c, 60, top + head, 390, split - top - head);
  printed(c, '學習領域', 155, top + head + rowH / 2, 18);
  printed(c, '得分', 355, top + head + rowH / 2, 18);
  subjects.forEach((subject, i) => {
    const y = top + head + rowH * (i + 1);
    c.strokeStyle = GRID;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(60, y);
    c.lineTo(450, y);
    c.stroke();
    printed(c, subject, 155, y + rowH / 2, 18);
  });
  c.beginPath();
  c.moveTo(260, top + head);
  c.lineTo(260, split);
  c.stroke();
  box(c, 60, split, 390, head);
  printed(c, '家長簽章', 255, split + head / 2);
  box(c, 60, split + head, 390, bottom - split - head); // nobody signed

  const [first, last] = await Promise.all([loadImage(book.first), loadImage(book.last)]);
  tapedPhoto(c, first, 92, 250, 300, 200, -0.05, '那時');
  tapedPhoto(c, last, 120, 520, 300, 200, 0.04, '現在');

  englishStrip(c, book, hideName);
}
