import { Request, Response } from 'express';

export interface ValidationConfig {
  field: string;
  repository: any;
  errorMessage: string;
}

export const validateAndFetchEntities = async (req: Request, res: Response, fieldsToValidate: ValidationConfig[]) => {
  const results: Record<string, any> = {};

  for (const config of fieldsToValidate) {
    const { field, repository, errorMessage } = config;
    const fieldValue = req.body[field];

    if (!fieldValue) {
      res.status(400).json({ status: 'error', message: errorMessage });
      return null;
    }

    if (repository) {
      const entity = await repository.findOne({ where: { id: fieldValue } });

      if (!entity) {
        res.status(500).json({ status: 'error', message: `${field} not found` });
        return null;
      }

      results[field] = entity;
    }
  }

  return results;
};
