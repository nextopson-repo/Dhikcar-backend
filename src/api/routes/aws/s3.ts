import express from 'express';
import { deleteObjectFromBucket, generateUploadUrl, getDocumentFromBucket } from '@/api/controllers/s3/cloudinaryController';

const Router = express.Router();

// Public routes
Router.post('/imgtokey', generateUploadUrl);
Router.post('/keytoimg', getDocumentFromBucket);

// Protected route (optional auth)
Router.post('/delete', deleteObjectFromBucket);

export default Router;
