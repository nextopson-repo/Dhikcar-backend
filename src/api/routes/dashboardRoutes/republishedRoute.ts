import express from 'express';

import {
  CarRepublisherList,
  conformRepublishRequest,
  createRepublisher,
  getCarListUserRepublished,
  getUserRepublishedCars,
  removeFromRepublished,
  republishRequest,
  requestOwnerMarkAsSold,
  statusUpdate,
} from '@/api/controllers/Dashboard/RepublishedController';

const router = express.Router();

// POST /republisher/create
router.post('/create', createRepublisher);

// POST /republisher/request
router.post('/get-user-request', republishRequest);

// PUT /republisher/status
router.post('/update-status', statusUpdate);

// POST /republisher/my
router.post('/car-republisher-list', CarRepublisherList);

// GET /republisher/user-republished
router.post('/user-republished', getUserRepublishedCars);

// get property list user republished
router.post('/car-list-user-republished', getCarListUserRepublished);

// POST /republisher/remove
router.post('/remove', removeFromRepublished);

// POST /republisher/request-mark-as-sold
router.post('/request-mark-as-sold', requestOwnerMarkAsSold);

// POST /republisher/conform-mark-as-sold
router.post('/conform-mark-as-sold', conformRepublishRequest);

export default router;
