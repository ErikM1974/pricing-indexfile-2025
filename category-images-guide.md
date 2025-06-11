# Category Images Guide

To complete the modern search interface, you'll need to upload category images to your Caspio CDN or another image hosting service.

## Required Images

Upload these images and update the URLs in `modern-search-interface.js`:

1. **T-Shirts Category Image**
   - Suggested: A grid of various t-shirt styles/colors
   - Current placeholder: `https://cdn.caspio.com/a0e15000/t-shirts-category.jpg`

2. **Polos Category Image**
   - Suggested: Professional polo shirts in different colors
   - Current placeholder: `https://cdn.caspio.com/a0e15000/polos-category.jpg`

3. **Sweatshirts Category Image**
   - Suggested: Cozy sweatshirts/crewnecks
   - Current placeholder: `https://cdn.caspio.com/a0e15000/sweatshirts-category.jpg`

4. **Hoodies Category Image**
   - Suggested: Hooded sweatshirts in various styles
   - Current placeholder: `https://cdn.caspio.com/a0e15000/hoodies-category.jpg`

5. **Caps Category Image**
   - Suggested: Baseball caps, trucker hats, beanies
   - Current placeholder: `https://cdn.caspio.com/a0e15000/caps-category.jpg`

6. **Jackets Category Image**
   - Suggested: Outerwear, windbreakers, soft shells
   - Current placeholder: `https://cdn.caspio.com/a0e15000/jackets-category.jpg`

7. **Bags Category Image**
   - Suggested: Tote bags, backpacks, duffels
   - Current placeholder: `https://cdn.caspio.com/a0e15000/bags-category.jpg`

8. **Accessories Category Image**
   - Suggested: Various accessories like aprons, towels, etc.
   - Current placeholder: `https://cdn.caspio.com/a0e15000/accessories-category.jpg`

## Image Specifications

- **Size**: 600x400px (2:3 ratio)
- **Format**: JPG or PNG
- **File size**: Under 200KB for fast loading
- **Style**: Clean, professional product photography

## How to Update

1. Upload your images to Caspio CDN or another hosting service
2. Open `modern-search-interface.js`
3. Find the `categoryData` object (around line 15)
4. Replace the placeholder URLs with your actual image URLs

## Fallback

The code includes a fallback to placeholder images if the main images fail to load, so the interface will still function even without custom images.