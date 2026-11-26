// SPDX-License-Identifier: GPL-3.0-only
//! Line-delimited JSON commands accepted by the overlay socket, and the mapping
//! from Claude Code hook events to those commands.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum Command {
    /// Change the persistent expression Capri returns to after reactions.
    Expression { id: String },
    /// Show frames in order, then return to the persistent expression.
    React { frames: Vec<Frame> },
    Quit,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Frame {
    pub id: String,
    pub ms: u64,
}

pub fn frame(id: &str, ms: u64) -> Frame {
    Frame { id: id.into(), ms }
}

pub fn expression(id: &str) -> Command {
    Command::Expression { id: id.into() }
}

pub fn react(frames: &[(&str, u64)]) -> Command {
    Command::React { frames: frames.iter().map(|(id, ms)| frame(id, *ms)).collect() }
}

pub fn wink() -> Command {
    react(&[("idle-wink_half", 70), ("idle-wink_closed", 160), ("idle-wink_half", 70)])
}

pub fn socket_path() -> PathBuf {
    let base = std::env::var_os("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    base.join("capri-overlay.sock")
}

/// Translate one Claude Code hook payload into avatar commands.
/// Unknown events map to nothing, so new hook types never break the overlay.
pub fn from_claude_hook(event: &Value) -> Vec<Command> {
    let name = event.get("hook_event_name").and_then(Value::as_str).unwrap_or("");
    let tool = event.get("tool_name").and_then(Value::as_str).unwrap_or("");
    match name {
        "SessionStart" => vec![expression("neutral"), wink()],
        "UserPromptSubmit" => vec![expression("attentive")],
        "PreToolUse" => vec![expression(tool_expression(tool))],
        "Notification" => {
            let text = [
                event.get("notification_type").and_then(Value::as_str).unwrap_or(""),
                event.get("message").and_then(Value::as_str).unwrap_or(""),
            ]
            .join(" ")
            .to_lowercase();
            if text.contains("permission") || text.contains("approv") {
                vec![expression("concerned"), react(&[("surprised", 700)])]
            } else {
                vec![expression("attentive")]
            }
        }
        // Finished a turn: celebrate for a while, then settle.
        "Stop" => vec![expression("neutral"), react(&[("happy", 20_000)])],
        "PreCompact" => vec![react(&[("sleepy", 2_500)])],
        "SessionEnd" => vec![expression("sleepy")],
        _ => vec![],
    }
}

fn tool_expression(tool: &str) -> &'static str {
    match tool {
        "Edit" | "Write" | "MultiEdit" | "NotebookEdit" | "Bash" => "focused",
        "Agent" | "Task" => "smirk",
        "AskUserQuestion" => "attentive",
        _ => "thinking",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn commands_round_trip_as_tagged_json() {
        let line = serde_json::to_string(&react(&[("happy", 500)])).unwrap();
        assert_eq!(line, r#"{"cmd":"react","frames":[{"id":"happy","ms":500}]}"#);
        assert_eq!(serde_json::from_str::<Command>(r#"{"cmd":"quit"}"#).unwrap(), Command::Quit);
    }

    #[test]
    fn tools_choose_working_expressions() {
        let edit = json!({"hook_event_name": "PreToolUse", "tool_name": "Edit"});
        assert_eq!(from_claude_hook(&edit), vec![expression("focused")]);
        let read = json!({"hook_event_name": "PreToolUse", "tool_name": "Grep"});
        assert_eq!(from_claude_hook(&read), vec![expression("thinking")]);
    }

    #[test]
    fn permission_notifications_look_concerned() {
        let event = json!({
            "hook_event_name": "Notification",
            "message": "Claude needs your permission to use Bash"
        });
        assert_eq!(from_claude_hook(&event)[0], expression("concerned"));
    }

    #[test]
    fn unknown_events_are_ignored() {
        assert!(from_claude_hook(&json!({"hook_event_name": "Future"})).is_empty());
        assert!(from_claude_hook(&json!({})).is_empty());
    }
}
