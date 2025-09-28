# Staff Directory - Northwest Custom Apparel

## Overview
This is the authoritative source for all staff contact information. Always reference this document when implementing staff dropdowns or contact lists.

**Last Updated**: 2025-08-18

## Sales Representatives

| Name | Email | Role | Default |
|------|-------|------|---------|
| General Sales | sales@nwcustomapparel.com | Sales Team | Yes |
| Ruth Nhong | ruth@nwcustomapparel.com | Production Manager | No |
| Taylar Hanson | taylar@nwcustomapparel.com | No Longer Employed at NW Custom Apparel| No |
| Nika Lao | nika@nwcustomapparel.com | Account Executive | No |
| Taneisha Clark | taneisha@nwcustomapparel.com | Account Executive | No |
| Erik Mickelson | erik@nwcustomapparel.com | Operations Manager | No |
| Adriyella | adriyella@nwcustomapparel.com | Office Assistant | No |
| Bradley Wright | bradley@nwcustomapparel.com | Accountant | No |
| Jim Mickelson | jim@nwcustomapparel.com | CEO & Owner/Founder | No |
| Steve Deland | art@nwcustomapparel.com | Art Director | No |

## JavaScript Implementation

### For Dropdown Lists
```javascript
const salesReps = [
    { email: 'sales@nwcustomapparel.com', name: 'General Sales', default: true },
    { email: 'ruth@nwcustomapparel.com', name: 'Ruth Nhong' },
    { email: 'taylar@nwcustomapparel.com', name: 'Taylar Hanson' },
    { email: 'nika@nwcustomapparel.com', name: 'Nika Lao' },
    { email: 'taneisha@nwcustomapparel.com', name: 'Taneisha Clark' },
    { email: 'erik@nwcustomapparel.com', name: 'Erik Mickelson' },
    { email: 'adriyella@nwcustomapparel.com', name: 'Adriyella' },
    { email: 'bradley@nwcustomapparel.com', name: 'Bradley Wright' },
    { email: 'jim@nwcustomapparel.com', name: 'Jim Mickelson' },
    { email: 'art@nwcustomapparel.com', name: 'Steve Deland' }
];
```

### For Email Mapping
```javascript
const salesRepEmails = {
    'ruth@nwcustomapparel.com': 'Ruth Nhong',
    'taylar@nwcustomapparel.com': 'Taylar Hanson',
    'nika@nwcustomapparel.com': 'Nika Lao',
    'taneisha@nwcustomapparel.com': 'Taneisha Clark',
    'erik@nwcustomapparel.com': 'Erik Mickelson',
    'adriyella@nwcustomapparel.com': 'Adriyella',
    'bradley@nwcustomapparel.com': 'Bradley Wright',
    'jim@nwcustomapparel.com': 'Jim Mickelson',
    'art@nwcustomapparel.com': 'Steve Deland',
    'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team'
};
```

### HTML Select Options
```html
<select id="salesRep" class="form-select" required>
    <option value="">Select a sales rep...</option>
    <option value="sales@nwcustomapparel.com" selected>General Sales</option>
    <option value="ruth@nwcustomapparel.com">Ruth Nhong</option>
    <option value="taylar@nwcustomapparel.com">Taylar Hanson</option>
    <option value="nika@nwcustomapparel.com">Nika Lao</option>
    <option value="taneisha@nwcustomapparel.com">Taneisha Clark</option>
    <option value="erik@nwcustomapparel.com">Erik Mickelson</option>
    <option value="adriyella@nwcustomapparel.com">Adriyella</option>
    <option value="bradley@nwcustomapparel.com">Bradley Wright</option>
    <option value="jim@nwcustomapparel.com">Jim Mickelson</option>
    <option value="art@nwcustomapparel.com">Steve Deland</option>
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

- 2025-08-18: Added Taneisha Clark as Account Executive
- 2025-01-29: Initial creation, consolidated from various documentation files
- Removed duplicate "Ruthie" entry
- Confirmed "Taylar" spelling
- Added complete staff listing including Bradley, Jim, and Steve