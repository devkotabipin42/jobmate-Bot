import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Something went wrong",
    };
  }

  componentDidCatch(error, info) {
    console.error("Dashboard crashed:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5 text-slate-950 dark:bg-slate-950 dark:text-white">
        <div className="max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl dark:border-red-500/20 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle size={28} />
          </div>

          <h1 className="mt-5 text-2xl font-black">
            Dashboard मा समस्या आयो
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Page crash भयो, तर data safe छ। कृपया refresh गर्नुहोस्।
          </p>

          <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            {this.state.errorMessage}
          </p>

          <button
            onClick={this.handleReload}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 dark:bg-white dark:text-slate-950"
          >
            <RefreshCcw size={16} />
            Refresh Dashboard
          </button>
        </div>
      </div>
    );
  }
}
