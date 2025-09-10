interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  validate?: (value: any) => boolean;
}

// Define validation function
export const validateRequestBody = (body: Record<string, any>, rules: Record<string, ValidationRule>) => {
  const errors: Record<string, string> = {};

  for (const field in rules) {
    const value = body[field];
    const rule = rules[field];

    // Check if field is required
    if (rule.required && (value === undefined || value === null)) {
      errors[field] = `${field} is required`;
      continue;
    }

    // If value is provided, validate its type
    if (value !== undefined && rule.type && typeof value !== rule.type) {
      errors[field] = `${field} must be of type ${rule.type}`;
      continue;
    }

    // Validate string length (if applicable)
    if (rule.type === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors[field] = `${field} must be at least ${rule.minLength} characters long`;
        continue;
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors[field] = `${field} must be less than ${rule.maxLength} characters long`;
        continue;
      }
    }

    // Custom validation
    if (rule.validate && !rule.validate(value)) {
      errors[field] = `${field} failed custom validation`;
    }
  }

  return Object.keys(errors).length === 0 ? null : errors;
};
