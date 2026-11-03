// The contact book (聯絡簿) page at the end. Drawn in the browser, so the player's
// name only ever exists on this device unless they choose to share the image.

const PAPER = '#f3eedf';
const INK = '#2a2a2a';
const MUTED = '#77736a';
const RULE = '#cdd8e2';
const RED = '#b8322a';
const SANS = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const KAI = '"BiauKai", "DFKai-SB", "Kaiti TC", "STKaiti", "KaiTi", serif';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fit(c, text, maxWidth) {
  if (c.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && c.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function wrap(c, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (c.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = '';
    }
    line += ch;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function heading(c, zh, en, y) {
  c.fillStyle = INK;
  c.font = `bold 32px ${SANS}`;
  c.fillText(zh, 60, y);
  const w = c.measureText(zh).width;
  c.fillStyle = MUTED;
  c.font = `24px ${SANS}`;
  c.fillText(en, 60 + w + 16, y);
}

function ruledLine(c, y) {
  c.strokeStyle = RULE;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(60, y + 14);
  c.lineTo(1020, y + 14);
  c.stroke();
}

export async function drawContactBook(canvas, book, hideName) {
  const c = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  c.fillStyle = PAPER;
  c.fillRect(0, 0, W, H);

  c.fillStyle = INK;
  c.font = `bold 60px ${SANS}`;
  c.fillText('聯絡簿', 60, 110);
  c.fillStyle = MUTED;
  c.font = `26px ${SANS}`;
  c.fillText('Contact book · Last One Out', 60, 150);
  c.textAlign = 'right';
  c.fillText(book.date, W - 60, 110);
  c.textAlign = 'left';

  heading(c, '值日生', 'On duty', 230);
  c.fillStyle = INK;
  c.font = `48px ${KAI}`;
  c.fillText(hideName ? '＿＿＿' : fit(c, book.name, 600), 330, 232);
  ruledLine(c, 232);

  const [first, last] = await Promise.all([loadImage(book.first), loadImage(book.last)]);
  [
    [first, 60, '那時 Then'],
    [last, 570, '現在 Now'],
  ].forEach(([img, x, caption]) => {
    c.fillStyle = '#ddd6c4';
    c.fillRect(x, 280, 450, 300);
    if (img) c.drawImage(img, x, 280, 450, 300);
    c.fillStyle = MUTED;
    c.font = `24px ${SANS}`;
    c.fillText(caption, x, 620);
  });

  heading(c, '你記得的', 'What you remembered', 690);
  c.fillStyle = INK;
  c.font = `34px ${KAI}`;
  (book.memories.length ? book.memories : ['—']).slice(0, 3).forEach((m, i) => {
    const y = 745 + i * 52;
    c.fillText(fit(c, m, 960), 60, y);
    ruledLine(c, y);
  });

  heading(c, '它變成的', 'What it became', 930);
  c.fillStyle = INK;
  c.font = `34px ${KAI}`;
  book.changes.slice(0, 4).forEach((title, i) => {
    const y = 985 + i * 52;
    c.fillText(fit(c, title, 960), 60, y);
    ruledLine(c, y);
  });

  heading(c, '老師評語', "Teacher's note", 1210);
  c.fillStyle = RED;
  c.font = `34px ${KAI}`;
  wrap(c, book.comment, 820, 2).forEach((line, i) => c.fillText(line, 60, 1262 + i * 46));

  // The teacher's red "seen" stamp.
  c.save();
  c.translate(W - 130, H - 130);
  c.rotate(-0.18);
  c.strokeStyle = RED;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(0, 0, 58, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = RED;
  c.font = `bold 60px ${KAI}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('閱', 0, 4);
  c.restore();
}
