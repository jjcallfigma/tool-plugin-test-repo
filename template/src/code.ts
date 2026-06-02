/**
 * Tool: Org Chart Builder
 * Does: Builds a clean org chart from names, titles, and reporting relationships.
 * Assumptions:
 *   - People text: one per line — Name | Title | Team | Location | Manager Name
 *   - Cards use absolute (non-auto-layout) placement inside a NONE-layout outer frame.
 *   - Connectors use setVectorNetworkAsync (required with documentAccess: dynamic-page).
 *   - layoutGrow / textAutoResize are NOT used (unreliable in non-auto-layout contexts).
 */

figma.showUI(__html__, { width: 240, height: 320, themeColors: true });

// ─── Types ────────────────────────────────────────────────────────────────────

type Person = {
  id: string;
  name: string;
  title: string;
  team: string;
  geography: string;
  level: number;
  reportsTo: string | null;
};

type State = {
  layout: 'top-down' | 'left-right' | 'radial';
  depth: number;
  cardStyle: 'full' | 'compact' | 'minimal';
  connectorStyle: 'right-angle' | 'curved' | 'straight';
  highlight: string;
  colorRule: 'team' | 'level' | 'geography';
  peopleText: string;
};

type UiToCodeMessage =
  | { type: 'generate'; state: State }
  | { type: 'regenerate'; state: State }
  | { type: 'resize'; height: number };

type CodeToUiMessage =
  | { type: 'loadState'; state: State }
  | { type: 'outputSelected'; selected: boolean };

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOL_ID = 'org-chart-builder';

const CARD_W = 148;
const CARD_H_FULL = 72;
const CARD_H_COMPACT = 48;
const CARD_H_MINIMAL = 32;
const H_GAP = 24;
const V_GAP = 52;
const CORNER = 8;

const PALETTE = ['#DBEAFE','#D1FAE5','#FEF3C7','#FCE7F3','#EDE9FE','#FEE2E2','#FFEDD5','#ECFDF5'];

const DEFAULT_PEOPLE_TEXT =
`Alex Rivera | Chief Executive Officer | Leadership | HQ |
Jordan Kim | VP Engineering | Engineering | HQ | Alex Rivera
Morgan Lee | VP Design | Design | HQ | Alex Rivera
Casey Chen | VP Marketing | Marketing | NYC | Alex Rivera
Riley Park | Senior Engineer | Engineering | HQ | Jordan Kim
Drew Singh | Staff Engineer | Engineering | London | Jordan Kim
Quinn Adams | Lead Designer | Design | HQ | Morgan Lee
Avery Brooks | Product Designer | Design | NYC | Morgan Lee
Taylor Gomez | Growth Manager | Marketing | NYC | Casey Chen
Sage Wilson | Brand Strategist | Marketing | London | Casey Chen`;

const defaultState: State = {
  layout: 'top-down',
  depth: 3,
  cardStyle: 'full',
  connectorStyle: 'right-angle',
  highlight: '',
  colorRule: 'team',
  peopleText: DEFAULT_PEOPLE_TEXT,
};

// ─── Tracking ─────────────────────────────────────────────────────────────────

let currentOutput: FrameNode | null = null;
let isRegenerating = false;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const hexToRgb = (hex: string): RGB => ({
  r: parseInt(hex.slice(1,3), 16) / 255,
  g: parseInt(hex.slice(3,5), 16) / 255,
  b: parseInt(hex.slice(5,7), 16) / 255,
});
const solid = (hex: string): SolidPaint => ({ type: 'SOLID', color: hexToRgb(hex) });

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
}

function getCardHeight(style: State['cardStyle']): number {
  return style === 'full' ? CARD_H_FULL : style === 'minimal' ? CARD_H_MINIMAL : CARD_H_COMPACT;
}

function cardBg(p: Person, rule: State['colorRule'], all: Person[]): string {
  if (rule === 'level') return PALETTE[Math.min(p.level, PALETTE.length - 1)];
  const keys = [...new Set(all.map(x => rule === 'geography' ? x.geography : x.team))].sort();
  const val = rule === 'geography' ? p.geography : p.team;
  return PALETTE[(keys.indexOf(val) + PALETTE.length) % PALETTE.length];
}

function getHighlightChain(name: string, people: Person[]): Set<string> {
  const chain = new Set<string>();
  if (!name.trim()) return chain;
  const byId = new Map(people.map(p => [p.id, p]));
  const target = people.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (!target) return chain;
  let cur: Person | undefined = target;
  while (cur) { chain.add(cur.id); cur = cur.reportsTo ? byId.get(cur.reportsTo) : undefined; }
  for (const p of people) if (p.reportsTo === target.id) chain.add(p.id);
  return chain;
}

function getSelectedToolFrame(): FrameNode | null {
  const sel = figma.currentPage.selection[0];
  if (sel?.type === 'FRAME' && sel.getPluginData('toolId') === TOOL_ID) return sel;
  return null;
}

function postOutputSelected(v: boolean) {
  figma.ui.postMessage({ type: 'outputSelected', selected: v } as CodeToUiMessage);
}

// ─── Parse people text ────────────────────────────────────────────────────────

function parsePeople(text: string): Person[] {
  const lines = (text || DEFAULT_PEOPLE_TEXT).split('\n').map(l => l.trim()).filter(Boolean);
  const raw = lines.map((line, i) => {
    const p = line.split('|').map(s => s.trim());
    return { id: `p${i}`, name: p[0] || `Person ${i}`, title: p[1] || '', team: p[2] || '', geo: p[3] || '', mgrName: p[4] || '' };
  });

  const people: Person[] = raw.map(r => ({
    id: r.id, name: r.name, title: r.title, team: r.team,
    geography: r.geo, level: 0, reportsTo: null,
  }));

  const nameMap = new Map(people.map(p => [p.name.trim().toLowerCase(), p.id]));
  for (let i = 0; i < people.length; i++) {
    const mgr = raw[i].mgrName.trim().toLowerCase();
    if (mgr) { const mid = nameMap.get(mgr); if (mid) people[i].reportsTo = mid; }
  }

  // BFS level assignment
  const byId = new Map(people.map(p => [p.id, p]));
  const queue = people.filter(p => !p.reportsTo).map(p => p.id);
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const parent = byId.get(id)!;
    for (const ch of people) {
      if (ch.reportsTo === id) { ch.level = parent.level + 1; queue.push(ch.id); }
    }
  }
  return people;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function layoutTopDown(
  id: string,
  byParent: Map<string, Person[]>,
  depth: number, cardH: number,
  ox: number, oy: number,
  out: Map<string, {x:number;y:number}>
): number {
  const children = (byParent.get(id) || []);
  if (!children.length) { out.set(id, {x: ox, y: oy}); return CARD_W; }
  let cx = ox, totalW = 0;
  for (const ch of children) {
    const w = layoutTopDown(ch.id, byParent, depth, cardH, cx, oy + cardH + V_GAP, out);
    cx += w + H_GAP; totalW += w + H_GAP;
  }
  totalW -= H_GAP;
  const fc = out.get(children[0].id)!;
  const lc = out.get(children[children.length-1].id)!;
  out.set(id, { x: (fc.x + lc.x) / 2, y: oy });
  return Math.max(totalW, CARD_W);
}

function layoutLeftRight(
  id: string,
  byParent: Map<string, Person[]>,
  depth: number, cardH: number,
  ox: number, oy: number,
  out: Map<string, {x:number;y:number}>
): number {
  const children = byParent.get(id) || [];
  if (!children.length) { out.set(id, {x: ox, y: oy}); return cardH; }
  let cy = oy, totalH = 0;
  const childX = ox + CARD_W + V_GAP;
  for (const ch of children) {
    const h = layoutLeftRight(ch.id, byParent, depth, cardH, childX, cy, out);
    cy += h + H_GAP; totalH += h + H_GAP;
  }
  totalH -= H_GAP;
  const fc = out.get(children[0].id)!;
  const lc = out.get(children[children.length-1].id)!;
  out.set(id, { x: ox, y: (fc.y + lc.y) / 2 });
  return Math.max(totalH, cardH);
}

function layoutRadial(people: Person[], depth: number, out: Map<string, {x:number;y:number}>): void {
  const visible = people.filter(p => p.level < depth);
  const root = visible.find(p => p.level === 0);
  if (!root) return;
  out.set(root.id, {x:0,y:0});
  const maxLvl = Math.max(...visible.map(p => p.level));
  for (let lvl = 1; lvl <= maxLvl; lvl++) {
    const peers = visible.filter(p => p.level === lvl);
    const r = lvl * (CARD_W + V_GAP + 20);
    peers.forEach((p, i) => {
      const a = (2 * Math.PI * i / peers.length) - Math.PI / 2;
      out.set(p.id, { x: Math.round(r * Math.cos(a)), y: Math.round(r * Math.sin(a)) });
    });
  }
}

// ─── Card builder (absolute layout only — no auto-layout children) ────────────

async function buildCard(
  person: Person, style: State['cardStyle'],
  colorRule: State['colorRule'], allPeople: Person[],
  highlighted: boolean
): Promise<FrameNode> {
  const cardH = getCardHeight(style);
  const bg   = highlighted ? '#FEF3C7' : cardBg(person, colorRule, allPeople);
  const border = highlighted ? '#F59E0B' : '#E2E8F0';

  // Load all fonts upfront
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const card = figma.createFrame();
  card.name = person.name;
  card.resize(CARD_W, cardH);
  card.cornerRadius = CORNER;
  card.fills = [solid(bg)];
  card.strokes = [{ type: 'SOLID', color: hexToRgb(border) }];
  card.strokeWeight = highlighted ? 2 : 1;
  card.strokeAlign = 'INSIDE';
  card.layoutMode = 'NONE'; // absolute placement — no auto-layout
  card.clipsContent = true;

  if (style === 'minimal') {
    const PAD = 8;
    // Avatar circle
    const av = figma.createFrame();
    av.resize(CARD_H_MINIMAL - 2*PAD, CARD_H_MINIMAL - 2*PAD);
    av.cornerRadius = av.width / 2;
    av.fills = [solid('#94A3B8')];
    av.x = PAD; av.y = PAD;
    card.appendChild(av);

    // Initials text
    const t = figma.createText();
    t.fontName = { family: 'Inter', style: 'Bold' };
    t.fontSize = 9;
    t.fills = [solid('#FFFFFF')];
    t.characters = initials(person.name);
    card.appendChild(t);
    t.x = av.x + (av.width - t.width) / 2;
    t.y = av.y + (av.height - t.height) / 2;

    return card;
  }

  const PAD = 10;
  const avSize = style === 'full' ? 36 : 28;
  const textX = PAD + avSize + 8;
  const textW = CARD_W - textX - PAD;

  // Avatar
  const av = figma.createFrame();
  av.resize(avSize, avSize);
  av.cornerRadius = avSize / 2;
  av.fills = [solid(highlighted ? '#FDE68A' : '#CBD5E1')];
  av.x = PAD;
  av.y = (cardH - avSize) / 2;
  card.appendChild(av);

  // Initials inside avatar
  const initT = figma.createText();
  initT.fontName = { family: 'Inter', style: 'Bold' };
  initT.fontSize = style === 'full' ? 13 : 11;
  initT.fills = [solid(highlighted ? '#92400E' : '#475569')];
  initT.characters = initials(person.name);
  card.appendChild(initT);
  initT.x = av.x + (av.width - initT.width) / 2;
  initT.y = av.y + (av.height - initT.height) / 2;

  // Name
  const nameSize = style === 'full' ? 11 : 10;
  const titleSize = style === 'full' ? 9 : 8;
  const lineH = style === 'full' ? 14 : 13;

  const linesCount = style === 'full' ? 3 : 2;
  const totalTextH = linesCount * lineH;
  let ty = (cardH - totalTextH) / 2;

  const nameT = figma.createText();
  nameT.fontName = { family: 'Inter', style: 'Semi Bold' };
  nameT.fontSize = nameSize;
  nameT.fills = [solid('#0F172A')];
  nameT.characters = person.name || ' ';
  nameT.resize(textW, lineH);
  nameT.textTruncation = 'ENDING';
  nameT.x = textX; nameT.y = ty;
  card.appendChild(nameT);
  ty += lineH;

  const titleT = figma.createText();
  titleT.fontName = { family: 'Inter', style: 'Regular' };
  titleT.fontSize = titleSize;
  titleT.fills = [solid('#64748B')];
  titleT.characters = person.title || ' ';
  titleT.resize(textW, lineH);
  titleT.textTruncation = 'ENDING';
  titleT.x = textX; titleT.y = ty;
  card.appendChild(titleT);
  ty += lineH;

  if (style === 'full') {
    const meta = [person.team, person.geography].filter(Boolean).join(' · ') || ' ';
    const metaT = figma.createText();
    metaT.fontName = { family: 'Inter', style: 'Regular' };
    metaT.fontSize = 8;
    metaT.fills = [solid('#94A3B8')];
    metaT.characters = meta;
    metaT.resize(textW, lineH);
    metaT.textTruncation = 'ENDING';
    metaT.x = textX; metaT.y = ty;
    card.appendChild(metaT);
  }

  return card;
}

// ─── Connector ────────────────────────────────────────────────────────────────

async function buildConnector(
  x1: number, y1: number, x2: number, y2: number,
  style: State['connectorStyle'], highlighted: boolean,
  container: FrameNode
): Promise<void> {
  const color = highlighted ? '#F59E0B' : '#CBD5E1';
  const weight = highlighted ? 2 : 1.5;
  const midY = (y1 + y2) / 2;
  const cp = Math.abs(y2 - y1) * 0.45;

  let network: VectorNetwork;
  if (style === 'right-angle') {
    network = {
      vertices: [
        { x: x1, y: y1, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 3, handleMirroring: 'NONE' },
        { x: x1, y: midY, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 3, handleMirroring: 'NONE' },
        { x: x2, y: midY, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 3, handleMirroring: 'NONE' },
        { x: x2, y: y2, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 3, handleMirroring: 'NONE' },
      ],
      segments: [
        { start: 0, end: 1, tangentStart: {x:0,y:0}, tangentEnd: {x:0,y:0} },
        { start: 1, end: 2, tangentStart: {x:0,y:0}, tangentEnd: {x:0,y:0} },
        { start: 2, end: 3, tangentStart: {x:0,y:0}, tangentEnd: {x:0,y:0} },
      ],
      regions: [],
    };
  } else if (style === 'curved') {
    network = {
      vertices: [
        { x: x1, y: y1, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0, handleMirroring: 'NONE' },
        { x: x2, y: y2, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0, handleMirroring: 'NONE' },
      ],
      segments: [{ start: 0, end: 1, tangentStart: {x:0,y:cp}, tangentEnd: {x:0,y:-cp} }],
      regions: [],
    };
  } else {
    network = {
      vertices: [
        { x: x1, y: y1, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0, handleMirroring: 'NONE' },
        { x: x2, y: y2, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0, handleMirroring: 'NONE' },
      ],
      segments: [{ start: 0, end: 1, tangentStart: {x:0,y:0}, tangentEnd: {x:0,y:0} }],
      regions: [],
    };
  }

  const vec = figma.createVector();
  figma.currentPage.appendChild(vec);           // required before setVectorNetworkAsync
  await vec.setVectorNetworkAsync(network);
  vec.strokes = [{ type: 'SOLID', color: hexToRgb(color) }];
  vec.strokeWeight = weight;
  vec.fills = [];
  container.appendChild(vec);                   // reparent into output frame
}

// ─── Regenerate ───────────────────────────────────────────────────────────────

async function regenerate(state: State, mode: 'create' | 'update'): Promise<void> {
  if (isRegenerating) return;
  isRegenerating = true;
  try {
    let posX = 0, posY = 0;
    if (mode === 'update') {
      const ex = getSelectedToolFrame();
      if (!ex) return;
      posX = ex.x; posY = ex.y;
      ex.remove();
    }

    const people = parsePeople(state.peopleText);
    if (!people.length) { figma.notify('No people found in the list.'); return; }

    const depth = Math.max(1, state.depth || 3);
    const cardH = getCardHeight(state.cardStyle);

    // Build parent → children map (only for nodes within depth)
    const byParent = new Map<string, Person[]>();
    const visible = people.filter(p => p.level < depth);
    for (const p of visible) {
      const k = p.reportsTo ?? '__ROOT__';
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(p);
    }

    const roots = visible.filter(p => !p.reportsTo);
    if (!roots.length) { figma.notify('Could not find a root person (no Manager Name blank).'); return; }
    const root = roots[0];

    // Compute positions
    const positions = new Map<string, {x:number;y:number}>();
    if (state.layout === 'top-down') {
      layoutTopDown(root.id, byParent, depth, cardH, 0, 0, positions);
    } else if (state.layout === 'left-right') {
      layoutLeftRight(root.id, byParent, depth, cardH, 0, 0, positions);
    } else {
      layoutRadial(visible, depth, positions);
    }

    // Bounding box → shift to 0,0 + padding
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [,pos] of positions) {
      minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + CARD_W); maxY = Math.max(maxY, pos.y + cardH);
    }
    const PAD = 40;
    const W = maxX - minX + PAD * 2;
    const H = maxY - minY + PAD * 2;

    const outer = figma.createFrame();
    outer.name = 'Org Chart';
    outer.fills = [solid('#F8FAFC')];
    outer.layoutMode = 'NONE';
    outer.resize(W, H);
    outer.clipsContent = false;

    const highlightChain = getHighlightChain(state.highlight || '', people);

    // Draw connectors first (behind cards)
    for (const person of visible) {
      if (!person.reportsTo) continue;
      const pp = positions.get(person.reportsTo);
      const cp = positions.get(person.id);
      if (!pp || !cp) continue;
      const hl = highlightChain.has(person.id) && highlightChain.has(person.reportsTo);
      let x1: number, y1: number, x2: number, y2: number;
      if (state.layout === 'left-right') {
        x1 = pp.x - minX + PAD + CARD_W;  y1 = pp.y - minY + PAD + cardH / 2;
        x2 = cp.x - minX + PAD;           y2 = cp.y - minY + PAD + cardH / 2;
      } else {
        x1 = pp.x - minX + PAD + CARD_W / 2; y1 = pp.y - minY + PAD + cardH;
        x2 = cp.x - minX + PAD + CARD_W / 2; y2 = cp.y - minY + PAD;
      }
      await buildConnector(x1, y1, x2, y2, state.connectorStyle, hl, outer);
    }

    // Draw cards on top
    for (const person of visible) {
      const pos = positions.get(person.id);
      if (!pos) continue;
      const card = await buildCard(person, state.cardStyle, state.colorRule, people, highlightChain.has(person.id));
      card.x = pos.x - minX + PAD;
      card.y = pos.y - minY + PAD;
      outer.appendChild(card);
    }

    // +N more badges for collapsed levels
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    const collapsed = new Map<string, number>();
    for (const p of people) {
      if (p.level >= depth && p.reportsTo) collapsed.set(p.reportsTo, (collapsed.get(p.reportsTo) || 0) + 1);
    }
    for (const [pid, count] of collapsed) {
      const pos = positions.get(pid);
      if (!pos) continue;
      const badge = figma.createFrame();
      badge.resize(CARD_W, 22);
      badge.cornerRadius = 11;
      badge.fills = [solid('#E2E8F0')];
      badge.layoutMode = 'NONE';
      const bt = figma.createText();
      bt.fontName = { family: 'Inter', style: 'Regular' };
      bt.fontSize = 9;
      bt.fills = [solid('#64748B')];
      bt.characters = `+${count} more`;
      badge.appendChild(bt);
      bt.x = (CARD_W - bt.width) / 2;
      bt.y = (22 - bt.height) / 2;
      if (state.layout === 'left-right') {
        badge.x = pos.x - minX + PAD + CARD_W + V_GAP / 2;
        badge.y = pos.y - minY + PAD + (cardH - 22) / 2;
      } else {
        badge.x = pos.x - minX + PAD;
        badge.y = pos.y - minY + PAD + cardH + V_GAP / 2 - 11;
      }
      outer.appendChild(badge);
    }

    outer.setPluginData('toolState', JSON.stringify(state));
    outer.setPluginData('toolId', TOOL_ID);
    outer.setRelaunchData({ regenerate: 'Regenerate with current values', edit: 'Open this tool to edit' });

    if (mode === 'update') {
      outer.x = posX; outer.y = posY;
    } else {
      outer.x = figma.viewport.center.x - outer.width / 2;
      outer.y = figma.viewport.center.y - outer.height / 2;
      figma.viewport.scrollAndZoomIntoView([outer]);
    }

    currentOutput = outer;
    figma.currentPage.selection = [outer];
    postOutputSelected(true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    figma.notify(`Error: ${msg}`);
  } finally {
    isRegenerating = false;
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg: UiToCodeMessage) => {
  if (msg.type === 'resize') {
    figma.ui.resize(240, Math.max(120, Math.min(900, Math.round(msg.height))));
    return;
  }
  if (msg.type === 'generate') {
    await regenerate(msg.state, getSelectedToolFrame() ? 'update' : 'create');
  } else if (msg.type === 'regenerate') {
    await regenerate(msg.state, 'update');
  }
};

figma.on('selectionchange', () => {
  const tf = getSelectedToolFrame();
  postOutputSelected(!!tf);
  if (!tf) return;
  const raw = tf.getPluginData('toolState');
  if (raw) {
    figma.ui.postMessage({ type: 'loadState', state: JSON.parse(raw) as State } as CodeToUiMessage);
    currentOutput = tf;
  }
});

if (figma.command === 'regenerate') {
  const sel = getSelectedToolFrame();
  if (sel) {
    const raw = sel.getPluginData('toolState');
    if (raw) void regenerate(JSON.parse(raw) as State, 'update');
  }
}

void currentOutput;
void defaultState;
