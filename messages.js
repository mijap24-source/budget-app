// MESSAGES FOR THE CATEGORY POPUP
//
// getMessage(spent, budget, day, daysInMonth, isPastMonth)
//   spent        - euros spent in this category in the selected month
//   budget       - the category's monthly budget
//   day          - today's day of the month (only matters for the current month)
//   daysInMonth  - how many days the selected month has (28-31)
//   isPastMonth  - true if the selected month is already over
//
// It returns an object: { title, text, color }
// color is "green", "yellow" or "red" (use it to colour the message box)

function getMessage(spent, budget, day, daysInMonth, isPastMonth) {
    let left = budget - spent;
    let over = spent - budget;
    let daysLeft = daysInMonth - day;
    let percent = budget > 0 ? Math.round(spent / budget * 100) : 0;

    let daysText = daysLeft === 1 ? "1 day" : daysLeft + " days";

    let isEarly = day <= 10;
    let isLate = day >= 21;

    // "slightly over" = up to 5 EUR or 15% of the budget, whichever is larger
    let slightLimit = Math.max(5, Math.round(budget * 0.15));
    let isSlightlyOver = over > 0 && over <= slightLimit;
    let isWellOver = over > slightLimit;


    // ---------- BUDGET OF 0 ----------
    if (budget === 0) {
        if (spent === 0) {
            return {
                title: "No budget set",
                text: "You haven't planned any money for this category.",
                color: "green"
            };
        }
        if (spent <= 5) {
            return {
                title: "Unplanned spending",
                text: `${spent}€ spent here with no budget. Technically it's all over budget.`,
                color: "yellow"
            };
        }
        return {
            title: "Didn't see it coming?",
            text: "Ouch. Might want to plan for this next time?",
            color: "red"
        };
    }


    // ---------- PAST MONTHS ----------
    if (isPastMonth) {
        if (over <= 0) {
            return {
                title: "Finished under",
                text: `${left}€ left over at the end of the month.`,
                color: "green"
            };
        }
        if (isSlightlyOver) {
            return {
                title: "Finished over",
                text: `Ended ${over}€ above the limit.`,
                color: "red"
            };
        }
        return {
            title: "Finished well over",
            text: `Ended ${over}€ over, ${percent}% of the plan.`,
            color: "red"
        };
    }


    // ---------- CURRENT MONTH: OVER BUDGET ----------
    if (isSlightlyOver) {
        if (isEarly) {
            return {
                title: "That was quick",
                text: `Over budget by ${over}€ and it's only day ${day}.`,
                color: "red"
            };
        }
        return {
            title: "A little over",
            text: `${over}€ above the limit. Nobody's judging. Mostly.`,
            color: "red"
        };
    }

    if (isWellOver) {
        if (isEarly) {
            return {
                title: "Wow",
                text: `${over}€ over with ${daysText} to go. Bold.`,
                color: "red"
            };
        }
        if (isLate) {
            return {
                title: "Damage done",
                text: `${over}€ over. The month is nearly done, so at least the pain is short.`,
                color: "red"
            };
        }
        return {
            title: "Time to rethink",
            text: `${over}€ over. Might want to think over your life choices.`,
            color: "red"
        };
    }


    // ---------- CURRENT MONTH: 10% OR LESS LEFT ----------
    if (left <= budget * 0.1) {
        if (isLate) {
            return {
                title: "So close",
                text: `${left}€ left. You've nearly made it, so don't blow it now.`,
                color: "yellow"
            };
        }
        return {
            title: "Careful!",
            text: `Only ${left}€ left, and ${daysText} to go.`,
            color: "yellow"
        };
    }


    // ---------- CURRENT MONTH: NOTHING SPENT ----------
    if (spent === 0) {
        if (isLate) {
            return {
                title: "Suspiciously quiet",
                text: "Nothing spent this month. Impressive, or did you forget to log something?",
                color: "green"
            };
        }
        return {
            title: "Clean slate",
            text: "Nothing spent yet. Enjoy it while it lasts.",
            color: "green"
        };
    }


    // ---------- CURRENT MONTH: PACE ----------
    // compare the % of the budget used with the % of the month that has passed
    let timePercent = day / daysInMonth * 100;
    let difference = percent - timePercent;
    let tolerance = 10;

    if (difference > tolerance) {
        // spending faster than the month is passing
        if (isEarly) {
            return {
                title: "Strong start",
                text: `${percent}% used by day ${day}. Bold strategy.`,
                color: "yellow"
            };
        }
        return {
            title: "Keep an eye on it",
            text: `${percent}% gone and it's only day ${day}. Might want to slow down.`,
            color: "yellow"
        };
    }

    if (difference < -tolerance) {
        // spending slower than the month is passing
        return {
            title: "Good job!",
            text: `${percent}% used and the month is further along than that.`,
            color: "green"
        };
    }

    return {
        title: "Right on track",
        text: `${percent}% used, ${daysText} left. Just as planned.`,
        color: "green"
    };
}
