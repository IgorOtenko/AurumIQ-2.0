"use client";

import { Component, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

// React's error-boundary contract requires a class component (no functional
// equivalent in React 19) — this is the one place class components are used.
class ErrorBoundaryClass extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(error: Error) {
    if (typeof window !== "undefined") {
      console.error(`[SectionWrapper:${this.props.title}]`, error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card border border-rose-500/30 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-rose-400 mb-2">
            {this.props.title}
          </div>
          <div className="text-sm text-rose-300">
            Section failed to load — {this.state.message ?? "unknown error"}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SectionWrapper(props: Props) {
  return <ErrorBoundaryClass {...props} />;
}
