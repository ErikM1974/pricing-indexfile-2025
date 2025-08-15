# Staff Directory - Northwest Custom Apparel

## Overview
This is the authoritative source for all staff contact information. Always reference this document when implementing staff dropdowns or contact lists.

**Last Updated**: 2025-01-29

## Sales Representatives

| Name | Email | Role | Default |
|------|-------|------|---------|
| General Sales | sales@nwcustomapparel.com | Sales Team | Yes |
| Ruth Nhong | ruth@nwcustomapparel.com | Production Manager | No |
| Taylar Hanson | taylar@nwcustomapparel.com | Account Executive | No |
| Nika Lao | nika@nwcustomapparel.com | Account Executive | No |
| Erik Mickelson | erik@nwcustomapparel.com | Operations Manager | No |
| Adriyella | adriyella@nwcustomapparel.com | Office Assistant | No |
| Bradley Wright | bradley@nwcustomapparel.com | Accountant | No |
| Jim Mickelson | jim@nwcustomapparel.com | CEO & Owner/Founder | No |
| Steve Deland | art@nwcustomapparel.com | Art Director | No |

## JavaScript Implementation

### For Dropdown Lists
```javascript
const salesReps = [
    { email: 'ruth@nwcustomapparel.com', name: 'Ruth', default: true },
    { email: 'taylar@nwcustomapparel.com', name: 'Taylar' },
    { email: 'nika@nwcustomapparel.com', name: 'Nika' },
    { email: 'erik@nwcustomapparel.com', name: 'Erik' },
    { email: 'adriyella@nwcustomapparel.com', name: 'Adriyella' },
    { email: 'bradley@nwcustomapparel.com', name: 'Bradley' },
    { email: 'jim@nwcustomapparel.com', name: 'Jim' },
    { email: 'art@nwcustomapparel.com', name: 'Steve (Artist)' },
    { email: 'sales@nwcustomapparel.com', name: 'General Sales' }
];
```

### For Email Mapping
```javascript
const salesRepEmails = {
    'ruth@nwcustomapparel.com': 'Ruth',
    'taylar@nwcustomapparel.com': 'Taylar',
    'nika@nwcustomapparel.com': 'Nika',
    'erik@nwcustomapparel.com': 'Erik',
    'adriyella@nwcustomapparel.com': 'Adriyella',
    'bradley@nwcustomapparel.com': 'Bradley',
    'jim@nwcustomapparel.com': 'Jim',
    'art@nwcustomapparel.com': 'Steve (Artist)',
    'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
};
```

### HTML Select Options
```html
<select id="salesRep" class="form-select" required>
    <option value="">Select a sales rep...</option>
    <option value="ruth@nwcustomapparel.com" selected>Ruth</option>
    <option value="taylar@nwcustomapparel.com">Taylar</option>
    <option value="nika@nwcustomapparel.com">Nika</option>
    <option value="erik@nwcustomapparel.com">Erik</option>
    <option value="adriyella@nwcustomapparel.com">Adriyella</option>
    <option value="bradley@nwcustomapparel.com">Bradley</option>
    <option value="jim@nwcustomapparel.com">Jim</option>
    <option value="art@nwcustomapparel.com">Steve (Artist)</option>
    <option value="sales@nwcustomapparel.com">General Sales</option>
</select>
```

## Company Contact Information

- **Main Phone**: 253-922-5793
- **Toll Free**: 1-800-851-3671
- **Main Email**: sales@nwcustomapparel.com
- **Website**: https://www.nwcustomapparel.com
- **Address**: 2025 Freeman Road East, Milton, WA 98354
- **Hours**: Monday - Friday, 9:00 AM - 5:00 PM PST
- **Established**: 1977 (Family Owned and Operated)

## Important Notes

1. **Ruth vs Ruthie**: The correct email is `ruth@nwcustomapparel.com` and display name is "Ruth"
2. **Taylar Spelling**: The correct spelling is "Taylar" (not "Taylor")
3. **Default Sales Rep**: Sales Team is the default selection in all calculators (sales@nwcustomapparel.com)
4. **BCC on Quotes**: All quote emails should BCC erik@nwcustomapparel.com
5. **Phone Number**: Always use 253-922-5793 for all sales rep phone fields

## Update History

- 2025-01-29: Initial creation, consolidated from various documentation files
- Removed duplicate "Ruthie" entry
- Confirmed "Taylar" spelling
- Added complete staff listing including Bradley, Jim, and Steve