// ----------------------------------------------------
// VectorLine - Main Application Logic
// ----------------------------------------------------

let imgElement = document.createElement('img');
let originalFile = null;
let debounceTimeout = null;
let activeTab = 'binary'; // 'binary' or 'svg'
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

// Color choice
const colorRadios = document.getElementsByName('svg-color');

// Cut mode choice
const cutModeRadios = document.getElementsByName('cut-mode');

// Actions
const btnDownloadSvg = document.getElementById('btn-download-svg');
const btnDownloadPng = document.getElementById('btn-download-png');
const btnPresetPhoto = document.getElementById('btn-preset-photo');
const btnPresetDigital = document.getElementById('btn-preset-digital');
const btnResetDefaults = document.getElementById('btn-reset-defaults');

// Tabs
const tabBinary = document.getElementById('tab-binary');
const tabSvg = document.getElementById('tab-svg');
const contentBinary = document.getElementById('content-binary');
const contentSvg = document.getElementById('content-svg');
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

// 3. Tab navigation switcher
tabBinary.addEventListener('click', () => {
  activeTab = 'binary';
  tabBinary.classList.add('active');
  tabSvg.classList.remove('active');
  contentBinary.classList.remove('hidden');
  contentSvg.classList.add('hidden');
});

tabSvg.addEventListener('click', () => {
  activeTab = 'svg';
  tabSvg.classList.add('active');
  tabBinary.classList.remove('active');
  contentSvg.classList.remove('hidden');
  contentBinary.classList.add('hidden');
});

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
  valSimplify.textContent = parseFloat(e.target.value).toFixed(1) + '%';
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
  updateSliderValue(sliderSimplify, valSimplify, simplify.toFixed(1) + '%');
  sliderSimplify.value = simplify;
  updateSliderValue(sliderMinArea, valMinArea, minArea, ' px');
  updateSliderValue(sliderBrightness, valBrightness, brightness);
  updateSliderValue(sliderContrast, valContrast, contrast);
  updateSliderValue(sliderMorphClean, valMorphClean, morphClean);
  checkboxInvertBinary.checked = false; // Reset color inversion to default
  triggerProcessing();
}

btnPresetPhoto.addEventListener('click', () => {
  applyPreset(8, 19, 4, 1.2, 30, 0, 0, 1);
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

    // 5.4 Extract Vector Contours
    // Use RETR_LIST (not RETR_EXTERNAL) so interior detail is preserved: RETR_EXTERNAL
    // keeps only the outermost silhouette of each connected mass, discarding all inner
    // lines (faces, clothing, text). RETR_LIST retrieves every contour so the SVG
    // faithfully reproduces the black/white preview.
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    // 5.5 Vector Optimization and SVG String Generation
    const simplifyVal = parseFloat(sliderSimplify.value) / 100.0;
    const minAreaVal = parseInt(sliderMinArea.value);
    let selectedColor = '#ff0000';
    for (const radio of colorRadios) {
      if (radio.checked) {
        selectedColor = radio.value;
        break;
      }
    }

    let pathsSvgHtml = '';
    let totalNodes = 0;
    let pathsCount = 0;
    const width = src.cols;
    const height = src.rows;

    for (let i = 0; i < contours.size(); ++i) {
      const contour = contours.get(i);
      
      // Calculate contour area to filter small dust/spots
      const area = cv.contourArea(contour);
      if (area < minAreaVal) {
        contour.delete();
        continue;
      }

      // Simplify nodes using Ramer-Douglas-Peucker (approxPolyDP)
      const approx = new cv.Mat();
      const perimeter = cv.arcLength(contour, true);
      const epsilon = simplifyVal * perimeter;
      cv.approxPolyDP(contour, approx, epsilon, true);

      if (approx.rows >= 2) {
        pathsCount++;
        totalNodes += approx.rows;
        
        let pathData = [];
        for (let j = 0; j < approx.rows; ++j) {
          const x = approx.data32S[j * 2];
          const y = approx.data32S[j * 2 + 1];
          if (j === 0) {
            pathData.push(`M ${x} ${y}`);
          } else {
            pathData.push(`L ${x} ${y}`);
          }
        }
        pathData.push('Z'); // Close the vector loop
        
        const pathStr = pathData.join(' ');
        // We set stroke-width suitable for laser cutting software (hairline width)
        pathsSvgHtml += `  <path d="${pathStr}" fill="none" stroke="${selectedColor}" stroke-width="1" />\n`;
      }
      
      approx.delete();
      contour.delete();
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

// Start OpenCV load check
checkOpenCVReady();
