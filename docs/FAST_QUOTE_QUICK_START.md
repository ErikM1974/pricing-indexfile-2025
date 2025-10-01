# Fast Quote Quick Start Guide

## For Erik: How to Test the Fast Quote System

### Step 1: Create EmailJS Templates (10 minutes)

1. Go to https://dashboard.emailjs.com/ and log in
2. Navigate to **Email Templates**
3. Click **"Create New Template"**

**Template 1: Customer Email**
- Template ID: `template_fastquote_customer`
- Subject: `Your Screen Print Quote Request (#{{quote_id}}) - NWCA`
- Body: Copy from `/docs/FAST_QUOTE_EMAILJS_TEMPLATES.md` (Customer section)
- Click **Save**

**Template 2: Sales Team Email**
- Template ID: `template_fastquote_sales`
- Subject: `New Fast Quote Request #{{quote_id}} - {{customer_name}}`
- Body: Copy from `/docs/FAST_QUOTE_EMAILJS_TEMPLATES.md` (Sales section)
- Click **Save**

### Step 2: Test the Form (5 minutes)

1. Open your browser to: `http://localhost:3000/calculators/screen-print-pricing.html`

2. You should see a **green banner** at the top:
   - "⚡ Not sure about the details?"
   - "Get Fast Quote" button

3. Click **"Get Fast Quote"** button

4. You'll be taken to the 3-step form:
   - **Step 1**: Select quantity, locations, colors
   - **Step 2**: Enter your contact info
   - **Step 3**: Success screen with quote ID

### Step 3: Verify Database (2 minutes)

1. Go to Caspio dashboard
2. Open `quote_sessions` table
3. Look for newest entry with Status = "Fast Quote Request"
4. Verify all fields populated correctly

### Step 4: Check Emails (2 minutes)

**You should receive 2 emails:**

1. **Customer email** (to your test email):
   - Subject: "Your Screen Print Quote Request..."
   - Should show quote ID, project details
   - Branded with NWCA green colors

2. **Sales team email** (to sales@nwcustomapparel.com):
   - Subject: "New Fast Quote Request..."
   - Should show customer contact info
   - Should have "Reply to Customer" button

---

## Quick Test Script

**Complete test in under 5 minutes:**

```
1. Go to: /calculators/screen-print-pricing.html
2. Click: "Get Fast Quote" button
3. Step 1: Select "48-71 pieces", "1 Location", "1-2 Colors"
4. Click: Continue
5. Step 2:
   - Name: Test User
   - Email: YOUR_EMAIL@example.com
   - Phone: 253-555-1234
6. Click: "Get My Quote"
7. Step 3: Note the Quote ID (e.g., SPC0930-1)
8. Check: Caspio database for new entry
9. Check: Both emails arrived
```

---

## Troubleshooting

### "Button doesn't appear on pricing page"
- **Solution**: Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check console for errors

### "Form doesn't submit"
- **Solution**: Open browser console (F12)
- Look for error messages
- Verify EmailJS templates are created
- Check template IDs match exactly

### "Emails not arriving"
- **Solution**: Check spam folder
- Verify EmailJS dashboard shows sends
- Check template IDs in service file
- Test templates in EmailJS dashboard first

### "Database not saving"
- **Solution**: Check console for API errors
- Verify Caspio proxy is running
- Quote still succeeds if DB fails (email still sends)

---

## Console Commands for Debugging

Open browser console (F12) and try:

```javascript
// Check if service loaded
console.log(window.ScreenPrintFastQuoteService);

// Test quote ID generation
const service = new ScreenPrintFastQuoteService();
console.log(service.generateQuoteID());

// Check EmailJS
console.log(emailjs);
```

---

## Expected Behavior

### ✅ Success Indicators:
- Green banner appears on pricing page
- Button links to fast quote form
- Form progresses through 3 steps
- Estimated price range updates in Step 2
- Success screen shows quote ID
- 2 emails arrive within 30 seconds
- Database entry created in Caspio

### ❌ Red Flags:
- 404 error on fast quote page
- "Template not found" error
- No emails arrive after 1 minute
- Quote ID not displayed on success screen
- Console shows JavaScript errors

---

## Demo Data for Testing

**Use this data for consistent testing:**

```
Quantity: 48-71 pieces
Locations: 2 Locations
Colors: 3-4
Name: Erik Mickelson
Email: erik@nwcustomapparel.com
Phone: (253) 922-5793
Company: Northwest Custom Apparel
Deadline: [7 days from today]
Notes: This is a test quote request
```

**Expected Result:**
- Quote ID: SPC0930-1 (or next sequence)
- Estimated Range: $12-15 per piece
- Both emails sent
- Database entry created

---

## Next Steps After Testing

1. **Test on mobile device** (actual phone)
2. **Show to sales team** for feedback
3. **Send test quote to real customer** (with their permission)
4. **Monitor metrics** for first week
5. **Adjust estimated pricing ranges** if needed

---

## Performance Benchmarks

**Target Metrics:**
- Page load: < 2 seconds
- Form submission: < 3 seconds
- Email delivery: < 30 seconds
- Mobile load: < 3 seconds
- Success rate: > 95%

---

## Support

**If something breaks:**
1. Check browser console for errors
2. Review `/docs/FAST_QUOTE_IMPLEMENTATION_SUMMARY.md`
3. Check EmailJS template configuration
4. Verify Caspio API is accessible
5. Contact implementation team

**Files to check:**
- `/quote-builders/screenprint-fast-quote.html`
- `/shared_components/js/screenprint-fast-quote-service.js`
- `/calculators/screen-print-pricing.html` (line 856-875)

---

## Success!

Once you see:
- ✅ Green banner on pricing page
- ✅ Form loads and works smoothly
- ✅ Quote ID generated (e.g., SPC0930-1)
- ✅ Both emails arrive
- ✅ Database entry created

**You're ready to go live!** 🎉

The fast quote system is fully functional and will help convert more casual browsers into qualified leads.