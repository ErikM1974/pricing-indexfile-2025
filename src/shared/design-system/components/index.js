// Design System Components - Main Export
// Phase 6: UI Redesign

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
    tabStyles
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