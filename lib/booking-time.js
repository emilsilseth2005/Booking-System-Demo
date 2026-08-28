const osloDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** @param {Date} date */
function osloDateTimeKey(date) {
  const parts = Object.fromEntries(
    osloDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`;
}

/**
 * @param {string} date
 * @param {string} time
 * @param {Date} [now]
 */
export function isBookingTimePast(date, time, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return true;
  return `${date.replaceAll("-", "")}${time.replace(":", "")}` <= osloDateTimeKey(now);
}
