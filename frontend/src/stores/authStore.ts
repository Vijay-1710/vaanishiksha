import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

export interface User {
  id: number
  email: string
  full_name: string
  role: 'teacher' | 'student'
  preferred_language?: string
  grade_level?: number
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      
      setAuth: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token })
      },
      
      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null })
      },
      
      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me')
          set({ user: response.data })
        } catch (error) {
          set({ user: null, token: null })
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
