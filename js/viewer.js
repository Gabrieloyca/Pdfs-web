/* Visor PDF continuo automático basado en pdf.js */

const viewerContainer = document.getElementById('viewerContainer');
const pagesContainer = document.getElementById('pages');

const MAX_SCALE = 4;
const MIN_SCALE = 0.25;
const SCALE_STEP = 0.1;
const FOLDER_COUNT = 10;
const FOLDER_PREFIX = 'pagina-';

let scale = 1;
let observer = null;
let pdfDocuments = [];
const pageRenderStates = new Map();

let isPanning = false;
let panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };
let pinchState = null;

function getPageKey(docIndex, pageNumber) {
  return `${docIndex}-${pageNumber}`;
}

function encodeLocalPath(path) {
  if (!path) return null;
  let working = path;
  let hash = '';
  let query = '';

  const hashIndex = working.indexOf('#');
  if (hashIndex !== -1) {
    hash = working.slice(hashIndex);
    working = working.slice(0, hashIndex);
  }

  const queryIndex = working.indexOf('?');
  if (queryIndex !== -1) {
    query = working.slice(queryIndex);
    working = working.slice(0, queryIndex);
  }

  const encodedPath = working
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
    .replace(/%25/g, '%');

  return `${encodedPath}${query}${hash}`;
}

function resolveFilePath(basePath, file) {
  if (typeof file !== 'string') return null;
  const trimmed = file.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const withoutLeadingDots = trimmed.replace(/^\.\/+/g, '').replace(/^\/+/g, '');
  const localPath = withoutLeadingDots.startsWith('pdfs/')
    ? withoutLeadingDots
    : `${basePath}/${withoutLeadingDots}`;

  return encodeLocalPath(localPath);
}

function clearPages() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  pdfDocuments = [];
  pageRenderStates.clear();
  pagesContainer.innerHTML = '';
}

function createPageElements(docIndex, numPages) {
  const fragment = document.createDocumentFragment();
  for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'page';
    wrapper.dataset.docIndex = String(docIndex);
    wrapper.dataset.pageNumber = String(pageNumber);
    wrapper.dataset.pageKey = getPageKey(docIndex, pageNumber);
    pageRenderStates.set(wrapper.dataset.pageKey, {
      renderedScale: 0,
      rendering: false
    });
    fragment.appendChild(wrapper);
  }
  pagesContainer.appendChild(fragment);
}

async function renderPage(docIndex, pageNumber) {
  const pdfEntry = pdfDocuments[docIndex];
  if (!pdfEntry) return;

  const key = getPageKey(docIndex, pageNumber);
  const state = pageRenderStates.get(key);
  if (!state || state.rendering) return;
  if (Math.abs(state.renderedScale - scale) < 0.001) return;

  const wrapper = pagesContainer.querySelector(
    `[data-doc-index="${docIndex}"][data-page-number="${pageNumber}"]`
  );
  if (!wrapper) return;

  state.rendering = true;

  try {
    const page = await pdfEntry.doc.getPage(pageNumber);
    let canvas = wrapper.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      wrapper.appendChild(canvas);
    }

    const viewport = page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;
    const renderViewport = page.getViewport({ scale: scale * outputScale });

    canvas.width = Math.floor(renderViewport.width);
    canvas.height = Math.floor(renderViewport.height);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const context = canvas.getContext('2d', { alpha: false });
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport: renderViewport }).promise;

    state.renderedScale = scale;
  } catch (error) {
    console.error(`Error al renderizar la página ${pageNumber} del documento ${pdfEntry.source}:`, error);
  } finally {
    const latestState = pageRenderStates.get(key);
    if (latestState) {
      latestState.rendering = false;
    }
  }
}

function setupIntersectionObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  if (!pdfDocuments.length) return;

  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const wrapper = entry.target;
      const docIndex = parseInt(wrapper.dataset.docIndex, 10);
      const pageNumber = parseInt(wrapper.dataset.pageNumber, 10);
      if (Number.isNaN(docIndex) || Number.isNaN(pageNumber)) return;
      renderPage(docIndex, pageNumber).catch((err) => console.error(err));
    });
  }, {
    root: viewerContainer,
    rootMargin: '400px 0px',
    threshold: 0.01
  });

  const wrappers = pagesContainer.querySelectorAll('.page');
  wrappers.forEach((wrapper) => observer.observe(wrapper));

  const firstWrapper = pagesContainer.querySelector('.page');
  if (firstWrapper) {
    const docIndex = parseInt(firstWrapper.dataset.docIndex, 10);
    const pageNumber = parseInt(firstWrapper.dataset.pageNumber, 10);
    if (!Number.isNaN(docIndex) && !Number.isNaN(pageNumber)) {
      renderPage(docIndex, pageNumber).catch((err) => console.error(err));
    }
  }
}

function markPagesForRedraw() {
  pageRenderStates.forEach((state) => {
    state.renderedScale = 0;
  });
  setupIntersectionObserver();
}

function applyZoom(newScale, clientX, clientY) {
  const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
  if (Math.abs(clampedScale - scale) < 0.001) return;

  const previousScale = scale;
  scale = clampedScale;

  if (typeof clientX === 'number' && typeof clientY === 'number') {
    const rect = viewerContainer.getBoundingClientRect();
    const offsetX = clientX - rect.left + viewerContainer.scrollLeft;
    const offsetY = clientY - rect.top + viewerContainer.scrollTop;
    const ratio = scale / previousScale;
    viewerContainer.scrollLeft = offsetX * ratio - (clientX - rect.left);
    viewerContainer.scrollTop = offsetY * ratio - (clientY - rect.top);
  }

  markPagesForRedraw();
}

function handleWheel(event) {
  if (!event) return;
  if (event.deltaY === 0 && event.deltaX === 0) return;

  const isPinchGesture = event.ctrlKey || event.metaKey;
  const isLineDelta = typeof WheelEvent !== 'undefined' && event.deltaMode === WheelEvent.DOM_DELTA_LINE;
  const magnitude = Math.max(Math.abs(event.deltaY), Math.abs(event.deltaX));
  const shouldZoom = isPinchGesture || isLineDelta || magnitude >= 20;

  if (!shouldZoom) {
    return;
  }

  event.preventDefault();

  const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  const step = isLineDelta ? SCALE_STEP * 4 : SCALE_STEP;
  const newScale = delta < 0 ? scale * (1 + step) : scale / (1 + step);
  applyZoom(newScale, event.clientX, event.clientY);
}

function startPan(event) {
  if (event.button !== 0 && event.button !== 1) return;
  isPanning = true;
  viewerContainer.classList.add('is-panning');
  panStart = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: viewerContainer.scrollLeft,
    scrollTop: viewerContainer.scrollTop
  };
}

function updatePan(event) {
  if (!isPanning) return;
  event.preventDefault();
  const deltaX = event.clientX - panStart.x;
  const deltaY = event.clientY - panStart.y;
  viewerContainer.scrollLeft = panStart.scrollLeft - deltaX;
  viewerContainer.scrollTop = panStart.scrollTop - deltaY;
}

function endPan() {
  if (!isPanning) return;
  isPanning = false;
  viewerContainer.classList.remove('is-panning');
}

function distanceBetweenTouches(touches) {
  const [a, b] = touches;
  const dx = b.clientX - a.clientX;
  const dy = b.clientY - a.clientY;
  return Math.hypot(dx, dy);
}

function midpointFromTouches(touches) {
  const [a, b] = touches;
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2
  };
}

function handleTouchStart(event) {
  if (event.touches.length === 2) {
    event.preventDefault();
    const midpoint = midpointFromTouches(event.touches);
    pinchState = {
      initialDistance: distanceBetweenTouches(event.touches),
      initialScale: scale,
      focusX: midpoint.x,
      focusY: midpoint.y
    };
  }
}

function handleTouchMove(event) {
  if (pinchState && event.touches.length === 2) {
    event.preventDefault();
    const currentDistance = distanceBetweenTouches(event.touches);
    if (currentDistance <= 0) return;
    const ratio = currentDistance / pinchState.initialDistance;
    const midpoint = midpointFromTouches(event.touches);
    applyZoom(pinchState.initialScale * ratio, midpoint.x, midpoint.y);
  }
}

function handleTouchEnd(event) {
  if (!pinchState) return;
  if (event.touches.length < 2) {
    pinchState = null;
  }
}

async function fetchManifestFiles(basePath) {
  try {
    const response = await fetch(`${basePath}/manifest.json`, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    if (!data) return [];
    const files = Array.isArray(data.files) ? data.files : [];
    return files
      .filter((file) => typeof file === 'string')
      .filter((file) => file.toLowerCase().endsWith('.pdf'));
  } catch (error) {
    console.warn(`No se pudo leer manifest en ${basePath}:`, error);
    return [];
  }
}

async function fetchDirectoryFiles(basePath) {
  try {
    const response = await fetch(`${basePath}/`, { cache: 'no-store' });
    if (!response.ok) return [];
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return [];
    const html = await response.text();
    const matches = [...html.matchAll(/href="([^"]+\.pdf)"/gi)];
    return matches
      .map((match) => match[1])
      .map((href) => href.split('?')[0].split('#')[0])
      .map((href) => decodeURIComponent(href))
      .map((href) => href.replace(/^.*\//, ''))
      .filter((file) => file.toLowerCase().endsWith('.pdf'))
      .map((file) => resolveFilePath(basePath, file))
      .filter(Boolean);
  } catch (error) {
    console.warn(`No se pudo obtener listado de ${basePath}:`, error);
    return [];
  }
}

async function collectPdfSources() {
  const seen = new Set();
  const sources = [];

  for (let index = 1; index <= FOLDER_COUNT; index++) {
    const folderName = `${FOLDER_PREFIX}${String(index).padStart(2, '0')}`;
    const basePath = `pdfs/${folderName}`;

    const manifestFiles = await fetchManifestFiles(basePath);
    if (manifestFiles.length) {
      manifestFiles.forEach((file) => {
        const fullPath = resolveFilePath(basePath, file);
        if (!fullPath || !fullPath.toLowerCase().endsWith('.pdf')) return;
        if (!seen.has(fullPath)) {
          seen.add(fullPath);
          sources.push(fullPath);
        }
      });
      continue;
    }

    const listedFiles = await fetchDirectoryFiles(basePath);
    listedFiles.forEach((file) => {
      if (!seen.has(file)) {
        seen.add(file);
        sources.push(file);
      }
    });
  }

  if (!sources.length) {
    const fallback = resolveFilePath('pdfs/pagina-01', 'Entrega Arquitectura Palta Aribnb.pdf');
    if (fallback && !seen.has(fallback)) {
      sources.push(fallback);
    }
  }

  return sources;
}

async function loadAllPdfs() {
  clearPages();
  const sources = await collectPdfSources();
  if (!sources.length) {
    console.warn('No se encontraron PDFs para mostrar.');
    return;
  }

  for (const source of sources) {
    try {
      const loadingTask = pdfjsLib.getDocument({ url: source });
      const pdfDoc = await loadingTask.promise;
      const docIndex = pdfDocuments.length;
      pdfDocuments.push({ doc: pdfDoc, source });
      createPageElements(docIndex, pdfDoc.numPages);
    } catch (error) {
      console.error(`No se pudo cargar el PDF ${source}:`, error);
    }
  }

  if (!pdfDocuments.length) {
    console.warn('No fue posible cargar ningún PDF.');
    return;
  }

  markPagesForRedraw();
}

function initInteractions() {
  viewerContainer.addEventListener('wheel', handleWheel, { passive: false });
  viewerContainer.addEventListener('mousedown', startPan);
  window.addEventListener('mousemove', updatePan, { passive: false });
  window.addEventListener('mouseup', endPan);
  viewerContainer.addEventListener('mouseleave', endPan);

  viewerContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
  viewerContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
  viewerContainer.addEventListener('touchend', handleTouchEnd);
  viewerContainer.addEventListener('touchcancel', handleTouchEnd);
}

async function init() {
  if (!window.pdfjsLib) {
    console.error('pdfjsLib no está disponible.');
    return;
  }

  initInteractions();
  await loadAllPdfs();
}

init();
