import { Component, type ReactNode } from "react";
import { captureError } from "../lib/errorReport";

interface Props {
  children: ReactNode;
}
interface State {
  crashed: boolean;
}

// Catches render-time crashes, buffers them for the /dev panel, and shows a
// reassuring fallback (data lives in localStorage, untouched by a render error).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error) {
    captureError({
      at: Date.now(),
      message: error.message,
      source: "boundary",
      stack: error.stack,
    });
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="crash-fallback">
          <p>Something broke. Your data is saved.</p>
          <button onClick={() => location.reload()}>Reload</button>
          <a href="?dev=1">Open diagnostics</a>
        </div>
      );
    }
    return this.props.children;
  }
}
