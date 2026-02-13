"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Optional label shown in error UI to help identify which section failed */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.section ? `: ${this.props.section}` : ""}]`,
      error,
      info,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="cw-error-boundary">
          <div className="cw-error-boundary__icon">⚠</div>
          <div className="cw-error-boundary__text">
            {this.props.section
              ? `Something went wrong in ${this.props.section}.`
              : "Something went wrong."}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-pill"
            onClick={this.handleRetry}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
