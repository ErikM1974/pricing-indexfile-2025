# Developer Quick Reference Guide

## 🚀 Getting Started in 5 Minutes

### 1. Understanding the New Structure
```
Your code now lives in organized folders:
src/
├── core/           → Foundation utilities
├── shared/         → Shared by all pages
├── modules/        → Business logic (embroidery, printing, etc.)
└── pages/          → Page-specific code
```

### 2. Most Common Tasks

#### 🎨 Need to change how something looks?
```javascript
// Go to: src/shared/design-system/components/
// Example: Change button color
// File: Button.js
```

#### 💰 Need to change pricing logic?
```javascript
// Go to: src/modules/[embellishment-type]/calculator.js
// Example: Change embroidery pricing
// File: src/modules/embroidery/calculator.js
```

#### 🌐 Need to add/change API endpoint?
```javascript
// Go to: src/shared/api/endpoints.js
// Add your endpoint there
```

#### 🎯 Need to update what happens when user clicks something?
```javascript
// Find the component in: src/shared/components/
// Update the onClick handler
```

---

## 📦 What Each Phase Gave Us

### Phase 1: Bundling = Faster Loading
- **Before**: 50 files loading one by one
- **After**: 3 bundles loading together
- **You get**: Pages that load in 2 seconds instead of 10

### Phase 2: Components = Reusable LEGO Blocks
- **Before**: Same code written 10 times
- **After**: Write once, use everywhere
- **You get**: Fix a bug once, it's fixed everywhere

### Phase 3: State Management = Central Brain
- **Before**: Each part has its own memory
- **After**: One central memory for everything
- **You get**: Change quantity, everything updates automatically

### Phase 4: Modules = Expert Systems
- **Before**: All code mixed together
- **After**: Embroidery code in embroidery folder
- **You get**: Easy to find and fix specific features

### Phase 5: API System = Smart Communication
- **Before**: Basic fetch calls everywhere
- **After**: One smart system handling all communication
- **You get**: Automatic caching, offline support, error handling

### Phase 6: Design System = Beautiful UI
- **Before**: Every button looks different
- **After**: Consistent, professional design
- **You get**: Beautiful UI that works on all devices

---

## 🛠️ Code Examples: Old Way vs New Way

### Making an API Call

❌ **OLD WAY - Don't do this:**
```javascript
fetch('/api/pricing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(response => response.json())
.then(data => {
  document.getElementById('price').innerText = data.price;
})
.catch(error => {
  console.error('Error:', error);
});
```

✅ **NEW WAY - Do this:**
```javascript
import { api } from '@/shared/api';

const data = await api.post('/api/pricing', data);
// That's it! Caching, retry, and error handling included!
```

### Creating a Button

❌ **OLD WAY - Don't do this:**
```html
<button style="background: blue; color: white; padding: 10px; border-radius: 4px;">
  Click Me
</button>
```

✅ **NEW WAY - Do this:**
```javascript
import { createButton } from '@/shared/design-system/components';

const button = createButton({
  text: 'Click Me',
  variant: 'primary',
  onClick: () => console.log('Clicked!')
});
```

### Updating the UI

❌ **OLD WAY - Don't do this:**
```javascript
// Manually updating multiple places
document.getElementById('price1').innerText = '$100';
document.getElementById('price2').innerText = '$100';
document.getElementById('total').innerText = '$100';
```

✅ **NEW WAY - Do this:**
```javascript
import { store } from '@/shared/state';

// Update once, all connected components update automatically
store.dispatch('updatePrice', 100);
```

---

## 🎯 Finding What You Need

### "Where do I find..."

| What You're Looking For | Where to Find It |
|------------------------|------------------|
| Button styles | `src/shared/design-system/components/Button.js` |
| API endpoints | `src/shared/api/endpoints.js` |
| Embroidery pricing logic | `src/modules/embroidery/calculator.js` |
| Color options | `src/shared/components/color-selector.js` |
| Error messages | `src/shared/api/errors.js` |
| Loading animations | `src/shared/design-system/components/Loading.js` |
| Form validation | `src/shared/design-system/components/Form.js` |
| Theme colors | `src/shared/design-system/tokens/tokens.js` |

---

## 💡 Best Practices

### Do's ✅
1. **Use existing components** - Don't reinvent the wheel
2. **Follow the patterns** - Consistency is key
3. **Update state properly** - Use store.dispatch()
4. **Use the API client** - Don't use fetch() directly
5. **Test your changes** - Use the demo pages

### Don'ts ❌
1. **Don't copy-paste code** - Make it reusable
2. **Don't use inline styles** - Use design tokens
3. **Don't manipulate DOM directly** - Update state instead
4. **Don't ignore errors** - Handle them gracefully
5. **Don't skip accessibility** - It's built in, use it

---

## 🐛 Debugging Tips

### Problem: "My changes aren't showing"
1. Check if you're editing the right file
2. Make sure bundles are rebuilding: `npm run dev`
3. Clear browser cache: Ctrl+Shift+R

### Problem: "API call isn't working"
1. Check browser console for errors
2. Look at Network tab in DevTools
3. Verify endpoint exists in `endpoints.js`

### Problem: "State isn't updating"
1. Check if component is connected to store
2. Verify action name is correct
3. Look for typos in dispatch call

### Problem: "Styles look wrong"
1. Check if using design tokens
2. Verify component variant name
3. Look for CSS conflicts

---

## 🚦 Quick Commands

```bash
# Start development
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Check code style
npm run lint

# Fix code style
npm run lint:fix
```

---

## 📞 Getting Help

1. **Check documentation first**: `docs/` folder
2. **Look at examples**: `test-files/` folder
3. **Read the code**: It's well-commented
4. **Ask teammates**: They know the system

---

## 🎉 You're Ready!

With this guide, you can:
- Find any code quickly
- Make changes confidently
- Follow best practices
- Debug issues effectively

Remember: The new system is designed to make your life easier. If something seems hard, you're probably doing it the old way. Check this guide and use the modern approach!

Happy coding! 🚀