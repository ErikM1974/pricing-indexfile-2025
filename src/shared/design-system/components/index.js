// Design System Components - Main Export
// Phase 6: UI Redesign

// Import all style constants for getAllComponentStyles function
import { buttonStyles } from './Button.js';
import { cardStyles } from './Card.js';
import { formStyles } from './Form.js';
import { modalStyles } from './Modal.js';
import { layoutStyles } from './Layout.js';
import { toastStyles } from './Toast.js';
import { loadingStyles } from './Loading.js';
import { tabStyles } from './Tabs.js';
import { Tooltip } from './Tooltip.js';
import { Footer } from './Footer.js';

// Button components
export {
  Button,
  ButtonGroup,
  IconButton,
  createButton,
  createButtonGroup,
  createIconButton,
  buttonStyles
} from './Button.js';

// Card components
export {
  Card,
  CardGrid,
  createCard,
  createCardGrid,
  cardStyles
} from './Card.js';

// Form components
export {
  FormField,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
  createTextInput,
  createTextarea,
  createSelect,
  createCheckbox,
  createRadioGroup,
  formStyles
} from './Form.js';

// Modal components
export {
  Modal,
  confirm,
  alert,
  prompt,
  modalStyles
} from './Modal.js';

// Layout components
export {
  Grid,
  Stack,
  Container,
  Spacer,
  createGrid,
  createStack,
  createContainer,
  createSpacer,
  layoutStyles
} from './Layout.js';

// Toast notifications
export {
  Toast,
  ToastContainer,
  showToast,
  toastStyles
} from './Toast.js';

// Loading components
export {
  Spinner,
  Skeleton,
  LoadingOverlay,
  createSpinner,
  createSkeleton,
  createLoadingOverlay,
  loadingStyles
} from './Loading.js';

// Tabs component
export {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  createTabs,
  tabStyles
} from './Tabs.js';

// Tooltip component
export {
  Tooltip,
  createTooltip
} from './Tooltip.js';

// Footer component
export {
  Footer,
  createFooter
} from './Footer.js';

// Aggregate all component styles
export function getAllComponentStyles() {
  return [
    buttonStyles,
    cardStyles,
    formStyles,
    modalStyles,
    layoutStyles,
    toastStyles,
    loadingStyles,
    tabStyles,
    Tooltip.getStyles(),
    Footer.getStyles()
  ].join('\n\n');
}

// Initialize all components
export function initializeComponents() {
  // Add component styles to document
  const styleElement = document.createElement('style');
  styleElement.id = 'design-system-components';
  styleElement.textContent = getAllComponentStyles();
  document.head.appendChild(styleElement);
  
  // Initialize toast container
  import('./Toast.js').then(({ initializeToasts }) => {
    initializeToasts();
  });
  
  // Log initialization
  console.log('[Design System] Components initialized');
}