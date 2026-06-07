/**
 * Tool: Artist Lineup Cards
 * Does: Generates brutalist 416×416 artist cards from public artist + image search.
 * Output strategy: single square frame with full-bleed image, overlay, and bottom-left text.
 * Regenerate behavior: Generate adds when none selected; control changes update selected card only.
 * Assumptions: Performance line uses uppercase stage label; MusicBrainz canonical name used when found.
 *
 * APIs (no keys):
 * - MusicBrainz: https://musicbrainz.org/ws/2/artist/?query=artist:{name}&fmt=json
 * - Wikimedia Commons: https://commons.wikimedia.org/w/api.php (image search)
 */

figma.showUI(__html__, { width: 240, height: 320, themeColors: true });

function setPageRelaunchForDiscovery(): void {
  figma.currentPage.setRelaunchData({
    edit: 'Open this tool',
  });
}
setPageRelaunchForDiscovery();

const TOOL_ID = 'artist-lineup-cards';
const CARD_SIZE = 416;
const PADDING = 20;
const OVERLAY_OPACITY = 0.57;

type ImageCandidate = {
  id: string;
  imageUrl: string;
  thumbUrl: string;
  title: string;
  sourceUrl: string;
};

type ImageTreatment = 'noir' | 'fog' | 'high-contrast' | 'soft-grain';
type CropBias = 'center' | 'top' | 'bottom';

type State = {
  artistName: string;
  stage: string;
  time: string;
  imageTreatment: ImageTreatment;
  cropBias: CropBias;
  grain: number;
  contrast: number;
  showSourceNote: boolean;
  selectedImageId: string | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  imageTitle: string | null;
  imageSourceUrl: string | null;
  imageCandidates: ImageCandidate[];
  canonicalArtistName: string | null;
};

type UiToCodeMessage =
  | { type: 'generate'; state: State }
  | { type: 'regenerate'; state: State }
  | { type: 'findImages'; artistName: string }
  | { type: 'resize'; height: number };

type CodeToUiMessage =
  | { type: 'loadState'; state: State }
  | { type: 'outputSelected'; selected: boolean }
  | { type: 'imageSearchStart' }
  | { type: 'imageSearchComplete'; candidates: ImageCandidate[]; error?: string };

const defaultState: State = {
  artistName: 'Tame Impala',
  stage: 'Main Stage',
  time: '10:00 PM',
  imageTreatment: 'noir',
  cropBias: 'center',
  grain: 35,
  contrast: 80,
  showSourceNote: false,
  selectedImageId: null,
  imageUrl: null,
  thumbUrl: null,
  imageTitle: null,
  imageSourceUrl: null,
  imageCandidates: [],
  canonicalArtistName: null,
};

const STAGE_LABELS: Record<string, string> = {
  'Main Stage': 'MAIN STAGE',
  'Redwood Stage': 'REDWOOD STAGE',
  'Creek Stage': 'CREEK STAGE',
  'The Grove': 'THE GROVE',
};

const TREATMENT_PARAMS: Record<
  ImageTreatment,
  { darken: number; lighten: number; contrastMul: number; grayOpacity: number }
> = {
  noir: { darken: 0.42, lighten: 0, contrastMul: 1.15, grayOpacity: 1 },
  fog: { darken: 0.18, lighten: 0.22, contrastMul: 0.65, grayOpacity: 0.75 },
  'high-contrast': { darken: 0.5, lighten: 0.04, contrastMul: 1.35, grayOpacity: 1 },
  'soft-grain': { darken: 0.28, lighten: 0.08, contrastMul: 0.85, grayOpacity: 0.88 },
};

let currentOutput: FrameNode | null = null;
let isRegenerating = false;

const solidFill = (hex: string, opacity = 1): SolidPaint => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { type: 'SOLID', color: { r, g, b }, opacity };
};

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, headers ? { headers } : undefined);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

function getSelectedToolFrame(): FrameNode | null {
  const sel = figma.currentPage.selection[0];
  if (sel?.type === 'FRAME' && sel.getPluginData('toolId') === TOOL_ID) {
    return sel;
  }
  return null;
}

function postOutputSelected(selected: boolean): void {
  figma.ui.postMessage({ type: 'outputSelected', selected } satisfies CodeToUiMessage);
}

function encodeQuery(value: string): string {
  return encodeURIComponent(value.trim());
}

async function searchMusicBrainz(artistName: string): Promise<string | null> {
  const url = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeQuery(artistName)}&fmt=json&limit=1`;
  const data = await fetchJson<{
    artists?: Array<{ name?: string }>;
  }>(url, { 'User-Agent': 'ArtistLineupCards/1.0 (figma-plugin-factory)' });
  return data.artists?.[0]?.name ?? null;
}

async function searchWikimediaImages(artistName: string): Promise<ImageCandidate[]> {
  const search = encodeQuery(`${artistName} musician`);
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${search}&gsrnamespace=6&gsrlimit=6&prop=imageinfo` +
    `&iiprop=url|thumburl|extmetadata&iiurlwidth=300&format=json&origin=*`;

  const data = await fetchJson<{
    query?: {
      pages?: Record<
        string,
        {
          pageid?: number;
          title?: string;
          imageinfo?: Array<{
            url?: string;
            thumburl?: string;
            descriptionurl?: string;
            extmetadata?: { ObjectName?: { value?: string } };
          }>;
        }
      >;
    };
  }>(url);

  const pages = data.query?.pages ?? {};
  const candidates: ImageCandidate[] = [];

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    const imageUrl = info?.url;
    if (!imageUrl) continue;

    const title =
      info.extmetadata?.ObjectName?.value?.replace(/<[^>]+>/g, '').trim() ||
      page.title?.replace('File:', '') ||
      'Image';

    candidates.push({
      id: String(page.pageid ?? imageUrl),
      imageUrl,
      thumbUrl: info.thumburl || imageUrl,
      title,
      sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? '')}`,
    });
  }

  return candidates.slice(0, 6);
}

function resolveImageFromState(state: State): {
  imageUrl: string | null;
  thumbUrl: string | null;
  title: string | null;
  sourceUrl: string | null;
} {
  if (state.selectedImageId) {
    const picked = state.imageCandidates.find((c) => c.id === state.selectedImageId);
    if (picked) {
      return {
        imageUrl: picked.imageUrl,
        thumbUrl: picked.thumbUrl,
        title: picked.title,
        sourceUrl: picked.sourceUrl,
      };
    }
  }

  if (state.imageUrl) {
    return {
      imageUrl: state.imageUrl,
      thumbUrl: state.thumbUrl,
      title: state.imageTitle,
      sourceUrl: state.imageSourceUrl,
    };
  }

  const first = state.imageCandidates[0];
  if (first) {
    return {
      imageUrl: first.imageUrl,
      thumbUrl: first.thumbUrl,
      title: first.title,
      sourceUrl: first.sourceUrl,
    };
  }

  return { imageUrl: null, thumbUrl: null, title: null, sourceUrl: null };
}

function getImageTransform(bias: CropBias): Transform {
  const ty = bias === 'top' ? 0.12 : bias === 'bottom' ? -0.12 : 0;
  return [
    [1, 0, 0],
    [0, 1, ty],
  ];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

async function loadCardFonts(): Promise<{ family: string; style: string }> {
  const candidates: Array<[string, string]> = [
    ['Arimo', 'Bold'],
    ['Inter', 'Bold'],
  ];

  for (const [family, style] of candidates) {
    try {
      await figma.loadFontAsync({ family, style });
      return { family, style };
    } catch {
      // try next
    }
  }

  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  return { family: 'Inter', style: 'Regular' };
}

function addFullRect(
  parent: FrameNode,
  name: string,
  fill: Paint | Paint[],
  opacity = 1,
  blendMode: BlendMode = 'NORMAL',
): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = name;
  rect.resize(CARD_SIZE, CARD_SIZE);
  rect.x = 0;
  rect.y = 0;
  rect.fills = Array.isArray(fill) ? fill : [fill];
  rect.opacity = opacity;
  rect.blendMode = blendMode;
  parent.appendChild(rect);
  return rect;
}

async function addImageLayer(
  parent: FrameNode,
  imageUrl: string,
  state: State,
): Promise<void> {
  try {
    const image = await figma.createImageAsync(imageUrl);
    const rect = figma.createRectangle();
    rect.name = 'image';
    rect.resize(CARD_SIZE, CARD_SIZE);
    rect.fills = [
      {
        type: 'IMAGE',
        scaleMode: 'FILL',
        imageHash: image.hash,
        imageTransform: getImageTransform(state.cropBias),
      },
    ];
    parent.appendChild(rect);
  } catch {
    await addPlaceholderLayers(parent, state);
  }
}

async function addPlaceholderLayers(parent: FrameNode, state: State): Promise<void> {
  addFullRect(parent, 'image', solidFill('#141414'));

  const initials = getInitials(state.canonicalArtistName || state.artistName);
  const font = await loadCardFonts();

  const shadowSpecs = [
    { x: 32, y: 48, w: 120, h: 180, opacity: 0.18 },
    { x: 220, y: 72, w: 96, h: 140, opacity: 0.12 },
    { x: 140, y: 260, w: 200, h: 64, opacity: 0.16 },
  ];

  for (const spec of shadowSpecs) {
    const block = figma.createRectangle();
    block.name = 'shadow';
    block.resize(spec.w, spec.h);
    block.x = spec.x;
    block.y = spec.y;
    block.fills = [solidFill('#000000', spec.opacity)];
    parent.appendChild(block);
  }

  const initialsText = figma.createText();
  initialsText.name = 'initials';
  initialsText.fontName = font;
  initialsText.characters = initials;
  initialsText.fontSize = 120;
  initialsText.fills = [solidFill('#FFFFFF', 0.08)];
  initialsText.textAlignHorizontal = 'CENTER';
  initialsText.textAlignVertical = 'CENTER';
  initialsText.resize(CARD_SIZE, CARD_SIZE);
  initialsText.x = 0;
  initialsText.y = 0;
  parent.appendChild(initialsText);
}

function addTreatmentLayers(parent: FrameNode, state: State): void {
  const preset = TREATMENT_PARAMS[state.imageTreatment];
  const contrastFactor = (state.contrast / 100) * preset.contrastMul;

  if (preset.grayOpacity > 0) {
    addFullRect(parent, 'grayscale', solidFill('#808080'), preset.grayOpacity, 'COLOR');
  }

  if (preset.darken > 0) {
    const darkenOpacity = Math.min(0.65, preset.darken * (0.55 + contrastFactor * 0.35));
    addFullRect(parent, 'exposure-dark', solidFill('#000000'), darkenOpacity, 'MULTIPLY');
  }

  if (preset.lighten > 0) {
    addFullRect(parent, 'exposure-light', solidFill('#FFFFFF'), preset.lighten, 'SCREEN');
  }

  if (contrastFactor > 0.7) {
    addFullRect(
      parent,
      'contrast',
      solidFill('#000000'),
      Math.min(0.35, (contrastFactor - 0.7) * 0.45),
      'OVERLAY',
    );
  }
}

function addGrainLayer(parent: FrameNode, state: State): void {
  const grainOpacity = Math.min(0.55, (state.grain / 100) * 0.5);
  if (grainOpacity <= 0.02) return;

  const grainGroup = figma.createFrame();
  grainGroup.name = 'grain';
  grainGroup.resize(CARD_SIZE, CARD_SIZE);
  grainGroup.x = 0;
  grainGroup.y = 0;
  grainGroup.fills = [];
  grainGroup.clipsContent = true;

  const grainBase = figma.createRectangle();
  grainBase.resize(CARD_SIZE, CARD_SIZE);
  grainBase.fills = [solidFill('#B0B0B0')];
  grainBase.opacity = grainOpacity;
  grainBase.blendMode = 'OVERLAY';
  grainGroup.appendChild(grainBase);

  const speckCount = state.imageTreatment === 'soft-grain' ? 48 : 32;
  for (let i = 0; i < speckCount; i++) {
    const speck = figma.createRectangle();
    speck.name = 'grain-speck';
    const size = 1 + (i % 3);
    speck.resize(size, size);
    speck.x = ((i * 97) % CARD_SIZE) + (i % 5);
    speck.y = ((i * 53) % CARD_SIZE) + (i % 7);
    speck.fills = [solidFill(i % 2 === 0 ? '#FFFFFF' : '#000000', 0.08 + (i % 4) * 0.03)];
    speck.blendMode = 'OVERLAY';
    grainGroup.appendChild(speck);
  }

  parent.appendChild(grainGroup);
}

function formatPerformanceLine(state: State): string {
  const stageLabel = STAGE_LABELS[state.stage] ?? state.stage.toUpperCase();
  return `${stageLabel} · ${state.time}`;
}

async function buildCardContents(parent: FrameNode, state: State): Promise<State> {
  const imageMeta = resolveImageFromState(state);
  const nextState: State = {
    ...state,
    imageUrl: imageMeta.imageUrl,
    thumbUrl: imageMeta.thumbUrl,
    imageTitle: imageMeta.title,
    imageSourceUrl: imageMeta.sourceUrl,
  };

  if (imageMeta.imageUrl) {
    await addImageLayer(parent, imageMeta.imageUrl, state);
  } else {
    await addPlaceholderLayers(parent, state);
  }

  addTreatmentLayers(parent, state);
  addFullRect(parent, 'overlay', solidFill('#000000'), OVERLAY_OPACITY);
  addGrainLayer(parent, state);

  const font = await loadCardFonts();
  const displayName = (nextState.canonicalArtistName || nextState.artistName).toUpperCase();

  const textWrap = figma.createFrame();
  textWrap.name = 'text';
  textWrap.layoutMode = 'VERTICAL';
  textWrap.primaryAxisSizingMode = 'AUTO';
  textWrap.counterAxisSizingMode = 'AUTO';
  textWrap.itemSpacing = 4;
  textWrap.fills = [];
  textWrap.x = PADDING;
  textWrap.y = CARD_SIZE - PADDING;
  textWrap.counterAxisAlignItems = 'MIN';

  const artistText = figma.createText();
  artistText.name = 'Artist Name';
  artistText.fontName = font;
  artistText.characters = displayName;
  artistText.fontSize = 48;
  artistText.lineHeight = { unit: 'PERCENT', value: 100 };
  artistText.fills = [solidFill('#FFFFFF')];
  artistText.textCase = 'UPPER';
  textWrap.appendChild(artistText);

  const perfText = figma.createText();
  perfText.name = 'Performance Details';
  perfText.fontName = font;
  perfText.characters = formatPerformanceLine(state);
  perfText.fontSize = 12;
  perfText.lineHeight = { unit: 'PERCENT', value: 100 };
  perfText.fills = [solidFill('#FFFFFF')];
  perfText.opacity = 0.75;
  perfText.textCase = 'UPPER';
  textWrap.appendChild(perfText);

  parent.appendChild(textWrap);

  textWrap.y = CARD_SIZE - PADDING - textWrap.height;

  if (state.showSourceNote && imageMeta.title) {
    const sourceText = figma.createText();
    sourceText.name = 'source note';
    sourceText.fontName = font;
    sourceText.characters = `Source: ${imageMeta.title}`;
    sourceText.fontSize = 8;
    sourceText.fills = [solidFill('#FFFFFF', 0.45)];
    sourceText.x = PADDING;
    sourceText.y = CARD_SIZE - PADDING - 10;
    parent.appendChild(sourceText);
  }

  return nextState;
}

async function regenerate(state: State, mode: 'create' | 'update'): Promise<void> {
  if (isRegenerating) return;
  isRegenerating = true;

  try {
    let posX = 0;
    let posY = 0;

    if (mode === 'update') {
      const existing = getSelectedToolFrame();
      if (!existing) return;
      posX = existing.x;
      posY = existing.y;
      existing.remove();
    }

    let workingState = { ...state };

    try {
      workingState.canonicalArtistName = await searchMusicBrainz(workingState.artistName);
    } catch {
      figma.notify('MusicBrainz lookup failed — using typed artist name.');
      workingState.canonicalArtistName = null;
    }

    const frame = figma.createFrame();
    frame.name = 'artist-card';
    frame.resize(CARD_SIZE, CARD_SIZE);
    frame.clipsContent = true;
    frame.fills = [solidFill('#000000')];
    frame.cornerRadius = 0;

    const persistedState = await buildCardContents(frame, workingState);

    frame.setPluginData('toolState', JSON.stringify(persistedState));
    frame.setPluginData('toolId', TOOL_ID);
    frame.setRelaunchData({
      regenerate: 'Regenerate with current values',
      edit: 'Open this tool to edit',
    });

    if (mode === 'update') {
      frame.x = posX;
      frame.y = posY;
    } else {
      frame.x = figma.viewport.center.x - frame.width / 2;
      frame.y = figma.viewport.center.y - frame.height / 2;
      figma.viewport.scrollAndZoomIntoView([frame]);
    }

    currentOutput = frame;
    figma.currentPage.selection = [frame];
    postOutputSelected(true);
  } catch (err) {
    figma.notify(`Could not regenerate: ${(err as Error).message}`);
  } finally {
    isRegenerating = false;
  }
}

figma.ui.onmessage = async (msg: UiToCodeMessage) => {
  if (msg.type === 'resize') {
    const h = Math.max(120, Math.min(900, Math.round(msg.height)));
    figma.ui.resize(240, h);
    return;
  }

  if (msg.type === 'findImages') {
    figma.ui.postMessage({ type: 'imageSearchStart' } satisfies CodeToUiMessage);
    try {
      const candidates = await searchWikimediaImages(msg.artistName);
      if (candidates.length === 0) {
        figma.ui.postMessage({
          type: 'imageSearchComplete',
          candidates: [],
          error: 'No images found. Generate will use a placeholder.',
        } satisfies CodeToUiMessage);
        figma.notify('No image candidates found.');
        return;
      }

      figma.ui.postMessage({
        type: 'imageSearchComplete',
        candidates,
      } satisfies CodeToUiMessage);
      figma.notify(`Found ${candidates.length} image${candidates.length === 1 ? '' : 's'}.`);
    } catch (err) {
      figma.ui.postMessage({
        type: 'imageSearchComplete',
        candidates: [],
        error: (err as Error).message,
      } satisfies CodeToUiMessage);
      figma.notify(`Image search failed: ${(err as Error).message}`);
    }
    return;
  }

  if (msg.type === 'generate') {
    const selected = getSelectedToolFrame();
    await regenerate(msg.state, selected ? 'update' : 'create');
  } else if (msg.type === 'regenerate') {
    await regenerate(msg.state, 'update');
  }
};

figma.on('selectionchange', () => {
  const toolFrame = getSelectedToolFrame();
  postOutputSelected(!!toolFrame);

  if (!toolFrame) return;

  const raw = toolFrame.getPluginData('toolState');
  if (!raw) return;

  figma.ui.postMessage({ type: 'loadState', state: JSON.parse(raw) as State });
  currentOutput = toolFrame;
});

if (figma.command === 'regenerate') {
  const sel = getSelectedToolFrame();
  if (sel) {
    const raw = sel.getPluginData('toolState');
    if (raw) {
      void regenerate(JSON.parse(raw) as State, 'update');
    }
  }
}

void defaultState;
