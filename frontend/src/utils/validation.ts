/**
 * Form validation utilities for the frontend
 */

// Common disposable email domains to block
const disposableEmailDomains = [
  '10minutemail.com', 'tempmail.com', 'throwawaymail.com', 'mailinator.com',
  'guerrillamail.com', 'sharklasers.com', 'yopmail.com', 'maildrop.cc',
  'temp-mail.org', 'dispostable.com', 'tempinbox.com', 'emailondeck.com',
  'mintemail.com', 'spamgourmet.com', 'trashmail.com', 'mailnesia.com',
  'mailcatch.com', 'jetable.org', 'getnada.com', 'tempr.email',
  'tempail.com', 'fakeinbox.com', 'tempmailer.com', 'temp-mail.ru',
  'mailinator.net', 'mailinator.org', 'mailinator.io',
  // Adding more temporary email services
  'flektel.com', 'tmpmail.org', 'tmpmail.net', 'tmpeml.com', 'temp-mail.io',
  'mohmal.com', 'improvmail.com', 'moakt.com', 'gmailnom.com', 'correotemporal.org',
  'dropmail.me', 'emailfake.com', 'zeroe.ml', '0box.eu', 'smailpro.com',
  'fakemail.net', 'mailpoof.com', 'emaildrop.io'
];

/**
 * Validates if the email format is correct
 */
export const isValidEmailFormat = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Check if email is from a disposable domain
 * @param email Email to check
 * @returns boolean indicating if email is from a disposable domain
 */
export const isDisposableEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  // Check against our list of known disposable domains
  if (disposableEmailDomains.some(disposableDomain => 
    domain === disposableDomain || domain.endsWith(`.${disposableDomain}`)
  )) {
    return true;
  }
  
  // Check for common patterns in temp email domain names
  const tempEmailPatterns = [
    'temp', 'disposable', 'throwaway', 'tempmail', 'tmpmail', 
    'fake', 'mailinator', 'minute', '10minute', 'hour', 
    'burner', 'guerrilla', 'dump', 'junk', 'trash',
    'melt', 'disappear', 'discard', 'one-time', 'temporary'
  ];
  
  for (const pattern of tempEmailPatterns) {
    if (domain.includes(pattern)) {
      return true;
    }
  }
  
  // Check for very short domains with numbers (often temporary services)
  if (/^[a-z0-9]{2,3}\.[a-z]{2,3}$/.test(domain) && /\d/.test(domain)) {
    return true;
  }
  
  return false;
};

/**
 * Comprehensive email validation
 */
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }
  
  if (!isValidEmailFormat(email)) {
    return { valid: false, error: 'Please enter a valid email format' };
  }
  
  if (isDisposableEmail(email)) {
    return { valid: false, error: 'Temporary or disposable email addresses are not allowed' };
  }
  
  return { valid: true };
};

/**
 * Password validation
 */
export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  
  // Check for at least one number and one letter
  if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one letter and one number' };
  }
  
  return { valid: true };
};

/**
 * Name validation
 */
export const validateName = (name: string, fieldName: string = 'Name'): { valid: boolean; error?: string } => {
  if (!name || name.trim() === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  
  if (name.length < 2) {
    return { valid: false, error: `${fieldName} must be at least 2 characters long` };
  }
  
  return { valid: true };
};

/**
 * OTP validation
 */
export const validateOTP = (otp: string): { valid: boolean; error?: string } => {
  if (!otp) {
    return { valid: false, error: 'Verification code is required' };
  }
  
  if (!/^\d{6}$/.test(otp)) {
    return { valid: false, error: 'Verification code must be 6 digits' };
  }
  
  return { valid: true };
}; 