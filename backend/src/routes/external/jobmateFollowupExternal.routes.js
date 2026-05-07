import { Router } from 'express'
import { receiveJobmateFollowup } from '../../controllers/external/jobmateFollowupExternal.controller.js'

const router = Router()

router.post('/jobmate-followup', receiveJobmateFollowup)

export default router