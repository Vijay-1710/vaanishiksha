import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import {
  DEMO_TEACHER,
  DEMO_STUDENT,
  DEMO_LECTURES,
  DEMO_NCERT_OVERVIEW,
  DEMO_NCERT_CHAPTERS,
  DEMO_WORKSHEET_CONTENT,
} from './mockData'

const envBaseUrl = (import.meta as any).env?.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: envBaseUrl,
  timeout: 3500, // 3.5s timeout before graceful offline fallback
})

// Attach Bearer token to all outgoing requests if token exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Helper to determine active demo user based on stored token or role
function getCurrentDemoUser() {
  const storedUserJson = localStorage.getItem('auth-storage')
  if (storedUserJson) {
    try {
      const parsed = JSON.parse(storedUserJson)
      if (parsed?.state?.user) return parsed.state.user
    } catch {
      // fallback
    }
  }
  const token = localStorage.getItem('token') || ''
  if (token.includes('teacher')) return DEMO_TEACHER
  return DEMO_STUDENT
}

// Fallback Mock Dispatcher
function resolveMockResponse(config: AxiosRequestConfig): any {
  const url = (config.url || '').toLowerCase()

  // 1. Auth endpoints
  if (url.includes('/auth/login') || url.includes('/auth/register')) {
    let role = 'student'
    if (typeof config.data === 'string') {
      try {
        const body = JSON.parse(config.data)
        if (body.username?.includes('teacher') || body.role === 'teacher') role = 'teacher'
      } catch {
        // ignore
      }
    }
    const token = `demo-${role}-jwt-token`
    return {
      access_token: token,
      token_type: 'bearer',
    }
  }

  if (url.includes('/auth/me') || url.includes('/users/me')) {
    return getCurrentDemoUser()
  }

  // 2. Lectures endpoints
  if (url.includes('/lectures/upload')) {
    return {
      id: Date.now(),
      title: 'Uploaded Science Lesson (Demo)',
      description: 'Recorded classroom session processed with automated transcription.',
      subject: 'General Science',
      grade_level: 5,
      original_language: 'en',
      created_at: new Date().toISOString(),
      has_transcript: true,
      available_languages: ['en', 'hi', 'ta'],
    }
  }

  // Dubbing endpoints
  if (url.match(/\/lectures\/\d+\/dub\/[a-z]{2}\/status/)) {
    const langMatch = url.match(/\/dub\/([a-z]{2})\/status/)
    const lang = langMatch ? langMatch[1] : 'hi'
    return {
      status: 'completed',
      target_language: lang,
      dubbed_audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=nature-sound-rain-112002.mp3',
      transcript_url: null,
    }
  }

  if (url.match(/\/lectures\/\d+\/dub\/[a-z]{2}/)) {
    const langMatch = url.match(/\/dub\/([a-z]{2})/)
    const lang = langMatch ? langMatch[1] : 'hi'
    return {
      id: Date.now(),
      lecture_id: 1,
      target_language: lang,
      status: 'completed',
      dubbed_audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=nature-sound-rain-112002.mp3',
      transcript_url: null,
    }
  }

  if (url.match(/\/lectures\/\d+/)) {
    const idMatch = url.match(/\/lectures\/(\d+)/)
    const id = idMatch ? Number(idMatch[1]) : 1
    const found = DEMO_LECTURES.find((l) => l.id === id) || DEMO_LECTURES[0]
    return found
  }

  if (url.includes('/lectures')) {
    return DEMO_LECTURES
  }

  // 3. NCERT Curriculum
  if (url.includes('/ncert/overview')) {
    return DEMO_NCERT_OVERVIEW
  }

  if (url.match(/\/ncert\/chapter\/[^/]+\/adopt/)) {
    return {
      lecture_id: 1,
      message: 'NCERT Chapter adopted successfully into interactive lesson repository.',
    }
  }

  if (url.match(/\/ncert\/chapter\/[^/]+/)) {
    const chId = url.split('/chapter/')[1]?.split('?')[0]
    const ch = DEMO_NCERT_CHAPTERS.find((c) => c.id === chId) || DEMO_NCERT_CHAPTERS[0]
    return ch
  }

  if (url.includes('/ncert/chapters')) {
    return DEMO_NCERT_CHAPTERS
  }

  // 4. Worksheets
  if (url.includes('/worksheets/generate')) {
    return {
      id: 101,
      lecture_id: 1,
      target_language: 'hi',
      status: 'completed',
      content_json: JSON.stringify(DEMO_WORKSHEET_CONTENT),
      content: DEMO_WORKSHEET_CONTENT,
      created_at: new Date().toISOString(),
    }
  }

  if (url.match(/\/worksheets\/lecture\/\d+/)) {
    return [
      {
        id: 101,
        lecture_id: 1,
        target_language: 'en',
        status: 'completed',
        created_at: '2026-09-30T10:15:00Z',
      },
      {
        id: 102,
        lecture_id: 1,
        target_language: 'hi',
        status: 'completed',
        created_at: '2026-09-30T10:16:00Z',
      },
    ]
  }

  if (url.match(/\/worksheets\/\d+/)) {
    return {
      id: 101,
      lecture_id: 1,
      target_language: 'hi',
      status: 'completed',
      content_json: JSON.stringify(DEMO_WORKSHEET_CONTENT),
      content: DEMO_WORKSHEET_CONTENT,
      created_at: new Date().toISOString(),
    }
  }

  // 5. Live Classrooms
  if (url.includes('/live/rooms/active')) {
    return [
      {
        room_code: 'LIVE-2026',
        title: 'Master Live Science: Water Cycle & Rain (जल चक्र)',
        subject: 'General Science',
        grade_level: 5,
        original_language: 'en',
        teacher_id: 101,
        teacher_name: 'Dr. Ramesh Sharma',
        student_count: 16,
        created_at: new Date().toISOString(),
        is_active: true,
      },
    ]
  }

  if (url.includes('/live/rooms/create')) {
    return {
      room_code: 'LIVE-2026',
      title: 'Interactive Live Classroom',
      teacher_name: 'Dr. Ramesh Sharma',
    }
  }

  if (url.match(/\/live\/rooms\/[^/]+\/end/)) {
    return {
      lecture_id: 1,
      message: 'Classroom archived and converted to permanent lecture with auto-generated worksheet.',
    }
  }

  if (url.match(/\/live\/rooms\/[^/]+/)) {
    const code = url.split('/live/rooms/')[1]?.split('?')[0] || 'LIVE-2026'
    return {
      room_code: code,
      title: 'Master Live Science: Water Cycle & Rain',
      subject: 'General Science',
      grade_level: 5,
      original_language: 'en',
      teacher_id: 101,
      teacher_name: 'Dr. Ramesh Sharma',
      student_count: 16,
      created_at: new Date().toISOString(),
      is_active: true,
    }
  }

  // Generic empty array or object fallback
  return []
}

// Intercept responses: if Vercel returns HTML (SPA rewrite), replace with mock data
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // If Vercel or proxy returned HTML for an API request, treat as offline and serve mock data
    if (
      typeof response.data === 'string' &&
      (response.data.includes('<!doctype html>') ||
        response.data.includes('<html') ||
        response.data.includes('Vite App'))
    ) {
      const mockResult = resolveMockResponse(response.config)
      return {
        ...response,
        data: mockResult,
        status: 200,
      }
    }
    return response
  },
  (error) => {
    // Fallback on Network Error, 404, 405 Method Not Allowed, or 500
    if (
      error.code === 'ECONNABORTED' ||
      !error.response ||
      error.response.status === 404 ||
      error.response.status === 405 ||
      error.response.status >= 500
    ) {
      const mockResult = resolveMockResponse(error.config || {})
      return Promise.resolve({
        data: mockResult,
        status: 200,
        statusText: 'OK (Offline Demo Mode)',
        headers: {},
        config: error.config || {},
      })
    }
    return Promise.reject(error)
  }
)

export default api
