/* Visor PDF continuo (usa pdfjsLib global cargado desde CDN) */

const pdfList = [
  'pdfs/Entrega Arquitectura Palta Aribnb.pdf'
];

const pdfSelect = document.getElementById('pdfSelect');
const openBtn = document.getElementById('openBtn');
const fileInput = document.getElementById('fileInput');
const pagesContainer = document.getElementById('pages');
const zoomInput = document.getElementById('zoom');
const zoomValue = document.getElementById('zoomValue');
const dropZone = document.getElementById('dropZone');

let currentPdf = null;
let scale = parseFloat(zoomInput.value) || 1;
let pageRenderStates = [];
let observer = null;

/* Poblamos la lista de PDFs definidos en el repo */
function populatePdfList() {
  pdfSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- selecciona un PDF --';
  pdfSelect.appendChild(defaultOption);

  pdfList.forEach(path => {
    const opt = document.createElement('option');
    opt.value = path;
    opt.textContent = path.split('/').pop();
    pdfSelect.appendChild(opt);
  });
}

/* Limpia páginas y estados */
function clearPages() {
  pagesContainer.innerHTML = '';
  pageRenderStates = [];
  if (observer) observer.disconnect();
  observer = null;
}

/* Crea elementos contenedores para cada página */
function createPageElements(numPages) {
  const fragment = document.createDocumentFragment();
  for (let i = 1; i <= numPages; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'page';
    wrapper.dataset.pageNumber = i;
    fragment.appendChild(wrapper);
    pageRenderStates[i] = { renderedScale: 0, rendering: false, viewportHeight: 0 };
  }
  pagesContainer.appendChild(fragment);
}

/* Renderizar una página al scale actual */
async function renderPage(pdfDoc, pageNumber) {
  const page = await pdfDoc.getPage(pageNumber);
  const wrapper = pagesContainer.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!wrapper) return;
  let canvas = wrapper.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
  }
  const context = canvas.getContext('2d');

  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = Math.floor(viewport.width) + 'px';
  canvas.style.height = Math.floor(viewport.height) + 'px';

  context.save();
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();

  const renderContext = {
    canvasContext: context,
    viewport: page.getViewport({ scale: scale * outputScale })
  };

  pageRenderStates[pageNumber].rendering = true;
  await page.render(renderContext).promise;
  pageRenderStates[pageNumber].rendering = false;
  pageRenderStates[pageNumber].renderedScale = scale;
  pageRenderStates[pageNumber].viewportHeight = viewport.height;
}

/* IntersectionObserver para lazy-render con margen amplio */
function setupIntersectionObserver(pdfDoc) {
  const options = {
    root: document.getElementById('viewerContainer'),
    rootMargin: '500px 0px',
    threshold: 0.01
  };
  observer = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const wrapper = entry.target;
        const pageNumber = parseInt(wrapper.dataset.pageNumber, 10);
        const state = pageRenderStates[pageNumber];
        if (!state) continue;
        if (!state.rendering && state.renderedScale !== scale) {
          renderPage(pdfDoc, pageNumber).catch(console.error);
        } else if (state.renderedScale === 0) {
          renderPage(pdfDoc, pageNumber).catch(console.error);
        }
      }
    }
  }, options);

  const wrappers = pagesContainer.querySelectorAll('.page');
  wrappers.forEach(w => observer.observe(w));
}

/* Carga PDF desde URL o Blob */
async function loadPdf(source) {
  try {
    clearPages();
    const loadingTask = typeof source === 'string'
      ? pdfjsLib.getDocument(source)
      : pdfjsLib.getDocument({ data: await source.arrayBuffer?.() ?? source });

    const pdfDoc = await loadingTask.promise;
    currentPdf = pdfDoc;
    createPageElements(pdfDoc.numPages);
    setupIntersectionObserver(pdfDoc);
    renderPage(pdfDoc, 1).catch(console.error);
  } catch (err) {
    console.error('Error cargando PDF:', err);
    alert('No se pudo cargar el PDF. Revisa la consola para más detalles.');
  }
}

/* Abrir desde selector o input file */
openBtn.addEventListener('click', () => {
  const val = pdfSelect.value;
  if (!val) {
    const files = fileInput.files;
    if (files && files.length > 0) {
      loadPdf(files[0]);
    } else {
      alert('Selecciona un PDF del selector o sube uno con "Abrir archivo".');
    }
  } else {
    loadPdf(val);
  }
});

fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) loadPdf(f);
});

/* Drag & drop */
['dragenter','dragover'].forEach(evt => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragging');
  });
});
['dragleave','drop'].forEach(evt => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragging');
  });
});
dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) {
    loadPdf(dt.files[0]);
  }
});

/* Zoom control */
function updateZoomDisplay() {
  zoomValue.textContent = Math.round(scale * 100) + '%';
}
zoomInput.addEventListener('input', (e) => {
  scale = parseFloat(e.target.value);
  updateZoomDisplay();
  if (currentPdf) {
    const wrappers = pagesContainer.querySelectorAll('.page');
    wrappers.forEach(w => {
      const pageNumber = parseInt(w.dataset.pageNumber,10);
      if (pageRenderStates[pageNumber]) pageRenderStates[pageNumber].renderedScale = 0;
    });
    if (observer) {
      observer.disconnect();
      setupIntersectionObserver(currentPdf);
    }
  }
});

/* Ctrl + rueda para zoom */
const viewerContainer = document.getElementById('viewerContainer');
viewerContainer.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.05;
    let newScale = Math.min(3, Math.max(0.25, scale + delta));
    if (Math.abs(newScale - scale) > 0.001) {
      scale = newScale;
      zoomInput.value = scale;
      updateZoomDisplay();
      const wrappers = pagesContainer.querySelectorAll('.page');
      wrappers.forEach(w => {
        const pageNumber = parseInt(w.dataset.pageNumber,10);
        if (pageRenderStates[pageNumber]) {
          pageRenderStates[pageNumber].renderedScale = 0;
        }
      });
      if (observer && currentPdf) {
        observer.disconnect();
        setupIntersectionObserver(currentPdf);
      }
    }
  }
}, { passive: false });

/* Inicialización */
(function init() {
  populatePdfList();
  updateZoomDisplay();
})();