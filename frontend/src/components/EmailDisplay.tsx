import React from 'react';

interface EmailDisplayProps {
  email: string;
  style?: 'full' | 'username' | 'masked';
  className?: string;
}

const EmailDisplay: React.FC<EmailDisplayProps> = ({ 
  email, 
  style = 'full',
  className = '' 
}) => {
  if (!email) return null;
  
  let displayText = email;
  
  if (style === 'username') {
    // Extract just the username part before @
    displayText = email.split('@')[0];
  } else if (style === 'masked') {
    // Create a partially masked email for privacy
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? `${username.charAt(0)}${'*'.repeat(username.length - 2)}${username.charAt(username.length - 1)}`
      : username;
    displayText = `${maskedUsername}@${domain}`;
  }
  
  return (
    <span className={`inline-flex items-center ${className}`}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-4 w-4 mr-1 text-gray-500" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
        />
      </svg>
      <span className="truncate" title={email}>
        {displayText}
      </span>
    </span>
  );
};

export default EmailDisplay; 