export const receiveJobmateFollowup = async (req, res) => {
  try {
    const expectedSecret = process.env.JOBMATE_FOLLOWUP_WEBHOOK_SECRET
    const receivedSecret = req.headers['x-jobmate-secret']

    if (expectedSecret && receivedSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized follow-up webhook'
      })
    }

    const {
      followUpLogId,
      type,
      phone,
      recipientName,
      jobTitle,
      companyName,
      message,
      metadata = {}
    } = req.body

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'phone and message are required'
      })
    }

    console.log('[external-jobmate-followup] received', {
      followUpLogId,
      type,
      phone,
      recipientName,
      jobTitle,
      companyName,
      metadata
    })

    // V1: receiver only. Later we wire this to WhatsApp sender / follow-up scheduler.
    return res.status(200).json({
      success: true,
      followupId: followUpLogId || `jobmate_${Date.now()}`,
      messageId: '',
      status: 'received'
    })
  } catch (error) {
    console.error('[external-jobmate-followup] failed', error)
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}