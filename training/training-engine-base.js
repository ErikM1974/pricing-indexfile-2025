/**
 * Product Training Engine Base
 * Reusable training system for any product type
 * Northwest Custom Apparel - 2025
 */

class ProductTrainingEngine {
    constructor(config) {
        // Validate required config
        if (!config || !config.type || !config.data) {
            throw new Error('ProductTrainingEngine requires config with type and data');
        }
        
        // Core configuration
        this.productType = config.type;           // 'Caps', 'Jackets', etc.
        this.productIcon = config.icon || '📦';   // Default icon if not provided
        this.productData = config.data;           // Array of product objects
        this.scenarios = config.scenarios || [];  // Array of scenario objects
        this.features = config.features || [];    // Product-specific features to highlight
        
        // State management
        this.currentMode = 'study';
        this.currentProductIndex = 0;
        this.currentScenarioIndex = 0;
        this.selectedProduct = null;
        this.scenarioAnswered = false;
        this.correctAnswers = 0;
        this.totalAnswers = 0;
        
        // Storage key unique to product type
        this.storageKey = `training_${this.productType.toLowerCase().replace(/\s+/g, '_')}`;
        
        // Load saved progress
        this.loadProgress();
    }
    
    // Initialize the training interface
    initializeUI(containerId = 'training-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container element '${containerId}' not found`);
            return;
        }
        
        // Set up initial display based on mode
        if (this.currentMode === 'study') {
            this.displayProduct(this.currentProductIndex);
        } else if (this.currentMode === 'scenarios' && this.scenarios.length > 0) {
            this.displayScenario(this.currentScenarioIndex);
        }
        
        this.updateProgress();
    }
    
    // Switch between training modes
    switchMode(modeName) {
        if (!['study', 'scenarios'].includes(modeName)) {
            console.warn(`Invalid mode: ${modeName}`);
            return;
        }
        
        // Check if scenarios exist for this product
        if (modeName === 'scenarios' && this.scenarios.length === 0) {
            alert('No scenarios available for this product type yet.');
            return;
        }
        
        this.currentMode = modeName;
        this.updateUI();
        this.saveProgress();
    }
    
    // Display product in study mode
    displayProduct(index) {
        if (index < 0 || index >= this.productData.length) {
            console.error(`Invalid product index: ${index}`);
            return;
        }
        
        const product = this.productData[index];
        this.currentProductIndex = index;
        
        // Update UI elements - override in specific implementations
        this.updateProductDisplay(product);
        this.updateStudyProgress();
    }
    
    // Display scenario in scenario mode
    displayScenario(index) {
        if (index < 0 || index >= this.scenarios.length) {
            console.error(`Invalid scenario index: ${index}`);
            return;
        }
        
        const scenario = this.scenarios[index];
        this.currentScenarioIndex = index;
        this.scenarioAnswered = false;
        this.selectedProduct = null;
        
        // Update UI elements - override in specific implementations
        this.updateScenarioDisplay(scenario);
    }
    
    // Navigate to next product in study mode
    nextProduct() {
        this.currentProductIndex = (this.currentProductIndex + 1) % this.productData.length;
        this.displayProduct(this.currentProductIndex);
        this.saveProgress();
    }
    
    // Navigate to previous product in study mode
    previousProduct() {
        this.currentProductIndex = (this.currentProductIndex - 1 + this.productData.length) % this.productData.length;
        this.displayProduct(this.currentProductIndex);
        this.saveProgress();
    }
    
    // Select a product in scenario mode
    selectProduct(productId) {
        if (this.scenarioAnswered) return;
        this.selectedProduct = productId;
        this.updateProductSelection(productId);
    }
    
    // Submit answer in scenario mode
    submitScenarioAnswer() {
        if (!this.selectedProduct || this.scenarioAnswered) return;
        
        this.scenarioAnswered = true;
        this.totalAnswers++;
        
        const scenario = this.scenarios[this.currentScenarioIndex];
        const isCorrect = this.checkAnswer(this.selectedProduct, scenario);
        
        if (isCorrect) {
            this.correctAnswers++;
        }
        
        this.showFeedback(isCorrect, scenario);
        this.saveProgress();
        this.updateProgress();
    }
    
    // Check if the selected answer is correct
    checkAnswer(selectedId, scenario) {
        // Default implementation - check if selected product is in correct products list
        if (scenario.correctProducts) {
            return scenario.correctProducts.includes(selectedId);
        }
        // Override in specific implementations for custom logic
        return false;
    }
    
    // Navigate to next scenario
    nextScenario() {
        this.currentScenarioIndex = (this.currentScenarioIndex + 1) % this.scenarios.length;
        this.displayScenario(this.currentScenarioIndex);
        this.saveProgress();
    }
    
    // Save progress to localStorage
    saveProgress() {
        const progress = {
            currentMode: this.currentMode,
            currentProductIndex: this.currentProductIndex,
            currentScenarioIndex: this.currentScenarioIndex,
            correctAnswers: this.correctAnswers,
            totalAnswers: this.totalAnswers,
            lastAccessed: new Date().toISOString()
        };
        
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(progress));
        } catch (e) {
            console.warn('Unable to save progress:', e);
        }
    }
    
    // Load progress from localStorage
    loadProgress() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const progress = JSON.parse(saved);
                this.currentMode = progress.currentMode || 'study';
                this.currentProductIndex = progress.currentProductIndex || 0;
                this.currentScenarioIndex = progress.currentScenarioIndex || 0;
                this.correctAnswers = progress.correctAnswers || 0;
                this.totalAnswers = progress.totalAnswers || 0;
                
                console.log(`Loaded progress for ${this.productType}:`, progress);
            }
        } catch (e) {
            console.warn('Unable to load progress:', e);
        }
    }
    
    // Reset all progress
    resetProgress() {
        this.currentProductIndex = 0;
        this.currentScenarioIndex = 0;
        this.correctAnswers = 0;
        this.totalAnswers = 0;
        this.saveProgress();
        this.updateProgress();
    }
    
    // Calculate overall progress percentage
    getProgressPercentage() {
        let progress = 0;
        
        if (this.currentMode === 'study') {
            progress = ((this.currentProductIndex + 1) / this.productData.length) * 100;
        } else if (this.currentMode === 'scenarios' && this.scenarios.length > 0) {
            progress = ((this.currentScenarioIndex + 1) / this.scenarios.length) * 100;
        }
        
        return Math.round(progress);
    }
    
    // Get accuracy percentage for scenarios
    getAccuracy() {
        if (this.totalAnswers === 0) return 0;
        return Math.round((this.correctAnswers / this.totalAnswers) * 100);
    }
    
    // Update progress bar (override in specific implementation)
    updateProgress() {
        const percentage = this.getProgressPercentage();
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
    }
    
    // Methods to override in specific implementations
    updateProductDisplay(product) {
        console.warn('updateProductDisplay should be overridden in specific implementation');
    }
    
    updateScenarioDisplay(scenario) {
        console.warn('updateScenarioDisplay should be overridden in specific implementation');
    }
    
    updateStudyProgress() {
        console.warn('updateStudyProgress should be overridden in specific implementation');
    }
    
    updateProductSelection(productId) {
        console.warn('updateProductSelection should be overridden in specific implementation');
    }
    
    showFeedback(isCorrect, scenario) {
        console.warn('showFeedback should be overridden in specific implementation');
    }
    
    updateUI() {
        console.warn('updateUI should be overridden in specific implementation');
    }
}

// Study Mode Handler Class
class StudyMode {
    constructor(engine) {
        this.engine = engine;
        this.isFlipped = false;
    }
    
    flipCard() {
        this.isFlipped = !this.isFlipped;
        const flashcard = document.getElementById('flashcard');
        if (flashcard) {
            flashcard.classList.toggle('flipped', this.isFlipped);
        }
    }
    
    resetFlip() {
        this.isFlipped = false;
        const flashcard = document.getElementById('flashcard');
        if (flashcard) {
            flashcard.classList.remove('flipped');
        }
    }
}

// Scenario Mode Handler Class
class ScenarioMode {
    constructor(engine) {
        this.engine = engine;
    }
    
    generateProductOptions(scenario, allProducts) {
        // Get correct products
        const correctProducts = scenario.correctProducts || [];
        
        // Get some incorrect products for variety
        const incorrectProducts = allProducts
            .filter(p => !correctProducts.includes(p.id))
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.max(3, 6 - correctProducts.length));
        
        // Combine and shuffle
        const correctItems = allProducts.filter(p => correctProducts.includes(p.id));
        const options = [...correctItems, ...incorrectProducts]
            .sort(() => Math.random() - 0.5);
        
        return options;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ProductTrainingEngine,
        StudyMode,
        ScenarioMode
    };
}