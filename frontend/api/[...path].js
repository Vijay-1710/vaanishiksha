// Vercel Serverless Function to handle any direct API calls gracefully
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const url = (req.url || '').toLowerCase()

  if (url.includes('/auth/login') || url.includes('/auth/register')) {
    let body = req.body || {}
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch (e) {}
    }
    const isTeacher = (body.username && body.username.includes('teacher')) || body.role === 'teacher'
    return res.status(200).json({
      access_token: `demo-${isTeacher ? 'teacher' : 'student'}-jwt-token`,
      token_type: 'bearer',
    })
  }

  if (url.includes('/auth/me') || url.includes('/users/me')) {
    const authHeader = req.headers.authorization || ''
    if (authHeader.includes('teacher')) {
      return res.status(200).json({
        id: 101,
        email: 'teacher@vaanishiksha.edu',
        full_name: 'Dr. Ramesh Sharma',
        role: 'teacher',
        preferred_language: 'en',
        grade_level: 5,
      })
    }
    return res.status(200).json({
      id: 202,
      email: 'student@vaanishiksha.edu',
      full_name: 'Aarav Patel',
      role: 'student',
      preferred_language: 'hi',
      grade_level: 5,
    })
  }

  return res.status(200).json({ status: 'ok', message: 'Vaanishiksha API Demo Active' })
}
