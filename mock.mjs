// Stand-ins used when there is no MODEL_API_KEY, so the whole walk can be built and
// tested offline. Mock photos are plain drawings with a label saying what would change.

export const MOCK_DEALS = [
  [
    { title: 'One light is off', whisper: 'Someone forgot to switch it back on.', edit: 'Turn off the third fluorescent tube.', sound: 'none' },
    { title: 'The bucket moved', whisper: 'You left it by the door. Didn’t you?', edit: 'Move the red bucket and mop right next to the classroom door.', sound: 'none' },
    { title: 'Room numbers skip', whisper: 'Four, five, seven.', edit: 'Make the classroom numbers skip one.', sound: 'echo' },
  ],
  [
    { title: 'The corridor is longer', whisper: 'It never took this long.', edit: 'Make the corridor twice as long.', sound: 'echo' },
    { title: 'Desks face the wall', whisper: 'Everyone turned around.', edit: 'Turn every desk to face the back wall.', sound: 'silence' },
    { title: 'Daylight outside', whisper: 'It is still night in here.', edit: 'Show bright daylight outside the windows.', sound: 'none' },
  ],
  [
    { title: 'Every chair pulled out', whisper: 'As if they all stood up at once.', edit: 'Pull every chair out from its desk.', sound: 'silence' },
    { title: 'The doors are taller', whisper: 'Or you are smaller.', edit: 'Make every door much taller.', sound: 'bell' },
    { title: 'Water on the floor', whisper: 'Nobody mopped tonight.', edit: 'Add a thin sheet of still water on the floor.', sound: 'echo' },
  ],
];

export const MOCK_COMMENT = {
  en: 'You stayed late again. Everything is still where you left it. Almost.',
  zh: '今天又留到很晚。東西都還在原來的位置，幾乎都在。',
};

// Hotspot boxes as fractions of the photo, matching the drawings below.
export const MOCK_BOXES = {
  corridor: { door: [{ x: 0.06, y: 0.28, w: 0.12, h: 0.5 }] },
  door: { door: [{ x: 0.33, y: 0.12, w: 0.34, h: 0.8 }] },
  classroom: {
    door: [{ x: 0.86, y: 0.3, w: 0.11, h: 0.55 }],
    chalkboard: [{ x: 0.22, y: 0.16, w: 0.56, h: 0.24 }],
  },
};

const W = 1536;
const H = 1024;
const box = (b) => ({ x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H });
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function corridor(p) {
  const d = box(MOCK_BOXES.corridor.door[0]);
  const lights = [0, 1, 2, 3, 4]
    .map((i) => {
      const s = 1 - i * 0.18;
      return `<rect x="${768 - 90 * s}" y="${120 + i * 55}" width="${180 * s}" height="${14 * s}" fill="${p.light}"/>`;
    })
    .join('');
  return `
    <polygon points="0,0 1536,0 900,420 636,420" fill="${p.ceiling}"/>
    <polygon points="0,1024 1536,1024 900,560 636,560" fill="${p.floor}"/>
    <polygon points="0,0 636,420 636,560 0,1024" fill="${p.wall}"/>
    <polygon points="1536,0 900,420 900,560 1536,1024" fill="${p.wall}"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${1536 - i * 110}" y1="${60 + i * 60}" x2="${1536 - i * 110}" y2="${960 - i * 70}" stroke="${p.line}" stroke-width="6"/>`).join('')}
    <rect x="636" y="420" width="264" height="140" fill="${p.far}"/>
    ${lights}
    <rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" fill="${p.door}" stroke="${p.line}" stroke-width="4"/>
    <rect x="${d.x + d.w * 0.6}" y="${d.y + 60}" width="${d.w * 0.25}" height="${d.h * 0.2}" fill="${p.far}"/>`;
}

function door(p) {
  const d = box(MOCK_BOXES.door.door[0]);
  return `
    <rect width="${W}" height="${H}" fill="${p.wall}"/>
    <rect y="900" width="${W}" height="124" fill="${p.floor}"/>
    <rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" fill="${p.door}" stroke="${p.line}" stroke-width="6"/>
    <rect x="${d.x + d.w * 0.55}" y="${d.y + 90}" width="${d.w * 0.3}" height="${d.h * 0.22}" fill="${p.far}"/>
    <rect x="${d.x + d.w * 0.25}" y="${d.y - 80}" width="${d.w * 0.5}" height="56" fill="${p.ceiling}" stroke="${p.line}" stroke-width="3"/>`;
}

function classroom(p) {
  const b = box(MOCK_BOXES.classroom.chalkboard[0]);
  const d = box(MOCK_BOXES.classroom.door[0]);
  const desks = [0, 1, 2]
    .flatMap((row) =>
      [0, 1, 2, 3].map((col) => {
        const s = 1 + row * 0.35;
        return `<rect x="${330 + col * 230 * s - row * 160}" y="${560 + row * 120}" width="${150 * s}" height="${60 * s}" fill="${p.desk}" stroke="${p.line}" stroke-width="3"/>`;
      }),
    )
    .join('');
  return `
    <rect width="${W}" height="${H}" fill="${p.wall}"/>
    <rect y="520" width="${W}" height="504" fill="${p.floor}"/>
    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#2f4a3a" stroke="${p.line}" stroke-width="8"/>
    <rect x="700" y="60" width="160" height="14" fill="${p.light}"/>
    <rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" fill="${p.door}" stroke="${p.line}" stroke-width="4"/>
    ${desks}`;
}

const DRAW = { corridor, door, classroom };

export function mockPhoto(sceneId, { walk, changes, daylight = false }) {
  const p = daylight
    ? { ceiling: '#e8e2cf', wall: '#c8d8c2', floor: '#bdb6a0', far: '#fff6d8', light: '#ffffff', line: '#7d7a6c', door: '#a0805c', desk: '#b08a5a' }
    : { ceiling: '#1c2420', wall: '#334a3e', floor: '#5a6055', far: '#050706', light: '#e9f5dc', line: '#1a201c', door: '#5b4632', desk: '#6e5235' };
  const bucketX = 560 + ((walk * 170) % 520);
  const labels = [
    `MOCK PHOTO · ${sceneId} · walk ${walk}${daylight ? ' · daylight' : ''}`,
    ...changes.map((c) => `+ ${c.title}`),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    ${DRAW[sceneId](p)}
    <ellipse cx="${bucketX - 150}" cy="960" rx="170" ry="26" fill="#ffffff" fill-opacity="0.12"/>
    <polygon points="${bucketX - 40},880 ${bucketX + 40},880 ${bucketX + 30},950 ${bucketX - 30},950" fill="#d0201c"/>
    <line x1="${bucketX + 10}" y1="890" x2="${bucketX + 60}" y2="700" stroke="#c9c2a8" stroke-width="8"/>
    <rect x="24" y="${H - 40 - labels.length * 34}" width="760" height="${labels.length * 34 + 24}" fill="#000" fill-opacity="0.55"/>
    ${labels.map((t, i) => `<text x="40" y="${H - 34 - (labels.length - 1 - i) * 34}" font-family="sans-serif" font-size="26" fill="#fff">${escape(t)}</text>`).join('')}
  </svg>`;
}
