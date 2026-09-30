// Vercel Serverless Function to handle API and live classroom real-time sync
const globalStore = global._vaanishiksha_store || (global._vaanishiksha_store = {
  rooms: {},
  messages: {},
})

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const url = (req.url || '').toLowerCase()

  // 1. Auth endpoints
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

  // 2. Live Classroom Real-Time Synchronization Endpoints
  if (url.includes('/live/rooms/create')) {
    let body = req.body || {}
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch (e) {}
    }
    const code = (body.room_code || 'LIVE-2026').toUpperCase()
    const room = {
      room_code: code,
      title: body.title || 'Master Live Science: Water Cycle & Rain (जल चक्र)',
      subject: body.subject || 'General Science',
      grade_level: body.grade_level || 5,
      teacher_name: 'Dr. Ramesh Sharma',
      teacher_id: 101,
      is_active: true,
      created_at: new Date().toISOString(),
    }
    globalStore.rooms[code] = room
    return res.status(200).json(room)
  }

  if (url.match(/\/live\/rooms\/[^/]+\/end/)) {
    return res.status(200).json({
      lecture_id: 1,
      message: 'Classroom archived and converted to permanent lecture with auto-generated worksheet.',
    })
  }

  if (url.includes('/broadcast')) {
    const codeMatch = url.match(/\/live\/rooms\/([^/]+)\/broadcast/)
    const roomCode = (codeMatch ? codeMatch[1] : 'LIVE-2026').toUpperCase()
    let payload = req.body || {}
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload) } catch (e) {}
    }

    if (!globalStore.messages[roomCode]) {
      globalStore.messages[roomCode] = []
    }
    globalStore.messages[roomCode].push(payload)
    if (globalStore.messages[roomCode].length > 100) {
      globalStore.messages[roomCode].shift()
    }
    return res.status(200).json({ status: 'broadcasted', id: payload.id })
  }

  if (url.includes('/sync')) {
    const codeMatch = url.match(/\/live\/rooms\/([^/]+)\/sync/)
    const roomCode = (codeMatch ? codeMatch[1] : 'LIVE-2026').toUpperCase()
    const queryIdx = req.url.indexOf('?')
    const params = new URLSearchParams(queryIdx > -1 ? req.url.substring(queryIdx) : '')
    const after = parseInt(params.get('after') || '0', 10)

    const list = globalStore.messages[roomCode] || []
    const newItems = list.filter((m) => m && m.timestamp > after)
    return res.status(200).json(newItems)
  }

  if (url.includes('/live/rooms/active')) {
    const activeRooms = Object.values(globalStore.rooms).filter(r => r.is_active)
    if (activeRooms.length > 0) return res.status(200).json(activeRooms)
    return res.status(200).json([
      {
        room_code: 'LIVE-2026',
        title: 'Master Live Science: Water Cycle & Rain (जल चक्र)',
        subject: 'General Science',
        grade_level: 5,
        original_language: 'en',
        teacher_id: 101,
        teacher_name: 'Dr. Ramesh Sharma',
        student_count: 14,
        created_at: new Date().toISOString(),
        is_active: true,
      },
    ])
  }

  if (url.match(/\/live\/rooms\/[^/]+/)) {
    const codeMatch = url.match(/\/live\/rooms\/([^/]+)/)
    const code = (codeMatch ? codeMatch[1] : 'LIVE-2026').toUpperCase().split('?')[0]
    const found = globalStore.rooms[code] || {
      room_code: code,
      title: 'Master Live Science: Water Cycle & Rain (जल चक्र)',
      subject: 'General Science',
      grade_level: 5,
      original_language: 'en',
      teacher_id: 101,
      teacher_name: 'Dr. Ramesh Sharma',
      student_count: 14,
      created_at: new Date().toISOString(),
      is_active: true,
    }
    return res.status(200).json(found)
  }

  return res.status(200).json({ status: 'ok', message: 'Vaanishiksha API Demo Active' })
}
