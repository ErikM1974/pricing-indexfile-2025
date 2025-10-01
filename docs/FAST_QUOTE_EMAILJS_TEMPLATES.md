# EmailJS Templates for Screen Print Fast Quote

## Overview
The Screen Print Fast Quote system requires two EmailJS templates to be created in the EmailJS dashboard.

## Template 1: Customer Confirmation Email

**Template ID**: `template_fastquote_customer`

**Subject**: Your Screen Print Quote Request (#{{quote_id}}) - NWCA

**Email Body**:

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3a7c52 0%, #2d5f3f 100%); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">Quote Request Received!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Northwest Custom Apparel</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px; background: #f9f9f9;">
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Hi {{customer_name}},
        </p>

        <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Thank you for your screen print quote request! We've received your inquiry and a sales representative will contact you within <strong>2 business hours</strong> with detailed pricing.
        </p>

        <!-- Quote Details Box -->
        <div style="background: white; border: 2px solid #3a7c52; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #3a7c52; font-size: 18px;">Your Quote Details</h3>

            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Quote ID:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; font-size: 14px;">{{quote_id}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Quantity:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; font-size: 14px;">{{quantity}} pieces</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Print Locations:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; font-size: 14px;">{{locations}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Colors:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; font-size: 14px;">{{colors}} per location</td>
                </tr>
                {{#if deadline}}
                <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Target Deadline:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; font-size: 14px;">{{deadline}}</td>
                </tr>
                {{/if}}
            </table>
        </div>

        <!-- What's Next -->
        <div style="background: #e8f5e9; border-left: 4px solid #3a7c52; padding: 15px; margin: 25px 0;">
            <h4 style="margin: 0 0 10px 0; color: #2d5f3f; font-size: 16px;">What Happens Next?</h4>
            <ul style="margin: 0; padding-left: 20px; color: #333; font-size: 14px; line-height: 1.8;">
                <li>A sales rep will review your request</li>
                <li>We'll prepare exact pricing based on garment selection</li>
                <li>You'll receive a detailed quote within 2 business hours</li>
                <li>We'll answer any questions and help finalize your order</li>
            </ul>
        </div>

        {{#if notes}}
        <div style="margin: 20px 0;">
            <strong style="color: #666; font-size: 14px;">Your Notes:</strong>
            <p style="color: #333; font-size: 14px; margin: 5px 0; padding: 10px; background: white; border-radius: 4px;">{{notes}}</p>
        </div>
        {{/if}}

        <p style="font-size: 14px; color: #666; margin-top: 25px;">
            <strong>Questions?</strong> Call us at <a href="tel:2539225793" style="color: #3a7c52; text-decoration: none;">(253) 922-5793</a> or reply to this email.
        </p>
    </div>

    <!-- Footer -->
    <div style="background: #2d3748; color: white; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0 0 10px 0;">Northwest Custom Apparel</p>
        <p style="margin: 0; opacity: 0.8;">Family Owned & Operated Since 1977</p>
        <p style="margin: 10px 0 0 0; opacity: 0.8;">
            <a href="tel:2539225793" style="color: white; text-decoration: none;">(253) 922-5793</a> |
            <a href="mailto:{{company_email}}" style="color: white; text-decoration: none;">{{company_email}}</a>
        </p>
    </div>
</div>
```

**Required Variables**:
- `{{quote_id}}` - Quote ID (e.g., SPC0130-1)
- `{{customer_name}}` - Customer's name
- `{{company_name}}` - Company name
- `{{quantity}}` - Quantity range (e.g., "48-71")
- `{{locations}}` - Number of print locations (e.g., "2 Locations")
- `{{colors}}` - Color range (e.g., "3-4")
- `{{deadline}}` - Optional target deadline
- `{{notes}}` - Optional customer notes
- `{{company_phone}}` - (253) 922-5793
- `{{company_email}}` - sales@nwcustomapparel.com

---

## Template 2: Sales Team Notification Email

**Template ID**: `template_fastquote_sales`

**Subject**: New Fast Quote Request #{{quote_id}} - {{customer_name}}

**Email Body**:

```html
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
    <!-- Alert Header -->
    <div style="background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 22px;">⚡ New Fast Quote Request</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Action Required: Respond within 2 hours</p>
    </div>

    <!-- Main Content -->
    <div style="background: white; padding: 25px; border-radius: 0 0 8px 8px;">
        <!-- Priority Info -->
        <div style="background: #fff3cd; border-left: 4px solid #ff6b35; padding: 12px; margin-bottom: 20px;">
            <strong style="color: #856404;">Priority:</strong> This customer expects a response within 2 business hours.
        </div>

        <!-- Quote ID -->
        <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Quote ID</div>
            <div style="font-size: 28px; font-weight: 700; color: #3a7c52;">{{quote_id}}</div>
        </div>

        <!-- Customer Information -->
        <h3 style="color: #2d5f3f; border-bottom: 2px solid #3a7c52; padding-bottom: 8px; margin: 25px 0 15px 0;">Customer Information</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
                <td style="padding: 10px; background: #f9f9f9; font-weight: 600; width: 180px;">Name:</td>
                <td style="padding: 10px; background: #f9f9f9;">{{customer_name}}</td>
            </tr>
            <tr>
                <td style="padding: 10px; font-weight: 600;">Email:</td>
                <td style="padding: 10px;"><a href="mailto:{{customer_email}}" style="color: #3a7c52;">{{customer_email}}</a></td>
            </tr>
            <tr>
                <td style="padding: 10px; background: #f9f9f9; font-weight: 600;">Phone:</td>
                <td style="padding: 10px; background: #f9f9f9;"><a href="tel:{{customer_phone}}" style="color: #3a7c52;">{{customer_phone}}</a></td>
            </tr>
            <tr>
                <td style="padding: 10px; font-weight: 600;">Company:</td>
                <td style="padding: 10px;">{{company_name}}</td>
            </tr>
        </table>

        <!-- Project Details -->
        <h3 style="color: #2d5f3f; border-bottom: 2px solid #3a7c52; padding-bottom: 8px; margin: 25px 0 15px 0;">Project Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
                <td style="padding: 10px; background: #f9f9f9; font-weight: 600; width: 180px;">Quantity:</td>
                <td style="padding: 10px; background: #f9f9f9;">{{quantity}} pieces</td>
            </tr>
            <tr>
                <td style="padding: 10px; font-weight: 600;">Print Locations:</td>
                <td style="padding: 10px;">{{locations}}</td>
            </tr>
            <tr>
                <td style="padding: 10px; background: #f9f9f9; font-weight: 600;">Colors Per Location:</td>
                <td style="padding: 10px; background: #f9f9f9;">{{colors}}</td>
            </tr>
            {{#if deadline}}
            <tr>
                <td style="padding: 10px; font-weight: 600;">Target Deadline:</td>
                <td style="padding: 10px; color: #d32f2f; font-weight: 600;">{{deadline}}</td>
            </tr>
            {{/if}}
        </table>

        {{#if notes}}
        <!-- Customer Notes -->
        <h3 style="color: #2d5f3f; border-bottom: 2px solid #3a7c52; padding-bottom: 8px; margin: 25px 0 15px 0;">Customer Notes</h3>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 25px;">
            {{notes}}
        </div>
        {{/if}}

        <!-- Action Items -->
        <div style="background: #e8f5e9; border: 2px solid #3a7c52; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <h4 style="margin: 0 0 15px 0; color: #2d5f3f;">Next Steps:</h4>
            <ol style="margin: 0; padding-left: 20px; color: #333;">
                <li style="margin-bottom: 8px;">Review project requirements</li>
                <li style="margin-bottom: 8px;">Prepare garment options and color choices</li>
                <li style="margin-bottom: 8px;">Calculate exact pricing</li>
                <li style="margin-bottom: 8px;">Contact customer within 2 hours</li>
                <li>Send detailed quote via email</li>
            </ol>
        </div>

        <!-- Quick Links -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <a href="mailto:{{customer_email}}?subject=Screen%20Print%20Quote%20%23{{quote_id}}"
               style="display: inline-block; background: #3a7c52; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px; font-weight: 600;">
                Reply to Customer
            </a>
            <a href="tel:{{customer_phone}}"
               style="display: inline-block; background: #2d5f3f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px; font-weight: 600;">
                Call Customer
            </a>
        </div>

        <!-- Submission Info -->
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 25px;">
            Submitted: {{submitted_date}}
        </p>
    </div>
</div>
```

**Required Variables**:
- `{{quote_id}}` - Quote ID
- `{{customer_name}}` - Customer's name
- `{{customer_email}}` - Customer's email
- `{{customer_phone}}` - Customer's phone
- `{{company_name}}` - Company name (or "Not provided")
- `{{quantity}}` - Quantity range
- `{{locations}}` - Number of locations
- `{{colors}}` - Color range
- `{{deadline}}` - Optional deadline
- `{{notes}}` - Optional customer notes
- `{{submitted_date}}` - Timestamp of submission

---

## Setup Instructions

1. **Log into EmailJS Dashboard**: https://dashboard.emailjs.com/

2. **Create Customer Template**:
   - Go to Email Templates
   - Click "Create New Template"
   - Template Name: "Fast Quote - Customer Confirmation"
   - Template ID: `template_fastquote_customer`
   - Paste the customer email body HTML
   - Set subject line
   - Save template

3. **Create Sales Team Template**:
   - Click "Create New Template"
   - Template Name: "Fast Quote - Sales Notification"
   - Template ID: `template_fastquote_sales`
   - Paste the sales team email body HTML
   - Set subject line
   - Save template

4. **Test Both Templates**:
   - Use the "Test" button in EmailJS dashboard
   - Verify all variables populate correctly
   - Check formatting on desktop and mobile
   - Ensure links work

5. **Update Service Configuration**:
   - Verify Service ID: `service_1c4k67j`
   - Verify Public Key: `4qSbDO-SQs19TbP80`
   - These are already set in `screenprint-fast-quote-service.js`

---

## Testing Checklist

- [ ] Customer email arrives within 30 seconds
- [ ] All variables populate correctly
- [ ] Links work (phone, email)
- [ ] Mobile formatting looks good
- [ ] Sales team email arrives
- [ ] Quote ID displays correctly
- [ ] Optional fields (deadline, notes) handle empty values
- [ ] HTML renders correctly in Gmail, Outlook, Apple Mail

---

## Notes

- Both templates use conditional logic for optional fields (`{{#if deadline}}`)
- Customer email is friendly and reassuring
- Sales team email is actionable with clear next steps
- 2-hour response time is highlighted in both emails
- Templates match NWCA green branding (#3a7c52)