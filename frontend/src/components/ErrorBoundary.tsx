import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React error:', error, errorInfo)
  }

  private handleReset = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('auth-storage')
    this.setState({ hasError: false, error: null })
    window.location.href = '/login'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full text-center border border-red-200 shadow-lg p-8">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 text-sm mb-4">
              An unexpected error occurred in the application.
            </p>
            {this.state.error && (
              <div className="bg-red-50 text-red-700 text-xs text-left p-3 rounded-lg font-mono mb-6 overflow-auto max-h-40 border border-red-200">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn btn-secondary text-sm"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="btn btn-primary text-sm"
              >
                Clear Session & Return to Login
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
