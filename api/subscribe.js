export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body ?? {}
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }

  const apiKey = process.env.MAILCHIMP_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Mailchimp is not configured.' })
  }

  const server = apiKey.split('-')[1] // e.g. "us17"
  const auth = Buffer.from(`anystring:${apiKey}`).toString('base64')
  const baseUrl = `https://${server}.api.mailchimp.com/3.0`

  // Resolve audience/list ID — use env var if set, otherwise pick the first list
  let listId = process.env.MAILCHIMP_LIST_ID
  if (!listId) {
    const listsRes = await fetch(`${baseUrl}/lists?count=1`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    const listsData = await listsRes.json()
    listId = listsData.lists?.[0]?.id
    if (!listId) {
      return res.status(500).json({ error: 'No Mailchimp audience found.' })
    }
  }

  const subscribeRes = await fetch(`${baseUrl}/lists/${listId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email_address: email, status: 'subscribed' }),
  })

  const data = await subscribeRes.json()

  // "Member Exists" is not a failure — treat it as success
  if (subscribeRes.ok || data.title === 'Member Exists') {
    return res.status(200).json({ success: true })
  }

  return res.status(400).json({ error: data.detail ?? 'Subscription failed. Please try again.' })
}
