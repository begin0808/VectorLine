// processor.worker.js
let opencvReady = false;

// Emscripten runtime hook for Worker environment (MUST be declared BEFORE importScripts!)
self.Module = {
  onRuntimeInitialized: function() {
    opencvReady = true;
    self.postMessage({ type: 'ready' });
  }
};

// Load OpenCV.js WebAssembly runtime locally from the site root
self.importScripts("/opencv.js");

// Safety double check in case script is loaded synchronously or cached
if (typeof cv !== 'undefined' && cv.Mat) {
  opencvReady = true;
  self.postMessage({ type: 'ready' });
}

// Convert a point array to an SVG path 'd' string
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

// Trace 1px skeleton bitmap into open polylines (Laser centerline)
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
  // Pass 1: start from endpoints (1 neighbor)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isLine(x, y) && !visited[idx(x, y)] && countNeighbors(x, y) === 1) {
        polylines.push(walk(x, y));
      }
    }
  }
  // Pass 2: trace closed loops or remaining pixels
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isLine(x, y) && !visited[idx(x, y)]) {
        polylines.push(walk(x, y));
      }
    }
  }
  return polylines;
}

// Ramer–Douglas–Peucker polyline simplification
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

// Main message router
self.onmessage = function(e) {
  const { type, width, height, imageDataBuffer, params } = e.data;
  if (type === 'process') {
    if (!opencvReady) {
      self.postMessage({ type: 'error', message: 'OpenCV is loading, please wait.' });
      return;
    }

    let src = null;
    let gray = null;
    let blurred = null;
    let binary = null;
    let contours = null;
    let hierarchy = null;

    try {
      // Reconstruct matrix from Transferable ArrayBuffer
      src = new cv.Mat(height, width, cv.CV_8UC4);
      src.data.set(new Uint8Array(imageDataBuffer));

      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Brightness and Contrast
      const brightness = parseInt(params.brightness);
      const contrast = parseInt(params.contrast);
      if (brightness !== 0 || contrast !== 0) {
        let alpha = 1.0;
        if (contrast > 0) {
          alpha = 1.0 + (contrast / 100.0) * 2.0;
        } else if (contrast < 0) {
          alpha = 1.0 + (contrast / 100.0);
        }
        let beta = brightness;
        gray.convertTo(gray, -1, alpha, beta);
      }

      // Denoise (Gaussian Blur)
      blurred = new cv.Mat();
      const denoiseVal = parseInt(params.denoise);
      if (denoiseVal > 0) {
        const ksize = new cv.Size(denoiseVal * 2 + 1, denoiseVal * 2 + 1);
        cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);
      } else {
        gray.copyTo(blurred);
      }

      // Adaptive Thresholding
      binary = new cv.Mat();
      let blockSize = parseInt(params.blocksize);
      if (blockSize % 2 === 0) blockSize += 1;
      if (blockSize < 3) blockSize = 3;
      const cVal = parseInt(params.cConstant);
      
      const threshType = params.invert ? cv.THRESH_BINARY : cv.THRESH_BINARY_INV;
      cv.adaptiveThreshold(
        blurred,
        binary,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        threshType,
        blockSize,
        cVal
      );

      // Morphology
      const morphCleanVal = parseInt(params.morphClean);
      if (morphCleanVal > 0) {
        let morphElement = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(morphCleanVal * 2 + 1, morphCleanVal * 2 + 1));
        cv.morphologyEx(binary, binary, cv.MORPH_OPEN, morphElement);
        cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, morphElement);
        morphElement.delete();
      }

      // Cut Mode
      const selectedMode = params.cutMode;
      if (selectedMode === 'canny') {
        let edges = new cv.Mat();
        cv.Canny(blurred, edges, 50, 150, 3, false);
        if (morphCleanVal > 0) {
          let cannyMorphElement = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(morphCleanVal * 2 + 1, morphCleanVal * 2 + 1));
          cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, cannyMorphElement);
          cannyMorphElement.delete();
        }
        edges.copyTo(binary);
        edges.delete();
      } else if (selectedMode === 'centerline') {
        let skel = cv.Mat.zeros(binary.rows, binary.cols, cv.CV_8UC1);
        let temp = new cv.Mat();
        let eroded = new cv.Mat();
        let element = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3));
        let done = false;
        let iterations = 0;
        const maxIterations = 50;

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
        working.delete();
        skel.delete();
        temp.delete();
        eroded.delete();
        element.delete();
      }

      // Binarized Canvas output preparation (bitwise_not so lines are drawn black on white background)
      let displayMat = new cv.Mat();
      cv.bitwise_not(binary, displayMat);
      
      let displayMatRGBA = new cv.Mat();
      cv.cvtColor(displayMat, displayMatRGBA, cv.COLOR_GRAY2RGBA);
      
      // Copy binary pixel buffer for main thread Canvas draw
      const outBuffer = new Uint8ClampedArray(displayMatRGBA.data).buffer;
      displayMat.delete();
      displayMatRGBA.delete();

      // Vectorization parameters
      const simplifyVal = parseFloat(params.simplify);
      const minAreaVal = parseInt(params.minArea);
      const smoothMode = params.smooth;
      const selectedColor = params.svgColor;
      const fillMode = params.renderMode === 'fill';
      const layerMode = params.layerMode; // 'single' or 'auto-layer'

      const isCenterline = selectedMode === 'centerline';
      // Force stroke mode (useFill = false) in auto-layer mode to prevent weird filled blobs
      const useFill = fillMode && !isCenterline && (layerMode !== 'auto-layer');

      let paths = []; // each: { pts, closed, isExternal, area, childIdx }
      let totalNodes = 0;

      if (isCenterline) {
        const minLen = Math.max(2, Math.round(minAreaVal / 5));
        const polylines = traceSkeleton(binary);
        for (const poly of polylines) {
          if (poly.length < minLen) continue;
          const simplified = rdpSimplify(poly, simplifyVal);
          if (simplified.length >= 2) {
            paths.push({ pts: simplified, closed: false, isExternal: true, area: 0, childIdx: -1 });
            totalNodes += simplified.length;
          }
        }
      } else {
        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        
        // RETR_CCOMP is needed to get 2-level hierarchy: outermost contours (index 3 parent = -1) and inner holes
        cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        
        for (let i = 0; i < contours.size(); ++i) {
          const contour = contours.get(i);
          const area = cv.contourArea(contour);
          if (area < minAreaVal) {
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
            
            // Check hierarchy array
            // hierarchy.data32S[i * 4 + 2] stores the child contour index (first_child)
            // hierarchy.data32S[i * 4 + 3] stores the parent contour index (parent)
            const childIdx = hierarchy.data32S[i * 4 + 2];
            const parentIdx = hierarchy.data32S[i * 4 + 3];
            const isExternal = (parentIdx === -1);
            
            paths.push({ pts, closed: true, isExternal, area, childIdx });
            totalNodes += approx.rows;
          }
          approx.delete();
          contour.delete();
        }
      }

      const pathsCount = paths.length;

      // Find the index of the path with the largest area (the overall outer frame or largest silhouette)
      let maxAreaIdx = -1;
      let maxArea = -1;
      for (let i = 0; i < paths.length; i++) {
        if (paths[i].area > maxArea) {
          maxArea = paths[i].area;
          maxAreaIdx = i;
        }
      }

      // Build SVG Paths
      let pathsSvgHtml = '';
      if (layerMode === 'auto-layer' && !isCenterline) {
        // Group paths by layer colors (Outer cut-out contours are Red, inner details are Black)
        // Red (Cut): The largest contour OR any external contour that has children inside it
        // Black (Engrave): All other contours (holes, internal details, standalone stroke lines)
        const outerPaths = [];
        const innerPaths = [];
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i];
          const isOuterCut = (i === maxAreaIdx) || (p.isExternal && p.area > maxArea * 0.15);
          if (isOuterCut) {
            outerPaths.push(p);
          } else {
            innerPaths.push(p);
          }
        }

        const outerD = outerPaths.map(p => pointsToPathD(p.pts, p.closed, smoothMode)).join(' ');
        const innerD = innerPaths.map(p => pointsToPathD(p.pts, p.closed, smoothMode)).join(' ');
        if (outerD) {
          pathsSvgHtml += `  <path d="${outerD}" fill="none" stroke="#ff0000" stroke-width="1.5" />\n`;
        }
        if (innerD) {
          pathsSvgHtml += `  <path d="${innerD}" fill="none" stroke="#000000" stroke-width="1" />\n`;
        }
      } else {
        // Single Color Mode
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
      }

      // Return results to the main thread, utilizing Transferable Object for outBuffer
      self.postMessage({
        type: 'result',
        outBuffer,
        pathsSvgHtml,
        pathsCount,
        totalNodes
      }, [outBuffer]);

    } catch (error) {
      self.postMessage({ type: 'error', message: error.toString() });
    } finally {
      if (src) src.delete();
      if (gray) gray.delete();
      if (blurred) blurred.delete();
      if (binary) binary.delete();
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();
    }
  }
};
