// ----------------------------------------------------
// VectorLine - Main Application Logic
// ----------------------------------------------------

let imgElement = document.createElement('img');
let originalFile = null;
let debounceTimeout = null;
let lastSvgContent = ''; // For downloading

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

// 1. OpenCV.js loading orchestration
let openCVInitialized = false;

function checkOpenCVReady() {
  if (window.opencvReady && typeof cv !== 'undefined' && cv.Mat) {
    onOpenCVLoaded();
    return;
  }

  document.addEventListener('opencv-ready', onOpenCVLoaded);

  // Robust fallback: some builds signal readiness differently, so poll until the
  // cv runtime is actually usable rather than trusting a single timed check.
  const startTime = Date.now();
  const poll = setInterval(() => {
    if (typeof cv !== 'undefined' && cv.Mat) {
      clearInterval(poll);
      window.opencvReady = true;
      onOpenCVLoaded();
    } else if (Date.now() - startTime > 30000) {
      clearInterval(poll);
      const loadingText = document.getElementById('loading-text');
      if (loadingText) {
        loadingText.textContent = 'OpenCV.js 載入逾時，請檢查網路連線後重新整理頁面。';
      }
    }
  }, 300);
}

function onOpenCVLoaded() {
  if (openCVInitialized) return;
  openCVInitialized = true;
  console.log("OpenCV.js successfully loaded into UI.");
  loadingScreen.classList.add('fade-out');
  // Enable drag and drop functionality
  setupDragAndDrop();
  // Initialize SVG zoom & pan
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

// Interactive SVG Pan & Zoom State
let zoomScale = 1.0;
let panOffsetX = 0;
let panOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

function applyZoomAndPan(transition = false) {
  if (!svgPreview) return;
  svgPreview.style.transition = transition ? 'transform 0.25s ease-out' : 'none';
  svgPreview.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoomScale})`;
}

function resetZoomAndPan() {
  zoomScale = 1.0;
  panOffsetX = 0;
  panOffsetY = 0;
  applyZoomAndPan(true);
}

function initZoomAndPanEvents() {
  const wrapper = document.getElementById('svg-preview-wrapper');
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
  
  // Mouse Move - Drag Pan
  window.addEventListener('mousemove', (e) => {
    if (!isPanning || !originalFile) return;
    panOffsetX = e.clientX - panStartX;
    panOffsetY = e.clientY - panStartY;
    applyZoomAndPan(false);
  });
  
  // Mouse Up - End Pan
  window.addEventListener('mouseup', () => {
    isPanning = false;
  });
  
  // Double click to Reset View
  wrapper.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (!originalFile) return;
    resetZoomAndPan();
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

// ---- Vector path helpers (skeleton tracing, simplification, smoothing) ----

// Trace a 1px skeleton bitmap (white lines on black) into open polylines. Used for the
// true single-line centerline output so the laser follows the middle of each stroke once.
function traceSkeleton(mat) {
  const cols = mat.cols, rows = mat.rows;
  const data = mat.data; // Uint8Array, 0 or 255
  const visited = new Uint8Array(cols * rows);
  const idx = (x, y) => y * cols + x;
  const isLine = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && data[idx(x, y)] > 0;
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

  function countNeighbors(x, y) {
    let c = 0;
    for (const [dx, dy] of offsets) if (isLine(x + dx, y + dy)) c++;
    return c;
  }
  function walk(sx, sy) {
    const pts = [[sx, sy]];
    visited[idx(sx, sy)] = 1;
    let x = sx, y = sy;
    while (true) {
      let next = null;
      for (const [dx, dy] of offsets) {
        const nx = x + dx, ny = y + dy;
        if (isLine(nx, ny) && !visited[idx(nx, ny)]) { next = [nx, ny]; break; }
      }
      if (!next) break;
      visited[idx(next[0], next[1])] = 1;
      pts.push(next);
      x = next[0]; y = next[1];
    }
    return pts;
  }

  const polylines = [];
  // Pass 1: start from stroke endpoints (exactly one neighbour) so lines trace end-to-end.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isLine(x, y) && !visited[idx(x, y)] && countNeighbors(x, y) === 1) {
        polylines.push(walk(x, y));
      }
    }
  }
  // Pass 2: trace remaining pixels (closed loops / leftover junction branches).
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isLine(x, y) && !visited[idx(x, y)]) {
        polylines.push(walk(x, y));
      }
    }
  }
  return polylines;
}

// Ramer–Douglas–Peucker simplification for a plain [[x,y], ...] array (used for centerlines,
// mirroring cv.approxPolyDP which we use for closed contours). epsilon in pixels; 0 = off.
function rdpSimplify(points, epsilon) {
  if (epsilon <= 0 || points.length < 3) return points;
  const sqSegDist = (p, a, b) => {
    let dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
      if (t > 1) { return (p[0] - b[0]) ** 2 + (p[1] - b[1]) ** 2; }
      if (t > 0) { dx = p[0] - (a[0] + t * dx); dy = p[1] - (a[1] + t * dy); return dx * dx + dy * dy; }
    }
    return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
  };
  const eps2 = epsilon * epsilon;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0, index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i], points[first], points[last]);
      if (d > maxD) { maxD = d; index = i; }
    }
    if (maxD > eps2 && index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

// Convert a point array to an SVG path 'd' string. When smooth is on, render Catmull-Rom
// cubic Béziers passing through every node; otherwise straight line segments.
function pointsToPathD(pts, closed, smooth) {
  const n = pts.length;
  if (n < 2) return '';
  if (!smooth || n < 3) {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < n; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    if (closed) d += ' Z';
    return d;
  }
  const at = (i) => closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  if (closed) d += ' Z';
  return d;
}

// 5. Image Processing and Vectorization Engine (OpenCV.js based)
function processImage() {
  if (typeof cv === 'undefined' || !cv.Mat) {
    console.error("OpenCV.js is not loaded yet.");
    return;
  }

  // Set stats resolution
  statResolution.textContent = `${imgElement.naturalWidth} x ${imgElement.naturalHeight}`;

  // Mats declaration (for memory safety management)
  let src = null;
  let gray = null;
  let blurred = null;
  let binary = null;
  let contours = null;
  let hierarchy = null;

  try {
    // 5.1 Read image into Mat
    src = cv.imread(imgElement);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 5.1.5 Brightness and Contrast Adjustment
    const brightness = parseInt(sliderBrightness.value);
    const contrast = parseInt(sliderContrast.value);
    if (brightness !== 0 || contrast !== 0) {
      let alpha = 1.0;
      if (contrast > 0) {
        alpha = 1.0 + (contrast / 100.0) * 2.0; // scale up contrast
      } else if (contrast < 0) {
        alpha = 1.0 + (contrast / 100.0); // scale down contrast
      }
      let beta = brightness;
      gray.convertTo(gray, -1, alpha, beta);
    }

    // 5.2 Denoise filter
    blurred = new cv.Mat();
    const denoiseVal = parseInt(sliderDenoise.value);
    if (denoiseVal > 0) {
      // Gaussian Blur works very fast and effectively for paper texture cleanup
      const ksize = new cv.Size(denoiseVal * 2 + 1, denoiseVal * 2 + 1);
      cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);
    } else {
      gray.copyTo(blurred);
    }

    // 5.3 Adaptive Thresholding (Creates high contrast black/white line lines)
    binary = new cv.Mat();
    let blockSize = parseInt(sliderBlocksize.value);
    if (blockSize % 2 === 0) blockSize += 1;
    if (blockSize < 3) blockSize = 3;
    const cVal = parseInt(sliderCConstant.value);
    
    const threshType = checkboxInvertBinary.checked ? cv.THRESH_BINARY : cv.THRESH_BINARY_INV;
    cv.adaptiveThreshold(
      blurred,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      threshType,
      blockSize,
      cVal
    );

    // 5.3.3 Morphological Cleanup (opening removes small noise, closing fills gaps)
    const morphCleanVal = parseInt(sliderMorphClean.value);
    if (morphCleanVal > 0) {
      let morphElement = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(morphCleanVal * 2 + 1, morphCleanVal * 2 + 1));
      // Opening: erode then dilate → removes small white noise dots
      cv.morphologyEx(binary, binary, cv.MORPH_OPEN, morphElement);
      // Closing: dilate then erode → fills small black holes/gaps in lines
      cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, morphElement);
      morphElement.delete();
    }

    // 5.3.5 Cut Mode selection & Skeletonization / Canny
    let selectedMode = 'outline';
    for (const radio of cutModeRadios) {
      if (radio.checked) {
        selectedMode = radio.value;
        break;
      }
    }

    if (selectedMode === 'canny') {
      // Canny Edge Detection mode: produces clean sketch-like edges from photos
      let edges = new cv.Mat();
      // Use blurred grayscale for cleaner edges
      const cannyLow = 50;
      const cannyHigh = 150;
      cv.Canny(blurred, edges, cannyLow, cannyHigh, 3, false);
      
      // Apply morphological cleanup to Canny output if enabled
      if (morphCleanVal > 0) {
        let cannyMorphElement = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(morphCleanVal * 2 + 1, morphCleanVal * 2 + 1));
        cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, cannyMorphElement);
        cannyMorphElement.delete();
      }
      
      edges.copyTo(binary);
      edges.delete();
    } else if (selectedMode === 'centerline') {
      // Morphological Thinning / Skeletonization
      let skel = cv.Mat.zeros(binary.rows, binary.cols, cv.CV_8UC1);
      let temp = new cv.Mat();
      let eroded = new cv.Mat();
      let element = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3));
      let done = false;
      let iterations = 0;
      const maxIterations = 50; // Cap iterations to prevent performance lags

      let working = binary.clone();

      while (!done && iterations < maxIterations) {
        cv.erode(working, eroded, element);
        cv.dilate(eroded, temp, element);
        cv.subtract(working, temp, temp);
        cv.bitwise_or(skel, temp, skel);
        eroded.copyTo(working);
        
        if (cv.countNonZero(working) === 0) {
          done = true;
        }
        iterations++;
      }

      skel.copyTo(binary);

      // Clean up local temp Mats
      working.delete();
      skel.delete();
      temp.delete();
      eroded.delete();
      element.delete();
    }

    // Render binary lines output on the preview canvas (always show as black lines on a white background)
    let displayMat = new cv.Mat();
    cv.bitwise_not(binary, displayMat);
    cv.imshow('output-canvas', displayMat);
    displayMat.delete();

    // 5.4 / 5.5 Vector extraction, optimization and SVG generation.
    // Absolute pixel tolerance (NOT perimeter-relative): a percentage-of-perimeter
    // epsilon over-simplifies large contours — the huge outer contour of a dense
    // sketch would collapse into long straight chords slashing across the image.
    const simplifyVal = parseFloat(sliderSimplify.value);
    const minAreaVal = parseInt(sliderMinArea.value);
    const smoothMode = checkboxSmooth.checked;
    let selectedColor = '#ff0000';
    for (const radio of colorRadios) {
      if (radio.checked) {
        selectedColor = radio.value;
        break;
      }
    }

    // Fill mode fills solid regions (matches the B/W preview, good for engraving);
    // stroke mode keeps hairline outlines (good for cutting). Read the current choice.
    let fillMode = false;
    for (const radio of renderModeRadios) {
      if (radio.checked) {
        fillMode = radio.value === 'fill';
        break;
      }
    }

    // Centerline outputs open single-line polylines, which have no area to fill —
    // force stroke rendering so the fill toggle can't produce an empty result there.
    const isCenterline = selectedMode === 'centerline';
    const useFill = fillMode && !isCenterline;

    const width = src.cols;
    const height = src.rows;
    let paths = []; // each: { pts: [[x,y], ...], closed: boolean }
    let totalNodes = 0;

    if (isCenterline) {
      // True single centerline: trace the 1px skeleton into open polylines (one per
      // stroke) instead of tracing around it (which would double every line). Filter
      // by length — a zero-area line would always fail the area test — then simplify.
      const minLen = Math.max(2, Math.round(minAreaVal / 5));
      const polylines = traceSkeleton(binary);
      for (const poly of polylines) {
        if (poly.length < minLen) continue;
        const simplified = rdpSimplify(poly, simplifyVal);
        if (simplified.length >= 2) {
          paths.push({ pts: simplified, closed: false });
          totalNodes += simplified.length;
        }
      }
    } else {
      // Outline / Canny: trace closed contours. RETR_LIST keeps interior detail
      // (RETR_EXTERNAL would drop everything but the outer silhouette).
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        if (cv.contourArea(contour) < minAreaVal) {
          contour.delete();
          continue;
        }
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, simplifyVal, true);
        if (approx.rows >= 2) {
          const pts = [];
          for (let j = 0; j < approx.rows; ++j) {
            pts.push([approx.data32S[j * 2], approx.data32S[j * 2 + 1]]);
          }
          paths.push({ pts, closed: true });
          totalNodes += approx.rows;
        }
        approx.delete();
        contour.delete();
      }
    }

    const pathsCount = paths.length;

    // Build SVG. Fill merges closed contours into one fill-rule="evenodd" path so nested
    // contours become holes (solid areas stay solid); stroke draws hairline outlines /
    // centerlines. smoothMode renders Catmull-Rom Bézier curves through the nodes.
    let pathsSvgHtml = '';
    if (useFill) {
      const combined = paths.map(p => pointsToPathD(p.pts, true, smoothMode)).join(' ');
      if (combined) {
        pathsSvgHtml = `  <path d="${combined}" fill="${selectedColor}" fill-rule="evenodd" stroke="none" />\n`;
      }
    } else {
      const combined = paths.map(p => pointsToPathD(p.pts, p.closed, smoothMode)).join(' ');
      if (combined) {
        pathsSvgHtml = `  <path d="${combined}" fill="none" stroke="${selectedColor}" stroke-width="1" />\n`;
      }
    }

    // Wrap in standard SVG format
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

    const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${svgWidthAttr}" height="${svgHeightAttr}" style="aspect-ratio: ${width} / ${height};">\n`;
    const svgFooter = '</svg>';
    lastSvgContent = svgHeader + pathsSvgHtml + svgFooter;

    // Render SVG preview dynamically
    if (svgPreview.src && svgPreview.src.startsWith('blob:')) {
      URL.revokeObjectURL(svgPreview.src); // Clean up memory
    }
    const blob = new Blob([lastSvgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    svgPreview.src = url;
    svgPreview.classList.remove('hidden');
    
    // Show SVG zoom helper instruction
    if (svgZoomIndicator) {
      svgZoomIndicator.classList.remove('hidden');
    }

    // Update dynamic stats board
    statContours.textContent = pathsCount;
    statNodes.textContent = totalNodes;

  } catch (error) {
    console.error("Error processing image in OpenCV.js runtime:", error);
  } finally {
    // 5.6 Crucial memory cleanup of C++ bindings in WebAssembly
    if (src) src.delete();
    if (gray) gray.delete();
    if (blurred) blurred.delete();
    if (binary) binary.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

// Theme Toggle Logic
const btnThemeToggle = document.getElementById('btn-theme-toggle');
if (btnThemeToggle) {
  const appContainer = document.querySelector('.app-container');
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  
  // Default to dark mode
  const savedTheme = localStorage.getItem('theme') || 'dark';
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
    loadSampleImage('/test_input.png', 'test_input.png');
  });
}

if (btnSample2) {
  btnSample2.addEventListener('click', () => {
    loadSampleImage('/test_binary.png', 'test_binary.png');
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

// Start OpenCV load check
checkOpenCVReady();
