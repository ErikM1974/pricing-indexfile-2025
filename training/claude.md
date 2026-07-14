# CLAUDE.md - Training Directory

This file provides guidance to Claude Code (claude.ai/code) when working with training materials and tools in this directory.

## Directory Overview

The `/training` directory contains all training materials, interactive games, administrative dashboards, and educational tools for Northwest Custom Apparel staff. These tools are designed to onboard new employees, maintain skill proficiency, and provide ongoing education for the sales team and coordinators.

## Training System Architecture

### Core Components

1. **Training Engine** (`training-engine-base.js`)
   - Shared JavaScript module for interactive training features
   - Handles scoring, progress tracking, and feedback systems
   - Used across multiple training modules

2. **Training Games Hub** (`training-games-hub.html`)
   - Central portal for all training activities
   - Links to individual training modules
   - Tracks completion and progress

3. **Local Development Server** (`server.js`, `simple-server.js`)
   - Express-based servers for local testing
   - Handles API routes for training data
   - Port 3001 for development

## Active Training Modules

### Sales & Customer Service Training

| Module | File | Purpose | Target Audience |
|--------|------|---------|-----------------|
| Sales Coordinator Manual | `sales-coordinator-manual.html` | Comprehensive training guide | New Sales Coordinators |
| Training Schedule | `sales-coordinator-training-schedule.html` | Structured learning path | Sales Coordinators |
| Customer Service Guide | `customer-service.html` | Customer interaction best practices | All Sales Staff |
| Customer Categorization | `customer-categorization-training.html` | Account classification training | Sales Team |
| Lead Source Training | `lead-source-training.html` | Lead tracking and attribution | Sales Team |
| Lead Sheet Guide | `lead-sheet-guide.html` | Lead management procedures | Sales Team |

### ShopWorks Training Suite

| Module | File | Description | Status |
|--------|------|-------------|--------|
| Customer Setup | `shopworks-customer-setup.html` | Customer account creation | Active |
| Enhanced Setup | `shopworks-customer-setup-enhanced.html` | Advanced features | Active |
| Working Version | `shopworks-customer-setup-working.html` | Stable version | Backup |
| Embroidery Order Types | `shopworks-embroidery-order-type.html` | Order type selection | Active |
| Sales Tax Training | `shopworks-sales-tax-training.html` | Tax code application | Active |
| Notes System | `shopworks-notes.html` | Order notes best practices | Active |
| SanMar Purchasing | `sanmar-purchasing-guide.html` (+ `.css`/`.js`, screenshots in `images/sanmar-purchasing/`) | Purchasing blanks from SanMar via the ShopWorks API integration — cost line items, build/send PO, note the order. Based on Bradley's guide; embeds official ShopWorks Wistia videos | Active |

### Specialized Training Tools

| Tool | File | Purpose |
|------|------|---------|
| Sales Tax Code Trainer | `sales-tax-code-trainer.html` | Interactive tax code quiz |
| Cap Training | `cap-training.html` | Headwear product knowledge |
| Art Approval Guide | `art-approval-guide.html` | Design approval process |
| Google Review Guide | `google-review-guide.html` | Managing customer reviews |
| Thank You Card Guide | `thank-you-card-guide.html` | Customer appreciation |
| NWCA Language Reference | `nwca-language-reference.html` | Company terminology guide |
| Bonus Policy | `bonus-policy.html` | Commission structure |

### Interactive Games

| Game | File | Learning Objective |
|------|------|-------------------|
| Team Match Game | `team-match-game.html` | Staff recognition and roles |
| Get to Know Erik | `get-to-know-erik.html` | Company culture |

## Adriyella's Administrative Dashboard — REMOVED 2026-07-05

The entire Adriyella task/bonus/report suite (12 files: `adriyella-admin*.html`,
`adriyella-billing-dashboard.html`, `adriyella-bonus-*.html`, `adriyella-daily-*.html`,
`adriyella-task-*.{html,js}`, `adriyella-performance-utils.js`, `adriyella-test-guide.html`,
`adriyella-workflow-test.md`) was deleted — Adriyella no longer works at NWCA. The staff-dashboard
nav links ("Adriyella's Bonus Tracker", "Adriyella Task Admin") were removed too. Recoverable from
git history if ever needed. (Her name remains in sales-rep dropdowns/maps as historical CRM data.)

## Development Guidelines for Training Materials

### Visual Standards
1. **Color Scheme**
   - Primary: NWCA Green (#4cb354)
   - WSU Crimson (#981e32) for training headers
   - Professional blues/grays for dashboards

2. **Typography**
   - Font: Inter for all interfaces
   - Clear hierarchy with consistent sizing
   - High contrast for readability

3. **Layout Principles**
   - Mobile-responsive design
   - Clear navigation with breadcrumbs
   - Progress indicators for multi-step processes
   - Print-friendly versions where applicable

### Interactive Elements
1. **Feedback Systems**
   - Immediate validation for quiz answers
   - Progress bars and completion tracking
   - Success/error messages with clear actions

2. **Gamification**
   - Points and scoring systems
   - Achievement badges
   - Leaderboards (where appropriate)
   - Timed challenges

### Data Management
1. **Local Storage**
   - Training progress persistence
   - User preferences
   - Score history

2. **API Integration**
   - Connect to Caspio for user data
   - Heroku proxy for database operations
   - Real-time validation where needed

## Testing & Deployment

### Local Development
```bash
# Start local training server
node server.js
# OR
node simple-server.js

# Access at http://localhost:3001
```

### Testing Checklist
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness
- [ ] Print layout (for guides and manuals)
- [ ] Accessibility (WCAG 2.1 AA compliance)
- [ ] Progress saving/loading
- [ ] Error handling and recovery

### File Naming Conventions
- `[system]-[function].html` for training modules
- `[person]-[tool].html` for personal dashboards
- `[topic]-guide.html` for reference materials
- `[topic]-training.html` for interactive training

## Git Workflow Reference

For version control and deployment procedures, refer to:
- `claude-git-setup-instructions.md` - Complete Git workflow for this project

Key points:
- Work on feature branches
- Merge to develop for testing
- Deploy to main for production
- Follow established branch naming patterns

## API Testing

- **API Test Runner** (`api-test-runner.html`) - Tool for testing API endpoints

## Common Patterns

### Training Module Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="robots" content="noindex, nofollow">
    <title>[Module Name] - Northwest Custom Apparel</title>
    <link rel="icon" href="[NWCA Favicon URL]">
    <!-- Standard includes -->
</head>
<body>
    <!-- Navigation header -->
    <!-- Training content -->
    <!-- Progress tracking -->
    <!-- Interactive elements -->
</body>
</html>
```

### JavaScript Module Pattern
```javascript
class TrainingModule {
    constructor() {
        this.score = 0;
        this.progress = 0;
        this.loadProgress();
    }
    
    saveProgress() {
        localStorage.setItem('training_progress', JSON.stringify({
            score: this.score,
            progress: this.progress,
            timestamp: Date.now()
        }));
    }
}
```

## Security Considerations

1. **No sensitive data in frontend code**
2. **Validate all user inputs**
3. **Use HTTPS for all external resources**
4. **Implement proper authentication for admin tools**
5. **Regular security audits of training materials**

## Maintenance Notes

### Regular Updates Required
- Staff directory changes
- Policy updates
- Tax code modifications
- Product catalog changes
- Pricing structure updates

### Version Control
- Keep backup versions of critical training tools
- Document major changes in commit messages
- Test thoroughly before replacing production versions

## Support & Resources

### External Dependencies
- Font Awesome for icons
- Google Fonts (Inter)
- Caspio CDN for company assets
- EmailJS for notifications (where applicable)

### Company Resources
- Logo: `https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1`
- Favicon: `https://cdn.caspio.com/A0E15000/Safety%20Stripes/NWCA%20Favicon%20for%20TEAMNWCA.com.png?ver=1`

## Important Notes

1. **Training materials should be engaging and interactive** - Avoid wall-of-text approaches
2. **Always include navigation back to the hub** - Users should never get stuck
3. **Track completion and progress** - Helps identify training gaps
4. **Mobile-first design** - Many users access on tablets/phones
5. **Regular content reviews** - Keep information current and relevant

## Recent Updates

- **2026-07-10**: Added **Training Center** (`index.html` + `training-center.{js,css}`) — role-track directory of ALL training: static guides plus the Policies Hub **Training category fetched live** from the public proxy API (new hub modules appear with no deploy). Dashboard Training nav lands here; the old Office Assistant nav section folded in as a track (its Bonus Policy link now points at the hub `bonus-and-incentives` policy). dash-shell/art-hub tokens, external JS/CSS only. NOTE: /training is a PUBLIC mount — the Center lists only links, titles, and published-hub summaries.
- **2026-07-10**: Added SanMar Purchasing Guide (`sanmar-purchasing-guide.html`) from Bradley's training deck — 3-phase workflow, size-annotation cheat sheet, ShopWorks screenshots (SanMar account # redacted — /training is a public static mount), official ShopWorks Wistia videos (`fast.wistia.net` added to CSP frameSrc in server.js). Linked in staff-dashboard Training nav.
- **2025-08-15**: Added ShopWorks Embroidery Order Type training module
- **2025-08**: Enhanced Adriyella's dashboard suite with v2 daily tasks
- **2025-08**: Added NWCA Language Reference Card to Training Games Hub

---

*This documentation is maintained for Claude Code CLI to understand the training system architecture and assist with development and maintenance of training materials.*