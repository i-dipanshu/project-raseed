// Google Color Palette Constants - Official Google Brand Colors
export const GoogleColors = {
  blue: '#4285F4',      // Google Blue - RGB: 66, 133, 244
  red: '#EA4335',       // Google Red - RGB: 234, 67, 53
  yellow: '#FBBC05',    // Google Yellow - RGB: 251, 188, 5
  green: '#34A853',     // Google Green - RGB: 52, 168, 83
  
  // Variations for different UI states
  blueLight: '#5A95F5',
  blueDark: '#3367D6',
  
  redLight: '#F28B82',
  redDark: '#D33B2C',
  
  yellowLight: '#FCE8B2',
  yellowDark: '#F9AB00',
  
  greenLight: '#81C995',
  greenDark: '#137333',
  
  // Neutral colors
  gray: {
    50: '#F8F9FA',
    100: '#F1F3F4',
    200: '#E8EAED',
    300: '#DADCE0',
    400: '#BDC1C6',
    500: '#9AA0A6',
    600: '#80868B',
    700: '#5F6368',
    800: '#3C4043',
    900: '#202124',
  }
};

// Semantic color mappings
export const SemanticColors = {
  primary: GoogleColors.blue,
  primaryLight: GoogleColors.blueLight,
  primaryDark: GoogleColors.blueDark,
  
  success: GoogleColors.green,
  successLight: GoogleColors.greenLight,
  successDark: GoogleColors.greenDark,
  
  warning: GoogleColors.yellow,
  warningLight: GoogleColors.yellowLight,
  warningDark: GoogleColors.yellowDark,
  
  danger: GoogleColors.red,
  dangerLight: GoogleColors.redLight,
  dangerDark: GoogleColors.redDark,
  
  // Category colors for expenses
  categories: {
    dining: GoogleColors.red,
    groceries: GoogleColors.green,
    transport: GoogleColors.blue,
    electronics: GoogleColors.blue,
    shopping: GoogleColors.yellow,
    utilities: GoogleColors.gray[600],
    other: GoogleColors.gray[500],
  }
}; 