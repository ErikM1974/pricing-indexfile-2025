// Design Uploader Component
// Phase 4: Cap Embroidery Modules

import { EventBus } from '../../../core/event-bus';
import { Logger } from '../../../core/logger';
import { StitchCountEstimator } from '../stitch-counter';

/**
 * DesignUploader - Handles design file uploads and analysis
 */
export class DesignUploader {
  constructor(options = {}) {
    this.container = document.querySelector(options.container);
    this.eventBus = options.eventBus || new EventBus();
    this.logger = new Logger('DesignUploader');
    this.stitchEstimator = new StitchCountEstimator();
    
    // Configuration
    this.config = {
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      acceptedFormats: options.acceptedFormats || [
        '.dst', '.pes', '.exp', '.jef', '.vp3', // Embroidery formats
        '.jpg', '.jpeg', '.png', '.svg', '.pdf'  // Image formats
      ],
      allowMultiple: options.allowMultiple || false
    };
    
    // State
    this.uploadedFiles = new Map();
    this.analyzedDesigns = new Map();
    
    // Callbacks
    this.onUpload = options.onUpload || (() => {});
    this.onAnalysis = options.onAnalysis || (() => {});
    this.onError = options.onError || (() => {});
    
    if (this.container) {
      this.render();
      this.attachEvents();
    }
  }
  
  /**
   * Render the uploader UI
   */
  render() {
    this.container.innerHTML = `
      <div class="design-uploader">
        <div class="upload-area" id="upload-drop-zone">
          <input type="file" 
                 id="design-file-input" 
                 class="file-input" 
                 accept="${this.config.acceptedFormats.join(',')}" 
                 ${this.config.allowMultiple ? 'multiple' : ''}>
          
          <label for="design-file-input" class="upload-label">
            <div class="upload-icon">📁</div>
            <div class="upload-text">
              <p class="upload-main-text">Drop design files here or click to browse</p>
              <p class="upload-sub-text">Accepted formats: DST, PES, EXP, JPG, PNG, SVG, PDF</p>
              <p class="upload-size-text">Max file size: 10MB</p>
            </div>
          </label>
        </div>
        
        <div class="uploaded-files" id="uploaded-files-list"></div>
        
        <div class="design-analysis" id="design-analysis" style="display: none;">
          <h3>Design Analysis</h3>
          <div class="analysis-content" id="analysis-content"></div>
        </div>
      </div>
    `;
  }
  
  /**
   * Attach event listeners
   */
  attachEvents() {
    const fileInput = this.container.querySelector('#design-file-input');
    const dropZone = this.container.querySelector('#upload-drop-zone');
    
    // File input change
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });
    
    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      this.handleFiles(e.dataTransfer.files);
    });
    
    // File actions
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-file')) {
        this.removeFile(e.target.dataset.fileId);
      } else if (e.target.classList.contains('analyze-file')) {
        this.analyzeFile(e.target.dataset.fileId);
      }
    });
  }
  
  /**
   * Handle file selection
   * @private
   */
  async handleFiles(files) {
    for (const file of files) {
      if (this.validateFile(file)) {
        await this.uploadFile(file);
      }
    }
  }
  
  /**
   * Validate file
   * @private
   */
  validateFile(file) {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      this.showError(`File "${file.name}" exceeds maximum size of 10MB`);
      return false;
    }
    
    // Check file format
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!this.config.acceptedFormats.includes(extension)) {
      this.showError(`File "${file.name}" has unsupported format`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Upload and process file
   * @private
   */
  async uploadFile(file) {
    const fileId = this.generateFileId();
    const fileInfo = {
      id: fileId,
      file: file,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: Date.now(),
      status: 'processing'
    };
    
    this.uploadedFiles.set(fileId, fileInfo);
    this.updateFileList();
    
    try {
      // Read file content
      const content = await this.readFile(file);
      fileInfo.content = content;
      fileInfo.status = 'uploaded';
      
      // Auto-analyze embroidery files
      const extension = file.name.split('.').pop().toLowerCase();
      if (['dst', 'pes', 'exp', 'jef', 'vp3'].includes(extension)) {
        await this.analyzeFile(fileId);
      }
      
      this.updateFileList();
      this.onUpload(fileInfo);
      
    } catch (error) {
      this.logger.error('File upload failed', error);
      fileInfo.status = 'error';
      fileInfo.error = error.message;
      this.updateFileList();
      this.showError(`Failed to upload ${file.name}`);
    }
  }
  
  /**
   * Read file content
   * @private
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      
      // Read as appropriate type
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }
  
  /**
   * Analyze design file
   * @private
   */
  async analyzeFile(fileId) {
    const fileInfo = this.uploadedFiles.get(fileId);
    if (!fileInfo) return;
    
    this.logger.info('Analyzing file', fileInfo.name);
    
    try {
      let analysis;
      const extension = fileInfo.name.split('.').pop().toLowerCase();
      
      if (['dst', 'pes', 'exp', 'jef', 'vp3'].includes(extension)) {
        // Analyze embroidery file
        analysis = await this.analyzeEmbroideryFile(fileInfo);
      } else if (['jpg', 'jpeg', 'png', 'svg'].includes(extension)) {
        // Analyze image file
        analysis = await this.analyzeImageFile(fileInfo);
      } else {
        analysis = {
          type: 'unknown',
          message: 'File type requires manual analysis'
        };
      }
      
      this.analyzedDesigns.set(fileId, analysis);
      this.displayAnalysis(fileId, analysis);
      this.onAnalysis(fileInfo, analysis);
      
    } catch (error) {
      this.logger.error('File analysis failed', error);
      this.showError(`Failed to analyze ${fileInfo.name}`);
    }
  }
  
  /**
   * Analyze embroidery file format
   * @private
   */
  async analyzeEmbroideryFile(fileInfo) {
    // This would require a proper embroidery file parser
    // For now, return mock data
    return {
      type: 'embroidery',
      format: fileInfo.name.split('.').pop().toUpperCase(),
      stitchCount: Math.floor(Math.random() * 10000) + 3000,
      colorCount: Math.floor(Math.random() * 5) + 1,
      dimensions: {
        width: 3.5,
        height: 2.5,
        units: 'inches'
      },
      colorSequence: ['Red', 'White', 'Blue'],
      estimatedTime: 12, // minutes
      complexity: 'medium'
    };
  }
  
  /**
   * Analyze image file
   * @private
   */
  async analyzeImageFile(fileInfo) {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        // Estimate based on image properties
        const aspectRatio = img.width / img.height;
        const targetWidth = 4; // inches
        const targetHeight = targetWidth / aspectRatio;
        
        // Estimate stitch count from dimensions
        const estimated = this.stitchEstimator.estimateFromDimensions({
          width: targetWidth,
          height: targetHeight,
          fillPercentage: 60,
          hasOutline: true
        });
        
        resolve({
          type: 'image',
          format: fileInfo.type,
          originalDimensions: {
            width: img.width,
            height: img.height,
            units: 'pixels'
          },
          suggestedDimensions: {
            width: targetWidth,
            height: targetHeight,
            units: 'inches'
          },
          estimatedStitchCount: estimated,
          estimatedColors: 3,
          suggestions: [
            'Convert to vector format for better quality',
            'Simplify design to reduce stitch count',
            'Consider using fewer colors'
          ]
        });
      };
      
      img.src = fileInfo.content;
    });
  }
  
  /**
   * Display analysis results
   * @private
   */
  displayAnalysis(fileId, analysis) {
    const analysisSection = this.container.querySelector('#design-analysis');
    const analysisContent = this.container.querySelector('#analysis-content');
    
    analysisSection.style.display = 'block';
    
    if (analysis.type === 'embroidery') {
      analysisContent.innerHTML = `
        <div class="analysis-result">
          <h4>${this.uploadedFiles.get(fileId).name}</h4>
          <div class="analysis-grid">
            <div class="analysis-item">
              <span class="label">Format:</span>
              <span class="value">${analysis.format}</span>
            </div>
            <div class="analysis-item">
              <span class="label">Stitch Count:</span>
              <span class="value">${analysis.stitchCount.toLocaleString()}</span>
            </div>
            <div class="analysis-item">
              <span class="label">Colors:</span>
              <span class="value">${analysis.colorCount}</span>
            </div>
            <div class="analysis-item">
              <span class="label">Size:</span>
              <span class="value">${analysis.dimensions.width}" × ${analysis.dimensions.height}"</span>
            </div>
            <div class="analysis-item">
              <span class="label">Est. Time:</span>
              <span class="value">${analysis.estimatedTime} min</span>
            </div>
            <div class="analysis-item">
              <span class="label">Complexity:</span>
              <span class="value">${analysis.complexity}</span>
            </div>
          </div>
          <div class="color-sequence">
            <span class="label">Color Sequence:</span>
            ${analysis.colorSequence.map(color => 
              `<span class="color-chip" style="background-color: ${color.toLowerCase()};">${color}</span>`
            ).join('')}
          </div>
        </div>
      `;
    } else if (analysis.type === 'image') {
      analysisContent.innerHTML = `
        <div class="analysis-result">
          <h4>${this.uploadedFiles.get(fileId).name}</h4>
          <div class="analysis-grid">
            <div class="analysis-item">
              <span class="label">Original Size:</span>
              <span class="value">${analysis.originalDimensions.width} × ${analysis.originalDimensions.height} px</span>
            </div>
            <div class="analysis-item">
              <span class="label">Suggested Size:</span>
              <span class="value">${analysis.suggestedDimensions.width.toFixed(1)}" × ${analysis.suggestedDimensions.height.toFixed(1)}"</span>
            </div>
            <div class="analysis-item">
              <span class="label">Est. Stitches:</span>
              <span class="value">${analysis.estimatedStitchCount.toLocaleString()}</span>
            </div>
          </div>
          <div class="suggestions">
            <h5>Suggestions:</h5>
            <ul>
              ${analysis.suggestions.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }
  }
  
  /**
   * Update file list display
   * @private
   */
  updateFileList() {
    const filesList = this.container.querySelector('#uploaded-files-list');
    
    if (this.uploadedFiles.size === 0) {
      filesList.innerHTML = '';
      return;
    }
    
    filesList.innerHTML = Array.from(this.uploadedFiles.values()).map(file => `
      <div class="uploaded-file ${file.status}" data-file-id="${file.id}">
        <div class="file-icon">📄</div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${this.formatFileSize(file.size)}</div>
        </div>
        <div class="file-actions">
          ${file.status === 'uploaded' ? `
            <button class="analyze-file" data-file-id="${file.id}">🔍 Analyze</button>
          ` : ''}
          <button class="remove-file" data-file-id="${file.id}">❌</button>
        </div>
        ${file.status === 'processing' ? '<div class="file-progress">Processing...</div>' : ''}
        ${file.status === 'error' ? `<div class="file-error">${file.error}</div>` : ''}
      </div>
    `).join('');
  }
  
  /**
   * Remove uploaded file
   * @private
   */
  removeFile(fileId) {
    this.uploadedFiles.delete(fileId);
    this.analyzedDesigns.delete(fileId);
    this.updateFileList();
    
    // Hide analysis if no files
    if (this.uploadedFiles.size === 0) {
      const analysisSection = this.container.querySelector('#design-analysis');
      analysisSection.style.display = 'none';
    }
  }
  
  /**
   * Format file size for display
   * @private
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  
  /**
   * Generate unique file ID
   * @private
   */
  generateFileId() {
    return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Show error message
   * @private
   */
  showError(message) {
    this.logger.error(message);
    this.onError(message);
    
    // You could also show a toast notification here
    const errorDiv = document.createElement('div');
    errorDiv.className = 'upload-error';
    errorDiv.textContent = message;
    this.container.appendChild(errorDiv);
    
    setTimeout(() => errorDiv.remove(), 5000);
  }
  
  /**
   * Get analyzed designs
   * @returns {Array} Array of analyzed designs
   */
  getAnalyzedDesigns() {
    return Array.from(this.analyzedDesigns.entries()).map(([fileId, analysis]) => ({
      fileId,
      fileInfo: this.uploadedFiles.get(fileId),
      analysis
    }));
  }
  
  /**
   * Clear all uploads
   */
  clearAll() {
    this.uploadedFiles.clear();
    this.analyzedDesigns.clear();
    this.updateFileList();
    
    const analysisSection = this.container.querySelector('#design-analysis');
    analysisSection.style.display = 'none';
  }
}