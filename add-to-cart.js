// add-to-cart.js - Reusable Add to Cart button component

/**
 * Add to Cart Button Component
 * Creates an "Add to Cart" button that can be added to product pages
 */
const AddToCartButton = (function() {
  /**
   * Create an "Add to Cart" button
   * @param {string} containerId - ID of the container element
   * @param {Function} getProductDataFn - Function that returns the product data
   */
  function createButton(containerId, getProductDataFn) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container element with ID "${containerId}" not found`);
      return;
    }
    
    // Create the button
    const button = document.createElement('button');
    button.className = 'add-to-cart-btn';
    button.innerHTML = 'Add to Cart';
    
    // Create error message container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'add-to-cart-error';
    errorContainer.style.display = 'none';
    errorContainer.style.color = '#dc3545';
    errorContainer.style.marginTop = '10px';
    errorContainer.style.fontSize = '14px';
    
    // Add click event listener
    button.addEventListener('click', async () => {
      // Clear previous errors
      errorContainer.style.display = 'none';
      errorContainer.textContent = '';
      
      // Show loading state
      button.disabled = true;
      button.innerHTML = 'Adding...';
      
      // Get product data
      const productData = getProductDataFn();
      
      // Add to cart
      // Check if NWCACart is available
      if (!window.NWCACart) {
        console.error("NWCACart is not available");
        errorContainer.textContent = "Cart system is not available. Please refresh the page and try again.";
        errorContainer.style.display = 'block';
        button.disabled = false;
        button.innerHTML = 'Add to Cart';
        return;
      }
      
      console.log("Adding to cart:", productData);
      const result = await window.NWCACart.addToCart(productData);
      
      // Reset button state
      button.disabled = false;
      
      if (result.success) {
        // Show success message
        button.innerHTML = 'Added to Cart ✓';
        setTimeout(() => {
          button.innerHTML = 'Add to Cart';
        }, 2000);
      } else {
        // Show error message
        button.innerHTML = 'Error - Try Again';
        
        if (result.error) {
          errorContainer.textContent = result.error;
          errorContainer.style.display = 'block';
        }
        
        setTimeout(() => {
          button.innerHTML = 'Add to Cart';
        }, 2000);
      }
    });
    
    // Add the error container after the button
    container.appendChild(errorContainer);
    
    // Add the button to the container
    container.appendChild(button);
  }
  
  /**
   * Get embellishment options based on type
   * @param {string} embellishmentType - Embellishment type
   * @param {Object} formData - Form data from embellishment options form
   * @returns {Object} - Embellishment options
   */
  function getEmbellishmentOptions(embellishmentType, formData) {
    switch (embellishmentType) {
      case 'embroidery':
        return {
          stitchCount: parseInt(formData.stitchCount || 8000),
          location: formData.location || 'left-chest'
        };
        
      case 'cap-embroidery':
        return {
          stitchCount: parseInt(formData.stitchCount || 8000),
          location: formData.location || 'front'
        };
        
      case 'dtg':
        return {
          location: formData.location || 'FF',
          colorType: formData.colorType || 'full-color'
        };
        
      case 'screen-print':
        const additionalLocations = [];
        
        if (formData.additionalLocations) {
          for (const location of formData.additionalLocations) {
            additionalLocations.push({
              location: location.location,
              colorCount: parseInt(location.colorCount || 1)
            });
          }
        }
        
        return {
          colorCount: parseInt(formData.colorCount || 1),
          additionalLocations: additionalLocations,
          requiresWhiteBase: formData.requiresWhiteBase === true || formData.requiresWhiteBase === 'true',
          specialInk: formData.specialInk === true || formData.specialInk === 'true'
        };
        
      default:
        return {};
    }
  }
  
  /**
   * Create embellishment options form
   * @param {string} containerId - ID of the container element
   * @param {string} embellishmentType - Embellishment type
   * @returns {HTMLFormElement} - Form element
   */
  function createEmbellishmentOptionsForm(containerId, embellishmentType) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container element with ID "${containerId}" not found`);
      return null;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Create form
    const form = document.createElement('form');
    form.className = 'embellishment-options-form';
    form.id = 'embellishment-options-form';
    
    // Add form fields based on embellishment type
    switch (embellishmentType) {
      case 'embroidery':
        form.innerHTML = `
          <div class="form-group">
            <label for="stitch-count">Stitch Count:</label>
            <select id="stitch-count" name="stitchCount" class="form-control">
              <option value="8000" selected>8,000 Stitches (Standard)</option>
              <option value="5000">5,000 Stitches (Low)</option>
              <option value="10000">10,000 Stitches (High)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="location">Location:</label>
            <select id="location" name="location" class="form-control">
              <option value="left-chest" selected>Left Chest</option>
              <option value="right-chest">Right Chest</option>
              <option value="full-back">Full Back</option>
              <option value="left-sleeve">Left Sleeve</option>
              <option value="right-sleeve">Right Sleeve</option>
            </select>
          </div>
        `;
        break;
        
      case 'cap-embroidery':
        form.innerHTML = `
          <div class="form-group">
            <label for="stitch-count">Stitch Count:</label>
            <select id="stitch-count" name="stitchCount" class="form-control">
              <option value="8000" selected>8,000 Stitches (Standard)</option>
              <option value="5000">5,000 Stitches (Low)</option>
              <option value="10000">10,000 Stitches (High)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="location">Location:</label>
            <select id="location" name="location" class="form-control">
              <option value="front" selected>Front</option>
              <option value="side">Side</option>
              <option value="back">Back</option>
            </select>
          </div>
        `;
        break;
        
      case 'dtg':
        form.innerHTML = `
          <div class="form-group">
            <label for="location">Print Location:</label>
            <select id="location" name="location" class="form-control">
              <option value="LC">Left Chest Only</option>
              <option value="FF" selected>Full Front Only</option>
              <option value="FB">Full Back Only</option>
              <option value="JF">Jumbo Front Only</option>
              <option value="JB">Jumbo Back Only</option>
              <option value="LC_FB">Left Chest + Full Back</option>
              <option value="FF_FB">Full Front + Full Back</option>
              <option value="JF_JB">Jumbo Front + Jumbo Back</option>
            </select>
          </div>
          <div class="form-group">
            <label for="color-type">Color Type:</label>
            <select id="color-type" name="colorType" class="form-control">
              <option value="full-color" selected>Full Color</option>
              <option value="white-only">White Only</option>
            </select>
          </div>
        `;
        break;
        
      case 'screen-print':
        form.innerHTML = `
          <div class="form-group">
            <label for="color-count">Number of Colors:</label>
            <select id="color-count" name="colorCount" class="form-control">
              <option value="1" selected>1 Color</option>
              <option value="2">2 Colors</option>
              <option value="3">3 Colors</option>
              <option value="4">4 Colors</option>
              <option value="5">5 Colors</option>
              <option value="6">6 Colors</option>
            </select>
          </div>
          <div class="form-group">
            <label>Additional Options:</label>
            <div class="checkbox">
              <label>
                <input type="checkbox" id="requires-white-base" name="requiresWhiteBase">
                Requires White Base Plate (for dark garments)
              </label>
            </div>
            <div class="checkbox">
              <label>
                <input type="checkbox" id="special-ink" name="specialInk">
                Special Ink (Reflective, Metallic, etc.)
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>Additional Locations:</label>
            <div id="additional-locations-container">
              <!-- Additional locations will be added here -->
            </div>
            <button type="button" id="add-location-btn" class="btn btn-sm btn-secondary">
              Add Location
            </button>
          </div>
        `;
        
        // Add event listener for "Add Location" button after form is added to DOM
        setTimeout(() => {
          const addLocationBtn = document.getElementById('add-location-btn');
          const additionalLocationsContainer = document.getElementById('additional-locations-container');
          
          if (addLocationBtn && additionalLocationsContainer) {
            addLocationBtn.addEventListener('click', () => {
              const locationDiv = document.createElement('div');
              locationDiv.className = 'additional-location';
              locationDiv.innerHTML = `
                <div class="row">
                  <div class="col-md-5">
                    <select name="additionalLocationName" class="form-control form-control-sm">
                      <option value="back" selected>Back</option>
                      <option value="left-sleeve">Left Sleeve</option>
                      <option value="right-sleeve">Right Sleeve</option>
                    </select>
                  </div>
                  <div class="col-md-5">
                    <select name="additionalLocationColors" class="form-control form-control-sm">
                      <option value="1" selected>1 Color</option>
                      <option value="2">2 Colors</option>
                      <option value="3">3 Colors</option>
                      <option value="4">4 Colors</option>
                    </select>
                  </div>
                  <div class="col-md-2">
                    <button type="button" class="btn btn-sm btn-danger remove-location-btn">
                      X
                    </button>
                  </div>
                </div>
              `;
              
              // Add event listener for remove button
              const removeBtn = locationDiv.querySelector('.remove-location-btn');
              removeBtn.addEventListener('click', () => {
                locationDiv.remove();
              });
              
              additionalLocationsContainer.appendChild(locationDiv);
            });
          }
        }, 0);
        break;
        
      default:
        form.innerHTML = '<p>No options available for this embellishment type.</p>';
    }
    
    // Add form to container
    container.appendChild(form);
    
    return form;
  }
  
  /**
   * Get form data from embellishment options form
   * @param {string} formId - ID of the form element
   * @returns {Object} - Form data
   */
  function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) {
      console.error(`Form element with ID "${formId}" not found`);
      return {};
    }
    
    const formData = {};
    
    // Get all form elements
    const elements = form.elements;
    
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      // Skip buttons and elements without a name
      if (element.type === 'button' || !element.name) {
        continue;
      }
      
      // Handle checkboxes
      if (element.type === 'checkbox') {
        formData[element.name] = element.checked;
      } 
      // Handle select elements
      else if (element.tagName === 'SELECT') {
        formData[element.name] = element.value;
      }
      // Handle other input types
      else {
        formData[element.name] = element.value;
      }
    }
    
    // Handle additional locations for screen printing
    if (form.querySelector('#additional-locations-container')) {
      const additionalLocations = [];
      const locationDivs = form.querySelectorAll('.additional-location');
      
      locationDivs.forEach(div => {
        const locationSelect = div.querySelector('select[name="additionalLocationName"]');
        const colorSelect = div.querySelector('select[name="additionalLocationColors"]');
        
        if (locationSelect && colorSelect) {
          additionalLocations.push({
            location: locationSelect.value,
            colorCount: parseInt(colorSelect.value)
          });
        }
      });
      
      formData.additionalLocations = additionalLocations;
    }
    
    return formData;
  }
  
  // Public API
  return {
    createButton,
    createEmbellishmentOptionsForm,
    getEmbellishmentOptions,
    getFormData
  };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a product page
  const addToCartContainer = document.getElementById('add-to-cart-container');
  const embellishmentOptionsContainer = document.getElementById('embellishment-options-container');
  const embellishmentTypeRadios = document.querySelectorAll('input[name="embellishment-type"]');
  
  if (addToCartContainer && embellishmentOptionsContainer && embellishmentTypeRadios.length > 0) {
    // Add event listeners to embellishment type radios
    embellishmentTypeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        const selectedType = document.querySelector('input[name="embellishment-type"]:checked').value;
        AddToCartButton.createEmbellishmentOptionsForm('embellishment-options-container', selectedType);
      });
    });
    
    // Initialize with the default selected embellishment type
    const defaultType = document.querySelector('input[name="embellishment-type"]:checked');
    if (defaultType) {
      AddToCartButton.createEmbellishmentOptionsForm('embellishment-options-container', defaultType.value);
    } else {
      embellishmentTypeRadios[0].checked = true;
      AddToCartButton.createEmbellishmentOptionsForm('embellishment-options-container', embellishmentTypeRadios[0].value);
    }
    
    // Create the "Add to Cart" button
    AddToCartButton.createButton('add-to-cart-container', () => {
      // Get the selected embellishment type
      const selectedType = document.querySelector('input[name="embellishment-type"]:checked').value;
      
      // Get the form data
      const formData = AddToCartButton.getFormData('embellishment-options-form');
      
      // Get the embellishment options
      const embellishmentOptions = AddToCartButton.getEmbellishmentOptions(selectedType, formData);
      
      // Get the product data
      const styleNumber = document.getElementById('style-number').textContent.trim();
      const color = document.getElementById('selected-color').textContent.trim();
      
      // Get the sizes and quantities
      const sizes = [];
      const quantityInputs = document.querySelectorAll('.qty-input');
      
      quantityInputs.forEach(input => {
        if (input.value && parseInt(input.value) > 0) {
          const size = input.dataset.size;
          const quantity = parseInt(input.value);
          const unitPrice = parseFloat(input.dataset.price || 0);
          const warehouseSource = input.dataset.warehouse || '';
          
          sizes.push({
            size,
            quantity,
            unitPrice,
            warehouseSource
          });
        }
      });
      
      return {
        styleNumber,
        color,
        embellishmentType: selectedType,
        embellishmentOptions,
        sizes
      };
    });
  }
});