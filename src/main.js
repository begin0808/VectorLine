// ----------------------------------------------------
// VectorLine - Main Application Logic
// ----------------------------------------------------

let imgElement = document.createElement('img');
let originalFile = null;
let debounceTimeout = null;
let lastSvgContent = ''; // For downloading
let origImageData = null; // Cached original pixels for magic-wand flood fill
let bgMask = null; // Uint8Array (w*h), 1 = removed background

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadPreviewContainer = document.getElementById('upload-preview-container');
const uploadPreview = document.getElementById('upload-preview');
const btnRemoveImage = document.getElementById('btn-remove-image');
const settingsGroup = document.getElementById('settings-group');

// Sliders & Values
const sliderDenoise = document.getElementById('slider-denoise');
const valDenoise = document.getElementById('val-denoise');
const sliderBlocksize = document.getElementById('slider-blocksize');
const valBlocksize = document.getElementById('val-blocksize');
const sliderCConstant = document.getElementById('slider-c-constant');
const valCConstant = document.getElementById('val-c-constant');
const sliderSimplify = document.getElementById('slider-simplify');
const valSimplify = document.getElementById('val-simplify');
const sliderMinArea = document.getElementById('slider-min-area');
const valMinArea = document.getElementById('val-min-area');

// Morphological cleanup
const sliderMorphClean = document.getElementById('slider-morph-clean');
const valMorphClean = document.getElementById('val-morph-clean');

// Brightness & Contrast
const sliderBrightness = document.getElementById('slider-brightness');
const valBrightness = document.getElementById('val-brightness');
const sliderContrast = document.getElementById('slider-contrast');
const valContrast = document.getElementById('val-contrast');

// Physical Scaler
const checkboxEnableSize = document.getElementById('checkbox-enable-size');
const inputPhysWidth = document.getElementById('input-phys-width');
const inputPhysHeight = document.getElementById('input-phys-height');
const sizeInputsWrapper = document.getElementById('size-inputs-wrapper');

// Invert color option
const checkboxInvertBinary = document.getElementById('checkbox-invert-binary');

// Curve smoothing option
const checkboxSmooth = document.getElementById('checkbox-smooth');

// Color choice
const colorRadios = document.getElementsByName('svg-color');

// Render mode choice (stroke outline vs solid fill)
const renderModeRadios = document.getElementsByName('render-mode');

// Cut mode choice
const cutModeRadios = document.getElementsByName('cut-mode');

// Actions
const btnDownloadSvg = document.getElementById('btn-download-svg');
const btnDownloadPng = document.getElementById('btn-download-png');
const btnPresetPhoto = document.getElementById('btn-preset-photo');
const btnPresetDigital = document.getElementById('btn-preset-digital');
const btnResetDefaults = document.getElementById('btn-reset-defaults');

// Preview empty-state overlays
const emptyStateCanvas = document.getElementById('empty-state-canvas');
const emptyStateSvg = document.getElementById('empty-state-svg');

// Canvas
const outputCanvas = document.getElementById('output-canvas');

// SVG zoom indicator & elements
const svgZoomIndicator = document.getElementById('svg-zoom-indicator');
const svgPreviewWrapper = document.getElementById('svg-preview-wrapper');
const svgPreview = document.getElementById('svg-preview');

// Stats
const statResolution = document.getElementById('stat-resolution');
const statContours = document.getElementById('stat-contours');
const statNodes = document.getElementById('stat-nodes');

// 1. Web Worker and OpenCV.js background thread initialization
const imageWorker = new Worker(new URL('./processor.worker.js', import.meta.url));
let isWorkerReady = false;
let openCVInitialized = false;

// Loading timeout check
const loadingTimeout = setTimeout(() => {
  if (!isWorkerReady) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
      loadingText.textContent = '載入 OpenCV.js (Web Worker) 逾時，請檢查網路連線後重新整理頁面。';
    }
  }
}, 30000);

imageWorker.onmessage = function(e) {
  const { type, outBuffer, pathsSvgHtml, pathsCount, totalNodes, message } = e.data;
  if (type === 'ready') {
    clearTimeout(loadingTimeout);
    isWorkerReady = true;
    onWorkerLoaded();
  } else if (type === 'result') {
    onProcessingFinished(outBuffer, pathsSvgHtml, pathsCount, totalNodes);
  } else if (type === 'error') {
    console.error("Web Worker error:", message);
  }
};

function onWorkerLoaded() {
  if (openCVInitialized) return;
  openCVInitialized = true;
  console.log("OpenCV.js Web Worker initialized successfully.");
  loadingScreen.classList.add('fade-out');
  // Enable drag and drop functionality
  setupDragAndDrop();
  // Initialize SVG zoom & pan (now dual-synchronized)
  initZoomAndPanEvents();
  
  // Auto-process if image was pre-loaded
  if (originalFile) {
    triggerProcessing();
  }
}

// 2. Drag and drop file uploading setup
function setupDragAndDrop() {
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop zone when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
  });

  // Handle dropped files
  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleImageFile(files[0]);
    }
  });

  // Handle clicked files
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageFile(e.target.files[0]);
    }
  });

  btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    resetImage();
  });
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('請上傳正確的圖片格式！');
    return;
  }

  originalFile = file;
  const reader = new FileReader();
  reader.onload = function(e) {
    imgElement.src = e.target.result;
    uploadPreview.src = e.target.result;
    
    imgElement.onload = function() {
      // Show upload preview overlay
      uploadPreviewContainer.classList.remove('hidden');
      // Enable controls panel
      settingsGroup.classList.remove('disabled-controls');
      settingsGroup.classList.add('enabled-controls');
      
      // Hide canvas/svg empty states
      emptyStateCanvas.classList.add('hidden');
      emptyStateSvg.classList.add('hidden');
      
      // Switch layout to active workspace
      const appContainer = document.querySelector('.app-container');
      if (appContainer) {
        appContainer.classList.remove('is-empty');
        appContainer.classList.add('is-loaded');
      }
      
      // Calculate physical height
      updatePhysicalHeight();

      // Reset Zoom & Pan
      resetZoomAndPan();

      // Cache original pixels & clear any previous background mask
      cacheOriginalPixels();
      bgMask = null;

      // Trigger processing
      triggerProcessing();
    };
  };
  reader.readAsDataURL(file);
}

function resetImage() {
  originalFile = null;
  imgElement = document.createElement('img');
  uploadPreview.src = '';
  fileInput.value = '';
  uploadPreviewContainer.classList.add('hidden');
  
  // Disable controls panel
  settingsGroup.classList.remove('enabled-controls');
  settingsGroup.classList.add('disabled-controls');
  
  // Switch layout to onboarding state
  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    appContainer.classList.add('is-empty');
    appContainer.classList.remove('is-loaded');
  }
  
  // Restore empty states
  emptyStateCanvas.classList.remove('hidden');
  emptyStateSvg.classList.remove('hidden');
  
  // Hide zoom indicator
  if (svgZoomIndicator) svgZoomIndicator.classList.add('hidden');
  
  // Reset physical size display
  inputPhysHeight.value = '-';
  
  // Reset stats
  statResolution.textContent = '-';
  statContours.textContent = '-';
  statNodes.textContent = '-';
  
  // Clear canvas
  const ctx = outputCanvas.getContext('2d');
  ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  
  // Clear SVG preview
  if (svgPreview.src && svgPreview.src.startsWith('blob:')) {
    URL.revokeObjectURL(svgPreview.src);
  }
  svgPreview.src = '';
  svgPreview.classList.add('hidden');
  lastSvgContent = '';
  
  // Reset pan & zoom values
  resetZoomAndPan();

  // Disable & close the before/after compare tool
  const compareBtn = document.getElementById('btn-compare-toggle');
  if (compareBtn) compareBtn.disabled = true;
  const compareLayerEl = document.getElementById('compare-layer');
  if (compareLayerEl) compareLayerEl.classList.add('hidden');
  if (typeof compareActive !== 'undefined') compareActive = false;
  if (compareBtn) compareBtn.classList.remove('active');

  // Disable & close the magic-wand tool; drop cached pixels/mask
  const magicBtn = document.getElementById('btn-magic-toggle');
  if (magicBtn) { magicBtn.disabled = true; magicBtn.classList.remove('active'); }
  const magicLayerEl = document.getElementById('magic-layer');
  if (magicLayerEl) magicLayerEl.classList.add('hidden');
  if (typeof magicActive !== 'undefined') magicActive = false;
  origImageData = null;
  bgMask = null;
}


// 4. Sliders bindings & triggers
sliderDenoise.addEventListener('input', (e) => {
  valDenoise.textContent = e.target.value;
  triggerProcessing();
});

sliderBlocksize.addEventListener('input', (e) => {
  // Ensure block size is always odd and >= 3
  let val = parseInt(e.target.value);
  if (val % 2 === 0) val += 1;
  valBlocksize.textContent = val;
  triggerProcessing();
});

sliderCConstant.addEventListener('input', (e) => {
  valCConstant.textContent = e.target.value;
  triggerProcessing();
});

sliderSimplify.addEventListener('input', (e) => {
  valSimplify.textContent = parseFloat(e.target.value).toFixed(1) + ' px';
  triggerProcessing();
});

sliderMinArea.addEventListener('input', (e) => {
  valMinArea.textContent = e.target.value + ' px';
  triggerProcessing();
});

sliderMorphClean.addEventListener('input', (e) => {
  valMorphClean.textContent = e.target.value;
  triggerProcessing();
});

// Brightness & Contrast input events
sliderBrightness.addEventListener('input', (e) => {
  valBrightness.textContent = e.target.value > 0 ? `+${e.target.value}` : e.target.value;
  triggerProcessing();
});

sliderContrast.addEventListener('input', (e) => {
  valContrast.textContent = e.target.value > 0 ? `+${e.target.value}` : e.target.value;
  triggerProcessing();
});

// White cutoff (background removal by luminance)
const sliderWhiteCutoff = document.getElementById('slider-white-cutoff');
const valWhiteCutoff = document.getElementById('val-white-cutoff');
sliderWhiteCutoff.addEventListener('input', (e) => {
  const v = parseInt(e.target.value);
  valWhiteCutoff.textContent = v >= 255 ? '關閉' : v;
  triggerProcessing();
});

// Physical size input events
checkboxEnableSize.addEventListener('change', () => {
  if (checkboxEnableSize.checked) {
    sizeInputsWrapper.classList.remove('disabled-controls');
  } else {
    sizeInputsWrapper.classList.add('disabled-controls');
  }
  triggerProcessing();
});

inputPhysWidth.addEventListener('input', () => {
  updatePhysicalHeight();
  triggerProcessing();
});

checkboxInvertBinary.addEventListener('change', () => triggerProcessing());

checkboxSmooth.addEventListener('change', () => triggerProcessing());

function updatePhysicalHeight() {
  if (!imgElement || !imgElement.naturalWidth) return;
  const w = imgElement.naturalWidth;
  const h = imgElement.naturalHeight;
  const physW = parseFloat(inputPhysWidth.value) || 0;
  if (physW > 0) {
    const physH = (h / w) * physW;
    inputPhysHeight.value = physH.toFixed(1);
  } else {
    inputPhysHeight.value = '-';
  }
}

// Interactive SVG & Canvas Pan & Zoom State (Synchronized)
let zoomScale = 1.0;
let panOffsetX = 0;
let panOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

function applyZoomAndPan(transition = false) {
  const transformStr = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoomScale})`;
  if (svgPreview) {
    svgPreview.style.transition = transition ? 'transform 0.25s ease-out' : 'none';
    svgPreview.style.transform = transformStr;
  }
  if (outputCanvas) {
    outputCanvas.style.transition = transition ? 'transform 0.25s ease-out' : 'none';
    outputCanvas.style.transform = transformStr;
  }
}

function resetZoomAndPan() {
  zoomScale = 1.0;
  panOffsetX = 0;
  panOffsetY = 0;
  applyZoomAndPan(true);
}

function initZoomAndPanEvents() {
  const wrappers = [
    document.getElementById('svg-preview-wrapper'),
    document.getElementById('canvas-preview-wrapper')
  ];
  
  wrappers.forEach(wrapper => {
    if (!wrapper) return;
    
    // Wheel Zoom
    wrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!originalFile) return;
      const zoomIntensity = 0.15;
      const delta = e.deltaY < 0 ? 1 : -1;
      const newScale = zoomScale + delta * zoomIntensity * zoomScale;
      
      // Clamp zoomScale between 0.5 and 8.0
      zoomScale = Math.min(Math.max(newScale, 0.5), 8.0);
      applyZoomAndPan(false);
    });
    
    // Mouse Down - Start Pan
    wrapper.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (!originalFile) return;
      isPanning = true;
      panStartX = e.clientX - panOffsetX;
      panStartY = e.clientY - panOffsetY;
    });
    
    // Double click to Reset View
    wrapper.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (!originalFile) return;
      resetZoomAndPan();
    });
  });

  // Mouse Move - Drag Pan (global listener handles it)
  window.addEventListener('mousemove', (e) => {
    if (!isPanning || !originalFile) return;
    panOffsetX = e.clientX - panStartX;
    panOffsetY = e.clientY - panStartY;
    applyZoomAndPan(false);
  });
  
  // Mouse Up - End Pan (global listener handles it)
  window.addEventListener('mouseup', () => {
    isPanning = false;
  });
}

// Paths color radio update
colorRadios.forEach(radio => {
  radio.addEventListener('change', () => triggerProcessing());
});

// Cut mode radio update
cutModeRadios.forEach(radio => {
  radio.addEventListener('change', () => triggerProcessing());
});

// Render mode radio update (stroke / fill)
renderModeRadios.forEach(radio => {
  radio.addEventListener('change', () => triggerProcessing());
});

// Layer mode radio update (single / auto-layer)
const layerModeRadios = document.getElementsByName('layer-mode');
layerModeRadios.forEach(radio => {
  radio.addEventListener('change', () => triggerProcessing());
});

// Download action buttons
btnDownloadSvg.addEventListener('click', () => {
  if (!lastSvgContent) return;
  const blob = new Blob([lastSvgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const baseName = originalFile ? originalFile.name.substring(0, originalFile.name.lastIndexOf('.')) : 'vectorline';
  link.href = url;
  link.download = `${baseName}_vector.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

btnDownloadPng.addEventListener('click', () => {
  if (!originalFile) return;
  const link = document.createElement('a');
  const baseName = originalFile ? originalFile.name.substring(0, originalFile.name.lastIndexOf('.')) : 'vectorline';
  link.href = outputCanvas.toDataURL('image/png');
  link.download = `${baseName}_lines.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// ----------------------------------------------------
// DXF Export (SVG paths -> LWPOLYLINE entities)
// ----------------------------------------------------
const btnDownloadDxf = document.getElementById('btn-download-dxf');

// Hidden SVG path used to sample bezier/line geometry into points
let dxfSamplerSvg = null;
let dxfSamplerPath = null;
function getDxfSampler() {
  if (!dxfSamplerSvg) {
    const NS = 'http://www.w3.org/2000/svg';
    dxfSamplerSvg = document.createElementNS(NS, 'svg');
    dxfSamplerSvg.setAttribute('width', '0');
    dxfSamplerSvg.setAttribute('height', '0');
    dxfSamplerSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;';
    dxfSamplerPath = document.createElementNS(NS, 'path');
    dxfSamplerSvg.appendChild(dxfSamplerPath);
    document.body.appendChild(dxfSamplerSvg);
  }
  return dxfSamplerPath;
}

// Sample one sub-path 'd' string into an array of [x,y] points
function sampleSubPath(dStr, stepPx) {
  const p = getDxfSampler();
  p.setAttribute('d', dStr);
  let total = 0;
  try { total = p.getTotalLength(); } catch (e) { return []; }
  if (!isFinite(total) || total <= 0) {
    const pt = p.getPointAtLength(0);
    return [[pt.x, pt.y]];
  }
  const step = Math.max(0.4, stepPx);
  const nSeg = Math.max(1, Math.ceil(total / step));
  const pts = [];
  for (let i = 0; i <= nSeg; i++) {
    const pt = p.getPointAtLength((i / nSeg) * total);
    pts.push([pt.x, pt.y]);
  }
  return pts;
}

function buildDxfFromSvg(svgString) {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  const pathEls = doc.querySelectorAll('path');
  const natW = imgElement.naturalWidth;
  const natH = imgElement.naturalHeight;

  // Determine scale to physical mm (falls back to 1:1 pixels)
  let sx = 1, sy = 1;
  if (checkboxEnableSize.checked) {
    const physW = parseFloat(inputPhysWidth.value) || 0;
    const physH = parseFloat(inputPhysHeight.value) || 0;
    if (physW > 0 && physH > 0 && natW > 0 && natH > 0) {
      sx = physW / natW;
      sy = physH / natH;
    }
  }

  const entities = [];
  pathEls.forEach((el) => {
    const d = el.getAttribute('d');
    if (!d) return;
    const stroke = (el.getAttribute('stroke') || '').toLowerCase();
    const isCut = stroke === '#ff0000' || stroke === 'red';
    const layer = isCut ? 'CUT' : 'ENGRAVE';
    const aci = isCut ? 1 : 7;

    // Split combined 'd' into independent sub-paths so we don't draw jumps between them
    const subs = d.split(/(?=M)/i).map(s => s.trim()).filter(Boolean);
    subs.forEach((sub) => {
      const closed = /z/i.test(sub);
      const raw = sampleSubPath(sub, 1.0);
      if (raw.length < 2) return;
      // Transform: scale to mm and flip Y (DXF Y is up, SVG Y is down)
      const verts = raw.map(([x, y]) => [x * sx, (natH - y) * sy]);
      let e = '0\nLWPOLYLINE\n100\nAcDbEntity\n8\n' + layer + '\n62\n' + aci +
              '\n100\nAcDbPolyline\n90\n' + verts.length + '\n70\n' + (closed ? 1 : 0) + '\n';
      for (const [x, y] of verts) {
        e += '10\n' + x.toFixed(4) + '\n20\n' + y.toFixed(4) + '\n';
      }
      entities.push(e);
    });
  });

  const header =
    '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n' +
    '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n2\n' +
    '0\nLAYER\n2\nCUT\n70\n0\n62\n1\n6\nCONTINUOUS\n' +
    '0\nLAYER\n2\nENGRAVE\n70\n0\n62\n7\n6\nCONTINUOUS\n' +
    '0\nENDTAB\n0\nENDSEC\n' +
    '0\nSECTION\n2\nENTITIES\n';
  const footer = '0\nENDSEC\n0\nEOF\n';
  return header + entities.join('') + footer;
}

btnDownloadDxf.addEventListener('click', () => {
  if (!lastSvgContent) return;
  let dxf;
  try {
    dxf = buildDxfFromSvg(lastSvgContent);
  } catch (err) {
    console.error('DXF 產生失敗:', err);
    alert('DXF 產生失敗，請重試或改用 SVG。');
    return;
  }
  const blob = new Blob([dxf], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const baseName = originalFile ? originalFile.name.substring(0, originalFile.name.lastIndexOf('.')) : 'vectorline';
  link.href = url;
  link.download = `${baseName}_vector.dxf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

// ----------------------------------------------------
// Before / After comparison slider
// ----------------------------------------------------
const btnCompareToggle = document.getElementById('btn-compare-toggle');
const compareLayer = document.getElementById('compare-layer');
const compareFrame = document.getElementById('compare-frame');
const compareBefore = document.getElementById('compare-before');
const compareAfter = document.getElementById('compare-after');
const compareDivider = document.getElementById('compare-divider');
let compareActive = false;

function setComparePct(pct) {
  const p = Math.min(98, Math.max(2, pct));
  compareBefore.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
  compareDivider.style.left = p + '%';
}

function refreshCompareImages() {
  // "After" = current processed bitmap; "Before" = original upload
  compareAfter.src = outputCanvas.toDataURL('image/png');
  compareBefore.src = imgElement.src;
}

function openCompare() {
  if (!originalFile) return;
  if (typeof magicActive !== 'undefined' && magicActive) closeMagic();
  compareActive = true;
  refreshCompareImages();
  setComparePct(50);
  compareLayer.classList.remove('hidden');
  btnCompareToggle.classList.add('active');
}

function closeCompare() {
  compareActive = false;
  compareLayer.classList.add('hidden');
  btnCompareToggle.classList.remove('active');
}

if (btnCompareToggle) {
  btnCompareToggle.addEventListener('click', () => {
    if (compareActive) closeCompare();
    else openCompare();
  });
}

// Divider dragging (pointer events cover mouse + touch)
let compareDragging = false;
function compareMoveTo(clientX) {
  const rect = compareFrame.getBoundingClientRect();
  if (rect.width === 0) return;
  setComparePct(((clientX - rect.left) / rect.width) * 100);
}
if (compareFrame) {
  compareFrame.addEventListener('pointerdown', (e) => {
    compareDragging = true;
    compareFrame.setPointerCapture(e.pointerId);
    compareMoveTo(e.clientX);
  });
  compareFrame.addEventListener('pointermove', (e) => {
    if (compareDragging) compareMoveTo(e.clientX);
  });
  compareFrame.addEventListener('pointerup', () => { compareDragging = false; });
  compareFrame.addEventListener('pointercancel', () => { compareDragging = false; });
}

// Presets & Reset Handlers
function updateSliderValue(slider, textEl, value, suffix = '') {
  slider.value = value;
  textEl.textContent = (value > 0 && (slider.id.includes('brightness') || slider.id.includes('contrast')) ? '+' : '') + value + suffix;
}

function applyPreset(denoise, blockSize, cConstant, simplify, minArea, brightness = 0, contrast = 0, morphClean = 0) {
  updateSliderValue(sliderDenoise, valDenoise, denoise);
  updateSliderValue(sliderBlocksize, valBlocksize, blockSize);
  updateSliderValue(sliderCConstant, valCConstant, cConstant);
  updateSliderValue(sliderSimplify, valSimplify, simplify.toFixed(1) + ' px');
  sliderSimplify.value = simplify;
  updateSliderValue(sliderMinArea, valMinArea, minArea, ' px');
  updateSliderValue(sliderBrightness, valBrightness, brightness);
  updateSliderValue(sliderContrast, valContrast, contrast);
  updateSliderValue(sliderMorphClean, valMorphClean, morphClean);
  checkboxInvertBinary.checked = false; // Reset color inversion to default
  triggerProcessing();
}

btnPresetPhoto.addEventListener('click', () => {
  // Higher Min Area (80) filters out texture noise (clothing patterns, shadows) common in photos.
  applyPreset(8, 19, 4, 1.2, 80, 0, 0, 1);
});

btnPresetDigital.addEventListener('click', () => {
  applyPreset(0, 7, 2, 0.6, 10, 0, 0, 0);
});

btnResetDefaults.addEventListener('click', () => {
  applyPreset(5, 11, 2, 1.0, 15, 0, 0);
  checkboxEnableSize.checked = true;
  sizeInputsWrapper.classList.remove('disabled-controls');
  inputPhysWidth.value = 150;
  checkboxInvertBinary.checked = false;
  sliderWhiteCutoff.value = 255;
  valWhiteCutoff.textContent = '關閉';
  updatePhysicalHeight();
  resetZoomAndPan();
});

function triggerProcessing() {
  if (!originalFile) return;
  
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  
  // Debounce processing to keep sliding inputs buttery smooth
  debounceTimeout = setTimeout(() => {
    processImage();
  }, 120);
}

// 5. Image Processing and Vectorization Engine (Web Worker based)
function processImage() {
  if (!originalFile || !isWorkerReady) return;

  const width = imgElement.naturalWidth;
  const height = imgElement.naturalHeight;
  if (width === 0 || height === 0) return;

  // Set stats resolution
  statResolution.textContent = `${width} x ${height}`;

  // Draw image to an offscreen canvas to retrieve raw pixel buffer
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(imgElement, 0, 0);
  const imgData = tempCtx.getImageData(0, 0, width, height);

  // Apply magic-wand background removal mask (masked pixels forced to white)
  if (bgMask && bgMask.length === width * height) {
    const d = imgData.data;
    for (let i = 0; i < bgMask.length; i++) {
      if (bgMask[i]) {
        const j = i * 4;
        d[j] = 255; d[j + 1] = 255; d[j + 2] = 255; d[j + 3] = 255;
      }
    }
  }

  // Extract all slider/configuration values
  const denoise = sliderDenoise.value;
  const blocksize = sliderBlocksize.value;
  const cConstant = sliderCConstant.value;
  const simplify = sliderSimplify.value;
  const minArea = sliderMinArea.value;
  const morphClean = sliderMorphClean.value;
  const brightness = sliderBrightness.value;
  const contrast = sliderContrast.value;
  const whiteCutoff = sliderWhiteCutoff.value;
  const invert = checkboxInvertBinary.checked;
  const smooth = checkboxSmooth.checked;

  let svgColor = '#ff0000';
  for (const radio of colorRadios) {
    if (radio.checked) {
      svgColor = radio.value;
      break;
    }
  }

  let renderMode = 'stroke';
  for (const radio of renderModeRadios) {
    if (radio.checked) {
      renderMode = radio.value;
      break;
    }
  }

  let cutMode = 'outline';
  for (const radio of cutModeRadios) {
    if (radio.checked) {
      cutMode = radio.value;
      break;
    }
  }

  let layerMode = 'single';
  const layerModeRadios = document.getElementsByName('layer-mode');
  for (const radio of layerModeRadios) {
    if (radio.checked) {
      layerMode = radio.value;
      break;
    }
  }

  const params = {
    denoise,
    blocksize,
    cConstant,
    simplify,
    minArea,
    morphClean,
    brightness,
    contrast,
    whiteCutoff,
    invert,
    smooth,
    svgColor,
    renderMode,
    cutMode,
    layerMode
  };

  // Adjust preview canvas size
  if (outputCanvas.width !== width || outputCanvas.height !== height) {
    outputCanvas.width = width;
    outputCanvas.height = height;
  }

  // Transfer array buffer slice to Web Worker to avoid clone delay
  const buffer = imgData.data.buffer.slice(0);
  imageWorker.postMessage({
    type: 'process',
    width,
    height,
    imageDataBuffer: buffer,
    params
  }, [buffer]);
}

function onProcessingFinished(outBuffer, pathsSvgHtml, pathsCount, totalNodes) {
  const width = imgElement.naturalWidth;
  const height = imgElement.naturalHeight;

  // Render binary output matrix on canvas
  const ctx = outputCanvas.getContext('2d');
  const outImgData = new ImageData(
    new Uint8ClampedArray(outBuffer),
    width,
    height
  );
  ctx.putImageData(outImgData, 0, 0);

  // Compile final SVG document
  let svgWidthAttr = width;
  let svgHeightAttr = height;
  if (checkboxEnableSize.checked) {
    const physW = parseFloat(inputPhysWidth.value) || 0;
    const physH = parseFloat(inputPhysHeight.value) || 0;
    if (physW > 0 && physH > 0) {
      svgWidthAttr = `${physW}mm`;
      svgHeightAttr = `${physH.toFixed(2)}mm`;
    }
  }

  const svgFooter = '</svg>';
  // Download version keeps the physical (mm) size when enabled
  const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${svgWidthAttr}" height="${svgHeightAttr}" style="aspect-ratio: ${width} / ${height};">\n`;
  lastSvgContent = svgHeader + pathsSvgHtml + svgFooter;

  // Preview version always uses PIXEL dimensions so it renders at exactly the
  // same displayed scale as the point-bitmap canvas (which is in px). Using the
  // mm size here would make the two previews mismatch in size.
  const previewHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
  const previewSvgContent = previewHeader + pathsSvgHtml + svgFooter;

  // Render SVG image Blob URL dynamically
  if (svgPreview.src && svgPreview.src.startsWith('blob:')) {
    URL.revokeObjectURL(svgPreview.src);
  }
  const blob = new Blob([previewSvgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  svgPreview.src = url;

  // Match the canvas: let CSS (object-fit) size it; keep the natural ratio
  svgPreview.style.width = '';
  svgPreview.style.height = '';
  svgPreview.setAttribute('width', width);
  svgPreview.setAttribute('height', height);
  svgPreview.classList.remove('hidden');

  // Display zoom instruction overlay
  if (svgZoomIndicator) {
    svgZoomIndicator.classList.remove('hidden');
  }

  // Update dynamic stats board
  statContours.textContent = pathsCount;
  statNodes.textContent = totalNodes;

  // Enable the before/after compare tool now that we have output
  const compareBtn = document.getElementById('btn-compare-toggle');
  if (compareBtn) compareBtn.disabled = false;
  const magicBtn = document.getElementById('btn-magic-toggle');
  if (magicBtn) magicBtn.disabled = false;
  // Keep the comparison overlay in sync if it is currently open
  if (typeof compareActive !== 'undefined' && compareActive) {
    refreshCompareImages();
  }
}

// Theme Toggle Logic
const btnThemeToggle = document.getElementById('btn-theme-toggle');
if (btnThemeToggle) {
  const appContainer = document.querySelector('.app-container');
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  
  // Default to light mode
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    appContainer.classList.add('dark-theme');
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  } else {
    appContainer.classList.remove('dark-theme');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  }

  btnThemeToggle.addEventListener('click', () => {
    if (appContainer.classList.contains('dark-theme')) {
      appContainer.classList.remove('dark-theme');
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
      localStorage.setItem('theme', 'light');
    } else {
      appContainer.classList.add('dark-theme');
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
      localStorage.setItem('theme', 'dark');
    }
  });
}

// Onboarding Sample Images click events
const btnSample1 = document.getElementById('btn-sample-1');
const btnSample2 = document.getElementById('btn-sample-2');

async function loadSampleImage(url, fileName) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });
    handleImageFile(file);
  } catch (error) {
    console.error('載入樣品圖片失敗:', error);
    alert('載入樣品圖片失敗，請嘗試手動上傳。');
  }
}

if (btnSample1) {
  btnSample1.addEventListener('click', () => {
    loadSampleImage('/sample_sketch.png', 'sample_sketch.png');
  });
}

if (btnSample2) {
  btnSample2.addEventListener('click', () => {
    loadSampleImage('/sample_digital.png', 'sample_digital.png');
  });
}

// Settings card tabs switching logic
const tabTriggers = document.querySelectorAll('.tab-trigger');
const tabContents = document.querySelectorAll('.settings-tab-content');

tabTriggers.forEach(trigger => {
  trigger.addEventListener('click', () => {
    const targetTabId = trigger.getAttribute('data-tab');
    
    // Deactivate all triggers and activate current
    tabTriggers.forEach(t => t.classList.remove('active'));
    trigger.classList.add('active');
    
    // Hide all tab contents and show current
    tabContents.forEach(content => {
      if (content.id === targetTabId) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  });
});

// ----------------------------------------------------
// Magic-wand background removal
// ----------------------------------------------------
function cacheOriginalPixels() {
  const w = imgElement.naturalWidth, h = imgElement.naturalHeight;
  if (!w || !h) { origImageData = null; return; }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(imgElement, 0, 0);
  origImageData = cx.getImageData(0, 0, w, h);
}

const btnMagicToggle = document.getElementById('btn-magic-toggle');
const magicLayer = document.getElementById('magic-layer');
const magicCanvas = document.getElementById('magic-canvas');
const sliderMagicTol = document.getElementById('slider-magic-tol');
const valMagicTol = document.getElementById('val-magic-tol');
const btnMagicUndo = document.getElementById('btn-magic-undo');
const btnMagicDone = document.getElementById('btn-magic-done');
let magicActive = false;

// Paint the original image with masked pixels tinted red (marked for removal)
function renderMagicCanvas() {
  if (!origImageData || !bgMask) return;
  const w = origImageData.width, h = origImageData.height;
  const ctx = magicCanvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  img.data.set(origImageData.data);
  const d = img.data;
  for (let i = 0; i < bgMask.length; i++) {
    if (bgMask[i]) {
      const j = i * 4;
      d[j] = 255; d[j + 1] = 90; d[j + 2] = 90; d[j + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Flood fill from (sx,sy) over pixels within colour tolerance of the seed
function magicFloodFill(sx, sy, tol) {
  const w = origImageData.width, h = origImageData.height;
  const data = origImageData.data;
  const seedP = (sy * w + sx);
  const s = seedP * 4;
  const sr = data[s], sg = data[s + 1], sb = data[s + 2];
  const visited = new Uint8Array(w * h);
  const stack = [seedP];
  visited[seedP] = 1;
  while (stack.length) {
    const p = stack.pop();
    const q = p * 4;
    const dr = Math.abs(data[q] - sr);
    const dg = Math.abs(data[q + 1] - sg);
    const db = Math.abs(data[q + 2] - sb);
    if (Math.max(dr, dg, db) > tol) continue;
    bgMask[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x > 0 && !visited[p - 1]) { visited[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1 && !visited[p + 1]) { visited[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !visited[p - w]) { visited[p - w] = 1; stack.push(p - w); }
    if (y < h - 1 && !visited[p + w]) { visited[p + w] = 1; stack.push(p + w); }
  }
}

function openMagic() {
  if (!originalFile || !origImageData) return;
  if (typeof compareActive !== 'undefined' && compareActive) closeCompare();
  magicActive = true;
  const w = origImageData.width, h = origImageData.height;
  if (!bgMask || bgMask.length !== w * h) bgMask = new Uint8Array(w * h);
  magicCanvas.width = w;
  magicCanvas.height = h;
  renderMagicCanvas();
  magicLayer.classList.remove('hidden');
  btnMagicToggle.classList.add('active');
}

function closeMagic() {
  magicActive = false;
  magicLayer.classList.add('hidden');
  btnMagicToggle.classList.remove('active');
}

if (btnMagicToggle) {
  btnMagicToggle.addEventListener('click', () => {
    if (magicActive) closeMagic();
    else openMagic();
  });
}

if (magicCanvas) {
  magicCanvas.addEventListener('click', (e) => {
    if (!magicActive || !origImageData) return;
    const rect = magicCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.floor((e.clientX - rect.left) / rect.width * origImageData.width);
    const y = Math.floor((e.clientY - rect.top) / rect.height * origImageData.height);
    if (x < 0 || y < 0 || x >= origImageData.width || y >= origImageData.height) return;
    magicFloodFill(x, y, parseInt(sliderMagicTol.value));
    renderMagicCanvas();
    triggerProcessing();
  });
}

if (sliderMagicTol) {
  sliderMagicTol.addEventListener('input', (e) => { valMagicTol.textContent = e.target.value; });
}

if (btnMagicUndo) {
  btnMagicUndo.addEventListener('click', () => {
    if (bgMask) bgMask.fill(0);
    renderMagicCanvas();
    triggerProcessing();
  });
}

if (btnMagicDone) {
  btnMagicDone.addEventListener('click', () => closeMagic());
}

// ----------------------------------------------------
// Help / Tips modal
// ----------------------------------------------------
const btnHelp = document.getElementById('btn-help');
const helpModal = document.getElementById('help-modal');
const btnHelpClose = document.getElementById('btn-help-close');
const helpBackdrop = document.getElementById('help-backdrop');

if (btnHelp) btnHelp.addEventListener('click', () => helpModal.classList.remove('hidden'));
if (btnHelpClose) btnHelpClose.addEventListener('click', () => helpModal.classList.add('hidden'));
if (helpBackdrop) helpBackdrop.addEventListener('click', () => helpModal.classList.add('hidden'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && helpModal && !helpModal.classList.contains('hidden')) {
    helpModal.classList.add('hidden');
  }
});

// OpenCV.js is managed inside the Web Worker automatically
