# Cap Embroidery Beta Migration Checklist

## Pre-Migration Checks ✓

### 1. Code Review
- [x] Beta button added to product.html
- [x] CSS styles added for beta button
- [x] JavaScript handles URL parameters
- [x] New page (cap-embroidery-pricing-integrated.html) created
- [x] Pricing bug fixed ($24 instead of $18)

### 2. Local Testing
- [ ] Test product page with different products
- [ ] Verify beta button appears and is styled correctly
- [ ] Click beta button and verify URL parameters pass
- [ ] Test pricing calculations on new page
- [ ] Test all interactive features

## Migration Steps

### Step 1: Merge to Main Branch
```bash
# 1. Switch to main branch
git checkout main

# 2. Pull latest changes
git pull origin main

# 3. Merge beta button branch
git merge feature/cap-embroidery-beta-button

# 4. Merge enhancements branch
git merge feature/cap-embroidery-enhancements

# 5. Push to origin
git push origin main
```

### Step 2: Deploy to Production
```bash
# If using Heroku
git push heroku main

# Or your deployment method
```

### Step 3: Verify Deployment
- [ ] Visit live product page
- [ ] Confirm beta button appears
- [ ] Test with real products
- [ ] Check browser console for errors

### Step 4: Monitor
- [ ] Watch error logs
- [ ] Monitor user clicks on beta button
- [ ] Collect initial feedback

## Quick Tests

### Test URLs:
1. Product page with NE1000:
   ```
   /product.html?StyleNumber=NE1000&COLOR=Cyber+Green
   ```

2. Product page with C112:
   ```
   /product.html?StyleNumber=C112&COLOR=Black
   ```

3. Direct beta page:
   ```
   /cap-embroidery-pricing-integrated.html?StyleNumber=C112&COLOR=Black
   ```

## Rollback Plan

If issues arise:

### Option 1: Hide Beta Button (Fastest)
```javascript
// Add to product page temporarily
document.getElementById('cap-embroidery-beta').style.display = 'none';
```

### Option 2: Full Rollback
```bash
git revert [commit-hash]
git push origin main
```

## Success Criteria

- [ ] No JavaScript errors in console
- [ ] Beta button clickable when product selected
- [ ] Pricing shows $24 for quantity 31
- [ ] No increase in support tickets
- [ ] Positive initial feedback

## Communication

### Internal Team:
"The beta button for cap embroidery is now live. Please test and report any issues."

### Key Customers (Optional):
"We've added a beta version of our cap embroidery pricing tool. Look for the BETA button to try it out!"

## Notes

- Keep the old system running normally
- Beta is optional for users
- Monitor closely for first 24-48 hours
- Be ready to hide button if needed

---

**Migration Started**: [Date/Time]
**Migration Completed**: [Date/Time]
**Status**: READY TO START