# OpenInsight

> Open Business Insights Agent

> [!WARNING]
> **Lot of the code was written by AI**, this is an experiment.

## TUI Mode

<img width="3610" height="2452" alt="CleanShot 2026-07-26 at 14 48 18@2x" src="https://github.com/user-attachments/assets/33d79612-6290-4b81-8500-66633c3916ff" />

## Web Mode

<img width="3984" height="2696" alt="CleanShot 2026-07-26 at 14 49 50@2x" src="https://github.com/user-attachments/assets/159b74d9-4517-4449-8bd3-371dc90b941e" />

## Quick Start

Install with Homebrew:

```bash
brew install arjunkomath/tap/openinsight
```

Or install from npm (a prebuilt binary is downloaded for your platform, no Bun
required):

```bash
# 1. Install
npm install -g openinsight

# Set your OpenRouter API key
export OPENROUTER_KEY=sk-...

# Run
openinsight
```

### Use Claude Code

OpenInsight can use an existing [Claude Code](https://code.claude.com/docs/en/setup)
login instead of OpenRouter. Install Claude Code 2.1.205 or newer, authenticate it,
and opt in with `--claude`:

```bash
claude auth login
openinsight --claude

# Claude also works with the web UI
openinsight --claude --web
```

OpenInsight verifies that the `claude` executable is in `PATH` before starting.
It runs each inference in non-interactive plan mode with all built-in and MCP tools
disabled; the database schema and query context are sent over stdin. The default
model is `opus` and can be changed with `OPENINSIGHT_CLAUDE_MODEL`:

```bash
OPENINSIGHT_CLAUDE_MODEL=sonnet openinsight --claude
```

For a persistent provider choice, set `OPENINSIGHT_AI_PROVIDER=claude` instead
of passing `--claude`. OpenRouter remains the default provider.

---

Made with ❤️ for data exploration
