import express from 'express';

import {
  getAllCities,
  getCarFilterData,
  getCities,
  getLocalities,
  getPopularCities,
  getStates,
  uploadLocationDropdown,
  userRequirements,
} from '@/api/controllers/dropdown/DropdownController';
import { imageFilter } from '@/api/controllers/dropdown/DropdownController';
import { uploadCarDetailsDropdown } from '@/api/controllers/dropdown/DropdownController';
const Router = express.Router();

Router.post('/userRequirements', userRequirements);
Router.post('/image-filter', imageFilter);
Router.post('/upload-car-details-dropdown', uploadCarDetailsDropdown);
Router.post('/location', uploadLocationDropdown);
Router.get('/all-cities', getAllCities);
Router.post('/car-filter-data', getCarFilterData);

// New hierarchical location routes
Router.get('/states', getStates);
Router.get('/popular-cities', getPopularCities);
Router.post('/cities', getCities);
Router.post('/localities', getLocalities);

export default Router;
