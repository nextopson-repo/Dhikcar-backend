import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';

import { ValidationError } from './errorHandler';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      return next(new ValidationError(errorMessage));
    }
    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  pagination: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string(),
  }),

  id: Joi.object({
    id: Joi.string().required(),
  }),

  search: Joi.object({
    query: Joi.string().min(1).required(),
    filters: Joi.object().pattern(Joi.string(), Joi.any()),
  }),

  dateRange: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  }),

  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }),

  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    zipCode: Joi.string()
      .pattern(/^\d{5}(-\d{4})?$/)
      .required(),
  }),

  contact: Joi.object({
    email: Joi.string().email().required(),
    phone: Joi.string()
      .pattern(/^\+?[\d\s-]{10,}$/)
      .required(),
  }),
};
