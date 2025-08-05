import { useState, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Start Day Timing Helper                                            */
/* ------------------------------------------------------------------ */
const useStartDayTiming = (openCloseTimes, selectedDate, dayOpenedAt, viewUserId) => {
  const [canStartDay, setCanStartDay] = useState(false);

  useEffect(() => {
    if (viewUserId || dayOpenedAt) {
      setCanStartDay(false);
      return;
    }

    // Bypass time window for testing: always true if not opened
    setCanStartDay(true); // Always active for testing

    // Original logic (commented for bypass)
    /*
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    if (selectedDate !== today) {
      setCanStartDay(false);
      return;
    }

    const dayOpenDateTime = new Date(`${selectedDate}T${openCloseTimes.dayOpenTime}`);
    const tenMinutesLater = new Date(dayOpenDateTime.getTime() + 10 * 60 * 1000);

    setCanStartDay(now >= dayOpenDateTime && now <= tenMinutesLater);

    const interval = setInterval(() => {
      const current = new Date();
      setCanStartDay(current >= dayOpenDateTime && current <= tenMinutesLater);
    }, 1000);

    return () => clearInterval(interval);
    */
  }, [openCloseTimes, selectedDate, dayOpenedAt, viewUserId]);

  return { canStartDay };
};

export default useStartDayTiming;