import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Heart, RefreshCw, AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#FFF9F9] flex flex-col items-center justify-center p-4 select-none">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-rose-100 shadow-[0_12px_40px_rgba(244,63,94,0.15)] text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 animate-gentle-pulse">
              <Heart className="w-7 h-7 fill-rose-400 text-rose-500" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Something went wrong ❤️
            </h2>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-700 font-medium flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>Your proposal draft and data are safe.</span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              {typeof this.state.error?.message === 'string'
                ? this.state.error.message
                : (typeof this.props.fallbackMessage === 'string'
                    ? this.props.fallbackMessage
                    : 'A temporary display issue occurred. Please retry to continue.')}
            </p>

            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-3.5 px-6 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload LoveLetter</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
