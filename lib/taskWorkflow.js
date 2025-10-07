export const STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  pending_verification: "Pending Verification",
  done: "Done",
  verified: "Verified",
};

export const normalizeTaskStatus = (status) => (status ? String(status).toLowerCase() : "not_started");

const makeOption = (value, reason = "") => ({
  value,
  label: STATUS_LABELS[value] || value,
  reason,
});

const dedupeOptions = (options = []) => {
  const seen = new Set();
  return options.filter((option) => {
    if (!option?.value) return false;
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

export const getTaskStatusOptions = (currentStatus, { isDoer, isObserver } = {}) => {
  const status = normalizeTaskStatus(currentStatus);
  const options = [];

  if (isDoer) {
    if (status === "not_started") {
      options.push(makeOption("in_progress", "Begin working on this task"));
    }
    if (status === "in_progress") {
      options.push(makeOption("pending_verification", "Request observer review"));
    }
  }

  if (isObserver) {
    if (status === "pending_verification") {
      options.push(
        makeOption("in_progress", "Return to doer for more work"),
        makeOption("done", "Mark as done"),
        makeOption("verified", "Verify and close")
      );
    }
    if (status === "done") {
      options.push(
        makeOption("pending_verification", "Send back for final checks"),
        makeOption("verified", "Consider fully verified")
      );
    }
    if (status === "verified") {
      options.push(
        makeOption("in_progress", "Reopen for additional work"),
        makeOption("pending_verification", "Move back to review")
      );
    }
  }

  return dedupeOptions(options);
};

export const getSprintStatusOptions = (currentStatus, { isDoer } = {}) => {
  if (!isDoer) return [];

  const status = normalizeTaskStatus(currentStatus);
  const options = [];

  if (status === "not_started") {
    options.push(makeOption("in_progress", "Start this sprint"));
  }
  if (status === "in_progress") {
    options.push(makeOption("done", "Sprint ready for review"));
  }
  if (status === "done") {
    options.push(makeOption("in_progress", "Reopen sprint"));
  }

  return dedupeOptions(options);
};
